import { Request, Response } from 'express';
import { Preference } from 'mercadopago';
import client from '../config/mercadoPagoClient';
import {
  guardarDonacion,
  obtenerDonacionesUsuario,
  obtenerTodasLasDonaciones,
  obtenerDonacionesFiltradas,
  obtenerTotalesPorPeriodo,
  obtenerEstadisticasGlobales
} from '../services/donacionesService';
import pool from '../db';

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
          success: `${process.env.FRONTEND_URL}/donaciones/exito`,
          failure: `${process.env.FRONTEND_URL}/donaciones/fallido`,
          pending: `${process.env.FRONTEND_URL}/donaciones/pendiente`
        },
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

/** Obtener todas las donaciones (solo admin) */
export const ObtenerTodasLasDonaciones = async (req: Request, res: Response) => {
  try {
    const donaciones = await obtenerTodasLasDonaciones();
    res.status(200).json(donaciones);
  } catch (error) {
    console.error('Error obteniendo todas las donaciones:', error);
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
