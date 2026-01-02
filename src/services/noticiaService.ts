// src/services/noticiaService.ts
import pool from "../db";
import type { Noticia } from "../tipos/tipos";
import type { PoolClient } from "pg";
import { RolesService } from "./rolesService";

const rolesService = new RolesService();

type ListOptions = {
  grupoId?: number;
  q?: string;
  dateFrom?: string;
  dateTo?: string;
  page?: number;
  limit?: number;
};

function parseDurationToSqlInterval(duration: string): string | null {
  const match = duration.match(/^(\d+)([hdw])$/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  const unit = match[2];

  switch (unit) {
    case "h":
      return `${value} hours`;
    case "d":
      return `${value} days`;
    case "w":
      return `${value} weeks`;
    default:
      return null;
  }
}

type NoticiaConDetalles = Noticia & {
  autor_nombre?: string;
  grupo_nombre?: string;
};

export class NoticiaService {
  constructor() {}

  async listar(opts: ListOptions = {}): Promise<Noticia[]> {
    const { grupoId, q, dateFrom, dateTo, page = 1, limit = 20 } = opts;
    const offset = (page - 1) * limit;
    const where: string[] = [];
    const params: any[] = [];

    if (grupoId !== undefined) {
      params.push(grupoId);
      where.push(`n.grupo_id = $${params.length}`);
    }
    if (q) {
      params.push(`%${q}%`);
      where.push(`(n.titulo ILIKE $${params.length} OR n.descripcion ILIKE $${params.length})`);
    }
    if (dateFrom) {
      params.push(dateFrom);
      where.push(`n.fecha::date >= $${params.length}::date`);
    }
    if (dateTo) {
      params.push(dateTo);
      where.push(`n.fecha::date <= $${params.length}::date`);
    }

    const whereClause = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sql = `
      SELECT
        n.id_noticia, n.titulo, n.fecha, n.lugar, n.descripcion, 
        n.autor_id, n.grupo_id, n.imagen_path, n.fijada, n.fijada_hasta
      FROM public.noticia n
      ${whereClause}
      ORDER BY
        n.fecha DESC
      LIMIT $${params.length + 1} OFFSET $${params.length + 2}
    `;

    params.push(limit, offset);
    const { rows } = await pool.query<Noticia>(sql, params);
    return rows;
  }

  async obtenerPorId(id: number): Promise<NoticiaConDetalles | null> {
    const { rows } = await pool.query<NoticiaConDetalles>(
      `SELECT 
        n.id_noticia, n.titulo, n.fecha, n.lugar, n.descripcion, 
        n.autor_id, n.grupo_id, n.imagen_path,
        u.nombre as autor_nombre,
        g.nombre as grupo_nombre,
        CASE WHEN n.fijada = TRUE AND n.fijada_hasta > NOW() THEN TRUE ELSE FALSE END AS fijada,
        CASE WHEN n.fijada = TRUE AND n.fijada_hasta > NOW() 
          THEN n.fijada_hasta 
          ELSE NULL 
        END as fijada_hasta
      FROM public.noticia n
      LEFT JOIN public.usuario u ON n.autor_id = u.id_usuario
      LEFT JOIN public.grupo g ON n.grupo_id = g.id_grupo
      WHERE n.id_noticia = $1`,
      [id]
    );

    if (rows.length === 0) return null;
    return rows[0];
  }

  async crear(payload: {
    titulo: string;
    lugar?: string | null;
    descripcion: string;
    autorId: number;
    grupoId?: number | null;
    fijada?: boolean;
    duracion_fijada?: string | null;
    imagen_path?: string | null;
  }): Promise<Noticia> {
    const client: PoolClient = await pool.connect();
    try {
      await client.query("BEGIN");

      let fijadaValue = false;
      let fijadaHastaSql = 'NULL';
      let sqlInterval: string | null = null;

      if (payload.fijada && payload.duracion_fijada) {
         sqlInterval = parseDurationToSqlInterval(payload.duracion_fijada);
         if (sqlInterval) {
            fijadaValue = true;
            fijadaHastaSql = `NOW() + INTERVAL '${sqlInterval}'`;
         } else {
            console.warn(`Duración inválida en crear: ${payload.duracion_fijada}. No se fijará.`);
         }
      }

      const { rows } = await client.query<Noticia>(
        `INSERT INTO public.noticia (titulo, fecha, lugar, descripcion, autor_id, grupo_id, imagen_path, fijada, fijada_hasta)
         VALUES ($1, now(), $2, $3, $4, $5, $6, $7, ${fijadaHastaSql}) 
         RETURNING *`,
        [
          payload.titulo,
          payload.lugar ?? null,
          payload.descripcion,
          payload.autorId,
          payload.grupoId ?? null,
          payload.imagen_path ?? null,
          fijadaValue
        ]
      );

      await client.query("COMMIT");
      return rows[0];
    } catch (err: any) {
      await client.query("ROLLBACK");
      throw new Error(err.message || "Error al crear noticia");
    } finally {
      client.release();
    }
  }

  async actualizar(
    id: number,
    opts: {
      titulo?: string;
      lugar?: string | null;
      descripcion?: string;
      fijada?: boolean;
      duracion_fijada?: string | null;
      grupo_id?: number | null | undefined;
      imagen_path?: string | null | undefined;
      actorId: number;
      actorRolId: number;
    }
  ): Promise<NoticiaConDetalles> {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");

      const { rows: existRows } = await client.query<Noticia>(
        "SELECT autor_id, grupo_id FROM public.noticia WHERE id_noticia = $1 FOR UPDATE",
        [id]
      );
      if (existRows.length === 0) throw new Error("Noticia no encontrada");
      const noticia = existRows[0] as any;

      const esAutor = noticia.autor_id === opts.actorId;
      if (!esAutor) {
        const rol = await rolesService.obtenerRol(opts.actorRolId);
        if (!rol) throw new Error("No autorizado para editar esta noticia");
        let autorizado = false;
        if (["admin", "developer", "secretaria general"].includes(rol.nombre)) {
          autorizado = true;
        }
        if (!autorizado && noticia.grupo_id) {
          const rolEnGrupo = await rolesService.obtenerRolEnGrupo(opts.actorId, noticia.grupo_id);
          if (rolEnGrupo === "secretaria") {
            autorizado = true;
          }
        }
        if (!autorizado) {
          throw new Error("No autorizado para editar esta noticia");
        }
      }

      let fijadaValue: boolean | undefined = opts.fijada;
      let sqlInterval: string | null = null;
      let fijadaHastaSql = 'fijada_hasta';

      if (opts.fijada === true && opts.duracion_fijada) {
        sqlInterval = parseDurationToSqlInterval(opts.duracion_fijada);
        if (sqlInterval) {
          fijadaValue = true;
          fijadaHastaSql = `NOW() + INTERVAL '${sqlInterval}'`;
        } else {
          fijadaValue = undefined;
          console.warn(`Duración inválida recibida: ${opts.duracion_fijada}`);
        }
      } else if (opts.fijada === false) {
        fijadaValue = false;
        fijadaHastaSql = 'NULL';
      }

      const setClauses: string[] = [];
      const queryParams: any[] = [];
      let paramIndex = 1;

      const addUpdate = (field: string, value: any) => {
        if (value !== undefined) {
           setClauses.push(`${field} = $${paramIndex++}`);
           queryParams.push(value);
        }
      };

      addUpdate('titulo', opts.titulo);
      addUpdate('lugar', opts.lugar);
      addUpdate('descripcion', opts.descripcion);
      addUpdate('imagen_path', opts.imagen_path);
      addUpdate('grupo_id', opts.grupo_id);

      if (fijadaValue !== undefined) {
        setClauses.push(`fijada = $${paramIndex++}`);
        queryParams.push(fijadaValue);
        setClauses.push(`fijada_hasta = ${fijadaHastaSql}`);
      }

      if (setClauses.length === 0) {
        await client.query("ROLLBACK");
        client.release();
        const finalNoticia = await this.obtenerPorId(id);
        if (!finalNoticia) throw new Error("Error al re-obtener la noticia");
        return finalNoticia;
      }

      queryParams.push(id);

      const sql = `
        UPDATE public.noticia SET
          ${setClauses.join(", ")}
        WHERE id_noticia = $${paramIndex}
        RETURNING id_noticia
      `;
      const { rows } = await client.query<{id_noticia: number}>(sql, queryParams);
      if (rows.length === 0) throw new Error("UPDATE no devolvió filas.");

      const finalNoticia = await this.obtenerPorId(id);
      if (!finalNoticia) throw new Error("No se pudo obtener la noticia después de actualizar.");

      await client.query("COMMIT");
      return finalNoticia;
    } catch (err: any) {
      await client.query("ROLLBACK");
      console.error("Error detallado en actualizar noticia:", err);
      throw new Error(err.message || "Error al actualizar noticia");
    } finally {
      client.release();
    }
  }

  async eliminar(id: number, actorId: number, actorRolId: number): Promise<void> {
    const { rows } = await pool.query<{ autor_id: number, grupo_id: number | null }>(
      "SELECT autor_id, grupo_id FROM public.noticia WHERE id_noticia = $1", 
      [id]
    );
    if (rows.length === 0) throw new Error("Noticia no encontrada");
    
    const { autor_id: autorId, grupo_id: grupoId } = rows[0];
    
    if (autorId === actorId) {
      await pool.query("DELETE FROM public.noticia WHERE id_noticia = $1", [id]);
      return;
    }
    
    const rol = await rolesService.obtenerRol(actorRolId);
    if (!rol) throw new Error("No autorizado para eliminar esta noticia");
    
    if (["admin", "developer", "secretaria general"].includes(rol.nombre)) {
      await pool.query("DELETE FROM public.noticia WHERE id_noticia = $1", [id]);
      return;
    }
    
    if (grupoId) {
      const rolEnGrupo = await rolesService.obtenerRolEnGrupo(actorId, grupoId);
      if (rolEnGrupo === "secretaria") {
        await pool.query("DELETE FROM public.noticia WHERE id_noticia = $1", [id]);
        return;
      }
    }
    
    throw new Error("No autorizado para eliminar esta noticia");
  }
}

export const noticiaService = new NoticiaService();