import { Request, Response } from 'express';
import { EventoGrupoService } from '../services/eventoGrupoService';
import pool from '../db';
import { EventoServices } from '../services/eventosService';

//Este controlador maneja solo las asociaciones entre eventos y grupos, el endpoint de CrearEvento ya realiza esto por si mismo
//Lo dejé porque puede ser útil para asociar eventos ya creados a grupos, osea cambiar el grupo de un evento ya existente, no sé si es necesario pero lo dejé
//por si lo usamos después
export class EventoGrupoController {
  constructor(private readonly eventoGrupoService: EventoGrupoService) {}

  eventoService = new EventoServices()

  asociarEventoGrupo = async (req: Request, res: Response) => {
    const { id_evento, id_grupo, rol_grupo } = req.body;
    console.log(req.body)
    try {
      if (!id_evento || !id_grupo) {
        return res.status(400).json({ error: 'id_evento e id_grupo son obligatorios' });
      }
      const asociacion = await this.eventoGrupoService.asociarEventoGrupo(id_evento, id_grupo);
      res.status(201).json(asociacion);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

    obtenerEventos = async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).usuario.id_usuario;
      const rolNombre = (req as any).usuario.rol_nombre;

      let eventos;

      // Si es secretaria grupal, filtrar por sus grupos asignados
      if (rolNombre === 'secretaria grupal') {
        console.log(`[DEBUG] Usuario ${usuarioId} es secretaria grupal`);

        const gruposResult = await pool.query(
          `SELECT DISTINCT id_grupo FROM usuariogrupo 
           WHERE id_usuario = $1 AND rol_en_grupo = 'secretaria'`,
          [usuarioId]
        );
        const gruposIds = gruposResult.rows.map(row => row.id_grupo);

        console.log(`[DEBUG] Grupos asignados:`, gruposIds);

        if (gruposIds.length === 0) {
          return res.json({ message: 'No tienes grupos asignados' });
        }

        // Obtener solo eventos de esos grupos
        const eventosResult = await pool.query(
          `SELECT DISTINCT e.* 
           FROM evento e
           INNER JOIN evento_grupo eg ON e.id_evento = eg.id_evento
           WHERE eg.id_grupo = ANY($1)
           ORDER BY e.fecha DESC`,
          [gruposIds]
        );
        eventos = eventosResult.rows;

        console.log(`[DEBUG] Eventos encontrados: ${eventos.length}`);
      } else {
        // Admin o secretaria general: todos los eventos
        eventos = await this.eventoService.obtenerEventos();
      }

      if (eventos.length === 0) {
        return res.json({ message: 'Aún no hay eventos registrados' });
      }
      res.json(eventos);
    } catch (err: any) {
      console.error('[ERROR] obtenerEventos:', err);
      res.status(500).json({ error: err.message });
    }
  }

  obtenerEventosVigentes = async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).usuario.id_usuario;
      const rolNombre = (req as any).usuario.rol_nombre;

      let eventos;

      // Si es secretaria grupal, filtrar por sus grupos asignados
      if (rolNombre === 'secretaria grupal') {
        console.log(`[DEBUG] Usuario ${usuarioId} es secretaria grupal - obteniendo eventos vigentes`);

        const gruposResult = await pool.query(
          `SELECT DISTINCT id_grupo FROM usuariogrupo 
           WHERE id_usuario = $1 AND rol_en_grupo = 'secretaria'`,
          [usuarioId]
        );
        const gruposIds = gruposResult.rows.map(row => row.id_grupo);

        console.log(`[DEBUG] Grupos asignados:`, gruposIds);

        if (gruposIds.length === 0) {
          return res.json({ message: 'No tienes grupos asignados' });
        }

        // Obtener solo eventos vigentes de esos grupos
        const eventosResult = await pool.query(
          `SELECT DISTINCT e.*,
            (e.cupos - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = FALSE THEN ie.id_usuario END), 0))::int as cupos_disponibles,
            (e.cupos_suplente - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = TRUE THEN ie.id_usuario END), 0))::int as suplentes_disponibles,
            g.nombre as nombre_grupo
           FROM evento e
           INNER JOIN evento_grupo eg ON e.id_evento = eg.id_evento
           LEFT JOIN inscripcion_evento ie ON e.id_evento = ie.id_evento
           LEFT JOIN grupo g ON eg.id_grupo = g.id_grupo
           WHERE eg.id_grupo = ANY($1) AND e.estado = $2
           GROUP BY e.id_evento, g.nombre
           ORDER BY e.fecha ASC`,
          [gruposIds, 'vigente']
        );
        eventos = eventosResult.rows;

        console.log(`[DEBUG] Eventos vigentes encontrados: ${eventos.length}`);
      } else {
        // Admin o secretaria general: todos los eventos vigentes
        eventos = await this.eventoService.obtenerEventosVigentes(usuarioId);
      }

      if (eventos.length === 0) {
        return res.json({ message: 'No se encontraron eventos vigentes' });
      }
      res.json(eventos);
    } catch (err: any) {
      console.error('[ERROR] obtenerEventosVigentes:', err);
      res.status(500).json({ error: err.message });
    }
  }

  obtenerEventosTranscurridos = async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).usuario.id_usuario;
      const rolNombre = (req as any).usuario.rol_nombre;

      let eventos;

      // Si es secretaria grupal, filtrar por sus grupos asignados
      if (rolNombre === 'secretaria grupal') {
        const gruposResult = await pool.query(
          `SELECT DISTINCT id_grupo FROM usuariogrupo 
           WHERE id_usuario = $1 AND rol_en_grupo = 'secretaria'`,
          [usuarioId]
        );
        const gruposIds = gruposResult.rows.map(row => row.id_grupo);

        if (gruposIds.length === 0) {
          return res.json({ message: 'No tienes grupos asignados' });
        }

        // Obtener solo eventos transcurridos de esos grupos
        const eventosResult = await pool.query(
          `SELECT DISTINCT e.*, g.nombre as nombre_grupo
           FROM evento e
           INNER JOIN evento_grupo eg ON e.id_evento = eg.id_evento
           LEFT JOIN grupo g ON eg.id_grupo = g.id_grupo
           WHERE eg.id_grupo = ANY($1) AND e.estado = $2
           ORDER BY e.fecha DESC`,
          [gruposIds, 'transcurrido']
        );
        eventos = eventosResult.rows;
      } else {
        // Admin o secretaria general: todos los eventos transcurridos
        eventos = await this.eventoService.obtenerEventosTranscurridos();
      }

      if (eventos.length === 0) {
        return res.json({ message: 'No se encontraron eventos transcurridos' });
      }
      res.json(eventos);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  obtenerEventosCancelados = async (req: Request, res: Response) => {
    try {
      const usuarioId = (req as any).usuario.id_usuario;
      const rolNombre = (req as any).usuario.rol_nombre;

      let eventos;

      // Si es secretaria grupal, filtrar por sus grupos asignados
      if (rolNombre === 'secretaria grupal') {
        const gruposResult = await pool.query(
          `SELECT DISTINCT id_grupo FROM usuariogrupo 
           WHERE id_usuario = $1 AND rol_en_grupo = 'secretaria'`,
          [usuarioId]
        );
        const gruposIds = gruposResult.rows.map(row => row.id_grupo);

        if (gruposIds.length === 0) {
          return res.json({ message: 'No tienes grupos asignados' });
        }

        // Obtener solo eventos cancelados de esos grupos
        const eventosResult = await pool.query(
          `SELECT DISTINCT e.*, g.nombre as nombre_grupo
           FROM evento e
           INNER JOIN evento_grupo eg ON e.id_evento = eg.id_evento
           LEFT JOIN grupo g ON eg.id_grupo = g.id_grupo
           WHERE eg.id_grupo = ANY($1) AND e.estado = $2
           ORDER BY e.fecha DESC`,
          [gruposIds, 'cancelado']
        );
        eventos = eventosResult.rows;
      } else {
        // Admin o secretaria general: todos los eventos cancelados
        eventos = await this.eventoService.obtenerEventosCancelados();
      }

      if (eventos.length === 0) {
        return res.json({ message: 'No se encontraron eventos cancelados' });
      }
      res.json(eventos);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
}
