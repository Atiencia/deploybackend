import { Request, Response } from 'express';
import { EventoServices } from '../services/eventosService';
import pool from '../db';
import { SecretariaGrupoService } from '../services/secretariaGrupoService';
import { EventoGrupoService } from '../services/eventoGrupoService';
import { Subevento } from '../tipos/tipos';
import { SubGrupoService } from '../services/subgruposService';

export class EventoController {
  private secretariaGrupoService: SecretariaGrupoService;
  private subgrupoService: SubGrupoService;


  constructor(
    private readonly eventoService: EventoServices,
    secretariaGrupoService: SecretariaGrupoService,
    private readonly eventoGrupoService: EventoGrupoService,
    subgrupoService: SubGrupoService,
  ) {
    this.secretariaGrupoService = secretariaGrupoService
    this.subgrupoService = subgrupoService
  }



  /**
 * Controlador: Obtiene la lista de eventos registrados en el sistema.
 * Si el usuario es secretaria grupal (rol 5), solo devuelve eventos de sus grupos asignados.
 * Si no existen eventos, devuelve un mensaje indicándolo.
 */

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
      const usuarioId = (req as any).usuario ? (req as any).usuario.id_usuario : 0;
      const rolNombre = (req as any).usuario ? (req as any).usuario.rol_nombre : '';

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

  obtenerEventosPorGrupo = async (req: Request, res: Response) => {
    const request = req.body
    try {
      const eventos = await this.eventoService.obtenerEventosPorGrupo(request.grupoId);
      if (eventos.length === 0) {
        return res.json({ message: 'No se encontraron eventos transcurridos' });
      }
      res.json(eventos);
    } catch (err: any) {
      console.error(err)
      res.status(500).json({ error: err.message });
    }
  }

  obtenerEvento = async (req: Request, res: Response) => {
    try {
      // Obtener el id desde req.params (url)
      const id = parseInt(req.params.id, 10);

      if (isNaN(id)) {
        return res.status(400).json({ error: 'ID inválido' });
      }

      const evento = await this.eventoService.obtenerEvento(id);
      if (!evento) {
        return res.status(404).json({ error: 'Evento no encontrado' });
      }
      res.json(evento);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }


  /**
   * Controlador: Asigna un rol específico a un usuario.
   * Requiere en el body: { usuarioId, rolId }
   */
  asignarCupos = async (req: Request, res: Response) => {
    const { eventoId, cupos } = req.body as { eventoId: number; cupos: number };
    try {
      const evento = await this.eventoService.asignarCupos(eventoId, cupos);
      if (!evento) {
        return res.status(404).json({ error: 'Evento no encontrado' });
      }
      res.json(evento);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  //ARREGLAR ENDPOINT
  crearEvento = async (req: Request, res: Response) => {
    const { evento: { nombre, fecha, descripcion, cupos, cupos_suplente, fecha_limite_inscripcion, fecha_limite_baja, lugar, categoria, costo, cuenta_destino, formSubgrupos, id_grupo } } = req.body as
      {
        evento:
        {
          nombre: string, fecha: Date, descripcion?: string, cupos: number, cupos_suplente: number, fecha_limite_inscripcion: Date, fecha_limite_baja: Date,
          lugar: string, categoria: 'salida' | 'normal' | 'pago', costo: number, cuenta_destino?: string, formSubgrupos: Subevento[], id_grupo: string,
        }
      };
    console.log(req.body)
    try {
      const usuarioId = (req as any).usuario.id_usuario;
      const rolNombre = (req as any).usuario.rol_nombre;


      if (nombre === undefined) {
        return res.status(400).json({ error: 'El nombre del evento es obligatorio' });
      }
      console.log(formSubgrupos)

      //si el evento se hizo con subgrupos entonces se usara la suma de todos los cupos por parte de los subgrupos, si no se usara directamente el valor de cupos especificado.
      const cupos_totales = formSubgrupos.length > 0 ? formSubgrupos.reduce((acc, s) => acc + s.cupos, 0) : cupos;
      const cupos_suplentes_totales = formSubgrupos.length > 0 ? formSubgrupos.reduce((acc, s) => acc + s.cupos_suplente, 0) : cupos_suplente;
      console.log(cupos_totales, 'cccc', cupos_suplentes_totales)


      const nuevoEvento = await this.eventoService.crearEvento(nombre, fecha, descripcion, cupos_totales, cupos_suplentes_totales, lugar, categoria, fecha_limite_inscripcion, fecha_limite_baja, costo, cuenta_destino);

      if (rolNombre === 'secretaria grupal') {
        const asociado = await this.eventoGrupoService.asociarEventoGrupo(nuevoEvento.id_evento, parseInt(id_grupo));
        console.log(asociado)
      }

      if (formSubgrupos.length > 0) {
        const subeventos = formSubgrupos.map((s) => ({ ...s, id_evento: nuevoEvento.id_evento }));

        for (const subevento of subeventos) {
          await this.subgrupoService.crearEventoDeSubgrupos(subevento);
        }
      }

      res.status(201).json(nuevoEvento);

    } catch (err: any) {
      console.error("Error creando evento:", err); // <- agrega esto
      res.status(500).json({ error: err.message });
    }
  };

  eliminarEvento = async (req: Request, res: Response) => {
    const { eventoId } = req.body;
    try {
      const evento = await this.eventoService.eliminarEvento(eventoId);
      if (!evento) return res.status(404).json({ error: 'Evento no encontrado' });
      res.json({ message: `Evento con ID ${eventoId} eliminado correctamente` });
    } catch (err: any) {
      // Detectar si el error viene por inscritos
      if (err.message.includes('usuarios inscritos')) {
        return res.status(400).json({ error: 'No se puede eliminar eventos con inscriptos' });
      }
      // Otros errores: 500
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  };


  // PUT: Actualizar evento (fecha, descripción, cupos)
  // es necesario actualizar tambien valores de eventos pagos. 
  actualizarEvento = async (req: Request, res: Response) => {
    const { id_evento, fecha, descripcion, cupos, cupos_suplente, fecha_limite_inscripcion, fecha_limite_baja, costo } = req.body;

    if (!id_evento) return res.status(400).json({ error: "ID del evento es obligatorio" });

    try {
      const eventoActualizado = await this.eventoService.actualizarEvento(id_evento, {
        fecha,
        descripcion,
        cupos,
        cupos_suplente,
        fecha_limite_inscripcion,
        fecha_limite_baja,
        costo
      });
      res.json(eventoActualizado);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };



  // aca tambien para eliminar al inscripto
  eliminarInscripto = async (req: Request, res: Response) => {
    console.log(req.body)
    const { eventoId, usuarioId } = req.body;
    if (!eventoId || !usuarioId) return res.status(400).json({ error: "eventoId y usuarioId son obligatorios" });

    try {
      const id_evento = await this.eventoService.eliminarInscripto(Number(eventoId), Number(usuarioId));
      res.json({ message: 'Inscripto eliminado correctamente', id_evento });
    } catch (err: any) {
      console.log(err)
      res.status(500).json({ error: err.message });
    }
  }


  /**
     * Controlador POST: Cuenta la cantidad de usuarios inscritos en un evento.
     * Requiere en el body: { eventoId }
     */
  contarInscriptos = async (req: Request, res: Response) => {
    const { eventoId } = req.body;
    try {
      const cantidad = await this.eventoService.contarInscriptos(Number(eventoId));
      res.json({ inscriptos: cantidad });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Error al contar inscriptos del evento' });
    }
  }

  /**
   * Controlador POST: Trae la lista de usuarios inscritos en un evento.
   * Requiere en el body: { eventoId }
   */
  obtenerInscriptos = async (req: Request, res: Response) => {
    const { eventoId } = req.body;
    try {
      const inscriptos = await this.eventoService.obtenerInscriptos(Number(eventoId));
      res.json(inscriptos);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: 'Error al obtener inscriptos del evento' });
    }
  }

  /**
     * Controlador POST: Inscribe un usuario a un evento, si hay cupos disponibles. 
     * Requiere en el body: { eventoId, usuarioId }
     */

  inscribirUsuario = async (req: Request, res: Response) => {
    try {
      const usuarioId = req.user?.id_usuario;
      if (!usuarioId) return res.status(401).json({ error: 'Usuario no autenticado' });

      const {
        eventoId,
        residencia,
        rol,
        primeraVez,
        carrera,
        anioCarrera,
        subgrupo,
      } = req.body as {
        eventoId: number;
        residencia: string;
        rol: string;
        primeraVez: boolean;
        carrera?: string;
        anioCarrera?: number;
        subgrupo?: string
      };

      if (!eventoId || !residencia || !rol) {
        return res.status(400).json({ error: 'Faltan campos obligatorios' });
      }

      const mensaje = await this.eventoService.inscribirUsuario({
        eventoId,
        usuarioId,
        residencia,
        rol,
        primeraVez,
        carrera,
        anioCarrera,
        subgrupo
      });

      res.json({ message: mensaje, eventoId });

    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Verificar si el usuario actual está inscrito en un evento específico
  verificarInscripcionUsuario = async (req: Request, res: Response) => {
    try {
      const { eventoId } = req.body;
      const user = req.user;

      console.log('Usuario en req:', user); // Debug log
      console.log('EventoId recibido:', eventoId); // Debug log

      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const usuarioId = user.id_usuario;

      if (!usuarioId) {
        console.log('No se encontró ID de usuario en:', user);
        return res.status(401).json({ error: 'ID de usuario no encontrado en token' });
      }

      if (!eventoId) {
        return res.status(400).json({ error: 'ID del evento es requerido' });
      }

      const estaInscrito = await this.eventoService.verificarInscripcionUsuario(Number(eventoId), usuarioId);
      console.log(`Usuario ${usuarioId} inscrito en evento ${eventoId}:`, estaInscrito); // Debug log

      res.json({ inscrito: estaInscrito });

    } catch (err: any) {
      console.error('Error en verificarInscripcionUsuario:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // Obtener detalles de la inscripción del usuario (si es suplente, su orden, etc.)
  obtenerDetallesInscripcion = async (req: Request, res: Response) => {
    try {
      const { eventoId } = req.body;
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const usuarioId = user.id_usuario;

      if (!eventoId) {
        return res.status(400).json({ error: 'ID del evento es requerido' });
      }

      // Consultar la inscripción del usuario
      const result = await pool.query(
        `SELECT ie.es_suplente as es_suplente, ie.orden_suplente as orden_suplente, sb.nombre as subgrupo
          FROM inscripcion_evento ie LEFT JOIN subgrupo sb on ie.id_subgrupo = sb.id_subgrupo
          WHERE id_evento = $1 AND id_usuario = $2`,
        [eventoId, usuarioId]
      );

      if (result.rows.length === 0) {
        return res.json({
          inscrito: false,
          esSuplente: false,
          ordenSuplente: null
        });
      }

      const inscripcion = result.rows[0];

      res.json({
        inscrito: true,
        esSuplente: inscripcion.es_suplente || false,
        ordenSuplente: inscripcion.orden_suplente || null,
        subgrupo: inscripcion.subgrupo || null
      });

    } catch (err: any) {
      console.error('Error en obtenerDetallesInscripcion:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // Obtener eventos donde el usuario está inscrito
  obtenerMisEventos = async (req: Request, res: Response) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const usuarioId = user.id_usuario;

      if (!usuarioId) {
        return res.status(401).json({ error: 'ID de usuario no encontrado' });
      }

      const eventos = await this.eventoService.obtenerMisEventos(usuarioId);

      // Siempre retornar un array, incluso si está vacío
      res.json(eventos);

    } catch (err: any) {
      console.error('Error en obtenerMisEventos:', err);
      res.status(500).json({ error: err.message });
    }
  }

  cancelarEvento = async (req: Request, res: Response) => {
    const { eventoId } = req.body as { eventoId: number };
    try {
      const evento = await this.eventoService.cancelarEvento(eventoId);
      if (!evento) {
        return res.status(404).json({ error: 'Evento no encontrado' });
      }
      res.json({
        message: 'Evento cancelado correctamente y notificaciones enviadas',
        evento
      });
    } catch (err: any) {
      console.log(err)
      res.status(500).json({ error: err.message });
    }
  }

  // Obtener eventos disponibles donde el usuario NO está inscrito
  obtenerEventosDisponibles = async (req: Request, res: Response) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const usuarioId = user.id_usuario;

      if (!usuarioId) {
        return res.status(401).json({ error: 'ID de usuario no encontrado' });
      }

      const eventos = await this.eventoService.obtenerEventosDisponibles(usuarioId);

      if (eventos.length === 0) {
        return res.json({ message: 'No hay eventos disponibles en este momento' });
      }

      res.json(eventos);

    } catch (err: any) {
      console.error('Error en obtenerEventosDisponibles:', err);
      res.status(500).json({ error: err.message });
    }
  }

  // Dar de baja la inscripción del usuario a un evento
  darDeBajaInscripcion = async (req: Request, res: Response) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const usuarioId = user.id_usuario;

      if (!usuarioId) {
        return res.status(401).json({ error: 'ID de usuario no encontrado' });
      }

      const { eventoId } = req.body;

      if (!eventoId) {
        return res.status(400).json({ error: 'ID de evento es requerido' });
      }

      await this.eventoService.darDeBajaInscripcion(eventoId, usuarioId);

      res.json({
        success: true,
        message: 'Te has dado de baja exitosamente del evento'
      });

    } catch (err: any) {
      console.error('Error en darDeBajaInscripcion:', err);
      res.status(400).json({ error: err.message });
    }
  }

  // ==================== CONTROLADORES PARA SUPLENTES ====================

  /**
   * Obtiene estad�sticas de cupos de un evento (titulares y suplentes)
   */
  obtenerEstadisticasEvento = async (req: Request, res: Response) => {
    try {
      const eventoId = parseInt(req.params.id);
      const stats = await this.eventoService.obtenerEstadisticasEvento(eventoId);
      res.json(stats);
    } catch (err: any) {
      console.error('[ERROR] obtenerEstadisticasEvento:', err);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Obtiene la lista de suplentes de un evento
   */
  obtenerSuplentes = async (req: Request, res: Response) => {
    try {
      const eventoId = parseInt(req.params.id);
      const suplentes = await this.eventoService.obtenerSuplentes(eventoId);
      res.json(suplentes);
    } catch (err: any) {
      console.error('[ERROR] obtenerSuplentes:', err);
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Dar de baja a un inscrito y promover al primer suplente (para admin/secretaria)
   */
  darDeBajaYPromoverSuplente = async (req: Request, res: Response) => {
    try {
      const eventoId = parseInt(req.params.eventoId);
      const usuarioId = parseInt(req.params.usuarioId);

      const mensaje = await this.eventoService.darDeBajaYPromoverSuplente(eventoId, usuarioId);
      res.json({ message: mensaje });
    } catch (err: any) {
      console.error('[ERROR] darDeBajaYPromoverSuplente:', err);
      res.status(400).json({ error: err.message });
    }
  }

  // Eliminar un suplente (sin promoción)
  eliminarSuplente = async (req: Request, res: Response) => {
    try {
      const eventoId = parseInt(req.params.eventoId);
      const usuarioId = parseInt(req.params.usuarioId);

      const mensaje = await this.eventoService.eliminarSuplente(eventoId, usuarioId);
      res.json({ message: mensaje });
    } catch (err: any) {
      console.error('[ERROR] eliminarSuplente:', err);
      res.status(400).json({ error: err.message });
    }
  }

  /**
   * Dar de baja del usuario autenticado (con promoci�n de suplentes)
   */
  darDeBajaInscripcionConPromocion = async (req: Request, res: Response) => {
    try {
      const user = req.user;

      if (!user) {
        return res.status(401).json({ error: 'Usuario no autenticado' });
      }

      const usuarioId = user.id_usuario;

      if (!usuarioId) {
        return res.status(401).json({ error: 'ID de usuario no encontrado' });
      }

      const { eventoId } = req.body;

      if (!eventoId) {
        return res.status(400).json({ error: 'ID de evento es requerido' });
      }

      const mensaje = await this.eventoService.darDeBajaYPromoverSuplente(eventoId, usuarioId);

      res.json({
        success: true,
        message: mensaje
      });

    } catch (err: any) {
      console.error('Error en darDeBajaInscripcionConPromocion:', err);
      res.status(400).json({ error: err.message });
    }
  }
}

