import { Request, Response } from "express";
import { AuthService } from "../services/authService";


const authService = new AuthService();

// Registro de usuario
export const register = async (req: Request, res: Response) => {
  try {
      const { nombre, apellido, email, dni, contrasena, numeroAlumno, nacionalidad, tipo_documento } = req.body;

    if (!nombre || !apellido || !email || !dni || !contrasena || !nacionalidad || !tipo_documento) {
      return res.status(400).json({ message: "Todos estos los campos son obligatorios" });
    }

    const newUser = await authService.register({
      nombre,
      apellido,
      email,
      dni,
      contrasena,
      numeroAlumno,
      nacionalidad,
      tipo_documento,
      id_rol: 3,
    });

    res.status(201).json({ 
      message: "Usuario registrado con éxito. Por favor, verifica tu correo electrónico para activar tu cuenta.", 
      user: {
        id_usuario: newUser.id_usuario,
        nombre: newUser.nombre,
        apellido: newUser.apellido,
        email: newUser.email,
        email_verificado: newUser.email_verificado
      }
    });
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// el login del usuario
export const login = async (req: Request, res: Response) => {
  try {
    const { email, contrasena } = req.body;

    if (!email || !contrasena) {
      return res.status(400).json({
        message: "email y contraseña son requeridos",
        detalle: { email, contrasena },
      });
    }

    try {
      const { token, nombre, rol } = await authService.login(email, contrasena); // 👈 incluimos rol

      res.cookie("token", token, {
        httpOnly: true,
        signed: true,
        secure: true, // Siempre HTTPS en producción
        sameSite: "none", // Permite cookies cross-domain
        maxAge: 1000 * 60 * 60 * 24
      });

      res.json({
        message: "Autenticación exitosa",
        token,
        nombre,
        rol, // 👈 lo enviamos al frontend
      });
    } catch (authError: any) {
      // Mensajes específicos según el error
      if (authError.message === "Usuario no encontrado") {
        return res.status(400).json({ message: "Usuario no encontrado. Verifica el email ingresado.", detalle: { email } });
      }
      if (authError.message === "Contraseña incorrecta") {
        return res.status(400).json({
          message: "Contraseña incorrecta. Intenta nuevamente.",
          detalle: { email },
        });
      }
      if (authError.message.includes("verificar tu correo")) {
        return res.status(403).json({
          message: authError.message,
          emailNoVerificado: true,
          detalle: { email },
        });
      }
      return res.status(400).json({
        message: "Error de autenticación",
        error: authError.message,
      });
    }
  } catch (error: any) {
    res.status(400).json({
      message: "Error inesperado en login",
      error: error.message,
    });
  }
};

// para cerrar sesion 
export const logout = async (req: Request, res: Response) => {
  res.clearCookie("token");
  res.json({ message: "Sesión cerrada correctamente" });
};

export const getUsuarios = async(req: Request, res: Response)=> 
{
  const usuarios = await authService.getUsuarios();
  res.json({usuarios})
}

// Verificar email
export const verificarEmail = async (req: Request, res: Response) => {
  try {
    const { token } = req.query;

    if (!token || typeof token !== 'string') {
      return res.status(400).json({ message: "Token de verificación es requerido" });
    }

    const result = await authService.verificarEmail(token);
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('expirado')) {
      return res.status(410).json({ 
        message: error.message,
        tokenExpirado: true 
      });
    }
    res.status(400).json({ message: error.message });
  }
};

// Reenviar email de verificación
export const reenviarVerificacion = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "El email es requerido" });
    }

    const result = await authService.reenviarEmailVerificacion(email);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ message: error.message });
  }
};

// Solicitar recuperación de contraseña
export const solicitarRecuperacionContrasena = async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ message: "El email es requerido" });
    }

    const result = await authService.solicitarRecuperacionContrasena(email);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ message: error.message });
  }
};

// Restablecer contraseña
export const restablecerContrasena = async (req: Request, res: Response) => {
  try {
    const { token, nuevaContrasena } = req.body;

    if (!token || !nuevaContrasena) {
      return res.status(400).json({ message: "Token y nueva contraseña son requeridos" });
    }

    if (nuevaContrasena.length < 6) {
      return res.status(400).json({ message: "La contraseña debe tener al menos 6 caracteres" });
    }

    const result = await authService.restablecerContrasena(token, nuevaContrasena);
    res.json(result);
  } catch (error: any) {
    if (error.message.includes('expirado')) {
      return res.status(410).json({ 
        message: error.message,
        tokenExpirado: true 
      });
    }
    res.status(400).json({ message: error.message });
  }
};
