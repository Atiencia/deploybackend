import { SubGrupoService } from "../services/subgruposService";

export class SubgrupoController {
    constructor(private subgrupoService: SubGrupoService) {
        this.obtenerSubgrupos = this.obtenerSubgrupos.bind(this);
        this.crearSubgrupo = this.crearSubgrupo.bind(this);
        this.editarSubgrupo = this.editarSubgrupo.bind(this);
        this.obtenerSubgruposPorGrupo = this.obtenerSubgruposPorGrupo.bind(this);
        this.toggleActivoGrupo = this.toggleActivoGrupo.bind(this);
        this.obtenerSubgruposPorEvento = this.obtenerSubgruposPorEvento.bind(this)
        this.crearEventosDeSubgrupos = this.crearEventosDeSubgrupos.bind(this)
        this.inscribirUsuarioEnSubgrupo = this.inscribirUsuarioEnSubgrupo.bind(this);
        this.obtenerSubgrupoPorId = this.obtenerSubgrupoPorId.bind(this);
        this.obtenerSuplentesDeSubevento = this.obtenerSuplentesDeSubevento.bind(this);
        this.eliminarSuplenteDeSubevento = this.eliminarSuplenteDeSubevento.bind(this);
    }

    // Obtener todos los subgrupos registrados
    async obtenerSubgrupos(req: any, res: any) {
        try {
            const subgrupos = await this.subgrupoService.obtenerSubgrupos();
            if (subgrupos.length === 0) {
                return res.json({ message: 'No hay subgrupos disponibles' });
            }
            return res.json(subgrupos);
        } catch (error) {
            console.error('Error al obtener subgrupos:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    // Obtener todos los subgrupos de un grupo en especifico    
    async obtenerSubgruposPorGrupo(req: any, res: any) {
        const { id_grupo } = req.params;
        try {
            const subgrupos = await this.subgrupoService.obtenerSubgruposPorGrupo(Number(id_grupo));
            if (subgrupos.length === 0) {
                return res.json(subgrupos);
            }
            return res.json(subgrupos);
        } catch (error) {
            console.error('Error al obtener subgrupos:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }


    // Obtener todos los subgrupos de un grupo en especifico    
    async obtenerSubgruposPorEvento(req: any, res: any) {
        const { id_evento } = req.params;
        try {
            const subgrupos = await this.subgrupoService.obtenerSubgruposPorEvento(id_evento);
            console.log(subgrupos)
            if (subgrupos.length === 0) {
                return res.json(subgrupos);
            }
            return res.json(subgrupos);

        } catch (error) {
            console.error('Error al obtener subgrupos:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    async obtenerSubgrupoPorId(req: any, res: any) {
        const { id_subgrupo } = req.params;
        try {
            const subgrupos = await this.subgrupoService.obtenerSubgrupo(Number(id_subgrupo));
            if (subgrupos === undefined) {
                return res.json(subgrupos);
            }
            return res.json(subgrupos);
        } catch (error) {
            console.error('Error al obtener subgrupo:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }



    async crearSubgrupo(req: any, res: any) {
        const { id_grupo, nombre, descripcion } = req.body;
        try {
            if (!id_grupo || !nombre || !descripcion) {
                return res.status(400).json({ error: 'ID de grupo, nombre y descripción son obligatorios' });
            }
            const nuevoSubgrupo = await this.subgrupoService.crearSubgrupo(id_grupo, nombre, descripcion);
            return res.status(201).json(nuevoSubgrupo);
        } catch (error) {
            console.error('Error al crear subgrupo:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    async editarSubgrupo(req: any, res: any) {
        const { id_subgrupo } = req.params;
        const { nombre, activo, descripcion } = req.body;

        const nombreInput = nombre == '' ? null : nombre;
        const descripcionInput = descripcion == '' ? null : descripcion

        try {
            const subgrupoActualizado = await this.subgrupoService.editarSubgrupo(id_subgrupo, nombreInput, activo, descripcionInput);
            if (!subgrupoActualizado) {
                return res.status(404).json({ message: 'Subgrupo no encontrado' });
            }
            return res.json(subgrupoActualizado);
        } catch (error) {
            console.error('Error al editar subgrupo:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    async toggleActivoGrupo(req: any, res: any) {
        const { id_subgrupo } = req.params;

        try {
            const subgrupoActualizado = await this.subgrupoService.toggleActivoSubgrupo(id_subgrupo);
            if (!subgrupoActualizado) return res.status(404).json({ message: 'Subgrupo no encontrado' })

            return res.json(subgrupoActualizado);


        } catch (err) {
            console.error(err)
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    async inscribirUsuarioEnSubgrupo(req: any, res: any) {
        try {
            const usuarioId = req.user?.id_usuario;
            if (!usuarioId) return res.status(401).json({ error: 'Usuario no autenticado' });

            const {
                eventoId,
                residencia,
                rol,
                primeraVez,
                carrera,
                anioCarrera,
                subgrupo,
            } = req.body as {
                eventoId: number;
                residencia: string;
                rol: string;
                primeraVez: boolean;
                carrera?: string;
                anioCarrera?: number;
                subgrupo?: string
            };

            if (!eventoId || !residencia || !rol) {
                return res.status(400).json({ error: 'Faltan campos obligatorios' });
            }

            const mensaje = await this.subgrupoService.inscribirUsuarioSubgrupos({
                eventoId,
                usuarioId,
                residencia,
                rol,
                primeraVez,
                carrera,
                anioCarrera,
                subgrupo
            });

            res.json({ message: mensaje, eventoId });

        } catch (err: any) {
            console.error('Error al inscribir por subgrupos:', err);
            res.status(500).json({ error: err.message });
        }
    }

    async crearEventosDeSubgrupos(req: any, res: any) {
        const { id_evento } = req.params;
        const { id_subgrupo, cupos, cupos_suplente } = req.body
        try {
            const subEventos = await this.subgrupoService.crearEventoDeSubgrupos({ id_subgrupo, id_evento, cupos, cupos_suplente });
            console.log(subEventos)
            if (subEventos.length === 0) {
                return res.json(subEventos);
            }
            return res.json(subEventos);

        } catch (error) {
            console.error('Error al obtener subgrupos:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }


    // ============================ METODOS PARA SUPLENTES ============================

    async obtenerSuplentesDeSubevento(req: any, res: any) {
        const { id_evento } = req.params;
        const { id_subgrupo } = req.body;

        try {
            const suplentes = await this.subgrupoService.obtenerSuplentesSubgrupo(Number(id_evento), id_subgrupo);
            return res.json(suplentes);
        } catch (error) {
            console.error('Error al obtener suplentes del subevento:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }

    async eliminarSuplenteDeSubevento(req: any, res: any) {
        const id_subgrupo = req.params.id_subgrupo;
        const payload = req.body;

        try {
            const eliminado = await this.subgrupoService.eliminarSuplente(payload.id_evento, payload.id_usuario, Number(id_subgrupo));
            return res.json(eliminado);
        } catch (error) {
            console.error('Error al eliminar suplente del subevento:', error);
            return res.status(500).json({ message: 'Error interno del servidor' });
        }
    }
}
