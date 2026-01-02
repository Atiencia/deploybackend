import { Request, Response, NextFunction } from "express";
import { RolesService } from "../services/rolesService";
import { SecretariaGrupoService } from "../services/secretariaGrupoService";
import { Rol } from "../tipos/tipos";
import pool from "../db";

const rolesService = new RolesService();
const secretariaGrupoService = new SecretariaGrupoService();

// Middleware para validar acceso a información de donantes fijos según rol y grupo
export function validateDonanteAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;
    if (!user) return res.status(401).json({ error: "No autenticado" });

    const userRole: Rol = await rolesService.obtenerRol(user.id_rol);

    // admin y secretaria general tienen acceso total
    if (["admin", "secretaria general"].includes(userRole.nombre)) {
      return next();
    }

    if (userRole.nombre === "secretaria grupal") {
      let grupoId: number | null = null;

      // Si hay id_grupo en body o params, usarlo directamente
      const grupoIdRaw = req.body?.id_grupo || req.params?.id_grupo;
      if (grupoIdRaw) {
        grupoId = Number(grupoIdRaw);
        if (isNaN(grupoId)) return res.status(400).json({ error: "id_grupo inválido" });
      } else {
        // Si no hay id_grupo, pero hay id de donante, buscar el grupo del donante
        const donanteId = req.params?.id;
        if (donanteId) {
          try {
            const donanteResult = await pool.query(
              'SELECT id_grupo FROM donantes_fijos WHERE id_donante_fijo = $1',
              [Number(donanteId)]
            );
            if (donanteResult.rows.length > 0) {
              grupoId = donanteResult.rows[0].id_grupo;
            }
          } catch (err) {
            return res.status(500).json({ error: "Error al obtener información del donante" });
          }
        }
      }

      if (!grupoId) return res.status(400).json({ error: "No se pudo determinar el grupo" });

      const tieneAcceso = await secretariaGrupoService.tieneAccesoAGrupo(user.id_usuario, grupoId);
      if (!tieneAcceso) return res.status(403).json({ error: "No tienes permiso para acceder a este donante" });

      return next();
    }

    return res.status(403).json({ error: "No tienes permiso para esta operación" });
  };
}
