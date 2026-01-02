import { Request, Response } from 'express';
import jwt from "jsonwebtoken";
import { RolesService } from '../services/rolesService';
import { SECRET_KEY } from '../utils/jwtUtils';

export class RolesController {
  constructor(private readonly rolesService: RolesService) { }

  /**
 * Controlador: Obtiene la lista de roles registrados en el sistema.
 * Si no existen roles, devuelve un mensaje indicándolo.
 */
  obtenerRoles = async (req: Request, res: Response) => {
    try {
      const roles = await this.rolesService.obtenerRoles();
      if (roles.length === 0) {
        return res.json({ message: 'Aún no hay roles registrados' });
      }
      res.json(roles);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Controlador: Asigna un rol específico a un usuario.
   * Requiere en el body: { usuarioId, rol }
   */
  asignarRolAUsuario = async (req: Request, res: Response) => {
    const { usuarioId, rol } = req.body as { usuarioId: number; rol: string };
    const rolId = (rol: string): number => {
      switch (rol) {
        case 'developer':
          return 1;
        case 'admin':
          return 2;
        case 'usuario':
          return 3;
        case 'secretaria general':
          return 4;
        case 'secretaria grupal':
          return 5;
        default:
          return 3; // usuario por defecto
      }
    }
    try {
      const usuario = await this.rolesService.asignarRolAUsuario(usuarioId, rolId(rol));
      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado' });
      }
      res.json(usuario);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }

  }

  /**
   * Controlador: Crea un nuevo rol en el sistema.
   * Requiere en el body: { nombre }
   */
  crearRol = async (req: Request, res: Response) => {
    const { nombre } = req.body as { nombre?: string };
    try {
      if (!nombre) {
        return res.status(400).json({ error: 'El nombre del rol es obligatorio' });
      }
      const nuevoRol = await this.rolesService.crearRol(nombre);
      res.status(201).json(nuevoRol);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Controlador: Elimina un rol existente del sistema.
   * Requiere en el body: { rolId }
   */
  eliminarRol = async (req: Request, res: Response) => {
    const { rolId } = req.body as { rolId: number };
    try {
      const rol = await this.rolesService.eliminarRol(rolId);
      if (!rol) {
        return res.status(404).json({ error: 'Rol no encontrado' });
      }
      res.json({ message: `Rol con ID ${rolId} eliminado correctamente` });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  /**
   * Controlador: Remueve el rol asignado a un usuario (coloca id_rol en NULL).
   * Requiere en el body: { usuarioId }
   */
  removerRolAUsuario = async (req: Request, res: Response) => {
    const { usuarioId } = req.body;

    try {
      const usuario = await this.rolesService.removerRolAUsuario(usuarioId);
      if (!usuario) {
        return res.status(404).json({ error: 'Usuario no encontrado o sin rol asignado' });
      }
      res.json({ message: `Rol removido correctamente del usuario ${usuarioId}`, usuario });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  obtenerRol = async (req: Request, res: Response) => {
    try{
      const cookies = req.signedCookies;
      const token = cookies.token
      if(!token) res.json({message : 'No hay un usuario logeado'});

      const usuario = jwt.verify(token, SECRET_KEY) as any;
      
      res.json({rol: usuario.id_rol})
    } catch (err){
      console.error(err);
      res.status(500).json({err})
    }
    
  }


///////////// Roles en grupo /////////////////////

  // Asigna un rol_en_grupo a un usuario (inserta o actualiza en la tabla usuariogrupo)
  asignarRolAUsuarioEnGrupo = async (req: Request, res: Response) => {
    const { id_usuario, id_grupo, rol_en_grupo } = req.body as {
      id_usuario: number;
      id_grupo: number;
      rol_en_grupo: 'admin' | 'secretaria' | 'usuario';
    };

    if (!id_usuario || !id_grupo || !rol_en_grupo) {
      return res.status(400).json({ error: 'id_usuario, grupoId y rol_en_grupo son obligatorios' });
    }

    try {
      const asignado = await this.rolesService.asignarRolEnGrupo(id_usuario, id_grupo, rol_en_grupo);
      return res.status(200).json({ message: 'Rol asignado correctamente', asignado });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };

    // Obtiene el rol de un usuario en un grupo específico
    obtenerRolDeUsuarioEnGrupo = async (req: Request, res: Response) => {
    const { id_usuario, id_grupo } = req.body;

    if (!id_usuario || !id_grupo) {
      return res.status(400).json({ error: 'id_usuario y id_grupo son obligatorios' });
    }

    try {
      const rol = await this.rolesService.obtenerRolEnGrupo(
        parseInt(id_usuario, 10),
        parseInt(id_grupo, 10)
      );
      return res.status(200).json({ rol });
    } catch (err: any) {
      return res.status(500).json({ error: err.message });
    }
  };
}