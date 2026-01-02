import { Request, Response } from "express";
import { noticiaService } from "../services/noticiaService";
import { supabase } from "../config/supabaseClient"; // Asegúrate que esta ruta sea correcta
// No es necesario importar 'fs' si usas memoryStorage y buffers

export class NoticiaController {

  listar = async (req: Request, res: Response) => {
    try {
      const grupoId = req.query.grupoId ? Number(req.query.grupoId) : undefined;
      const q = req.query.q ? String(req.query.q) : undefined;
      const dateFrom = req.query.date_from ? String(req.query.date_from) : undefined;
      const dateTo = req.query.date_to ? String(req.query.date_to) : undefined;
      const page = req.query.page ? Number(req.query.page) : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : undefined;

      const noticias = await noticiaService.listar({ grupoId, q, dateFrom, dateTo, page, limit });
      res.json(noticias);
    } catch (err: any) {
      console.error("Error en listar noticias:", err);
      res.status(500).json({ error: err.message || "Error interno del servidor" });
    }
  };

  detalle = async (req: Request, res: Response) => {
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const noticia = await noticiaService.obtenerPorId(id);
      if (!noticia) return res.status(404).json({ error: "Noticia no encontrada" });
      
      // El servicio ya devuelve los nombres, así que no es necesaria la transformación
      res.json(noticia);
    } catch (err: any) {
      console.error("Error detalle noticia:", err);
      res.status(500).json({ error: err.message || "Error interno del servidor" });
    }
  };

  crear = async (req: Request, res: Response) => { // Usar Request estándar
    try {
      const autorId = req.user?.id_usuario; // Acceder a req.user (definido globalmente)
      if (!autorId) return res.status(401).json({ error: "Usuario no autenticado" });

      const { titulo, lugar, descripcion, grupo_id, fijada, duracion_fijada } = req.body;
      if (!titulo || !descripcion) return res.status(400).json({ error: "Faltan campos obligatorios" });

      let imagen_url: string | null = null;

      // Lógica de UPLOAD (usando req.file.buffer de memoryStorage)
      if (req.file) { // Acceder a req.file (definido globalmente)
        try {
          const fileName = `${Date.now()}-${req.file.originalname}`;
          
          const { data, error } = await supabase.storage
            .from('noticias_imagenes')
            .upload(fileName, req.file.buffer, { // Usar req.file.buffer
              contentType: req.file.mimetype,
              upsert: false
            });

          if (error) {
            console.error('Error subiendo imagen a Supabase:', error);
            return res.status(500).json({ error: 'Error al subir la imagen' });
          }

          const { data: urlData } = supabase.storage
            .from('noticias_imagenes')
            .getPublicUrl(fileName);

          imagen_url = urlData.publicUrl;
          // No se necesita fs.unlinkSync
        } catch (uploadError: any) {
          console.error('Error procesando la imagen:', uploadError);
          return res.status(500).json({ error: 'Error al procesar la imagen' });
        }
      }

      const noticia = await noticiaService.crear({
        titulo: String(titulo),
        lugar: lugar ? String(lugar) : null,
        descripcion: String(descripcion),
        autorId,
        grupoId: grupo_id ? Number(grupo_id) : null,
        fijada: String(fijada).toLowerCase() === 'true' || String(fijada) === '1', // Conversión robusta
        duracion_fijada: duracion_fijada || null,
        imagen_path: imagen_url, // Guardar la URL de Supabase
      });

      res.status(201).json(noticia);
    } catch (err: any) {
      console.error("Error crear noticia:", err);
      res.status(500).json({ error: err.message });
    }
  };

  actualizar = async (req: Request, res: Response) => { // Usar Request estándar
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const actorId = req.user?.id_usuario;
      const actorRolId = req.user?.id_rol;
      if (!actorId || !actorRolId) return res.status(401).json({ error: "Usuario no autenticado" });

      const { titulo, lugar, descripcion, fijada, duracion_fijada, grupo_id, imagen_path } = req.body;

      // Lógica de actualización de imagen
      let imagen_path_update: string | null | undefined = undefined; // undefined = no cambiar

      if (req.file) {
        // 1. Hay un archivo nuevo, subirlo
        try {
          const fileName = `${Date.now()}-${req.file.originalname}`;
          const { data, error } = await supabase.storage
            .from('noticias_imagenes')
            .upload(fileName, req.file.buffer, { // <-- Usar buffer
              contentType: req.file.mimetype,
              upsert: false
            });
          if (error) throw error;
          const { data: urlData } = supabase.storage
            .from('noticias_imagenes')
            .getPublicUrl(fileName);
          imagen_path_update = urlData.publicUrl;
        } catch (uploadError: any) {
          console.error('Error procesando la imagen de actualización:', uploadError);
          return res.status(500).json({ error: 'Error al procesar la imagen' });
        }
      } else if (imagen_path === null) {
        // 2. Se envió 'imagen_path: null' explícitamente para eliminarla
        imagen_path_update = null;
      }
      // 3. Si no hay req.file y 'imagen_path' no es null, 'imagen_path_update' queda undefined

      const fijadaBool =
        fijada !== undefined
          ? (String(fijada).toLowerCase() === "true" || String(fijada) === "1" || fijada === true)
          : undefined;

      const updated = await noticiaService.actualizar(id, {
        titulo: titulo,
        lugar: lugar,
        descripcion: descripcion,
        fijada: fijadaBool,
        duracion_fijada: duracion_fijada ?? null,
        grupo_id: grupo_id !== undefined ? (grupo_id ? Number(grupo_id) : null) : undefined,
        imagen_path: imagen_path_update, // Usar el valor procesado
        actorId: actorId,
        actorRolId: actorRolId,
      });

      res.json(updated);
    } catch (err: any) {
      console.error("Error actualizar noticia:", err);
      if (err.message === "Noticia no encontrada") {
        return res.status(404).json({ error: err.message });
      }
      if (err.message && err.message.includes("No autorizado")) {
        return res.status(403).json({ error: err.message });
      }
      res.status(500).json({ error: err.message || "Error interno del servidor" });
    }
  };

  eliminar = async (req: Request, res: Response) => { // Usar Request estándar
    try {
      const id = Number(req.params.id);
      if (isNaN(id)) return res.status(400).json({ error: "ID inválido" });

      const actorId = req.user?.id_usuario;
      const actorRolId = req.user?.id_rol;
      if (!actorId || !actorRolId) return res.status(401).json({ error: "Usuario no autenticado" });

      await noticiaService.eliminar(id, actorId, actorRolId);
      res.json({ message: "Noticia eliminada" });
    } catch (err: any) {
      console.error("Error eliminar noticia:", err);
      if (err.message === "Noticia no encontrada") {
        return res.status(404).json({ error: err.message });
      }
      if (err.message.includes("No autorizado")) {
        return res.status(403).json({ error: err.message });
      }
      res.status(500).json({ error: err.message });
    }
  };
}
