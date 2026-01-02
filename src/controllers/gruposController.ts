import { Request, Response } from 'express';
import { GrupoService } from '../services/gruposService';
import pool from '../db';
import { supabase } from '../config/supabaseClient';

export class GrupoController {
  constructor(private readonly grupoService: GrupoService) {
    this.obtenerGrupos = this.obtenerGrupos.bind(this);
    this.obtenerGrupo = this.obtenerGrupo.bind(this);
    this.crearGrupo = this.crearGrupo.bind(this);
    this.editarGrupo = this.editarGrupo.bind(this);
    this.seguirGrupo = this.seguirGrupo.bind(this);
    this.obtenerGruposSeguidos = this.obtenerGruposSeguidos.bind(this);
    this.obtenerSeguidoresGrupo = this.obtenerSeguidoresGrupo.bind(this);
    this.obtenerSolicitudesGrupo = this.obtenerSolicitudesGrupo.bind(this);
    this.gestionarSolicitud = this.gestionarSolicitud.bind(this);
    this.eliminarMiembro = this.eliminarMiembro.bind(this);
  }

  // Obtener todos los grupos registrados
  // Si es secretaria grupal, solo devuelve sus grupos asignados
  async obtenerGrupos(req: Request, res: Response) {
    try {
      const usuarioId = (req as any).usuario?.id_usuario;
      const rolNombre = (req as any).usuario?.rol_nombre;

      let grupos;

      // Si es secretaria grupal, solo sus grupos asignados
      if (rolNombre === 'secretaria grupal') {
        const result = await pool.query(
          `SELECT g.* FROM grupo g
           INNER JOIN usuariogrupo ug ON g.id_grupo = ug.id_grupo
           WHERE ug.id_usuario = $1 AND ug.rol_en_grupo = 'secretaria'
           ORDER BY g.nombre`,
          [usuarioId]
        );
        grupos = result.rows;
      } else {
        // Admin o secretaria general: todos los grupos
        grupos = await this.grupoService.obtenerGrupos();
      }

      if (grupos.length === 0) {
        return res.json({ message: 'No hay grupos disponibles' });
      }
      res.json(grupos);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  // Obtener un solo grupo por ID (desde params)
  async obtenerGrupo(req: Request, res: Response) {
    const { id } = req.params;
    try {
      const grupo = await this.grupoService.obtenerGrupo(Number(id));
      if (!grupo) {
        return res.status(404).json({ error: 'Grupo no encontrado' });
      }
      res.json(grupo);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }

  // Crear un nuevo grupo (datos desde el body)
  async crearGrupo(req: Request, res: Response) {
    console.log(req.body)
    const { nombre, descripcion, zona, usuario_instagram, contacto_whatsapp } = req.body;

    try {
      if (!nombre) {
        return res.status(400).json({ error: 'El nombre del grupo es obligatorio' });
      }

      let imagen_url: string | undefined = undefined;


      // Lógica de UPLOAD (usando req.file.buffer de memoryStorage)
      if (req.file) { // Acceder a req.file (definido globalmente)
        try {
          const fileName = `${Date.now()}-${req.file.originalname}`;

          const { data, error } = await supabase.storage
            .from('grupos_imagenes')
            .upload(fileName, req.file.buffer, { // Usar req.file.buffer
              contentType: req.file.mimetype,
              upsert: false
            });

          if (error) {
            console.error('Error subiendo imagen a Supabase:', error);
            return res.status(500).json({ error: `Error al subir imagen ${error.message}` });
          }

          const { data: urlData } = supabase.storage
            .from('grupos_imagenes')
            .getPublicUrl(fileName);

          imagen_url = urlData.publicUrl;
          // No se necesita fs.unlinkSync
        } catch (uploadError: any) {
          console.error('Error procesando la imagen:', uploadError);
          return res.status(500).json({ error: 'Error al procesar la imagen' });
        }
      }

      const nuevoGrupo = await this.grupoService.crearGrupo(nombre, descripcion, zona, imagen_url, contacto_whatsapp, usuario_instagram);
      res.status(201).json(nuevoGrupo);
    } catch (err: any) {
      console.error(err)
      res.status(500).json({ error: err.message });
    }
  }

  // Crear un nuevo grupo (datos desde el body)
  async editarGrupo(req: Request, res: Response) {
    const { id } = req.params;
    const rolNombre = (req as any).usuario?.rol_nombre;
    const usuarioId = rolNombre === 'admin' ? '' : (req as any).usuario?.id_usuario;

    const datosEditados = req.body.datosEditados ? req.body.datosEditados : req.body

    if (!id) throw new Error('ID de grupo es requerido');
    const { nombre, descripcion, zona, usuario_instagram, imagen_url, contacto_whatsapp, activo } = datosEditados;

    try {
      const nuevoGrupo = await this.grupoService.editarGrupo(parseInt(id), nombre, descripcion, zona, imagen_url, activo, contacto_whatsapp, usuario_instagram, usuarioId);
      console.log('editado', nuevoGrupo)
      res.status(201).json(nuevoGrupo);
    } catch (err: any) {
      console.error(err)
      res.status(500).json({ error: err.message });
    }
  }

  async seguirGrupo(req: Request, res: Response) {
    const id_usuario = (req as any).usuario?.id_usuario;
    const { id } = req.params

    console.log('seguir grupo', id_usuario, id)
    if (!id) throw new Error('ID de grupo es requerido');

    try {
      const siguiendo = await this.grupoService.seguirGrupo(id_usuario, parseInt(id));
      res.status(200).json({ message: 'Grupo seguido correctamente', siguiendo });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  async obtenerGruposSeguidos(req: Request, res: Response) {
    const id_usuario = (req as any).usuario?.id_usuario;
    try {
      const grupos = await this.grupoService.obtenerGruposSeguidos(id_usuario);
      res.json(grupos);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  async obtenerSeguidoresGrupo(req: Request, res: Response) {
    const { id } = req.params;
    if (!id) throw new Error('ID de grupo es requerido');

    try {
      const seguidores = await this.grupoService.obtenerSeguidoresGrupo(Number(id));
      res.json(seguidores);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  async obtenerSolicitudesGrupo(req: Request, res: Response) {
    const { id } = req.params;
    if (!id) throw new Error('ID de grupo es requerido');
    try {
      const solicitudes = await this.grupoService.obtenerSolicitudesGrupo(Number(id));
      res.json(solicitudes);
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  async gestionarSolicitud(req: Request, res: Response) {
    const { id_usuario, accion } = req.body;
    const { id } = req.params;

    try {
      const mensaje = await this.grupoService.gestionarSolicitud(id_usuario, Number(id), accion);
      res.json({ message: mensaje });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

  async eliminarMiembro(req: Request, res: Response) {
    const { id_usuario, id_grupo } = req.params;
    if (!id_usuario || !id_grupo) throw new Error('ID de usuario y grupo son requeridos');

    try {
      const mensaje = await this.grupoService.eliminarMiembro(Number(id_usuario), Number(id_grupo));
      res.json({ message: mensaje });
    } catch (err: any) {
      console.error(err);
      res.status(500).json({ error: err.message });
    }
  }

}
