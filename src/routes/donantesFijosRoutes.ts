import { Router } from 'express';
import { DonantesFijosController } from '../controllers/donantesFijosController';
import { DonantesFijosService } from '../services/donantesFijosService';
import { SecretariaGrupoService } from '../services/secretariaGrupoService';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware';
import { validateDonanteAccess } from '../middleware/donantesAccessMiddleware';

const donantesFijosService = new DonantesFijosService();
const secretariaGrupoService = new SecretariaGrupoService();
const donantesFijosController = new DonantesFijosController(
  donantesFijosService,
  secretariaGrupoService
);

const router = Router();

router.use(authenticate);

// GET: Obtener todos los donantes (solo admin o secretaria general)
router.get(
  '/donantes-fijos',
  authorizeRoles(['admin', 'secretaria general']),
  donantesFijosController.obtenerTodosDonantes
);

// GET: Obtener donantes por grupo (solo secretaria grupal - no necesita validateDonanteAccess)
router.get(
  '/donantes-fijos/por-grupo',
  authorizeRoles(['secretaria grupal']),
  donantesFijosController.obtenerDonantesPorGrupo
);

// GET: Obtener un donante por ID (admin, secretaria general o grupal con validación)
router.get(
  '/donantes-fijos/:id',
  authorizeRoles(['admin', 'secretaria general', 'secretaria grupal']),
  validateDonanteAccess(),
  donantesFijosController.obtenerDonantePorId
);

// POST: Crear un nuevo donante fijo (admin, general o grupal con validación de grupo)
router.post(
  '/donantes-fijos',
  authorizeRoles(['admin', 'secretaria general', 'secretaria grupal']),
  //validateDonanteAccess(),
  donantesFijosController.crearDonante
);

// PUT: Editar un donante existente (admin, secretaria general o grupal con validación)
router.put(
  '/donantes-fijos/:id',
  authorizeRoles(['admin', 'secretaria general', 'secretaria grupal']),
  validateDonanteAccess(),
  donantesFijosController.editarDonante
);

// DELETE: Eliminar un donante fijo (solo secretaria general y grupal)
router.delete(
  '/donantes-fijos/:id',
  authorizeRoles(['secretaria general', 'secretaria grupal']),
  donantesFijosController.eliminarDonante
);

export default router;
