import { Router } from "express";
import { SubgrupoController } from "../controllers/subgrupoController";
import { SubGrupoService } from "../services/subgruposService";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware";

const router = Router();
const subgrupoService = new SubGrupoService();
const subgrupoController = new SubgrupoController(subgrupoService);

router.use(authenticate)

// Ruta GET: obtiene todos los subgrupos disponibles en el sistema.
router.get("/subgrupos", subgrupoController.obtenerSubgrupos); 

// Ruta GET: obtiene todos los subgrupos de un grupo en especifico.
router.get("/subgrupos/grupo/:id_grupo", subgrupoController.obtenerSubgruposPorGrupo);

// Ruta GET: obtiene todos los subgrupos de un grupo en especifico al momento de crear un evento, para poder asignar cupos.
router.get("/subgrupos/evento/:id_evento", subgrupoController.obtenerSubgruposPorEvento);

// Ruta POST: crea un nuevo subevento(un evento que conlleva subgrupos).
//router.post("/subgrupos/evento/:id_evento", authorizeRoles(['secretaria grupal']), subgrupoController.crearEventosDeSubgrupos);

// Ruta POST: crea un nuevo subgrupo.
router.post("/subgrupos", authorizeRoles(['secretaria grupal']), subgrupoController.crearSubgrupo);

//ruta PUT: cambia el estado de actividad del subgrupo.
router.put("/subgrupos/:id_subgrupo", authorizeRoles(['secretaria grupal']), subgrupoController.toggleActivoGrupo);


// Ruta POST: edita un subgrupo por ID.
router.post("/subgrupos/:id_subgrupo", authorizeRoles(['secretaria grupal']), subgrupoController.editarSubgrupo);

// Ruta POST : inscribir a un usuario en un subevento (evento en un subgrupo especifico).
router.post("/subgrupos/inscripcion/:id_subgrupo", subgrupoController.inscribirUsuarioEnSubgrupo);

// Ruta GET: obtener suplentes de un subevento 
router.get("/subgrupos/suplentes/:id_evento", subgrupoController.obtenerSuplentesDeSubevento);

// Ruta DELETE: eliminar suplente de un subevento
router.delete("/subgrupos/suplentes/:id_subgrupo", authorizeRoles(['secretaria grupal']), subgrupoController.eliminarSuplenteDeSubevento);

export default router;
