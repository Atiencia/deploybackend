import { Router, Request, Response } from "express";
import { RolesController } from '../controllers/rolesController';
import { RolesService } from '../services/rolesService';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware';

const rolesService = new RolesService()
const rolesController = new RolesController(rolesService);

// Enrutador de Express
const router = Router();
router.use(authenticate)

// Ruta GET: obtiene todos los roles disponibles en el sistema.
// Si no existen roles registrados, devolverá un mensaje indicándolo.
router.get('/roles', authorizeRoles(['admin', 'secretaria general', 'secretaria grupal']), rolesController.obtenerRoles);

// Ruta PUT: asigna un rol a un usuario específico.
// Se espera recibir en el body un objeto con "usuarioId" y "rolId".
router.put('/roles/asignar', authorizeRoles(['admin']), rolesController.asignarRolAUsuario);

// Ruta DELETE: elimina un rol específico del sistema.
// Se espera recibir en el body un objeto con "rolId".
router.delete('/roles', authorizeRoles(['admin']), rolesController.eliminarRol);

// Ruta POST: crea un nuevo rol en el sistema.
// Se espera recibir en el body un objeto con "nombre" del rol.
router.post('/roles', authorizeRoles(['admin']), rolesController.crearRol);

// Ruta PUT: remueve el rol de un usuario específico.
// Se espera recibir en el body un objeto con "usuarioId".
router.put('/roles/remover', authorizeRoles(['admin']), rolesController.removerRolAUsuario);

router.get('/roles/logeado', rolesController.obtenerRol)

// RUTA POST: Asigna un rol a un usuario en un grupo específico
// Se espera recibir en el body un objeto con id_usuario, id_grupo, rol_en_grupo:ADMIN / SECRETARIA / USUARIO"
router.post(
  '/roles/asignar-rol-en-grupo',
  authenticate,
  authorizeRoles(['admin', 'secretaria general']),
  rolesController.asignarRolAUsuarioEnGrupo
);

// RUTA POST: Obtiene el rol de un usuario en un grupo específico
// Se espera recibir en el body un objeto con id_usuario e id_grupo
router.post(
  '/roles/obtener-rol-en-grupo',
  authenticate,
  authorizeRoles(['admin', 'secretaria general']),
  rolesController.obtenerRolDeUsuarioEnGrupo
);



export default router;

