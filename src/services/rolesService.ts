import pool from '../db';
import { Rol, User } from '../tipos/tipos';

export class RolesService {

  constructor() { }


  // Obtiene todos los roles de la base de datos
  async obtenerRoles(): Promise<Rol[]> {
    const { rows } = await pool.query('SELECT * FROM rol');
    return rows;
  }

  async obtenerRol(idRol: number): Promise<Rol> {
    const { rows } = await pool.query('SELECT * FROM rol WHERE id_rol = $1', [idRol])
    return rows[0];
  }

  // Asigna un rol a un usuario (actualiza la columna id_rol en la tabla usuarios)
  async asignarRolAUsuario(usuarioId: number, rolId: number): Promise<User | undefined> {
    if (usuarioId) {
      const esSecretaria = await pool.query(
        `SELECT * FROM usuariogrupo WHERE id_usuario = $1 AND rol_en_grupo = 'secretaria'`,
        [usuarioId]
      );

      if (esSecretaria.rows.length > 0) {
        await pool.query(
          `DELETE FROM usuariogrupo WHERE id_usuario = $1 AND rol_en_grupo = 'secretaria'`,
          [usuarioId]
        );
      }
    }

    const { rows } = await pool.query(
      'UPDATE usuario SET id_rol = $1 WHERE id_usuario = $2 RETURNING *',
      [rolId, usuarioId]
    );
    return rows[0]; // Devuelve el usuario actualizado o undefined si no existe
  }

  // Elimina un rol de la tabla "rol"
  async eliminarRol(rolId: number): Promise<Rol | undefined> {
    const { rows } = await pool.query(
      'DELETE FROM rol WHERE id_rol = $1 RETURNING *',
      [rolId]
    );
    return rows[0]; // Devuelve el rol eliminado o undefined si no existe
  }

  // Crea un nuevo rol en la base de datos
  async crearRol(nombre: string): Promise<Rol> {
    const { rows } = await pool.query(
      'INSERT INTO rol (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );
    return rows[0]; // Devuelve el rol creado
  }

  // Remueve el rol de un usuario (pone id_rol en NULL)
  async removerRolAUsuario(usuarioId: number) {
    const { rows } = await pool.query(
      'UPDATE usuarios SET id_rol = NULL WHERE id_rol IS NOT NULL AND id_usuario = $1 RETURNING *',
      [usuarioId]
    );
    return rows[0]; // Devuelve el usuario actualizado o undefined si no existe
  }


  /////////////////////////// Roles en grupos ///////////////////////////

  // Obtiene el rol de un usuario en un grupo específico TABLA USUARIOGRUPO
  async obtenerRolEnGrupo(idUsuario: number, idGrupo: number): Promise<string | null> {
    const query = `
      SELECT rol_en_grupo
      FROM usuariogrupo
      WHERE id_usuario = $1 AND id_grupo = $2
    `;
    const result = await pool.query(query, [idUsuario, idGrupo]);
    return result.rows.length > 0 ? result.rows[0].rol_en_grupo : null;
  }


  async asignarRolEnGrupo(id_usuario: number, id_grupo: number, rol_en_grupo: string) {
    // Verificamos si ya existe un registro
    const { rows } = await pool.query(
      `SELECT * FROM usuariogrupo WHERE id_usuario = $1 AND id_grupo = $2`,
      [id_usuario, id_grupo]
    );

    if (rows.length > 0) {
      // Actualizamos el rol
      const { rows: updatedRows } = await pool.query(
        `UPDATE usuariogrupo SET rol_en_grupo = $1 WHERE id_usuario = $2 AND id_grupo = $3 RETURNING *`,
        [rol_en_grupo, id_usuario, id_grupo]
      );
      return updatedRows[0];
    } else {
      // Creamos el registro
      const { rows: newRows } = await pool.query(
        `INSERT INTO usuariogrupo (id_usuario, id_grupo, rol_en_grupo) VALUES ($1, $2, $3) RETURNING *`,
        [id_usuario, id_grupo, rol_en_grupo]
      );
      return newRows[0];
    }
  }

}

