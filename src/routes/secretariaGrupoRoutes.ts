import { Router } from 'express';
import { SecretariaGrupoController } from '../controllers/secretariaGrupoController';
import { SecretariaGrupoService } from '../services/secretariaGrupoService';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware';

const secretariaGrupoService = new SecretariaGrupoService();
const secretariaGrupoController = new SecretariaGrupoController(secretariaGrupoService);

const router = Router();

// Todas las rutas requieren autenticación
router.use(authenticate);

/**
 * POST: Asignar una secretaria a un grupo (solo admin)
 * Body: { usuarioId: number, grupoId: number }
 */
router.post(
  '/secretaria-grupo/asignar',
  authorizeRoles(['admin']),
  secretariaGrupoController.asignarSecretariaAGrupo
);

/**
 * DELETE: Remover una secretaria de un grupo (solo admin)
 * Body: { usuarioId: number, grupoId: number }
 */
router.delete(
  '/secretaria-grupo/remover',
  authorizeRoles(['admin']),
  secretariaGrupoController.removerSecretariaDeGrupo
);

/**
 * GET: Obtener todos los grupos asignados a una secretaria (solo admin)
 * Params: usuarioId
 */
router.get(
  '/secretaria-grupo/usuario/:usuarioId/grupos',
  authorizeRoles(['admin']),
  secretariaGrupoController.obtenerGruposDeSecretaria
);

/**
 * GET: Obtener todas las secretarias asignadas a un grupo (admin y secretaria general)
 * Params: grupoId
 */
router.get(
  '/secretaria-grupo/grupo/:grupoId/secretarias',
  authorizeRoles(['admin', 'secretaria general']),
  secretariaGrupoController.obtenerSecretariasDeGrupo
);

/**
 * GET: Obtener mis grupos asignados (secretaria grupal)
 */
router.get(
  '/secretaria-grupo/mis-grupos',
  authorizeRoles(['secretaria grupal']),
  secretariaGrupoController.obtenerMisGrupos
);

/**
 * GET: Obtener eventos de un grupo específico (secretaria grupal)
 * Params: grupoId
 */
router.get(
  '/secretaria-grupo/grupo/:grupoId/eventos',
  authorizeRoles(['secretaria grupal', 'admin', 'secretaria general']),
  secretariaGrupoController.obtenerEventosDeGrupo
);

export default router;
