import { Request, Response } from 'express';
import { SecretariaGrupoService } from '../services/secretariaGrupoService';

export class SecretariaGrupoController {
  constructor(private readonly secretariaGrupoService: SecretariaGrupoService) {}

  /**
   * Asigna una secretaria a un grupo específico
   * Body: { usuarioId: number, grupoId: number }
   */
  asignarSecretariaAGrupo = async (req: Request, res: Response) => {
    const { usuarioId, grupoId } = req.body;

    if (!usuarioId || !grupoId) {
      return res.status(400).json({ error: 'usuarioId y grupoId son obligatorios' });
    }

    try {
      const asignacion = await this.secretariaGrupoService.asignarSecretariaAGrupo(usuarioId, grupoId);
      res.status(200).json({ 
        message: 'Secretaria asignada al grupo exitosamente', 
        data: asignacion 
      });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  /**
   * Remueve una secretaria de un grupo
   * Body: { usuarioId: number, grupoId: number }
   */
  removerSecretariaDeGrupo = async (req: Request, res: Response) => {
    const { usuarioId, grupoId } = req.body;

    if (!usuarioId || !grupoId) {
      return res.status(400).json({ error: 'usuarioId y grupoId son obligatorios' });
    }

    try {
      const eliminado = await this.secretariaGrupoService.removerSecretariaDeGrupo(usuarioId, grupoId);
      
      if (!eliminado) {
        return res.status(404).json({ error: 'Asignación no encontrada' });
      }

      res.json({ message: 'Secretaria removida del grupo exitosamente' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Obtiene todos los grupos asignados a una secretaria
   * Params: usuarioId
   */
  obtenerGruposDeSecretaria = async (req: Request, res: Response) => {
    const usuarioId = parseInt(req.params.usuarioId);

    if (isNaN(usuarioId)) {
      return res.status(400).json({ error: 'usuarioId inválido' });
    }

    try {
      const grupos = await this.secretariaGrupoService.obtenerGruposDeSecretaria(usuarioId);
      res.json({ grupos });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Obtiene todas las secretarias asignadas a un grupo
   * Params: grupoId
   */
  obtenerSecretariasDeGrupo = async (req: Request, res: Response) => {
    const grupoId = parseInt(req.params.grupoId);

    if (isNaN(grupoId)) {
      return res.status(400).json({ error: 'grupoId inválido' });
    }

    try {
      const secretarias = await this.secretariaGrupoService.obtenerSecretariasDeGrupo(grupoId);
      res.json({ secretarias });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Obtiene información de una secretaria grupal (sus grupos asignados)
   * Utiliza el usuario autenticado del token
   */
  obtenerMisGrupos = async (req: Request, res: Response) => {
    const usuario = req.user;

    if (!usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    try {
      const info = await this.secretariaGrupoService.obtenerInfoSecretariaGrupal(usuario.id_usuario);
      res.json(info);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  /**
   * Obtiene los eventos de un grupo específico (para secretarias grupales)
   * Params: grupoId
   */
  obtenerEventosDeGrupo = async (req: Request, res: Response) => {
    const grupoId = parseInt(req.params.grupoId);
    const usuario = req.user;

    if (!usuario) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    if (isNaN(grupoId)) {
      return res.status(400).json({ error: 'grupoId inválido' });
    }

    try {
      const eventos = await this.secretariaGrupoService.obtenerEventosDeGrupo(grupoId, usuario.id_usuario);
      res.json({ eventos });
    } catch (err: any) {
      res.status(403).json({ error: err.message });
    }
  };
}
