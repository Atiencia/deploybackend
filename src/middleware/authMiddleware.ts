import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { SECRET_KEY } from "../utils/jwtUtils";
import { Rol, User } from "../tipos/tipos";
import { RolesService } from "../services/rolesService";
import { SecretariaGrupoService } from "../services/secretariaGrupoService";

// Extiende la interfaz Request para incluir 'user'
declare global {
  namespace Express {
    interface Request {
      user?: User & { id_usuario: number };
    }
  }
}

const rolesService = new RolesService(); // CORRECCIÓN: instanciar con () MADE BY BENJAMON
//const rolesService = new RolesService();
const secretariaGrupoService = new SecretariaGrupoService();

// Middleware de autenticación (token en cookie firmada)
export const authenticate = (req: Request, res: Response, next: NextFunction) => {
  // Prefer signed cookie, but accept Authorization: Bearer <token> as fallback
  let token: string | undefined = req.signedCookies?.token;
  if (!token) {
    const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  if (!token) {
    return res.status(401).json({ message: "No autorizado. No se encontró el token." });
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as any;
    // Asignar tanto a req.user como a req.usuario para compatibilidad
    req.user = decoded;
    (req as any).usuario = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
};

// Middleware de autenticación opcional (no rechaza si no hay token, pero lo lee si existe)
export const optionalAuthenticate = (req: Request, res: Response, next: NextFunction) => {
  // Prefer signed cookie, but accept Authorization: Bearer <token> as fallback
  let token: string | undefined = req.signedCookies?.token;
  if (!token) {
    const authHeader = (req.headers.authorization || req.headers.Authorization) as string | undefined;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }
  }

  // Si no hay token, continuar sin autenticar
  if (!token) {
    console.log('[optionalAuthenticate] No se encontró token, continuando sin autenticación');
    return next();
  }

  try {
    const decoded = jwt.verify(token, SECRET_KEY) as any;
    // Asignar tanto a req.user como a req.usuario para compatibilidad
    req.user = decoded;
    (req as any).usuario = decoded;
    console.log('[optionalAuthenticate] Usuario autenticado:', decoded.id_usuario);
  } catch (err) {
    // Si el token es inválido, continuar sin autenticar
    console.log('[optionalAuthenticate] Token inválido, continuando sin autenticación');
  }

  next();
};

// Middleware de autorización por roles
export function authorizeRoles(allowedRoles: string[] = []) {
  return async (req: Request, res: Response, next: NextFunction) => {
    // El usuario debe estar autenticado (ya debe existir req.user)
    const user = req.user;
    console.log("Usuario en authorizeRoles:", user);

    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    // Si el token no trae rol, asignar "viewer"
    const userRole: Rol = await rolesService.obtenerRol(user.id_rol);

    // 403 solo si el rol es válido pero no está permitido en esta ruta
    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole.nombre)) {
      return res.status(403).json({
        error: `Acceso denegado: el rol "${userRole.nombre}" no tiene permiso para esta ruta`,
      });
    }

    next();
  };
}

/**
 * Middleware para validar que una secretaria grupal tenga acceso a un grupo específico
 * El grupoId puede venir en body, params o query
 */
export function validateSecretariaGrupalAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    // Obtener el rol del usuario
    const userRole: Rol = await rolesService.obtenerRol(user.id_rol);

    // Si es admin o secretaria general, tiene acceso total
    if (userRole.nombre === 'admin' || userRole.nombre === 'secretaria general') {
      return next();
    }

    // Si es secretaria grupal, validar acceso al grupo específico
    if (userRole.nombre === 'secretaria grupal') {
      // Intentar obtener el grupoId de diferentes fuentes
      const grupoId = req.body?.grupoId ||
        req.params?.grupoId ||
        req.query?.grupoId ||
        req.body?.id_grupo ||
        req.params?.id_grupo;

      if (!grupoId) {
        return res.status(400).json({
          error: "Se requiere especificar el grupoId para esta operación"
        });
      }

      const grupoIdNum = parseInt(grupoId.toString());

      if (isNaN(grupoIdNum)) {
        return res.status(400).json({ error: "grupoId inválido" });
      }

      // Verificar acceso al grupo
      try {
        const tieneAcceso = await secretariaGrupoService.tieneAccesoAGrupo(
          user.id_usuario,
          grupoIdNum
        );

        if (!tieneAcceso) {
          return res.status(403).json({
            error: "No tienes permiso para acceder a este grupo"
          });
        }

        return next();
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    // Si no es ninguno de los roles permitidos
    return res.status(403).json({
      error: "No tienes permisos para esta operación"
    });
  };
}

/**
 * Middleware para validar que una secretaria grupal tenga acceso a un evento
 * basándose en la relación evento-grupo
 */
export function validateSecretariaEventoAccess() {
  return async (req: Request, res: Response, next: NextFunction) => {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "No autenticado" });
    }

    // Obtener el rol del usuario
    const userRole: Rol = await rolesService.obtenerRol(user.id_rol);

    // Si es admin o secretaria general, tiene acceso total
    if (userRole.nombre === 'admin' || userRole.nombre === 'secretaria general') {
      return next();
    }

    // Si es secretaria grupal, validar acceso al evento a través del grupo
    if (userRole.nombre === 'secretaria grupal') {
      const eventoId = req.body?.eventoId ||
        req.params?.eventoId ||
        req.query?.eventoId ||
        req.body?.id_evento ||
        req.params?.id;

      if (!eventoId) {
        return res.status(400).json({
          error: "Se requiere especificar el eventoId para esta operación"
        });
      }

      const eventoIdNum = parseInt(eventoId.toString());

      if (isNaN(eventoIdNum)) {
        return res.status(400).json({ error: "eventoId inválido" });
      }

      try {
        // Obtener los grupos del evento
        const pool = require('../db').default;
        const eventosGrupos = await pool.query(
          'SELECT id_grupo FROM evento_grupo WHERE id_evento = $1',
          [eventoIdNum]
        );

        if (eventosGrupos.rows.length === 0) {
          return res.status(404).json({
            error: "El evento no está asociado a ningún grupo"
          });
        }

        // Verificar si la secretaria tiene acceso a alguno de los grupos del evento
        const gruposEvento = eventosGrupos.rows.map((row: any) => row.id_grupo);
        const gruposSecretaria = await secretariaGrupoService.obtenerGruposDeSecretaria(user.id_usuario);

        // Diagnostic logging to help debug secretaria grupal access issues
        try {
          console.log(`[AUTH DEBUG] validateSecretariaEventoAccess - user=${user.id_usuario}, eventoId=${eventoIdNum}`);
          console.log(`[AUTH DEBUG] gruposEvento: ${JSON.stringify(gruposEvento)}`);
          console.log(`[AUTH DEBUG] gruposSecretaria: ${JSON.stringify(gruposSecretaria)}`);
        } catch (logErr) {
          console.error('[AUTH DEBUG] error printing debug info', logErr);
        }

        const tieneAcceso = gruposEvento.some((grupoId: number) =>
          gruposSecretaria.includes(grupoId)
        );

        if (!tieneAcceso) {
          console.error(`[AUTH] Acceso denegado: user ${user.id_usuario} gruposSecretaria=${JSON.stringify(gruposSecretaria)} gruposEvento=${JSON.stringify(gruposEvento)}`);
          return res.status(403).json({
            error: "No tienes permiso para acceder a este evento"
          });
        }

        return next();
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    }

    // Si no es ninguno de los roles permitidos
    return res.status(403).json({
      error: "No tienes permisos para esta operación"
    });
  };
}
