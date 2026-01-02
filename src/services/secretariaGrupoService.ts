import pool from '../db';
import { SecretariaGrupo } from '../tipos/tipos';

export class SecretariaGrupoService {

  /**
   * Asigna una secretaria grupal a un grupo específico usando la tabla usuariogrupo
   * 
   * IMPORTANTE: La tabla usuariogrupo SOLO se usa para asignar secretarias a grupos.
   * NO se usa para admin de grupo, usuario de grupo ni otros roles.
   * El campo rol_en_grupo siempre se establece como 'secretaria'.
   */
  async asignarSecretariaAGrupo(id_usuario: number, id_grupo: number): Promise<any> {
    // Verificar que el usuario tenga el rol de secretaria grupal
    const usuario = await pool.query(
      'SELECT u.*, r.nombre as rol_nombre FROM usuario u JOIN rol r ON u.id_rol = r.id_rol WHERE u.id_usuario = $1',
      [id_usuario]
    );

    if (usuario.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    if (usuario.rows[0].rol_nombre !== 'secretaria grupal') {
      throw new Error('El usuario debe tener el rol de secretaria grupal');
    }

    // Verificar que el grupo existe
    const grupo = await pool.query('SELECT * FROM grupo WHERE id_grupo = $1', [id_grupo]);
    if (grupo.rows.length === 0) {
      throw new Error('Grupo no encontrado');
    }

    // Enforce 1:1 secretaria -> grupo
    // Eliminamos cualquier asignación previa de esta secretaria a otros grupos
    // antes de insertar la nueva asignación. Usamos una transacción para
    // garantizar consistencia.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Si ya existe exactamente esta asignación, simplemente actualizamos el rol y retornamos
      const existente = await client.query(
        'SELECT * FROM usuariogrupo WHERE id_usuario = $1 AND id_grupo = $2',
        [id_usuario, id_grupo]
      );

      if (existente.rows.length > 0) {
        const updated = await client.query(
          'UPDATE usuariogrupo SET rol_en_grupo = $1 WHERE id_usuario = $2 AND id_grupo = $3 RETURNING *',
          ['secretaria', id_usuario, id_grupo]
        );
        await client.query('COMMIT');
        return updated.rows[0];
      }

      // Borrar asignaciones anteriores de esta secretaria a otros grupos
      await client.query('DELETE FROM usuariogrupo WHERE id_usuario = $1', [id_usuario]);

      // Insertar la nueva asignación
      const insertResult = await client.query(
        `INSERT INTO usuariogrupo (id_usuario, id_grupo, rol_en_grupo)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [id_usuario, id_grupo, 'secretaria']
      );

      await client.query('COMMIT');
      return insertResult.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  /**
   * Remueve la asignación de una secretaria de un grupo
   */
  async removerSecretariaDeGrupo(id_usuario: number, id_grupo: number): Promise<boolean> {
    const result = await pool.query(
      'DELETE FROM usuariogrupo WHERE id_usuario = $1 AND id_grupo = $2 RETURNING *',
      [id_usuario, id_grupo]
    );
    console.log(result)
    return result.rows[0];
  }

  /**
   * Obtiene todos los grupos asignados a una secretaria
   */
  async obtenerGruposDeSecretaria(id_usuario: number): Promise<number[]> {
    const result = await pool.query(
      'SELECT id_grupo FROM usuariogrupo WHERE id_usuario = $1',
      [id_usuario]
    );

    return result.rows.map((row: any) => row.id_grupo);
  }

  /**
   * Verifica si una secretaria tiene acceso a un grupo específico
   */
  async tieneAccesoAGrupo(id_usuario: number, id_grupo: number): Promise<boolean> {
    const result = await pool.query(
      'SELECT 1 FROM usuariogrupo WHERE id_usuario = $1 AND id_grupo = $2',
      [id_usuario, id_grupo]
    );

    return result.rows.length > 0;
  }

  /**
   * Obtiene todas las secretarias asignadas a un grupo
   */
  async obtenerSecretariasDeGrupo(id_grupo: number): Promise<any[]> {
    const result = await pool.query(
      `SELECT u.id_usuario, u.nombre, u.apellido, u.email, ug.rol_en_grupo
       FROM usuariogrupo ug
       JOIN usuario u ON ug.id_usuario = u.id_usuario
       JOIN rol r ON u.id_rol = r.id_rol
       WHERE ug.id_grupo = $1 AND r.nombre = 'secretaria grupal'`,
      [id_grupo]
    );

    return result.rows;
  }

  /**
   * Verifica si un usuario es secretaria grupal y obtiene sus grupos
   */
  async obtenerInfoSecretariaGrupal(id_usuario: number): Promise<{ es_secretaria: boolean; grupos: any[] }> {
    // Verificar el rol
    const usuario = await pool.query(
      'SELECT u.*, r.nombre as rol_nombre FROM usuario u JOIN rol r ON u.id_rol = r.id_rol WHERE u.id_usuario = $1',
      [id_usuario]
    );

    if (usuario.rows.length === 0 || usuario.rows[0].rol_nombre !== 'secretaria grupal') {
      return { es_secretaria: false, grupos: [] };
    }

    // Obtener los grupos asignados
    const grupos = await pool.query(
      `SELECT g.*, ug.rol_en_grupo
       FROM usuariogrupo ug
       JOIN grupo g ON ug.id_grupo = g.id_grupo
       WHERE ug.id_usuario = $1`,
      [id_usuario]
    );

    return { es_secretaria: true, grupos: grupos.rows };
  }

  /**
   * Obtiene los eventos de un grupo específico (para secretarias grupales)
   */
  async obtenerEventosDeGrupo(id_grupo: number, id_usuario: number): Promise<any[]> {
    // Verificar acceso
    const tieneAcceso = await this.tieneAccesoAGrupo(id_usuario, id_grupo);
    if (!tieneAcceso) {
      throw new Error('No tienes acceso a este grupo');
    }

    const result = await pool.query(
      `SELECT e.*, eg.rol_grupo, g.nombre as nombre_grupo
       FROM evento e
       JOIN evento_grupo eg ON e.id_evento = eg.id_evento
       JOIN grupo g ON eg.id_grupo = g.id_grupo
       WHERE eg.id_grupo = $1
       ORDER BY e.fecha DESC`,
      [id_grupo]
    );

    console.log(`Eventos encontrados para grupo ${id_grupo}:`, result.rows.map(r => ({ 
      id: r.id_evento, 
      nombre: r.nombre, 
      grupo: r.nombre_grupo 
    })));

    return result.rows;
  }
}
