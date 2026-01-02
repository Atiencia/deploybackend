import { Grupo, User } from '../tipos/tipos';
import pool from '../db';

export class GrupoService {

  // Obtiene todos los grupos registrados
  async obtenerGrupos(): Promise<Grupo[]> {
    const result = await pool.query('SELECT * FROM grupo');
    return result.rows;
  }

  // Obtiene un grupo por ID
  async obtenerGrupo(id_grupo: number): Promise<Grupo | undefined> {

    const result = await pool.query('SELECT * FROM grupo WHERE id_grupo = $1', [id_grupo]);
    return result.rows[0];
  }

  // Crea un nuevo grupo
  async crearGrupo(nombre: string, descripcion?: string, zona?: string, imagen_url?: string, contacto_whatsapp?: string, usuario_instagram?: string): Promise<Grupo> {
    const result = await pool.query(
      'INSERT INTO grupo (nombre, descripcion, zona, imagen_url, contacto_whatsapp, usuario_instagram) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [nombre, descripcion, zona, imagen_url, contacto_whatsapp, usuario_instagram]
    );
    return result.rows[0];
  }

  // Crea un nuevo grupo
  async editarGrupo(id_grupo: number, nombre?: string, descripcion?: string, zona?: string, imagen_url?: string, activo?: boolean, contacto_whatsapp?: string, usuario_instagram?: string, id_usuario?: string): Promise<Grupo> {

    if (id_usuario) {
      const permiso = await pool.query(
        `SELECT * FROM usuariogrupo WHERE id_usuario = $1 AND id_grupo = $2 AND rol_en_grupo = 'secretaria'`,
        [id_usuario, id_grupo]
      );

      if (permiso.rows.length === 0) {
        throw new Error('No tienes permiso para editar este grupo');
      }
    }
    console.log('zona', zona, ', imagen', imagen_url)


    const result = await pool.query(
      `UPDATE grupo SET 
      nombre = COALESCE($1, nombre), 
      descripcion = COALESCE($2, descripcion), 
      zona = COALESCE($3, zona), 
      imagen_url = COALESCE($4, imagen_url),
      activo = COALESCE($5, activo), 
      contacto_whatsapp = COALESCE($6, contacto_whatsapp),
      usuario_instagram = COALESCE($7, usuario_instagram)
      WHERE id_grupo = $8 RETURNING *`,
      [nombre, descripcion, zona, imagen_url, activo, contacto_whatsapp, usuario_instagram, id_grupo]
    );
    return result.rows[0];
  }

  async seguirGrupo(id_usuario: number, id_grupo: number): Promise<boolean | string> {
    const grupo = await this.obtenerGrupo(id_grupo);
    if (!grupo) {
      throw new Error('Grupo no encontrado');
    }

    const existing = await pool.query(
      'SELECT * FROM preferencia_grupo WHERE id_usuario = $1 AND id_grupo = $2',
      [id_usuario, id_grupo]
    );

    if (existing.rows.length > 0) {
      const result = await pool.query(
        `DELETE FROM preferencia_grupo WHERE id_usuario = $1 AND id_grupo = $2
        RETURNING 
          (SELECT nombre FROM grupo WHERE id_grupo = preferencia_grupo.id_grupo) AS nombre,
          'eliminado' as status;`,
        [id_usuario, id_grupo]
      );
      console.log(result.rows[0])
      return result.rows[0];
    }

    if (grupo.solicitudNecesitada) {
      const result = await pool.query(
        `INSERT INTO preferencia_grupo (id_usuario, id_grupo, status)
          VALUES ($1, $2, $3)
        RETURNING 
          (SELECT nombre FROM grupo WHERE id_grupo = preferencia_grupo.id_grupo) AS nombre,
          status;`,
        [id_usuario, id_grupo, 'pendiente']
      );
      console.log(result.rows[0])
      return result.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO preferencia_grupo (id_usuario, id_grupo)
          VALUES ($1, $2)
        RETURNING 
          (SELECT nombre FROM grupo WHERE id_grupo = preferencia_grupo.id_grupo) AS nombre,
          status;`,
        [id_usuario, id_grupo]
      );
      console.log(result.rows[0])
      return result.rows[0];
    }
  }

  async obtenerGruposSeguidos(id_usuario: number): Promise<Grupo[]> {
    const result = await pool.query(
      `SELECT p.*, g.nombre, g.imagen_url FROM preferencia_grupo p JOIN grupo g ON p.id_grupo = g.id_grupo WHERE p.id_usuario = $1;`,
      [id_usuario]
    );
    return result.rows;
  }


  async obtenerSeguidoresGrupo(id_grupo: number): Promise<User[]> {
    const result = await pool.query(
      `SELECT 
          u.id_usuario,
          u.nombre,
          u.apellido,
          u.email,
          u.dni_usuario,
          u.nacionalidad,
          u.tipo_documento,
          u.numero_alumno,
          u.id_rol
      FROM usuario u JOIN preferencia_grupo p ON u.id_usuario = p.id_usuario
      JOIN grupo g ON g.id_grupo = p.id_grupo   WHERE g.id_grupo = $1 AND p.status = 'aprobado'
      ORDER BY RANDOM() LIMIT 10;`,
      [id_grupo]
    );
    return result.rows;
  }


  async obtenerSolicitudesGrupo(id_grupo: number): Promise<User[]> {
    const result = await pool.query(
      `SELECT 
          u.id_usuario,
          u.nombre,
          u.apellido,
          u.email,
          u.dni_usuario,
          u.nacionalidad,
          u.tipo_documento,
          u.numero_alumno,
          u.id_rol
      FROM usuario u JOIN preferencia_grupo p ON u.id_usuario = p.id_usuario
      JOIN grupo g ON g.id_grupo = p.id_grupo   WHERE g.id_grupo = $1 AND p.status = 'pendiente'
      ORDER BY RANDOM() LIMIT 10;`,
      [id_grupo]
    );
    return result.rows;
  }

  async gestionarSolicitud(id_usuario: number, id_grupo: number, accion: 'aprobado' | 'rechazado'): Promise<string> {
    const solicitud = await pool.query(
      'SELECT * FROM preferencia_grupo WHERE id_usuario = $1 AND id_grupo = $2 AND status = $3',
      [id_usuario, id_grupo, 'pendiente']
    );

    if (solicitud.rows.length === 0) {
      throw new Error('Solicitud no encontrada');
    }

    if (accion === 'aprobado') {
      await pool.query(
        'UPDATE preferencia_grupo SET status = $1 WHERE id_usuario = $2 AND id_grupo = $3',
        ['aprobado', id_usuario, id_grupo]
      );
      return 'Solicitud aprobada';
    } else {
      await pool.query(
        `DELETE FROM preferencia_grupo WHERE id_usuario = $1 AND id_grupo = $2
        RETURNING 
          (SELECT nombre FROM grupo WHERE id_grupo = preferencia_grupo.id_grupo) AS nombre,
          'eliminado' as status;`,
        [id_usuario, id_grupo]
      );
      return 'Solicitud rechazada';
    }
  }


  async eliminarMiembro(id_usuario: number, id_grupo: number): Promise<string> {
    await pool.query(
      'DELETE FROM preferencia_grupo WHERE id_usuario = $1 AND id_grupo = $2',
      [id_usuario, id_grupo]
    );
    const result = await pool.query(
      'SELECT * FROM preferencia_grupo WHERE id_usuario = $1 AND id_grupo = $2',
      [id_usuario, id_grupo]
    );

    if (result.rows.length === 0) return 'Se elimino correctamente';

    throw new Error('No se pudo eliminar el miembro del grupo');
  }

}