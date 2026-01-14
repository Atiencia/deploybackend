import pool from '../db';
import { Donacion } from '../tipos/tipos';
import axios from 'axios';

/** Guarda los datos de una donación en la base de datos */
export const guardarDonacion = async (donacion: Donacion) => {
  try {
    const query = `
      INSERT INTO donaciones (
        id_usuario,
        monto,
        descripcion,
        fecha_donacion,
        estado,
        id_pago_mercadopago,
        metadata,
        id_grupo
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7::jsonb, $8
      ) RETURNING *;
    `;

    const values = [
      donacion.id_usuario,
      donacion.monto,
      donacion.descripcion,
      donacion.fecha_donacion,
      donacion.estado,
      donacion.id_pago_mercadopago || null,
      donacion.metadata || null,
      donacion.id_grupo || null,
    ];

    const { rows } = await pool.query(query, values);
    console.log('Donación guardada en BD:', rows[0].id_donacion);
    return rows[0];
  } catch (error) {
    console.error('Error guardando la donación en DB:', error);
    throw error;
  }
};

/** Obtiene las donaciones de un usuario */
export const obtenerDonacionesUsuario = async (idUsuario: number) => {
  try {
    const query = `
      SELECT d.*, u.nombre, u.apellido
      FROM donaciones d
      JOIN usuario u ON d.id_usuario = u.id_usuario
      WHERE d.id_usuario = $1
      ORDER BY d.fecha_donacion DESC
    `;
    const { rows } = await pool.query(query, [idUsuario]);
    return rows;
  } catch (error) {
    console.error('Error obteniendo donaciones del usuario:', error);
    throw error;
  }
};

/** Actualiza el estado de una donación */
export const actualizarEstadoDonacion = async (idDonacion: number, estado: string) => {
  try {
    const query = `
      UPDATE donaciones
      SET estado = $1
      WHERE id_donacion = $2
      RETURNING *
    `;
    const { rows } = await pool.query(query, [estado, idDonacion]);
    return rows[0];
  } catch (error) {
    console.error('Error actualizando estado de donación:', error);
    throw error;
  }
};

/** Obtiene todas las donaciones (para admin y sec general) */
export const obtenerTodasLasDonaciones = async () => {
  try {
    const query = `
      SELECT d.*, u.nombre, u.apellido, u.email, g.nombre as nombre_grupo, g.id_grupo
      FROM donaciones d
      JOIN usuario u ON d.id_usuario = u.id_usuario
      LEFT JOIN grupo g ON d.id_grupo = g.id_grupo
      ORDER BY d.fecha_donacion DESC
    `;
    const { rows } = await pool.query(query);
    return rows;
  } catch (error) {
    console.error('Error obteniendo todas las donaciones:', error);
    throw error;
  }
};

/** Obtiene las donaciones filtradas por grupo (para secretaria grupal) */
export const obtenerDonacionesPorGrupo = async (idUsuario: number) => {
  try {
    // Primero obtenemos el grupo al que pertenece la secretaria
    const grupoQuery = `
      SELECT id_grupo FROM usuariogrupo 
      WHERE id_usuario = $1 AND rol_en_grupo = 'secretaria'
      LIMIT 1
    `;
    const { rows: grupoRows } = await pool.query(grupoQuery, [idUsuario]);
    
    if (grupoRows.length === 0) {
      return [];
    }
    
    const idGrupo = grupoRows[0].id_grupo;
    
    // Obtenemos las donaciones del grupo
    const query = `
      SELECT d.*, u.nombre, u.apellido, u.email, g.nombre as nombre_grupo, g.id_grupo
      FROM donaciones d
      JOIN usuario u ON d.id_usuario = u.id_usuario
      LEFT JOIN grupo g ON d.id_grupo = g.id_grupo
      WHERE d.id_grupo = $1
      ORDER BY d.fecha_donacion DESC
    `;
    const { rows } = await pool.query(query, [idGrupo]);
    return rows;
  } catch (error) {
    console.error('Error obteniendo donaciones por grupo:', error);
    throw error;
  }
};

/** Obtiene donaciones con filtros */
export const obtenerDonacionesFiltradas = async (filtros: {
  usuarioId?: number;
  estado?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  metodoPago?: string;
}) => {
  try {
    let query = `
      SELECT d.*, u.nombre, u.apellido, u.email
      FROM donaciones d
      JOIN usuario u ON d.id_usuario = u.id_usuario
      WHERE 1=1
    `;

    const params: any[] = [];

    if (filtros.usuarioId) {
      params.push(filtros.usuarioId);
      query += ` AND d.id_usuario = $${params.length}`;
    }

    if (filtros.estado) {
      params.push(filtros.estado);
      query += ` AND d.estado = $${params.length}`;
    }

    if (filtros.fechaDesde) {
      params.push(filtros.fechaDesde);
      query += ` AND DATE(d.fecha_donacion) >= $${params.length}`;
    }

    if (filtros.fechaHasta) {
      params.push(filtros.fechaHasta);
      query += ` AND DATE(d.fecha_donacion) <= $${params.length}`;
    }

    query += ` ORDER BY d.fecha_donacion DESC`;

    const { rows } = await pool.query(query, params);
    return rows;
  } catch (error) {
    console.error('Error obteniendo donaciones filtradas:', error);
    throw error;
  }
};

/** Obtiene totales de donaciones por periodo */
export const obtenerTotalesPorPeriodo = async (fechaDesde: string, fechaHasta: string) => {
  try {
    const query = `
      SELECT
        COUNT(*) as total_donaciones,
        SUM(monto) as total_monto,
        SUM(monto_neto_recibido) as total_neto
      FROM donaciones
      WHERE estado = 'aprobado'
        AND DATE(fecha_donacion) BETWEEN $1 AND $2
    `;
    const { rows } = await pool.query(query, [fechaDesde, fechaHasta]);
    return rows[0];
  } catch (error) {
    console.error('Error obteniendo totales por periodo:', error);
    throw error;
  }
};

/** Obtiene estadísticas globales para dashboard admin */
export const obtenerEstadisticasGlobales = async () => {
  try {
    const query = `
      SELECT
        COUNT(CASE WHEN estado = 'aprobado' THEN 1 END) as donaciones_aprobadas,
        COUNT(CASE WHEN estado = 'pendiente' THEN 1 END) as donaciones_pendientes,
        COUNT(CASE WHEN estado = 'rechazado' THEN 1 END) as donaciones_rechazadas,
        COUNT(*) as total_donaciones,
        COALESCE(SUM(CASE WHEN estado = 'aprobado' THEN monto ELSE 0 END), 0) as total_monto_aprobado,
        COALESCE(SUM(CASE WHEN estado = 'aprobado' THEN monto_neto_recibido ELSE 0 END), 0) as total_neto_aprobado,
        COUNT(DISTINCT CASE WHEN estado = 'aprobado' THEN id_usuario END) as total_donantes
      FROM donaciones
    `;
    const { rows } = await pool.query(query);
    return rows[0];
  } catch (error) {
    console.error('Error obteniendo estadísticas globales:', error);
    throw error;
  }
};
