import pool from '../db';
import { Evento } from '../tipos/tipos';
import { InscripcionPayload } from '../tipos/tipos';
import { EmailService } from './emailService';
// import { getIO } from '../socket'; // Socket.io no usado por ahora

export class EventoServices {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  async crearInscripcionTemporal(eventoId: number, usuarioId: number): Promise<number> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar si el usuario ya tiene una inscripción pendiente
      const { rows: inscripcionesExistentes } = await client.query(
        `SELECT * FROM inscripcion_evento
         WHERE id_evento = $1 AND id_usuario = $2`,
        [eventoId, usuarioId]
      );

      if (inscripcionesExistentes.length > 0) {
        return inscripcionesExistentes[0].id_inscripcion;
      }

      const evento = await this.obtenerEvento(eventoId);
      if (!evento) throw new Error('No existe el evento especificado')

      // Verificar cupos
      const cantidadInscriptos = await this.contarInscriptos(eventoId);
      if (evento.cupos !== null && cantidadInscriptos >= evento.cupos) throw new Error('No hay cupos disponibles');

      const { rows } = await client.query(
        `INSERT INTO inscripcion_evento
         (id_usuario, id_evento, fecha_inscripcion)
         VALUES ($1, $2, CURRENT_DATE)
         RETURNING id_inscripcion`,
        [usuarioId, eventoId]
      );

      await client.query('COMMIT');
      return rows[0].id_inscripcion;
    } catch (error) {
      console.error(error)
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async confirmarInscripcion(inscripcionId: number): Promise<void> {
    // Since the database doesn't have an estado column, we don't need to do anything
    // The inscription was already created, so it's confirmed by the payment success
    console.log(`Inscripción ${inscripcionId} confirmada por pago exitoso`);
  }

  async obtenerEventos(): Promise<Evento[]> {
    const { rows } = await pool.query<Evento>('SELECT * FROM evento');
    return rows;
  }

  async obtenerEventosVigentes(id_usuario: number): Promise<Evento[]> {
    if (!id_usuario) {
      const { rows } = await pool.query<Evento>(
        `SELECT 
            e.*, 
            g.nombre as nombre_grupo,
      -- Cálculo de cupos disponibles
            (e.cupos - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = FALSE THEN ie.id_usuario END), 0))::int as cupos_disponibles,
        -- Cálculo de cupos suplentes
            (e.cupos_suplente - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = TRUE THEN ie.id_usuario END), 0))::int as suplentes_disponibles
        FROM evento e
        LEFT JOIN evento_grupo eg ON e.id_evento = eg.id_evento
        LEFT JOIN grupo g ON eg.id_grupo = g.id_grupo
        -- Join necesario para contar las personas inscritas
        LEFT JOIN inscripcion_evento ie ON e.id_evento = ie.id_evento
        WHERE e.estado = $1
          AND (
            -- Eventos asociados a grupos públicos
            g."solicitudNecesitada" = FALSE
            -- O eventos sin grupo asociado
            OR g.id_grupo IS NULL
          )
        GROUP BY e.id_evento, g.id_grupo, g.nombre
        ORDER BY e.fecha ASC;`,
        ['vigente']
      );
      return rows;
    }
    const { rows } = await pool.query<Evento>(
      `SELECT 
          e.*, 
          g.nombre as nombre_grupo,
          -- Cálculo de cupos disponibles
          (e.cupos - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = FALSE THEN ie.id_usuario END), 0))::int as cupos_disponibles,
          -- Cálculo de cupos suplentes
          (e.cupos_suplente - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = TRUE THEN ie.id_usuario END), 0))::int as suplentes_disponibles
      FROM evento e
        LEFT JOIN evento_grupo eg ON e.id_evento = eg.id_evento
        LEFT JOIN grupo g ON eg.id_grupo = g.id_grupo
      -- Join 1: Verificar permisos del usuario en grupos privados
      LEFT JOIN "preferencia_grupo" pg 
          ON g.id_grupo = pg.id_grupo 
          AND pg.id_usuario = $1 
      -- Join 2: Contar inscritos para calcular cupos
      LEFT JOIN inscripcion_evento ie ON e.id_evento = ie.id_evento
      WHERE e.estado = 'vigente'
      AND (
          -- Eventos sin grupo: visibles para todos los usuarios
          g.id_grupo IS NULL
          OR (
            -- El grupo es público
            g."solicitudNecesitada" = FALSE
          )
          OR (
            -- Grupo privado y el usuario está aprobado
            g."solicitudNecesitada" = TRUE AND pg.status = 'aprobado'
          )
      )
      GROUP BY e.id_evento, g.id_grupo, g.nombre
      ORDER BY e.fecha ASC;`,
      [id_usuario]
    );
    return rows;
  }

  // Obtiene todos los eventos vigentes sin filtrar por visibilidad del grupo
  // Pensado para roles con acceso total (admin, secretaria general)
  async obtenerEventosVigentesAdmin(): Promise<Evento[]> {
    const { rows } = await pool.query<Evento>(
      `SELECT 
          e.*, 
          g.nombre as nombre_grupo,
          (e.cupos - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = FALSE THEN ie.id_usuario END), 0))::int as cupos_disponibles,
          (e.cupos_suplente - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = TRUE THEN ie.id_usuario END), 0))::int as suplentes_disponibles
      FROM evento e
      LEFT JOIN evento_grupo eg ON e.id_evento = eg.id_evento
      LEFT JOIN grupo g ON eg.id_grupo = g.id_grupo
      LEFT JOIN inscripcion_evento ie ON e.id_evento = ie.id_evento
      WHERE e.estado = 'vigente'
      GROUP BY e.id_evento, g.id_grupo, g.nombre
      ORDER BY e.fecha ASC;`
    );
    return rows;
  }

  // Obtiene solo los eventos cuya fecha ya pasó (transcurridos)
  async obtenerEventosTranscurridos(): Promise<Evento[]> {
    const { rows } = await pool.query<Evento>(
      `SELECT 
         e.*,
         g.nombre as nombre_grupo
       FROM evento e
       LEFT JOIN evento_grupo eg ON e.id_evento = eg.id_evento
       LEFT JOIN grupo g ON eg.id_grupo = g.id_grupo
       WHERE e.estado = $1
       ORDER BY e.fecha DESC`,
      ['transcurrido']
    );
    return rows;
  }

  // Obtiene solo los eventos con estado cancelado
  async obtenerEventosCancelados(): Promise<Evento[]> {
    const { rows } = await pool.query<Evento>(
      `SELECT 
         e.*,
         g.nombre as nombre_grupo
       FROM evento e
       LEFT JOIN evento_grupo eg ON e.id_evento = eg.id_evento
       LEFT JOIN grupo g ON eg.id_grupo = g.id_grupo
       WHERE e.estado = $1
       ORDER BY e.fecha DESC`,
      ['cancelado']
    );
    return rows;
  }

  async obtenerEvento(eventoId: number): Promise<Evento | undefined> {
    const { rows } = await pool.query<Evento>(
      `SELECT 
         e.*,
         (e.cupos - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = FALSE THEN ie.id_usuario END), 0))::int as cupos_disponibles,
         (e.cupos_suplente - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = TRUE THEN ie.id_usuario END), 0))::int as suplentes_disponibles
       FROM evento e
       LEFT JOIN inscripcion_evento ie ON e.id_evento = ie.id_evento
       WHERE e.id_evento = $1
       GROUP BY e.id_evento`,
      [eventoId]
    );
    return rows[0];
  }

  async obtenerEventosPorGrupo(grupoId: number): Promise<Evento[]> {
    const { rows } = await pool.query<Evento>(
      'SELECT * FROM evento as e JOIN evento_grupo as eg ON e.id_evento = eg.id_evento WHERE eg.id_grupo = $1 AND e.estado = $2',
      [grupoId, 'vigente']
    );
    return rows;
  }


  // Elimina un evento de la tabla "evento"
  async eliminarEvento(eventoId: number): Promise<Evento | undefined> {
    // 1. Contar inscriptos
    const inscriptos = await this.contarInscriptos(eventoId);

    if (inscriptos > 0) {
      // 2. Si hay inscriptos, no eliminar y lanzar error
      throw new Error('No se puede eliminar el evento porque tiene usuarios inscritos');
    }

    // 3. Si no hay inscriptos, eliminar
    const { rows } = await pool.query<Evento>(
      'DELETE FROM evento WHERE id_evento = $1 RETURNING *',
      [eventoId]
    );

    return rows[0]; // Evento eliminado o undefined si no existía
  }

  // Cancela un evento y envía notificaciones por email a todos los inscriptos
  async cancelarEvento(eventoId: number): Promise<Evento | undefined> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Obtener información del evento
      const { rows: eventos } = await client.query<Evento>(
        'SELECT * FROM evento WHERE id_evento = $1',
        [eventoId]
      );

      if (eventos.length === 0) {
        throw new Error('El evento no existe');
      }

      const evento = eventos[0];

      // 2. Cambiar estado del evento a 'cancelado'
      const { rows } = await client.query<Evento>(
        `UPDATE evento SET estado = 'cancelado' WHERE id_evento = $1 RETURNING *`,
        [eventoId]
      );

      // 3. Obtener todos los inscriptos con sus emails
      const { rows: inscriptos } = await client.query(
        `SELECT u.email, u.nombre, u.apellido 
         FROM inscripcion_evento i
         JOIN usuario u ON u.id_usuario = i.id_usuario
         WHERE i.id_evento = $1`,
        [eventoId]
      );

      // 4. Enviar email a cada inscripto
      const emailPromises = inscriptos.map(inscripto => {
        const subject = `Evento Cancelado: ${evento.nombre}`;
        const text = `Hola ${inscripto.nombre} ${inscripto.apellido},\n\nLamentamos informarte que el evento "${evento.nombre}" programado para el ${new Date(evento.fecha).toLocaleDateString()} ha sido cancelado.\n\nDisculpa las molestias.\n\nSaludos,\nInstituto Misionero`;
        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #dc2626;">Evento Cancelado</h2>
            <p>Hola <strong>${inscripto.nombre} ${inscripto.apellido}</strong>,</p>
            <p>Lamentamos informarte que el evento <strong>"${evento.nombre}"</strong> programado para el <strong>${new Date(evento.fecha).toLocaleDateString()}</strong> ha sido <strong>cancelado</strong>.</p>
            <p>Disculpa las molestias.</p>
            <br>
            <p>Saludos,<br><strong>Instituto Misionero</strong></p>
          </div>
        `;

        return this.emailService.enviarEmail(inscripto.email, subject, text, html);
      });

      // Enviar todos los emails en paralelo
      await Promise.all(emailPromises);

      await client.query('COMMIT');
      return rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  // HASTA ACA TODO BIEN 
  //CAMBIO DE ACTUALIZAR EVENTOS CONFORME AL METODO PAGO.

  async actualizarEvento(
    eventoId: number,
    cambios: {
      fecha?: Date;
      descripcion?: string;
      cupos?: number;
      cupos_suplente?: number;
      fecha_limite_inscripcion?: Date;
      fecha_limite_baja?: Date;
      costo?: Number,
      cuenta_destino?: string// llamar a soporte cambiar cada año conforme a
    }
  ): Promise<Evento> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const { fecha, descripcion, cupos, cupos_suplente, fecha_limite_inscripcion, fecha_limite_baja, costo, cuenta_destino } = cambios;

      // Obtener evento actual
      const { rows: eventoActual } = await client.query<Evento>(
        'SELECT * FROM evento WHERE id_evento = $1',
        [eventoId]
      );

      if (eventoActual.length === 0) {
        throw new Error('Evento no encontrado');
      }

      const evento = eventoActual[0];
      const cuposAnteriores = evento.cupos;

      // Validar cupos actuales vs inscritos TITULARES (no suplentes)
      const { rows: inscritosTitulares } = await client.query(
        'SELECT COUNT(*) as total FROM inscripcion_evento WHERE id_evento = $1 AND es_suplente = FALSE',
        [eventoId]
      );
      const cantidadTitulares = parseInt(inscritosTitulares[0].total);

      if (cupos !== undefined && cantidadTitulares > cupos) {
        throw new Error('El número de cupos no puede ser menor a la cantidad de inscriptos titulares actuales');
      }

      // Validar fechas límite
      if (fecha_limite_inscripcion && fecha) {
        if (new Date(fecha_limite_inscripcion) > new Date(fecha)) {
          throw new Error('La fecha límite de inscripción no puede ser posterior a la fecha del evento');
        }
      }
      if (fecha_limite_baja && fecha) {
        if (new Date(fecha_limite_baja) > new Date(fecha)) {
          throw new Error('La fecha límite de baja no puede ser posterior a la fecha del evento');
        }
      }


      // If reducing suplente slots, ensure current suplentes fit
      if (cupos_suplente !== undefined) {
        const { rows: suplentesCountRows } = await client.query(
          'SELECT COUNT(*) as total FROM inscripcion_evento WHERE id_evento = $1 AND es_suplente = TRUE',
          [eventoId]
        );
        const suplentesInscritos = parseInt(suplentesCountRows[0].total, 10);
        if (cupos_suplente < suplentesInscritos) {
          throw new Error('El número de cupos suplentes no puede ser menor a la cantidad de suplentes inscritos actuales');
        }
      }

      // Actualizar evento (incluye cupos_suplente)
      const { rows } = await client.query<Evento>(
        `UPDATE evento SET 
        fecha = COALESCE($1, fecha),
        descripcion = COALESCE($2, descripcion),
        cupos = COALESCE($3, cupos),
        cupos_suplente = COALESCE($4, cupos_suplente),
        fecha_limite_inscripcion = COALESCE($5, fecha_limite_inscripcion),
        fecha_limite_baja = COALESCE($6, fecha_limite_baja),
        costo = COALESCE($7, costo)
       WHERE id_evento = $8
       RETURNING *`,
        [fecha, descripcion, cupos, cupos_suplente, fecha_limite_inscripcion, fecha_limite_baja, costo, eventoId]
      );

      const eventoActualizado = rows[0];

      // Si se aumentaron los cupos, promover suplentes automáticamente
      if (cupos !== undefined && cupos > cuposAnteriores) {
        const cuposDisponibles = cupos - cantidadTitulares;

        if (cuposDisponibles > 0) {
          // Obtener suplentes en orden
          const { rows: suplentes } = await client.query(
            `SELECT ie.*, u.email, u.nombre, u.apellido
             FROM inscripcion_evento ie
             JOIN usuario u ON u.id_usuario = ie.id_usuario
             WHERE ie.id_evento = $1 AND ie.es_suplente = TRUE
             ORDER BY ie.orden_suplente ASC
             LIMIT $2`,
            [eventoId, cuposDisponibles]
          );

          // Promover cada suplente a titular
          for (const suplente of suplentes) {
            // Actualizar a titular
            await client.query(
              `UPDATE inscripcion_evento 
               SET es_suplente = FALSE, 
                   orden_suplente = NULL,
                   fecha_paso_a_titular = CURRENT_TIMESTAMP
               WHERE id_evento = $1 AND id_usuario = $2`,
              [eventoId, suplente.id_usuario]
            );

            // Enviar email de notificación
            try {
              await this.emailService.enviarNotificacionPromocionSuplente(
                suplente.email,
                `${suplente.nombre} ${suplente.apellido}`,
                eventoActualizado
              );
            } catch (emailError) {
              console.error('Error al enviar email de promoción:', emailError);
            }
          }

          // Reordenar los suplentes restantes
          await client.query(
            `UPDATE inscripcion_evento 
             SET orden_suplente = orden_suplente - $1
             WHERE id_evento = $2 AND es_suplente = TRUE`,
            [suplentes.length, eventoId]
          );
        }
      }

      await client.query('COMMIT');
      // Emit socket event to notify clients that suplente list / cupos changed
      // try {
      //   getIO().emit('suplentes_actualizados', { eventoId });
      // } catch (emitErr) {
      //   console.error('[SOCKET EMIT] actualizarEvento error emitting suplentes_actualizados', emitErr);
      // }
      return eventoActualizado;

    } catch (error: any) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }


  //funcion para eliminar un inscrito a un evento
  async eliminarInscripto(eventoId: number, usuarioId: number): Promise<number> {
    const id_evento = await pool.query(
      'DELETE FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2 RETURNING id_evento',
      [eventoId, usuarioId]
    );
    return id_evento.rows[0]
  }


  async asignarCupos(eventoId: number, cupos: number): Promise<Evento | undefined> {
    const { rows } = await pool.query<Evento>('UPDATE evento SET cupos = $1 WHERE id_evento = $2',
      [cupos, eventoId]
    )
    return rows[0]
  }

  // Crea un nuevo evento en la base de datos
  async crearEvento(
    nombre: string,
    fecha: Date,
    descripcion: string | undefined,
    cupos: number,
    cupos_suplente: number,
    lugar: string,
    categoria: 'salida' | 'normal' | 'pago',
    fechaLimiteInscripcion?: Date,
    fechaLimiteBaja?: Date,
    costo?: number,
    cuenta_destino?: string,
  ): Promise<Evento> {
    if (categoria === 'pago') {
    
    // cuenta_destino es null si no se proporciona.
    const finalCuentaDestino = cuenta_destino ?? null; 

    console.log(cupos,'cc', cupos_suplente)

    const { rows } = await pool.query<Evento>(
        `INSERT INTO evento 
          (nombre, fecha, descripcion, cupos, cupos_suplente, fecha_limite_inscripcion, fecha_limite_baja, lugar, estado, categoria, costo, cuenta_destino)
        VALUES ($1,$2,$3,$4,$5,$6,$7, $8, 'vigente', $9, $10, $11) 
        RETURNING *`,
        [
          nombre, fecha, descripcion, cupos, cupos_suplente, fechaLimiteInscripcion ?? null, fechaLimiteBaja ?? null, lugar, categoria, 
          costo, finalCuentaDestino  
        ]
    );
    return rows[0];
  } else {
      const { rows } = await pool.query<Evento>(
        `INSERT INTO evento 
          (nombre, fecha, descripcion, cupos, cupos_suplente, fecha_limite_inscripcion, fecha_limite_baja, lugar, estado, categoria)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'vigente',$9)
        RETURNING *`,
        [nombre, fecha, descripcion, cupos, cupos_suplente, fechaLimiteInscripcion, fechaLimiteBaja, lugar, categoria]
      );
      return rows[0];
    }
  }


  // Cuenta la cantidad de inscriptos a un evento, dado un id_evento
  // Retorna un número (0 si no hay inscriptos)
  async contarInscriptos(eventoId: number): Promise<number> {
    const { rows } = await pool.query(
      'SELECT COUNT(*) FROM inscripcion_evento WHERE id_evento = $1',
      [eventoId]
    );
    return parseInt(rows[0].count, 10);
  }

  // Obtiene la lista de inscriptos a un evento, dado un id_evento
  // Retorna un array de objetos con la información de los inscriptos TITULARES (no suplentes)
  async obtenerInscriptos(eventoId: number): Promise<any[]> {
    const { rows } = await pool.query(
      `SELECT 
        u.nombre, 
        u.apellido, 
        u.dni_usuario, 
        u.numero_alumno AS "numeroAlumno",  
        u.tipo_documento, 
        u.nacionalidad, 
        i.fecha_inscripcion, 
        u.id_usuario,
        i.fecha_paso_a_titular
       FROM inscripcion_evento i
       JOIN usuario u ON u.id_usuario = i.id_usuario
       WHERE i.id_evento = $1 AND i.es_suplente = FALSE
       ORDER BY i.fecha_inscripcion ASC`,
      [eventoId]
    );
    return rows;
  }

  // Inscribe a un usuario en un evento, verificando cupos y si ya está inscrito
  async inscribirUsuario(payload: InscripcionPayload & { nombreRemitente?: string; comprobante?: string }): Promise<string> {
    console.log('payload', payload)
    let client;
    try {
      console.log('🔄 Intentando obtener conexión del pool...');
      client = await pool.connect();
      console.log('✅ Conexión obtenida exitosamente');
      
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
      const stats = await this.obtenerEstadisticasEvento(payload.eventoId);

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
          throw new Error('No hay cupos disponibles ni como suplente');
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
         (id_usuario, id_evento, fecha_inscripcion, residencia, rol, primera_vez, anio_carrera, es_suplente, orden_suplente, nombre_remitente, carrera, id_subgrupo) 
         VALUES ($1, $2, CURRENT_DATE, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        [
          payload.usuarioId,
          payload.eventoId,
          payload.residencia,
          payload.rol,
          payload.primeraVez,
          payload.anioCarrera || null,
          esSuplente,
          ordenSuplente,
          payload.nombreRemitente || null,
          payload.carrera, 
          payload.subgrupo || null
        ]
      );

      await client.query('COMMIT');
      // Emit event to notify clients that inscripciones / suplentes changed
      // try {
      //   getIO().emit('suplentes_actualizados', { eventoId: payload.eventoId });
      // } catch (emitErr) {
      //   console.error('[SOCKET EMIT] inscribirUsuario error emitting suplentes_actualizados', emitErr);
      // }

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
      if (client) {
        await client.query('ROLLBACK');
      }
      console.error('❌ Error en inscribirUsuario:', error);
      console.error('Stack:', error.stack);
      throw new Error(error.message || 'Error al inscribir usuario');
    } finally {
      if (client) {
        client.release();
        console.log('🔓 Conexión liberada');
      }
    }
  }

  // Verifica si un usuario específico está inscrito en un evento específico
  async verificarInscripcionUsuario(eventoId: number, usuarioId: number): Promise<boolean> {
    try {
      console.log(`Verificando inscripción: eventoId=${eventoId}, usuarioId=${usuarioId}`);

      const { rows } = await pool.query(
        'SELECT COUNT(*) as count FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2',
        [eventoId, usuarioId]
      );

      const count = parseInt(rows[0].count);
      const estaInscrito = count > 0;

      console.log(`Resultado consulta: count=${count}, estaInscrito=${estaInscrito}`);

      return estaInscrito;
    } catch (error: any) {
      console.error(`Error en verificarInscripcionUsuario (eventoId=${eventoId}, usuarioId=${usuarioId}):`, error);
      throw new Error(`Error al verificar inscripción: ${error.message}`);
    }
  }

  // Logica para obtener los eventos en los que el usuario actual está inscrito
  async obtenerEventosInscritosPorUsuario(usuarioId: number): Promise<Evento[]> {
    const { rows } = await pool.query<Evento>(
      `SELECT e.*, i.fecha_inscripcion, i.fecha_limite_baja
      FROM inscripcion_evento i
      JOIN evento e ON i.id_evento = e.id_evento
      WHERE i.id_usuario = $1
      ORDER BY e.fecha ASC`,
      [usuarioId]
    );
    return rows;
  }

  // Obtiene los eventos donde el usuario está inscrito
  async obtenerMisEventos(usuarioId: number): Promise<Evento[]> {
    try {
      const { rows } = await pool.query<Evento>(
        `SELECT e.*, 
                ie.es_suplente, 
                ie.orden_suplente 
         FROM evento e 
         INNER JOIN inscripcion_evento ie ON e.id_evento = ie.id_evento 
         WHERE ie.id_usuario = $1 AND e.estado = 'vigente'
         ORDER BY e.fecha ASC`,
        [usuarioId]
      );
      return rows;
    } catch (error: any) {
      console.error(`Error en obtenerMisEventos (usuarioId=${usuarioId}):`, error);
      throw new Error(`Error al obtener tus eventos: ${error.message}`);
    }
  }

  // Obtiene los eventos disponibles donde el usuario NO está inscrito
  async obtenerEventosDisponibles(usuarioId: number): Promise<Evento[]> {
    try {
      const { rows } = await pool.query<Evento>(
        `SELECT 
    e.*,
    g.nombre as nombre_grupo,
    -- Cálculo de Cupos
    (e.cupos - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = FALSE THEN ie.id_usuario END), 0))::int as cupos_disponibles,
    (e.cupos_suplente - COALESCE(COUNT(DISTINCT CASE WHEN ie.es_suplente = TRUE THEN ie.id_usuario END), 0))::int as suplentes_disponibles
FROM evento e 
-- 1. CAMBIO IMPORTANTE: LEFT JOIN para incluir eventos sin grupo
LEFT JOIN evento_grupo eg ON e.id_evento = eg.id_evento
LEFT JOIN grupo g ON eg.id_grupo = g.id_grupo
-- 2. Verificamos permisos (se mantiene igual)
LEFT JOIN "preferencia_grupo" pg ON g.id_grupo = pg.id_grupo AND pg.id_usuario = $1
-- 3. Join para contar inscritos (se mantiene igual)
LEFT JOIN inscripcion_evento ie ON e.id_evento = ie.id_evento
WHERE 
    e.estado = 'vigente' 
    AND (
        -- Caso A: El evento NO tiene grupo (es global/abierto)
        g.id_grupo IS NULL
        OR
        -- Caso B: Tiene grupo y es público
        g."solicitudNecesitada" = FALSE
        OR 
        -- Caso C: Tiene grupo privado y el usuario está aprobado
        pg.status = 'aprobado'
    )
    -- Excluir eventos donde ya está inscrito
    AND e.id_evento NOT IN (
        SELECT ie2.id_evento FROM inscripcion_evento ie2 
        WHERE ie2.id_usuario = $1
    )
GROUP BY e.id_evento, g.id_grupo, g.nombre
ORDER BY e.fecha ASC;`,
        [usuarioId]
      );
      return rows;
    } catch (error: any) {
      console.error(`Error en obtenerEventosDisponibles (usuarioId=${usuarioId}):`, error);
      throw new Error(`Error al obtener eventos disponibles: ${error.message}`);
    }
  }

  // Dar de baja la inscripción del usuario a un evento
  async darDeBajaInscripcion(eventoId: number, usuarioId: number): Promise<void> {
    try {
      // Verificar que el usuario esté inscrito
      const { rows } = await pool.query(
        'SELECT 1 FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2',
        [eventoId, usuarioId]
      );

      if (rows.length === 0) {
        throw new Error('No estás inscrito en este evento');
      }

      // Verificar que la fecha límite de baja no haya pasado
      const { rows: eventoRows } = await pool.query<Evento>(
        'SELECT fecha_limite_baja FROM evento WHERE id_evento = $1',
        [eventoId]
      );

      if (eventoRows.length === 0) {
        throw new Error('Evento no encontrado');
      }

      const fechaLimiteBaja = new Date(eventoRows[0].fecha_limite_baja);
      const fechaActual = new Date();

      if (fechaActual > fechaLimiteBaja) {
        throw new Error('La fecha límite para darse de baja ha pasado');
      }

      // Eliminar la inscripción (CASCADE se encargará de las dependencias)
      await pool.query(
        'DELETE FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2',
        [eventoId, usuarioId]
      );

      // Emitir actualización para clientes conectados
      // try {
      //   getIO().emit('suplentes_actualizados', { eventoId });
      // } catch (emitErr) {
      //   console.error('[SOCKET EMIT] darDeBajaInscripcion error emitting suplentes_actualizados', emitErr);
      // }
    } catch (error: any) {
      console.error(`Error en darDeBajaInscripcion (eventoId=${eventoId}, usuarioId=${usuarioId}):`, error);
      throw error;
    }
  }

  // ==================== MÉTODOS PARA SUPLENTES ====================

  // Obtiene estadísticas de cupos de un evento (titulares y suplentes)
  async obtenerEstadisticasEvento(eventoId: number): Promise<any> {
    const { rows } = await pool.query(
      `SELECT 
        e.cupos as cupos_totales,
        e.cupos_suplente as cupos_suplente_totales,
        COUNT(CASE WHEN ie.es_suplente = FALSE THEN 1 END)::int as cupos_ocupados,
        COUNT(CASE WHEN ie.es_suplente = TRUE THEN 1 END)::int as suplentes_inscritos,
        (e.cupos - COUNT(CASE WHEN ie.es_suplente = FALSE THEN 1 END))::int as cupos_disponibles,
        (e.cupos_suplente - COUNT(CASE WHEN ie.es_suplente = TRUE THEN 1 END))::int as suplentes_disponibles
       FROM evento e
       LEFT JOIN inscripcion_evento ie ON e.id_evento = ie.id_evento
       WHERE e.id_evento = $1
       GROUP BY e.id_evento, e.cupos, e.cupos_suplente`,
      [eventoId]
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

  // Obtiene la lista de suplentes de un evento ordenados por su posición
  async obtenerSuplentes(eventoId: number): Promise<any[]> {
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
       WHERE ie.id_evento = $1 AND ie.es_suplente = TRUE
       ORDER BY ie.orden_suplente ASC`,
      [eventoId]
    );

    // Debug log para verificar qué devuelve la consulta
    console.log(`[DEBUG] obtenerSuplentes eventoId=${eventoId} -> rows=${rows.length}`);
    if (rows.length > 0) console.log(rows.slice(0, 10));

    return rows;
  }

  // Dar de baja a un usuario y promover al primer suplente si corresponde
  async darDeBajaYPromoverSuplente(eventoId: number, usuarioId: number): Promise<string> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verificar que el usuario está inscrito
      const { rows: inscripcion } = await client.query(
        `SELECT * FROM inscripcion_evento 
         WHERE id_evento = $1 AND id_usuario = $2`,
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
        'DELETE FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2',
        [eventoId, usuarioId]
      );

      let mensajePromocion = '';

      // 4. Si era titular, promover al primer suplente
      if (!inscripcionActual.es_suplente) {
        const { rows: primerSuplente } = await client.query(
          `SELECT ie.*, u.email, u.nombre, u.apellido
           FROM inscripcion_evento ie
           JOIN usuario u ON u.id_usuario = ie.id_usuario
           WHERE ie.id_evento = $1 AND ie.es_suplente = TRUE
           ORDER BY ie.orden_suplente ASC
           LIMIT 1`,
          [eventoId]
        );

        if (primerSuplente.length > 0) {
          const suplente = primerSuplente[0];

          // Actualizar al suplente para que sea titular
          await client.query(
            `UPDATE inscripcion_evento 
             SET es_suplente = FALSE, 
                 orden_suplente = NULL,
                 fecha_paso_a_titular = CURRENT_TIMESTAMP
             WHERE id_evento = $1 AND id_usuario = $2`,
            [eventoId, suplente.id_usuario]
          );

          // Actualizar el orden de los demás suplentes
          await client.query(
            `UPDATE inscripcion_evento 
             SET orden_suplente = orden_suplente - 1
             WHERE id_evento = $1 AND es_suplente = TRUE AND orden_suplente > $2`,
            [eventoId, suplente.orden_suplente]
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
           WHERE id_evento = $1 AND es_suplente = TRUE AND orden_suplente > $2`,
          [eventoId, inscripcionActual.orden_suplente]
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
  async eliminarSuplente(eventoId: number, usuarioId: number): Promise<string> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verificar que la inscripción existe y es suplente
      const { rows: inscripcion } = await client.query(
        `SELECT * FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2 AND es_suplente = TRUE`,
        [eventoId, usuarioId]
      );

      if (inscripcion.length === 0) {
        throw new Error('El suplente no existe para este evento');
      }

      const orden = inscripcion[0].orden_suplente;

      // Eliminar la inscripción
      await client.query(
        'DELETE FROM inscripcion_evento WHERE id_evento = $1 AND id_usuario = $2 AND es_suplente = TRUE',
        [eventoId, usuarioId]
      );

      // Reordenar los suplentes siguientes
      await client.query(
        `UPDATE inscripcion_evento SET orden_suplente = orden_suplente - 1
         WHERE id_evento = $1 AND es_suplente = TRUE AND orden_suplente > $2`,
        [eventoId, orden]
      );

      await client.query('COMMIT');

      // Notify clients that suplentes changed
      // try {
      //   getIO().emit('suplentes_actualizados', { eventoId });
      // } catch (emitErr) {
      //   console.error('[SOCKET EMIT] eliminarSuplente error emitting suplentes_actualizados', emitErr);
      // }

      return 'Suplente eliminado correctamente';
    } catch (err: any) {
      await client.query('ROLLBACK');
      throw new Error(err.message);
    } finally {
      client.release();
    }
  }
}
