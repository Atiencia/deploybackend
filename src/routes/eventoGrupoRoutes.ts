
// Este enrutador maneja las rutas relacionadas con la asociación entre eventos y grupos
// El endpoint de crear evento ya realiza esta asociación, pero este puede ser útil para otras operaciones (cambiar id_grupo de un evento ya creado, por ejemplo)

import { Router } from 'express';
import { EventoGrupoController } from '../controllers/eventoGrupoController';
import { EventoGrupoService } from '../services/eventoGrupoService';

const eventoGrupoService = new EventoGrupoService();
const eventoGrupoController = new EventoGrupoController(eventoGrupoService);


const router = Router();

// Asociar evento a grupo
router.post('/evento_grupo', eventoGrupoController.asociarEventoGrupo);



export default router;
