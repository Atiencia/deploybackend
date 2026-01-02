import { Router} from "express";
import { register, login, logout, getUsuarios, verificarEmail, reenviarVerificacion, solicitarRecuperacionContrasena, restablecerContrasena } from "../controllers/authController";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware";
import { EventoController } from "../controllers/eventosController";
import { EventoGrupoService } from "../services/eventoGrupoService";
import { EventoServices } from "../services/eventosService";
import { SecretariaGrupoService } from "../services/secretariaGrupoService";
import { GrupoController } from "../controllers/gruposController";
import { GrupoService } from "../services/gruposService";
import { SubGrupoService } from "../services/subgruposService";


const eventoService = new EventoServices();
const eventoGrupoService = new EventoGrupoService(); 
const secretariaGrupoService = new SecretariaGrupoService();
const subgrupoService = new SubGrupoService()
const eventoController = new EventoController(eventoService, secretariaGrupoService, eventoGrupoService, subgrupoService);
const grupoService = new GrupoService();
const grupoController = new GrupoController(grupoService);

// Enrutador de Express
const router = Router();


/**
 * Ruta GET: obtiene todos los grupos disponibles.
 */
router.get('/grupos', grupoController.obtenerGrupos);

// Ruta GET: obtiene todos los roles disponibles en el sistema.
// Si no existen roles registrados, devolverÃ¡ un mensaje indicÃ¡ndolo.
router.get('/eventos-vigentes', eventoController.obtenerEventosVigentes);


export default router;