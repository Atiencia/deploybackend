import { Grupo, InscripcionPayload, Subevento, Subgrupo, User, UsuarioConGrupo } from '../tipos/tipos';
import pool from '../db';
import { pathToFileURL } from 'url';
import { EmailService } from './emailService';
// import { getIO } from '../socket'; // Socket.io no usado por ahora
import { parse } from 'path';

export class SubGrupoService {

  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  // Obtiene todos los subgrupos registrados
  async obtenerSubgrupos(): Promise<Subgrupo[]> {
    const result = await pool.query('SELECT * FROM subgrupo');
    return result.rows;
  }

  // Obtiene todos los subgrupos de un grupo en especifico
  async obtenerSubgruposPorGrupo(id_grupo: number): Promise<Subgrupo[]> {
    const result = await pool.query('SELECT * FROM subgrupo WHERE id_grupo = $1', [id_grupo]);
    return result.rows;
  }

  async obtenerSubgruposPorEvento(id_evento: string): Promise<Subgrupo[]> {
    console.log('sad', id_evento)
    const result = await pool.query(
      `SELECT 
          sg.*,
          g.nombre as nombre_grupo_padre
      FROM subgrupo sg
      INNER JOIN grupo g ON sg.id_grupo = g.id_grupo
      INNER JOIN evento_grupo eg ON g.id_grupo = eg.id_grupo
      WHERE eg.id_evento = $1
        AND sg.activo = TRUE   -- Solo subgrupos activos
        AND g.activo = TRUE;   -- Solo si el grupo padre también está activo`
      , [parseInt(id_evento)]);
    return result.rows;
  }

  // Obtiene un subgrupo por ID
  async obtenerSubgrupo(id_subgrupo: number): Promise<Subgrupo | undefined> {

    const result = await pool.query('SELECT * FROM subgrupo WHERE id_subgrupo = $1', [id_subgrupo]);
    return result.rows[0];
  }

  // Crea un nuevo subgrupo
  async crearSubgrupo(id_grupo: number, nombre: string, descripcion: string): Promise<Subgrupo> {
    const result = await pool.query(
      'INSERT INTO subgrupo (id_grupo, nombre, descripcion) VALUES ($1, $2, $3) RETURNING *',
      [id_grupo, nombre, descripcion]
    );
    return result.rows[0];
  }

  // Editar un subgrupo
  async editarSubgrupo(id_subgrupo: number, nombre?: string, activo?: boolean, descripcion?: string): Promise<Subgrupo> {
    const result = await pool.query(
      `UPDATE subgrupo SET 
      nombre = COALESCE($1, nombre), 
      activo = COALESCE($2, activo),
      descripcion = COALESCE($3, descripcion)
      WHERE id_subgrupo = $4 RETURNING *`,
      [nombre, activo, descripcion, id_subgrupo]
    );
    return result.rows[0];
  }

  async toggleActivoSubgrupo(id_subgrupo: number): Promise<Subgrupo> {
    const valor = await this.obtenerSubgrupo(id_subgrupo)
    console.log(valor)
    const result = await pool.query(
      'UPDATE subgrupo SET activo = $2 WHERE id_subgrupo = $1 RETURNING *',
      [id_subgrupo, !valor?.activo]
    );
    return result.rows[0]
  }

  /* async asociarSubgrupoAEvento(id_subgrupo: number, id_evento: number) {
     const result = await pool.query(
       `INSERT INTO subgrupo_evento (id_subrupo, id__evento, cupos, cupos_suplente) VALUES ($1, $2, $3, $4)`,
       [id_subgrupo, id_evento]
     );
     return result.rows[0];
   }*/

  async obtenerEstadisticasSubevento(eventoId: number, subgrupoId: number): Promise<any> {
    const { rows } = await pool.query(
      `SELECT 
        es.cupos as cupos_totales,
        es.cupos_suplente as cupos_suplente_totales,
        COUNT(CASE WHEN ie.es_suplente = FALSE THEN 1 END)::int as cupos_ocupados,
        COUNT(CASE WHEN ie.es_suplente = TRUE THEN 1 END)::int as suplentes_inscritos,
        (es.cupos - COUNT(CASE WHEN ie.es_suplente = FALSE THEN 1 END))::int as cupos_disponibles,
        (es.cupos_suplente - COUNT(CASE WHEN ie.es_suplente = TRUE THEN 1 END))::int as suplentes_disponibles
       FROM subgrupo_evento es
       LEFT JOIN inscripcion_evento ie ON es.id_subgrupo = ie.id_subgrupo
       WHERE es.id_evento = $1 
       AND es.id_subgrupo = $2
       GROUP BY es.id_evento, es.cupos, es.cupos_suplente`,
      [eventoId, subgrupoId]
    );

    return rows[0] || {
      cupos_totales: 0,
      cupos_ocupados: 0,
      cupos_disponibles: 0,
      cupos_suplente_totales: 0,
      suplentes_inscritos: 0,
      suplentes_disponibles: 0
    };
  }

  async inscribirUsuarioSubgrupos(payload: InscripcionPayload): Promise<string> {
    console.log('payload', payload)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verificar evento
      const { rows: eventos } = await client.query(
        'SELECT * FROM evento WHERE id_evento = $1',
        [payload.eventoId]
      );
      if (eventos.length === 0) throw new Error('El evento no existe');
      const evento = eventos[0];

      // Verificar estado del evento
      if (evento.estado === 'cancelado') throw new Error('El evento fue cancelado');
      if (evento.estado === 'transcurrido') throw new Error('El evento ya finalizó');

      // 2. Verificar si ya está inscrito (como titular o suplente)
      const { rows: yaInscrito } = await client.query(
        'SELECT 1 FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2',
        [payload.eventoId, payload.usuarioId]
      );
      if (yaInscrito.length > 0) {
        throw new Error('Ya estás inscrito en este evento');
      }


      // 3. Verificar fecha límite de inscripción
      if (evento.fecha_limite_inscripcion && new Date() > new Date(evento.fecha_limite_inscripcion))
        throw new Error('La fecha límite de inscripción ya pasó');

      // 4. Obtener estadísticas de cupos
      const stats = await this.obtenerEstadisticasSubevento(payload.eventoId, parseInt(payload.subgrupo!)); 

      // 5. Determinar si será suplente o titular
      let esSuplente = false;
      let ordenSuplente = null;

      if (stats.cupos_disponibles <= 0) {
        // No hay cupos titulares, verificar si puede ser suplente

        // Verificar fecha límite de baja (después de esta fecha no se aceptan suplentes)
        if (evento.fecha_limite_baja) {
          const fechaLimiteBaja = new Date(evento.fecha_limite_baja);
          const fechaActual = new Date();
          if (fechaActual > fechaLimiteBaja) {
            throw new Error('Ya no se aceptan inscripciones como suplente. La fecha límite de baja ha pasado.');
          }
        }

        // Verificar si hay cupos de suplente disponibles
        if (stats.suplentes_disponibles <= 0) {
          throw new Error('No hay cupos disponibles para titulares ni suplentes, intenta con otro subgrupo.');
        }

        esSuplente = true;
        // Obtener el próximo número de orden
        const { rows: maxOrden } = await client.query(
          `SELECT COALESCE(MAX(orden_suplente), 0) + 1 as siguiente_orden 
             FROM inscripcion_evento 
             WHERE id_evento = $1 AND es_suplente = TRUE`,
          [payload.eventoId]
        );
        ordenSuplente = maxOrden[0].siguiente_orden;
      }

      // 6. Obtener datos del usuario
      const { rows: usuarios } = await client.query(
        'SELECT email, nombre, apellido FROM usuario WHERE id_usuario = $1',
        [payload.usuarioId]
      );
      if (usuarios.length === 0) throw new Error('Usuario no encontrado');
      const usuario = usuarios[0];



      // 7. Insertar inscripción
      await client.query(
        `INSERT INTO inscripcion_evento 
           (id_usuario, id_evento, fecha_inscripcion, residencia, rol, primera_vez, anio_carrera, es_suplente, orden_suplente, carrera, id_subgrupo) 
           VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          payload.usuarioId,
          payload.eventoId,
          payload.residencia,
          payload.rol,
          payload.primeraVez,
          payload.anioCarrera || null,
          esSuplente,
          ordenSuplente,
          payload.carrera,
          payload.subgrupo || null
        ]
      );

      await client.query('COMMIT');
      /*/ Emit event to notify clients that inscripciones / suplentes changed
      try {
        getIO().emit('suplentes_actualizados', { eventoId: payload.eventoId });
      } catch (emitErr) {
        console.error('[SOCKET EMIT] inscribirUsuario error emitting suplentes_actualizados', emitErr);
      }*/

      // 8. Enviar email de confirmación
      try {
        const nombreCompleto = `${usuario.nombre} ${usuario.apellido}`;
        if (esSuplente) {
          await this.emailService.enviarConfirmacionInscripcionSuplente(
            usuario.email,
            nombreCompleto,
            evento,
            ordenSuplente!
          );
        } else {
          await this.emailService.enviarConfirmacionInscripcion(
            usuario.email,
            nombreCompleto,
            evento
          );
        }
      } catch (emailError) {
        console.error('Error al enviar email de confirmación:', emailError);
      }

      const mensaje = esSuplente
        ? `Inscripción realizada como SUPLENTE (posición #${ordenSuplente} en lista de espera)`
        : 'Inscripción realizada con éxito';

      return mensaje;

    } catch (error: any) {
      await client.query('ROLLBACK');
      console.error(error)
      throw new Error(error.message);
    } finally {
      client.release();
    }
  }

  async crearEventoDeSubgrupos(subevento: Subevento) {
    const result = await pool.query(
      `INSERT INTO subgrupo_evento (id_subgrupo, id_evento, cupos, cupos_suplente) VALUES ($1, $2, $3, $4)`,
      [subevento.id_subgrupo, subevento.id_evento, subevento.cupos, subevento.cupos_suplente]
    );
    return result.rows[0];
  }


  // ==================== MÉTODOS PARA SUPLENTES ====================

  // Obtiene la lista de suplentes de un evento ordenados por su posición en base a un subgrupo
  async obtenerSuplentesSubgrupo(eventoId: number, subgrupoId: number): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT 
        ie.id_inscripcion,
        ie.id_evento,
        u.id_usuario,
        u.nombre, 
        u.apellido, 
        u.dni_usuario, 
        u.numero_alumno AS "numeroAlumno",  
        u.tipo_documento, 
        u.nacionalidad, 
        ie.fecha_inscripcion, 
        ie.orden_suplente
       FROM inscripcion_evento ie
       JOIN usuario u ON u.id_usuario = ie.id_usuario
       WHERE ie.id_evento = $1 AND ie.es_suplente = TRUE AND ie.id_subgrupo = $2
       ORDER BY ie.orden_suplente ASC`,
      [eventoId, subgrupoId]
    );

    // Debug log para verificar qué devuelve la consulta
    console.log(`[DEBUG] obtenerSuplentes eventoId=${eventoId} -> rows=${rows.length}`);
    if (rows.length > 0) console.log(rows.slice(0, 10));

    return rows;
  }

  // Dar de baja a un usuario y promover al primer suplente si corresponde
  async darDeBajaYPromoverSuplente(eventoId: number, usuarioId: number, subgrupoId: number): Promise<string> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verificar que el usuario está inscrito
      const { rows: inscripcion } = await client.query(
        `SELECT * FROM inscripcion_evento 
         WHERE id_evento = $1 AND id_usuario = $2 AND id_subgrupo = $3`,
        [eventoId, usuarioId]
      );

      if (inscripcion.length === 0) {
        throw new Error('No estás inscrito en este evento');
      }

      const inscripcionActual = inscripcion[0];

      // 2. Verificar fecha límite de baja
      const { rows: eventos } = await client.query(
        'SELECT * FROM evento WHERE id_evento = $1',
        [eventoId]
      );
      const evento = eventos[0];

      if (evento.fecha_limite_baja) {
        const fechaLimite = new Date(evento.fecha_limite_baja);
        const fechaActual = new Date();
        if (fechaActual > fechaLimite) {
          throw new Error('La fecha límite para darse de baja ya pasó');
        }
      }

      // 3. Eliminar la inscripción
      await client.query(
        'DELETE FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2 AND id_subgrupo = $3',
        [eventoId, usuarioId, subgrupoId]
      );

      let mensajePromocion = '';

      // 4. Si era titular, promover al primer suplente
      if (!inscripcionActual.es_suplente) {
        const { rows: primerSuplente } = await client.query(
          `SELECT ie.*, u.email, u.nombre, u.apellido
           FROM inscripcion_evento ie
           JOIN usuario u ON u.id_usuario = ie.id_usuario
           WHERE ie.id_evento = $1 AND ie.es_suplente = TRUE AND ie.id_subgrupo = $2
           ORDER BY ie.orden_suplente ASC
           LIMIT 1`,
          [eventoId, subgrupoId]
        );

        if (primerSuplente.length > 0) {
          const suplente = primerSuplente[0];

          // Actualizar al suplente para que sea titular
          await client.query(
            `UPDATE inscripcion_evento 
             SET es_suplente = FALSE, 
                 orden_suplente = NULL,
                 fecha_paso_a_titular = CURRENT_TIMESTAMP
             WHERE id_evento = $1 AND id_usuario = $2 AND id_subgrupo = $3`,
            [eventoId, suplente.id_usuario, subgrupoId]
          );

          // Actualizar el orden de los demás suplentes
          await client.query(
            `UPDATE inscripcion_evento 
             SET orden_suplente = orden_suplente - 1
             WHERE id_evento = $1 AND es_suplente = TRUE AND orden_suplente > $2 AND id_subgrupo = $3`,
            [eventoId, suplente.orden_suplente, subgrupoId]
          );

          mensajePromocion = ` Se ha promovido a ${suplente.nombre} ${suplente.apellido} de suplente a titular.`;

          // Enviar email al suplente promovido
          try {
            await this.emailService.enviarNotificacionPromocionSuplente(
              suplente.email,
              `${suplente.nombre} ${suplente.apellido}`,
              evento
            );
          } catch (emailError) {
            console.error('Error al enviar email de promoción:', emailError);
          }
        }
      } else {
        // Si era suplente, solo reordenar los suplentes siguientes
        await client.query(
          `UPDATE inscripcion_evento 
           SET orden_suplente = orden_suplente - 1
           WHERE id_evento = $1 AND es_suplente = TRUE AND orden_suplente > $2  AND id_subgrupo = $3`,
          [eventoId, inscripcionActual.orden_suplente, subgrupoId]
        );
      }

      await client.query('COMMIT');

      // Notify clients about suplentes/inscripciones changes
      // try {
      //   getIO().emit('suplentes_actualizados', { eventoId });
      // } catch (emitErr) {
      //   console.error('[SOCKET EMIT] darDeBajaYPromoverSuplente error emitting suplentes_actualizados', emitErr);
      // }

      return `Baja realizada con éxito.${mensajePromocion}`;

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw new Error(error.message);
    } finally {
      client.release();
    }
  }

  // Eliminar un suplente específico (sin promover a nadie) y reordenar los restantes
  async eliminarSuplente(eventoId: number, usuarioId: number, subgrupoId: number): Promise<string> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar que la inscripción existe y es suplente
      const { rows: inscripcion } = await client.query(
        `SELECT * FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2 AND es_suplente = TRUE AND id_subgrupo = $3`,
        [eventoId, usuarioId, subgrupoId]
      );

      if (inscripcion.length === 0) {
        throw new Error('El suplente no existe para este evento');
      }

      const orden = inscripcion[0].orden_suplente;

      // Eliminar la inscripción
      await client.query(
        'DELETE FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2 AND es_suplente = TRUE  AND id_subgrupo = $3',
        [eventoId, usuarioId, subgrupoId]
      );

      // Reordenar los suplentes siguientes
      await client.query(
        `UPDATE inscripcion_evento SET orden_suplente = orden_suplente - 1
         WHERE id_evento = $1 AND es_suplente = TRUE AND orden_suplente > $2 AND id_subgrupo = $3`,
        [eventoId, orden, subgrupoId]
      );

      await client.query('COMMIT');

      /* Notify clients that suplentes changed
      try {
        getIO().emit('suplentes_actualizados', { eventoId });
      } catch (emitErr) {
        console.error('[SOCKET EMIT] eliminarSuplente error emitting suplentes_actualizados', emitErr);
      }*/

      return 'Suplente eliminado correctamente';
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw new Error(err.message);
    } finally {
      client.release();
    }
  }
}



