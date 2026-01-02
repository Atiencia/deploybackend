// src/routes/noticias.ts
import { Router } from "express";
import { NoticiaController } from "../controllers/noticiaController";
import { authenticate } from "../middleware/authMiddleware";
import multer from "multer";
import path from "path";

const router = Router();
const controller = new NoticiaController();

// --- CONFIGURACIÓN DE MULTER (MODIFICADA) ---
// Usar memoryStorage para pasar el buffer al servicio (más eficiente)
const storage = multer.memoryStorage();

const upload = multer({
  storage: storage, // <-- Cambiado a memoryStorage
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb: multer.FileFilterCallback) => {
    const allowed = /jpeg|jpg|png|gif|webp/; // Añadido webp
    const ok = allowed.test(path.extname(file.originalname).toLowerCase()) && allowed.test(file.mimetype);
    if (!ok) {
      cb(new Error("Solo imágenes (jpeg/jpg/png/gif/webp)"));
      return;
    }
    cb(null, true);
  },
});

// públicas
router.get("/", controller.listar);
router.get("/:id", controller.detalle);

// protegidas
router.post(
  "/", 
  authenticate, 
  upload.single("imagen"), // Aceptar multipart/form-data
  controller.crear
);
router.put(
  "/:id", 
  authenticate, 
  upload.single("imagen"), // <-- AÑADIDO: Aceptar imagen también al actualizar
  controller.actualizar
);
router.delete("/:id", authenticate, controller.eliminar);

export default router;