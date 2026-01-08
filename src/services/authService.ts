import { User } from "../tipos/tipos";
import pool from "../db";
import { SECRET_KEY } from "../utils/jwtUtils";
import { hash, verify } from "argon2";
import jwt from "jsonwebtoken";
import crypto from "crypto";
import { EmailService } from "./emailService";

// Simulación de base de datos en memoria
const users: User[] = [];

export class AuthService {
  private emailService: EmailService;

  constructor() {
    this.emailService = new EmailService();
  }

  /**
   * Genera un token aleatorio para verificación de email
   */
  private generarTokenVerificacion(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  async register(userData: Omit<User, "contrasena"> & { contrasena: string }): Promise<User> {
    const { nombre, apellido, email, dni, contrasena, numeroAlumno, id_rol, nacionalidad, tipo_documento } = userData;

    // Verificar si ya existe el usuario en la BD
    const existingUser = await pool.query("SELECT * FROM usuario WHERE email = $1", [email]);
    if (existingUser.rows.length > 0) {
      throw new Error("El usuario ya existe");
    }

    // Hashear contraseña
    const hashedPassword = await hash(contrasena);

    // Generar token de verificación
    const tokenVerificacion = this.generarTokenVerificacion();
    const tokenExpira = new Date();
    tokenExpira.setHours(tokenExpira.getHours() + 24); // Token válido por 24 horas

    // Insertar usuario en la BD con email_verificado en false
    const result = await pool.query(
      `INSERT INTO usuario (nombre, apellido, email, dni_usuario, contrasena, numero_alumno, id_rol, nacionalidad, tipo_documento, email_verificado, token_verificacion, token_verificacion_expira) 
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [nombre, apellido, email, dni, hashedPassword, numeroAlumno, id_rol, nacionalidad, tipo_documento, false, tokenVerificacion, tokenExpira]
    );

    // Enviar email de verificación
    try {
      await this.emailService.enviarEmailVerificacion(
        email,
        `${nombre} ${apellido}`,
        tokenVerificacion
      );
    } catch (emailError) {
      console.error('Error al enviar email de verificación:', emailError);
      // No fallar el registro si el email falla, pero registrar el error
    }

    // Adaptar el resultado a la interfaz User
    return {
      id_usuario: result.rows[0].id_usuario,
      nombre: result.rows[0].nombre,
      apellido: result.rows[0].apellido,
      email: result.rows[0].email,
      dni: result.rows[0].dni_usuario,
      id_rol: result.rows[0].id_rol,
      contrasena: result.rows[0].contrasena,
      numeroAlumno: result.rows[0].numero_alumno,
      nacionalidad: result.rows[0].nacionalidad,
      tipo_documento: result.rows[0].tipo_documento,
      email_verificado: result.rows[0].email_verificado
    };
  }

  async login(correo: string, contrasena: string): Promise<{ token: string; nombre: string; rol: number }> {
    // Buscar usuario en la BD con el nombre del rol
    const userResult = await pool.query(
      `SELECT u.*, r.nombre as rol_nombre 
       FROM usuario u 
       INNER JOIN rol r ON u.id_rol = r.id_rol 
       WHERE u.email = $1`, 
      [correo]
    );
    if (userResult.rows.length === 0) {
      throw new Error("Usuario no encontrado");
    }
    const user: User = userResult.rows[0];

    // Verificar si el email está verificado
    if (!user.email_verificado) {
      throw new Error("Debes verificar tu correo electrónico antes de iniciar sesión. Revisa tu bandeja de entrada.");
    }

    const isPasswordValid = await verify(user.contrasena, contrasena);
    if (!isPasswordValid) {
      throw new Error("Contraseña incorrecta");
    }

    // Crear payload y generar token (incluir rol_nombre)
    const nombreCompleto = `${user.nombre} ${user.apellido}`;
    const payload = { 
      correo: user.email, 
      dni: user.dni, 
      nombre: user.nombre, 
      id_rol: user.id_rol, 
      id_usuario: user.id_usuario,
      rol_nombre: userResult.rows[0].rol_nombre  // Agregar nombre del rol
    };
    const token = jwt.sign(payload, SECRET_KEY, { expiresIn: "3h" }); // Usa la variable de entorno (1h)
    return { token, nombre: nombreCompleto, rol: user.id_rol };
  }

  async getUsuarios(): Promise<User[]> {
    // Obtener usuarios con información del grupo asignado (si es secretaria grupal)
    const usuarios = await pool.query(`
      SELECT 
        u.id_usuario,
        u.nombre,
        u.apellido,
        u.email as correo,
        u.dni_usuario as dni,
        u.id_rol,
        r.nombre as rol_nombre,
        g.id_grupo,
        g.nombre as nombre_grupo
      FROM usuario u
      LEFT JOIN rol r ON u.id_rol = r.id_rol
      LEFT JOIN usuariogrupo ug ON u.id_usuario = ug.id_usuario AND ug.rol_en_grupo = 'secretaria' AND u.id_rol = 5
      LEFT JOIN grupo g ON ug.id_grupo = g.id_grupo
    `)
    if (usuarios.rows.length === 0) {
      throw new Error("Usuario no encontrado");
    }
    return usuarios.rows
  }

  async getUsuarioById(email: string): Promise<User | null> {
    const usuario = await pool.query('SELECT * FROM usuario WHERE email = $1', [email])
    if (usuario.rows.length === 0) {
      throw new Error("Usuario no encontrado");
    }
    return usuario.rows[0]
  }

  // Obtener usuario por ID, getUsuarioById está basado en email, no lo he eliminado porque no sé si tiene algun uso.
  async obtenerUsuarioPorId(id: number): Promise<User | null> {
    const resultado = await pool.query('SELECT * FROM usuario WHERE id_usuario = $1', [id]);
    if (resultado.rows.length === 0) {
      throw new Error("Usuario no encontrado");
    }
    return resultado.rows[0];
  }

  /**
   * Verifica el email del usuario usando el token
   */
  async verificarEmail(token: string): Promise<{ message: string }> {
    // Buscar usuario por token
    const result = await pool.query(
      'SELECT * FROM usuario WHERE token_verificacion = $1',
      [token]
    );

    if (result.rows.length === 0) {
      throw new Error('Token de verificación inválido');
    }

    const user = result.rows[0];

    // Verificar si el email ya está verificado
    if (user.email_verificado) {
      return { message: 'El correo electrónico ya ha sido verificado previamente' };
    }

    // Verificar si el token ha expirado
    const now = new Date();
    const tokenExpira = new Date(user.token_verificacion_expira);
    
    if (now > tokenExpira) {
      throw new Error('El token de verificación ha expirado. Por favor, solicita un nuevo correo de verificación.');
    }

    // Actualizar el usuario: marcar email como verificado y limpiar el token
    await pool.query(
      `UPDATE usuario 
       SET email_verificado = true, 
           token_verificacion = NULL, 
           token_verificacion_expira = NULL 
       WHERE id_usuario = $1`,
      [user.id_usuario]
    );

    return { message: 'Correo electrónico verificado exitosamente. Ya puedes iniciar sesión.' };
  }

  /**
   * Reenvía el email de verificación
   */
  async reenviarEmailVerificacion(email: string): Promise<{ message: string }> {
    // Buscar usuario por email
    const result = await pool.query(
      'SELECT * FROM usuario WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      throw new Error('Usuario no encontrado');
    }

    const user = result.rows[0];

    // Verificar si el email ya está verificado
    if (user.email_verificado) {
      throw new Error('El correo electrónico ya ha sido verificado');
    }

    // Generar nuevo token
    const nuevoToken = this.generarTokenVerificacion();
    const tokenExpira = new Date();
    tokenExpira.setHours(tokenExpira.getHours() + 24);

    // Actualizar token en la base de datos
    await pool.query(
      `UPDATE usuario 
       SET token_verificacion = $1, 
           token_verificacion_expira = $2 
       WHERE id_usuario = $3`,
      [nuevoToken, tokenExpira, user.id_usuario]
    );

    // Enviar nuevo email de verificación
    try {
      await this.emailService.reenviarEmailVerificacion(
        user.email,
        `${user.nombre} ${user.apellido}`,
        nuevoToken
      );
    } catch (emailError) {
      console.error('Error al reenviar email de verificación:', emailError);
      throw new Error('No se pudo enviar el correo de verificación');
    }

    return { message: 'Se ha enviado un nuevo correo de verificación. Por favor, revisa tu bandeja de entrada.' };
  }

  /**
   * Solicita recuperación de contraseña enviando un email con token
   */
  async solicitarRecuperacionContrasena(email: string): Promise<{ message: string }> {
    // Buscar usuario por email
    const result = await pool.query(
      'SELECT * FROM usuario WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      // Por seguridad, no revelamos si el email existe o no
      return { message: 'Si el correo existe en nuestro sistema, recibirás un email con instrucciones para recuperar tu contraseña.' };
    }

    const user = result.rows[0];

    // Generar token de recuperación
    const tokenRecuperacion = this.generarTokenVerificacion();
    const tokenExpira = new Date();
    tokenExpira.setHours(tokenExpira.getHours() + 1); // Token válido por 1 hora

    // Guardar token en la base de datos
    await pool.query(
      `UPDATE usuario 
       SET token_recuperacion = $1, 
           token_recuperacion_expira = $2 
       WHERE id_usuario = $3`,
      [tokenRecuperacion, tokenExpira, user.id_usuario]
    );

    // Enviar email de recuperación
    try {
      await this.emailService.enviarEmailRecuperacionContrasena(
        user.email,
        `${user.nombre} ${user.apellido}`,
        tokenRecuperacion
      );
    } catch (emailError) {
      console.error('Error al enviar email de recuperación:', emailError);
      throw new Error('No se pudo enviar el correo de recuperación');
    }

    return { message: 'Si el correo existe en nuestro sistema, recibirás un email con instrucciones para recuperar tu contraseña.' };
  }

  /**
   * Restablece la contraseña usando el token de recuperación
   */
  async restablecerContrasena(token: string, nuevaContrasena: string): Promise<{ message: string }> {
    // Buscar usuario por token de recuperación
    const result = await pool.query(
      'SELECT * FROM usuario WHERE token_recuperacion = $1',
      [token]
    );

    if (result.rows.length === 0) {
      throw new Error('Token de recuperación inválido');
    }

    const user = result.rows[0];

    // Verificar si el token ha expirado
    const now = new Date();
    const tokenExpira = new Date(user.token_recuperacion_expira);
    
    if (now > tokenExpira) {
      throw new Error('El token de recuperación ha expirado. Por favor, solicita una nueva recuperación de contraseña.');
    }

    // Hashear la nueva contraseña
    const hashedPassword = await hash(nuevaContrasena);

    // Actualizar contraseña y limpiar el token
    await pool.query(
      `UPDATE usuario 
       SET contrasena = $1, 
           token_recuperacion = NULL, 
           token_recuperacion_expira = NULL 
       WHERE id_usuario = $2`,
      [hashedPassword, user.id_usuario]
    );

    return { message: 'Contraseña restablecida exitosamente. Ya puedes iniciar sesión con tu nueva contraseña.' };
  }
}
