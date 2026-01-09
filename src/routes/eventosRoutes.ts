import { Router } from 'express';
import { EventoController} from '../controllers/eventosController';
import { EventoServices } from '../services/eventosService';
import { EventoGrupoService } from '../services/eventoGrupoService';
import { authenticate, authorizeRoles, validateSecretariaEventoAccess } from '../middleware/authMiddleware';
import { SecretariaGrupoService } from '../services/secretariaGrupoService';
import { SubGrupoService } from '../services/subgruposService';

const eventoService = new EventoServices();
const eventoGrupoService = new EventoGrupoService(); 
const secretariaGrupoService = new SecretariaGrupoService();
const subgruposService = new SubGrupoService()
const eventoController = new EventoController(eventoService, secretariaGrupoService, eventoGrupoService, subgruposService);


// Enrutador de Express
const router = Router();

// Ruta GET: obtiene todos los roles disponibles en el sistema.
// Si no existen roles registrados, devolverÃ¡ un mensaje indicÃ¡ndolo.
router.get('/eventos', authenticate, eventoController.obtenerEventos);

router.get('/eventos-vigentes', authenticate, eventoController.obtenerEventosVigentes);

router.get('/eventos-transcurridos', authenticate, eventoController.obtenerEventosTranscurridos);

router.get('/eventos-cancelados', authenticate, eventoController.obtenerEventosCancelados);

// GET: Obtener eventos donde el usuario estÃ¡ inscrito (Mis Eventos)
router.get('/eventos/mis-eventos', authenticate, eventoController.obtenerMisEventos);

// GET: Obtener eventos disponibles donde el usuario NO estÃ¡ inscrito
router.get('/eventos/eventos-disponibles', authenticate, eventoController.obtenerEventosDisponibles);

// GET: Obtener estadísticas de cupos de un evento (DEBE IR ANTES DE /eventos/:id)
router.get('/eventos/estadisticas/:id', authenticate, eventoController.obtenerEstadisticasEvento);

router.get('/eventos/:id', eventoController.obtenerEvento)
router.delete('/eventos/inscriptos', eventoController.eliminarInscripto);


//RUTA PARA ACTUALIZAR LA INFO DEL EVENTO
router.put('/eventos', eventoController.actualizarEvento);


// Ruta PUT: asigna un rol a un usuario especÃ­fico.
// Se espera recibir en el body un objeto con "usuarioId" y "rolId".
router.put('/eventos/asignarCupos', eventoController.asignarCupos);

// Ruta DELETE: elimina un rol especÃ­fico del sistema.
// Se espera recibir en el body un objeto con "rolId".
router.delete('/eventos', eventoController.eliminarEvento);

// Ruta POST: crea un nuevo evento
// Se espera que el body contenga al menos idGrupo
router.post(
  '/eventos', 
  // authorizeRoles(['admin','secretaria general', 'secretaria grupal']), 
  // authorizeRolesEnGrupo(['admin', 'secretaria']), 
  eventoController.crearEvento
);
// Ruta PUT: Cancelar un evento (cambia estado a 'cancelado' y notifica a inscriptos)
// Se espera recibir en el body un objeto con "eventoId".
router.put('/eventos/cancelar', eventoController.cancelarEvento);

// Ruta POST: crea un nuevo rol en el sistema.
// Se espera recibir en el body un objeto con "nombre" del rol.
router.post('/eventos', eventoController.crearEvento);


// Ruta POST: Contar inscriptos 
// Se espera recibir en el body "eventoId".
router.post('/eventos/inscriptos/count', authenticate, validateSecretariaEventoAccess(), eventoController.contarInscriptos);

// Ruta POST: Obtener inscriptos 
// Se espera recibir en el body "eventoId".
router.post('/eventos/inscriptos/lista', authenticate, validateSecretariaEventoAccess(), eventoController.obtenerInscriptos);

// POST: InscripciÃ³n a evento
router.post('/eventos/inscripcion', authenticate, eventoController.inscribirUsuario);

// POST: Verificar si el usuario actual estÃ¡ inscrito en un evento
router.post('/eventos/verificar-inscripcion', authenticate, eventoController.verificarInscripcionUsuario);

// POST: Obtener detalles de inscripción (si es suplente, orden, etc.)
router.post('/eventos/detalles-inscripcion', authenticate, eventoController.obtenerDetallesInscripcion);

// DELETE: Dar de baja la inscripciÃ³n del usuario actual a un evento
router.delete('/eventos/mi-baja', authenticate, eventoController.darDeBajaInscripcionConPromocion);

router.post('/evento-grupo/:id', eventoController.obtenerEventosPorGrupo);

// endpoint de eventos pasados
router.post('/evento-grupo/:id', eventoController.obtenerEventosPorGrupo);


// Rutas de Eventos inscritos por usuario y para darse de baja
//router.get('/eventos/inscritos', authenticate, eventoController.obtenerEventosInscritosPorUsuario);

//
//router.delete('/eventos/:id_evento/baja', authenticate, eventoController.darseDeBajaEvento);

// ==================== RUTAS PARA SUPLENTES ====================

// GET: Obtener lista de suplentes de un evento
router.get('/eventos/suplentes/:id', authenticate, validateSecretariaEventoAccess(), eventoController.obtenerSuplentes);

// DELETE: Dar de baja a un inscrito específico y promover suplente (admin/secretaria)
router.delete('/eventos/:eventoId/inscrito/:usuarioId', authenticate, validateSecretariaEventoAccess(), eventoController.darDeBajaYPromoverSuplente);

// DELETE: Eliminar un suplente específico (sin promoción)
router.delete('/eventos/:eventoId/suplente/:usuarioId', authenticate, validateSecretariaEventoAccess(), eventoController.eliminarSuplente);

export default router;

