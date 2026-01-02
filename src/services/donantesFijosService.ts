import pool from "../db";

export class DonantesFijosService {
  //join es para que devuelva todos los registros, incluso los que no tienen grupo, y en tal caso sera el grupo null
  // Obtener todos los donantes
  async obtenerTodosDonantes() {
    const result = await pool.query(`
      SELECT df.*, g.nombre AS nombre_grupo
      FROM donantes_fijos df
      LEFT JOIN grupo g ON df.id_grupo = g.id_grupo
      ORDER BY df.nombre
    `);
    return result.rows;
  }

  // Obtener un donante por ID
  async obtenerDonantePorId(id_donante_fijo: number) {
    const result = await pool.query(
      `SELECT df.*, g.nombre AS nombre_grupo
       FROM donantes_fijos df
       LEFT JOIN grupo g ON df.id_grupo = g.id_grupo
       WHERE df.id_donante_fijo = $1`,
      [id_donante_fijo]
    );
    return result.rows[0];
  }

  // Crear un nuevo donante
  async crearDonante({ nombre, apellido, email, dni, id_grupo }: any) {
    const result = await pool.query(
      `INSERT INTO donantes_fijos (nombre, apellido, email, dni, id_grupo)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [nombre, apellido, email, dni, id_grupo]
    );
    return result.rows[0];
  }

  async editarDonante(id_donante_fijo: number, { nombre, apellido, email, dni, id_grupo }: any) {
    const result = await pool.query(
      `UPDATE donantes_fijos
       SET nombre=$1, apellido=$2, email=$3, dni=$4, id_grupo=$5
       WHERE id_donante_fijo=$6
       RETURNING *`,
      [nombre, apellido, email, dni, id_grupo, id_donante_fijo]
    );
    return result.rows[0];
  }

  // Obtener donantes por grupo
  async obtenerDonantesPorGrupo(id_usuario: number) {
    console.log('[Service] Buscando donantes para usuario:', id_usuario);
    
    const exists = await pool.query(
      `SELECT * FROM usuariogrupo
      WHERE id_usuario = $1`,
      [id_usuario]
    )
    console.log('[Service] Usuario en usuariogrupo:', exists.rows.length > 0);
    
    if (exists.rows.length === 0) throw new Error('El usuario en sesion no es secretaria de grupo');

    const result = await pool.query(
      `SELECT df.*, g.nombre AS nombre_grupo
      FROM donantes_fijos df
      JOIN grupo g ON df.id_grupo = g.id_grupo
      JOIN usuariogrupo sg ON g.id_grupo = sg.id_grupo
      WHERE sg.id_usuario = $1
      ORDER BY df.nombre`,
      [id_usuario]
    );

    console.log('[Service] Query result:', result.rows.length, 'donantes');
    return result.rows;
  }

  // Eliminar un donante
  async eliminarDonante(id_donante_fijo: number, id_usuario: number, id_rol: number) {
    // Si es secretaria general (rol 4), puede eliminar cualquier donante
    if (id_rol === 4) {
      const result = await pool.query(
        `DELETE FROM donantes_fijos WHERE id_donante_fijo = $1 RETURNING *`,
        [id_donante_fijo]
      );
      if (result.rows.length === 0) throw new Error('Donante no encontrado');
      return result.rows[0];
    }

    // Si es secretaria grupal (rol 5), solo puede eliminar donantes de su grupo
    if (id_rol === 5) {
      const exists = await pool.query(
        `SELECT df.* FROM donantes_fijos df
        JOIN usuariogrupo ug ON df.id_grupo = ug.id_grupo
        WHERE df.id_donante_fijo = $1 AND ug.id_usuario = $2`,
        [id_donante_fijo, id_usuario]
      );
      
      if (exists.rows.length === 0) {
        throw new Error('No tienes permiso para eliminar este donante o no existe');
      }

      const result = await pool.query(
        `DELETE FROM donantes_fijos df
        USING usuariogrupo ug
        WHERE df.id_donante_fijo = $1
          AND ug.id_usuario = $2
          AND df.id_grupo = ug.id_grupo
        RETURNING df.*`,
        [id_donante_fijo, id_usuario]
      );
      return result.rows[0];
    }

    throw new Error('Rol no autorizado para eliminar donantes');
  }
}
