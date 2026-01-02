import { Router } from 'express';
import { GrupoController } from '../controllers/gruposController';
import { GrupoService } from '../services/gruposService';
import { authenticate, authorizeRoles } from '../middleware/authMiddleware';
import multer from 'multer';
import path from 'path';

const grupoService = new GrupoService();
const grupoController = new GrupoController(grupoService);

// Enrutador de Express
const router = Router();
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage, // <-- Cambiado a memoryStorage
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb: multer.FileFilterCallback) => {
    const allowed = /jpeg|jpg|png|gif|webp/; // Añadido webp
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    if (!ok) {
      cb(new Error("Solo imágenes (jpeg/jpg/png/gif/webp)"));
      return;
    }
    cb(null, true);
  },
});

router.use(authenticate);

/**
 * Ruta POST: crea un nuevo grupo.
*/
router.post('/grupos',upload.single("imagen")/*, authorizeRoles(['admin', 'secretaria general'])*/, grupoController.crearGrupo);    


/**
 * Ruta GET: obtiene todos los grupos disponibles.
 */
router.get('/grupos', grupoController.obtenerGrupos);


// Middleware de autenticación para las rutas que requieren autenticación
//router.use(authenticate);


//Ruta POST para seguir un grupo
router.post('/grupos/seguir/:id', authorizeRoles(['usuario']), grupoController.seguirGrupo);

//Ruta GET para obtener grupos seguidos
router.get('/grupos/seguidos', authorizeRoles(['usuario']), grupoController.obtenerGruposSeguidos);

// Nueva ruta para obtener seguidores de un grupo
router.get('/grupos/:id/seguidores', authorizeRoles(['admin', 'secretaria general', 'secretaria grupal', 'usuario']), grupoController.obtenerSeguidoresGrupo);

// Nueva ruta para obtener solicitudes de un grupo
router.get('/grupos/:id/solicitudes', authorizeRoles(['secretaria grupal']), grupoController.obtenerSolicitudesGrupo);

// Nueva ruta para gestionar solicitudes (aceptar/rechazar)
router.post('/grupos/:id/solicitudes', authorizeRoles(['secretaria grupal']), grupoController.gestionarSolicitud);

// Nueva ruta para eliminar un miembro del grupo
router.delete('/grupos/:id_grupo/miembros/:id_usuario', authorizeRoles(['secretaria grupal']), grupoController.eliminarMiembro);

/**
 * Ruta GET: obtiene un grupo por ID.
 */
router.get('/grupos/:id', authorizeRoles(['admin', 'secretaria general', 'usuario', 'secretaria grupal']), grupoController.obtenerGrupo);


/**
 * Ruta POST: edita un grupo por ID, tambien usamos esta ruta para eliminar un grupo
 */
router.post('/grupos/:id', authorizeRoles(['admin', 'secretaria general', 'secretaria grupal']), grupoController.editarGrupo);


export default router;
