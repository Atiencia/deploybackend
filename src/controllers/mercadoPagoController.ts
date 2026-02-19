import { Request, Response } from 'express';
import { Preference } from 'mercadopago';
import client from '../config/mercadoPagoClient';
import axios from 'axios';
import { guardarPago, obtenerPagoPorId } from '../services/mercadoPagoService';
import pool from '../db';
import { EventoServices } from '../services/eventosService'; // Asegúrate de tener tu conexión a la BD aquí
import { enviarEmailConfirmarDonacion } from '../services/emailConfirmarDonacion';
import { guardarDonacion } from '../services/donacionesService';
import { AuthService } from '../services/authService';


/** Crear una preferencia de pago en Mercado Pago */
export const CrearPreferencia = async (req: Request, res: Response) => {
  const { title, unit_price, eventoId, form_data } = req.body;
  console.log('Creando preferencia de pago:', req.body);
  // Get user ID from JWT token (req.user)
  const usuarioId = req.user?.id_usuario;

  // Log detallado de cada campo
  console.log('title:', title);
  console.log('unit_price:', unit_price);
  console.log('eventoId:', eventoId);
  console.log('formData:', form_data);
  console.log('usuarioId (from req.user):', usuarioId);

  if (!title) console.error('FALTA title');
  if (!unit_price) console.error('FALTA unit_price');
  if (!eventoId) console.error('FALTA eventoId');
  if (!usuarioId) console.error('FALTA usuarioId (usuario no autenticado)');
  if (!form_data) console.error('FALTA formData');

  if (!title || !unit_price || !eventoId || !usuarioId || !form_data) {
    return res.status(400).json({ error: 'Faltan datos requeridos para crear la preferencia o usuario no autenticado' });
  }

  const preference = new Preference(client);

  try {
    //   preferencia con los datos del formulario incluidos en la metadata
    const data = await preference.create({
      body: {
        items: [
          {
            id: `evento_${eventoId}_usuario_${usuarioId}_${Date.now()}`,
            title,
            quantity: 1,
            unit_price,
          }
        ],
        metadata: {
          tipo: 'evento_pago',
          evento_id: eventoId,
          usuario_id: usuarioId,
          form_data: JSON.stringify(form_data) // Guardar los datos del formulario
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/mis-eventos`,
          failure: `${process.env.FRONTEND_URL}/eventos-disponibles`,
          // pending: `${process.env.FRONTEND_URL}/eventos-disponibles`
        },
        auto_return: "approved" as const,
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`
      }
    });

    res.status(200).json({
      preferenceId: data.id,
      preferenceUrl: data.init_point,
    });

  } catch (error) {
    console.error("Error al crear la preferencia:", error);
    res.status(500).send("Error al crear la preferencia de pago");
  }
};


/** Recibir Webhooks de Mercado Pago, con información de pagos. */
export const WebhookMercadoPago = async (req: Request, res: Response) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('WEBHOOK RECIBIDO - Notificación de MercadoPago:', req.body);
    console.log('Headers:', req.headers);
    const paymentId = req.body.data?.id;
    if (!paymentId) {
      console.log('No se recibió ID de transacción en webhook');
      return res.status(400).send('No se recibió ID de transacción.');
    }

    console.log('💳 Procesando pago ID:', paymentId);

    // Obtener detalles del pago de Mercado Pago
    const paymentData = await obtenerPagoPorId(paymentId);
    console.log('📊 Datos del pago obtenidos:', {
      status: paymentData.status,
      metadata: paymentData.metadata,
      amount: paymentData.transaction_amount
    });

    // Solo procesar pagos aprobados
    if (paymentData.status === 'approved') {
      console.log('✅ Pago aprobado, procesando...');
      // Comprobar si es un pago de evento o de donación
      const { tipo, usuario_id } = paymentData.metadata;

      if (tipo === 'donacion') {
        console.log('🎁 Procesando donación desde webhook...');
        
        // Verificar si ya existe esta donación
        const { rows: existingDonation } = await client.query(
          'SELECT id_donacion FROM donaciones WHERE id_pago_mercadopago = $1',
          [paymentId]
        );

        if (existingDonation.length > 0) {
          console.log('✅ Donación ya procesada anteriormente. ID:', existingDonation[0].id_donacion);
          await client.query('COMMIT');
          return res.status(200).send('Donación ya procesada');
        }

        // Intentar obtener email/nombre de external_reference si no está en metadata
        let emailFromRef = null;
        let nombreFromRef = null;
        let idGrupoFromRef = null;

        if (paymentData.external_reference) {
          try {
            const refData = JSON.parse(paymentData.external_reference);
            emailFromRef = refData.email;
            nombreFromRef = refData.nombre;
            idGrupoFromRef = refData.id_grupo;
            console.log('📋 Datos recuperados de external_reference:', refData);
          } catch (e) {
            console.warn('⚠️ No se pudo parsear external_reference');
          }
        }

        const emailFinal = paymentData.metadata.email || emailFromRef || paymentData.payer?.email;
        const nombreFinal = paymentData.metadata.nombre || nombreFromRef || paymentData.payer?.first_name || 'Anónimo';
        const idGrupoFinal = paymentData.metadata.id_grupo || idGrupoFromRef || null;

        // Procesar donación
        const donacion = {
          id_usuario: usuario_id || null,
          monto: paymentData.transaction_amount,
          descripcion: usuario_id ? `Donación - Usuario ID: ${usuario_id}` : `Donación - ${nombreFinal}`,
          fecha_donacion: new Date(),
          estado: 'aprobado' as 'pendiente' | 'aprobado' | 'rechazado',
          id_pago_mercadopago: paymentId,
          metadata: paymentData,
          id_grupo: idGrupoFinal
        };

        const donacionGuardada = await guardarDonacion(donacion);
        console.log('✅ Donación aprobada y guardada desde webhook. ID:', donacionGuardada.id_donacion);

        // Enviar email de confirmación de donacion
        let emailDestinatario: string | null = emailFinal;
        let nombreDestinatario: string | null = nombreFinal;

        if (usuario_id) {
          try {
            const authService = new AuthService();
            const usuario = await authService.obtenerUsuarioPorId(usuario_id);
            if (usuario) {
              emailDestinatario = usuario.email;
              nombreDestinatario = usuario.nombre;
            }
          } catch (error) {
            console.error('Error obteniendo usuario para email:', error);
          }
        }

        if (emailDestinatario && nombreDestinatario) {
          try {
            await enviarEmailConfirmarDonacion(nombreDestinatario, emailDestinatario);
            console.log(`📩 Email enviado a ${emailDestinatario}`);
          } catch (emailError) {
            console.error('⚠️ Error enviando email:', emailError);
          }
        } else {
          console.warn('⚠️ No se pudo obtener email para enviar confirmación de donación.');
        }


      } else if (tipo === 'evento_pago') {
        console.log('Procesando pago de evento...');

        // Verificar si el pago ya fue procesado para evitar duplicados
        const { rows: existingPayment } = await client.query(
          'SELECT id_pago FROM evento_pago WHERE id_pago_mercadopago = $1',
          [paymentId]
        );

        if (existingPayment.length > 0) {
          console.log('Pago de evento ya procesado anteriormente. ID:', existingPayment[0].id_pago);
          return res.status(200).send('Pago ya procesado');
        }

        const { evento_id, usuario_id, form_data } = paymentData.metadata;

        let parsedFormData;
        try {
          parsedFormData = JSON.parse(form_data);
          console.log('FormData parseado correctamente:', parsedFormData);
        } catch (parseError) {
          console.error('Error al parsear formData:', parseError);
          console.error('formData raw:', form_data);
          throw new Error('FormData inválido en metadata');
        }

        // Crear la inscripción completa con los datos del formulario
        const eventoServices = new EventoServices();
        const payload = {
          eventoId: parseInt(evento_id),
          usuarioId: parseInt(usuario_id),
          residencia: parsedFormData.residencia,
          rol: parsedFormData.rol,
          primeraVez: parsedFormData.primeraVez,
          carrera: parsedFormData.carrera || undefined,
          anioCarrera: parsedFormData.anioCarrera ? parseInt(parsedFormData.anioCarrera) : undefined,
        };

        console.log('Creando inscripción con payload:', payload);

        // Crear la inscripción completa
        const mensaje = await eventoServices.inscribirUsuario(payload);
        console.log('Mensaje de inscripción:', mensaje);

        // Obtener el ID de la inscripción creada
        const { rows: inscripcionRows } = await client.query(
          'SELECT id_inscripcion FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2 ORDER BY fecha_inscripcion DESC LIMIT 1',
          [evento_id, usuario_id]
        );

        if (inscripcionRows.length > 0) {
          const inscripcionId = inscripcionRows[0].id_inscripcion;
          console.log('ID de inscripción obtenida:', inscripcionId);

          // Guardar el pago en la base de datos
          const pagoGuardado = await guardarPago(inscripcionId, paymentData);

          console.log('Pago de evento aprobado y guardado. ID:', pagoGuardado.id_pago);
          console.log('Inscripción creada con ID:', 1);
        } else {
          console.error('No se pudo obtener el ID de la inscripción creada para evento', 2, 'usuario', usuario_id);
          throw new Error('No se pudo obtener el ID de la inscripción creada');
        }
      } else {
        console.warn('Pago aprobado pero sin metadata reconocida:', paymentData.metadata);
      }
    // }

    await client.query('COMMIT');
    res.status(200).send('Recibido');
  } 
}
catch (error) {
    await client.query('ROLLBACK');
    console.error('Error procesando webhook:', error);

    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return res.status(404).send('Error al consultar API MP: ID de transacción inválido');
    }
    res.status(500).send('Error interno');
  } finally {
    client.release();
  }
};
