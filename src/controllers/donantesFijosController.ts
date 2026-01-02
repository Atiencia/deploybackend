import { Request, Response } from 'express';
import { DonantesFijosService } from '../services/donantesFijosService';
import { SecretariaGrupoService } from '../services/secretariaGrupoService';

export class DonantesFijosController {
  constructor(
    private readonly donantesFijosService: DonantesFijosService,
    private readonly secretariaGrupoService: SecretariaGrupoService 
  ) {
    this.obtenerTodosDonantes = this.obtenerTodosDonantes.bind(this);
    this.obtenerDonantePorId = this.obtenerDonantePorId.bind(this);
    this.crearDonante = this.crearDonante.bind(this);
    this.editarDonante = this.editarDonante.bind(this);
    this.obtenerDonantesPorGrupo = this.obtenerDonantesPorGrupo.bind(this);
    this.eliminarDonante = this.eliminarDonante.bind(this);
  }

  async obtenerTodosDonantes(req: Request, res: Response) {
    try {
      const donantes = await this.donantesFijosService.obtenerTodosDonantes();
      res.json(donantes);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  async obtenerDonantePorId(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const donante = await this.donantesFijosService.obtenerDonantePorId(Number(id));
      if (!donante) return res.status(404).json({ message: 'Donante no encontrado' });
      res.json(donante);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  async crearDonante(req: Request, res: Response) {
    const { nombre, apellido, email, dni, id_grupo } = req.body;
    console.log(req.body)
    const user = req.user; // El usuario autenticado
    console.log(user)

     if (!user) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    try {
        // Valiación de roles para permitir crear un donante
        if (user.id_rol !== 4 && user.id_rol !== 5) {
            return res.status(403).json({ error: "No tienes permisos para crear un donante" });
        }

        let grupoAsignado = id_grupo;

        // Si es rol 5 (Secretaría Grupal), obtener el grupo asignado desde la base de datos
        if (user.id_rol === 5) {
            const gruposSecretaria = await this.secretariaGrupoService.obtenerGruposDeSecretaria(user.id_usuario);
            if (gruposSecretaria.length === 0) {
                return res.status(400).json({ error: "No tienes un grupo asignado como secretaria grupal" });
            }
            grupoAsignado = gruposSecretaria[0]; // Tomar el primer id_grupo del array
        }

        // Para secretaria general, id_grupo no puede ser null
        if (user.id_rol === 4 && grupoAsignado === null) {
            return res.status(400).json({ error: "Debe seleccionar un grupo para el donante" });
        }

        const nuevoDonante = await this.donantesFijosService.crearDonante({
            nombre,
            apellido,
            email,
            dni,
            id_grupo: grupoAsignado
        });

        res.status(201).json(nuevoDonante);

    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  async editarDonante(req: Request, res: Response) {
    const { id } = req.params;
    const { nombre, apellido, email, dni, id_grupo } = req.body;
    try {
      const actualizado = await this.donantesFijosService.editarDonante(Number(id), { nombre, apellido, email, dni, id_grupo });
      res.json(actualizado);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }


  async obtenerDonantesPorGrupo(req: Request, res: Response) {
    const user = req.user;

    if (!user) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const id_usuario = user.id_usuario;
    console.log('[obtenerDonantesPorGrupo] Usuario:', id_usuario, 'Rol:', user.id_rol);

    try {
      const donantes = await this.donantesFijosService.obtenerDonantesPorGrupo(id_usuario);
      console.log('[obtenerDonantesPorGrupo] Donantes encontrados:', donantes.length);
      res.json(donantes);
    } catch (err: any) {
      console.error('[obtenerDonantesPorGrupo] Error:', err.message);
      res.status(500).json({ error: err.message });
    }
  }

  async eliminarDonante(req: Request, res: Response) {
    const { id } = req.params;
    const user = req.user //usuario autenticado

    if (!user) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    try {
      // Validar permisos
      if (user.id_rol !== 4 && user.id_rol !== 5) {
        return res.status(403).json({ error: "No tienes permisos para eliminar donantes" });
      }

      const eliminado = await this.donantesFijosService.eliminarDonante(Number(id), user.id_usuario, user.id_rol);
      if (!eliminado) return res.status(404).json({ message: 'Donante no encontrado' });
      res.json({ message: 'Donante eliminado correctamente', eliminado });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }
}
