import { Request, Response } from 'express';
import { Preference } from 'mercadopago';
import client from '../config/mercadoPagoClient';
import {
  guardarDonacion,
  obtenerDonacionesUsuario,
  obtenerTodasLasDonaciones,
  obtenerDonacionesPorGrupo,
  obtenerDonacionesFiltradas,
  obtenerTotalesPorPeriodo,
  obtenerEstadisticasGlobales
} from '../services/donacionesService';
import pool from '../db';
import { obtenerPagoPorId } from '../services/mercadoPagoService';
import { enviarEmailConfirmarDonacion } from '../services/emailConfirmarDonacion';
import { AuthService } from '../services/authService';

/** Crear una preferencia de pago para donación en Mercado Pago */
export const CrearPreferenciaDonacion = async (req: Request, res: Response) => {
  const { monto, descripcion, email, nombre, id_grupo } = req.body;
  const usuarioId = req.user?.id_usuario

  if (!monto) {
    return res.status(400).json({
      error: 'Faltan datos requeridos para crear la preferencia de donación'
    });
  }

  // Si no está autenticado, requiere email y nombre
  // if (!usuarioId && (!email || !nombre)) {
  //   return res.status(400).json({
  //     error: 'Para donaciones sin autenticación, se requiere email y nombre'
  //   });
  // }

  const preference = new Preference(client);

  try {
    const preferenceData = await preference.create({
      body: {
        items: [
          {
            id: `donacion_${usuarioId || email}_${Date.now()}`,
            title: descripcion,
            quantity: 1,
            unit_price: parseFloat(monto),
          }
        ],
        metadata: {
          usuario_id: usuarioId || null,
          tipo: 'donacion',
          email: email || null,
          nombre: nombre || null,
          id_grupo: id_grupo || null,
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/pago-exito-donacion`,
          failure: `${process.env.FRONTEND_URL}/donaciones/fallido`,
          pending: `${process.env.FRONTEND_URL}/donaciones/pendiente`
        },
        auto_return: "approved" as const,
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`
      }
    });

    res.status(200).json({
      preferenceId: preferenceData.id,
      preferenceUrl: preferenceData.init_point,
    });
  } catch (error) {
    console.error("Error al crear la preferencia de donación:", error);
    res.status(500).send("Error al crear la preferencia de pago");
  }
};

/** Obtener donaciones del usuario autenticado */
export const ObtenerDonacionesUsuario = async (req: Request, res: Response) => {
  const usuarioId = req.user?.id_usuario;

  if (!usuarioId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  try {
    const donaciones = await obtenerDonacionesUsuario(usuarioId);
    res.status(200).json(donaciones);
  } catch (error) {
    console.error('Error obteniendo donaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/** Obtener todas las donaciones (admin y sec general) */
export const ObtenerTodasLasDonaciones = async (req: Request, res: Response) => {
  try {
    const donaciones = await obtenerTodasLasDonaciones();
    res.status(200).json(donaciones);
  } catch (error) {
    console.error('Error obteniendo todas las donaciones:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/** Obtener donaciones por grupo (secretaria grupal) */
export const ObtenerDonacionesPorGrupo = async (req: Request, res: Response) => {
  const usuarioId = req.user?.id_usuario;

  if (!usuarioId) {
    return res.status(401).json({ error: 'Usuario no autenticado' });
  }

  try {
    const donaciones = await obtenerDonacionesPorGrupo(usuarioId);
    res.status(200).json(donaciones);
  } catch (error) {
    console.error('Error obteniendo donaciones por grupo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/** Obtener donaciones filtradas (para admin y secretaria) */
export const ObtenerDonacionesFiltradas = async (req: Request, res: Response) => {
  try {
    const { usuarioId, estado, fechaDesde, fechaHasta, metodoPago } = req.query;

    const filtros = {
      usuarioId: usuarioId ? parseInt(usuarioId as string) : undefined,
      estado: estado as string,
      fechaDesde: fechaDesde as string,
      fechaHasta: fechaHasta as string,
      metodoPago: metodoPago as string
    };

    const donaciones = await obtenerDonacionesFiltradas(filtros);
    res.status(200).json(donaciones);
  } catch (error) {
    console.error('Error obteniendo donaciones filtradas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/** Obtener totales por periodo */
export const ObtenerTotalesPorPeriodo = async (req: Request, res: Response) => {
  try {
    const { fechaDesde, fechaHasta } = req.query;

    if (!fechaDesde || !fechaHasta) {
      return res.status(400).json({ error: 'Fecha desde y hasta son requeridas' });
    }

    const totales = await obtenerTotalesPorPeriodo(fechaDesde as string, fechaHasta as string);
    res.status(200).json(totales);
  } catch (error) {
    console.error('Error obteniendo totales por periodo:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};

/** Obtener estadísticas globales (solo admin) */
export const ObtenerEstadisticasGlobales = async (req: Request, res: Response) => {
  try {
    const estadisticas = await obtenerEstadisticasGlobales();
    res.status(200).json(estadisticas);
  } catch (error) {
    console.error('Error obteniendo estadísticas globales:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
};
/** Procesar pago de donación después del pago exitoso (llamado desde el frontend) */
export const ProcesarPagoDonacion = async (req: Request, res: Response) => {
  const { payment_id, status, external_reference } = req.body;

  console.log('🔄 Procesando pago de donación desde frontend:', {
    payment_id,
    status,
    external_reference
  });

  if (!payment_id) {
    return res.status(400).json({ error: 'payment_id es requerido' });
  }

  try {
    // Verificar si el pago ya fue procesado
    const checkQuery = `
      SELECT id_donacion FROM donaciones 
      WHERE id_pago_mercadopago = $1
    `;
    const existingDonation = await pool.query(checkQuery, [payment_id]);

    if (existingDonation.rows.length > 0) {
      console.log('✅ Donación ya procesada anteriormente:', existingDonation.rows[0].id_donacion);
      return res.status(200).json({
        success: true,
        message: 'Donación ya procesada',
        donacionId: existingDonation.rows[0].id_donacion
      });
    }

    // Obtener información del pago desde Mercado Pago
    const paymentData = await obtenerPagoPorId(payment_id);
    console.log('📊 Datos del pago obtenidos de Mercado Pago:', {
      status: paymentData.status,
      amount: paymentData.transaction_amount,
      metadata: paymentData.metadata
    });

    // Solo procesar pagos aprobados
    if (paymentData.status !== 'approved') {
      return res.status(400).json({
        error: 'El pago no está aprobado',
        status: paymentData.status
      });
    }

    // Extraer metadata
    const { usuario_id, tipo, email, nombre, id_grupo } = paymentData.metadata || {};

    if (tipo !== 'donacion') {
      return res.status(400).json({
        error: 'Este pago no corresponde a una donación'
      });
    }

    // Crear el objeto de donación
    const donacion = {
      id_usuario: usuario_id || null,
      monto: paymentData.transaction_amount,
      descripcion: usuario_id 
        ? `Donación - Usuario ID: ${usuario_id}` 
        : `Donación - ${nombre || 'Anónimo'}`,
      fecha_donacion: new Date(),
      estado: 'aprobado' as 'pendiente' | 'aprobado' | 'rechazado',
      id_pago_mercadopago: payment_id,
      metadata: paymentData,
      id_grupo: id_grupo || null
    };

    // Guardar la donación en la base de datos
    const donacionGuardada = await guardarDonacion(donacion);
    console.log('✅ Donación guardada exitosamente. ID:', donacionGuardada.id_donacion);

    // Enviar email de confirmación
    let emailDestinatario: string | null = null;
    let nombreDestinatario: string | null = null;

    if (usuario_id) {
      const authService = new AuthService();
      const usuario = await authService.obtenerUsuarioPorId(usuario_id);
      if (usuario) {
        emailDestinatario = usuario.email;
        nombreDestinatario = usuario.nombre;
      }
    } else if (email) {
      emailDestinatario = email;
      nombreDestinatario = nombre || 'Donante';
    }

    if (emailDestinatario && nombreDestinatario) {
      try {
        await enviarEmailConfirmarDonacion(nombreDestinatario, emailDestinatario);
        console.log(`📩 Email enviado a ${emailDestinatario}`);
      } catch (emailError) {
        console.error('⚠️ Error enviando email:', emailError);
        // No fallar la operación si falla el email
      }
    }

    res.status(200).json({
      success: true,
      message: 'Donación procesada exitosamente',
      donacionId: donacionGuardada.id_donacion,
      monto: donacionGuardada.monto
    });

  } catch (error) {
    console.error('❌ Error procesando pago de donación:', error);
    res.status(500).json({
      error: 'Error procesando la donación',
      details: error instanceof Error ? error.message : 'Error desconocido'
    });
  }
};