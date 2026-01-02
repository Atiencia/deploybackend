import { Router, Request, Response } from "express";
import { register, login, logout, getUsuarios, verificarEmail, reenviarVerificacion, solicitarRecuperacionContrasena, restablecerContrasena } from "../controllers/authController";
import { authenticate, authorizeRoles } from "../middleware/authMiddleware";

const router = Router();

// Rutas de autenticación
router.post("/register", register);

router.post("/login", login);

router.post("/logout", authenticate, logout);

router.get("/usuarios",authenticate, authorizeRoles(['admin', 'secretaria general']), getUsuarios);

// Rutas de verificación de email
router.get("/verificar-email", verificarEmail);

router.post("/reenviar-verificacion", reenviarVerificacion);

// Rutas de recuperación de contraseña
router.post("/solicitar-recuperacion", solicitarRecuperacionContrasena);

router.post("/restablecer-contrasena", restablecerContrasena);


export default router;