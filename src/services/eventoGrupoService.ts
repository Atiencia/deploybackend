import pool from '../db';

export class EventoGrupoService {
  async asociarEventoGrupo(id_evento: number, id_grupo: number): Promise<any> {
    
    const rol_asignado = 'secretaria'; 

    const asociacion = await pool.query(
      `INSERT INTO evento_grupo (id_evento, id_grupo, rol_grupo) VALUES ($1, $2, $3)`,
      [id_evento, id_grupo, rol_asignado]
    );

    if (asociacion && typeof asociacion.rowCount === 'number' && asociacion.rowCount > 0) {
        return { message: 'Asociación creada con éxito', id_evento, id_grupo };
    }
    
    throw new Error('No se pudo crear la asociación o la base de datos no confirmó la inserción.');
  }
}
