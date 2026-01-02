import nodemailer from 'nodemailer';
import { Evento } from '../tipos/tipos';

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configuración del transporter
    // Para desarrollo, puedes usar servicios como Gmail, Ethereal, o un servidor SMTP
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || 'smtp.gmail.com',
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: false, // true para 465, false para otros puertos
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  /**
   * Envía un email de confirmación de inscripción a un evento
   * @param userEmail - Email del usuario inscrito
   * @param userName - Nombre del usuario
   * @param evento - Datos del evento
   */
  async enviarConfirmacionInscripcion(
    userEmail: string,
    userName: string,
    evento: Evento
  ): Promise<void> {
    try {
      // Formatear las fechas
      const fechaEvento = new Date(evento.fecha).toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const fechaLimiteBaja = evento.fecha_limite_baja 
        ? new Date(evento.fecha_limite_baja).toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'No especificada';

      // Contenido del email en HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .header {
              background-color: #4CAF50;
              color: white;
              padding: 20px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .event-details {
              background-color: #f0f0f0;
              padding: 15px;
              border-left: 4px solid #4CAF50;
              margin: 20px 0;
            }
            .event-details p {
              margin: 8px 0;
            }
            .highlight {
              color: #4CAF50;
              font-weight: bold;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>✅ Inscripción Confirmada</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${userName}</strong>,</p>
              
              <p>¡Tu inscripción ha sido confirmada exitosamente!</p>
              
              <div class="event-details">
                <h2>📅 Detalles del Evento</h2>
                <p><strong>Evento:</strong> ${evento.nombre}</p>
                <p><strong>Fecha y hora:</strong> ${fechaEvento}</p>
                ${evento.lugar ? `<p><strong>Lugar:</strong> ${evento.lugar}</p>` : ''}
                ${evento.descripcion ? `<p><strong>Descripción:</strong> ${evento.descripcion}</p>` : ''}
              </div>

              <div class="warning">
                <p><strong>⚠️ Importante:</strong></p>
                <p>Puedes darte de baja de este evento hasta el <span class="highlight">${fechaLimiteBaja}</span>.</p>
                <p>Después de esta fecha, no será posible cancelar tu inscripción.</p>
              </div>

              <p>Esperamos verte en el evento. Si tienes alguna pregunta, no dudes en contactarnos.</p>
              
              <p>¡Nos vemos pronto!</p>
            </div>
            
            <div class="footer">
              <p>Este es un correo automático, por favor no responder.</p>
              <p>&copy; ${new Date().getFullYear()} Sistema de Gestión de Eventos</p>
            </div>
          </div>
        </body>
        </html>
      `;

      // Contenido del email en texto plano (para clientes que no soportan HTML)
      const textContent = `
Inscripción Confirmada

Hola ${userName},

¡Tu inscripción ha sido confirmada exitosamente!

DETALLES DEL EVENTO:
- Evento: ${evento.nombre}
- Fecha y hora: ${fechaEvento}
${evento.lugar ? `- Lugar: ${evento.lugar}` : ''}
${evento.descripcion ? `- Descripción: ${evento.descripcion}` : ''}

IMPORTANTE:
Puedes darte de baja de este evento hasta el ${fechaLimiteBaja}.
Después de esta fecha, no será posible cancelar tu inscripción.

Esperamos verte en el evento. Si tienes alguna pregunta, no dudes en contactarnos.

¡Nos vemos pronto!

---
Este es un correo automático, por favor no responder.
© ${new Date().getFullYear()} Sistema de Gestión de Eventos
      `;

      // Configurar y enviar el email
      const mailOptions = {
        from: `"Sistema de Eventos" <${process.env.SMTP_USER}>`,
        to: userEmail,
        subject: `✅ Confirmación de Inscripción - ${evento.nombre}`,
        text: textContent,
        html: htmlContent,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email enviado exitosamente:', info.messageId);
    } catch (error) {
      console.error('Error al enviar email:', error);
      // No lanzamos el error para no interrumpir el flujo de inscripción
      // El usuario quedará inscrito aunque el email falle
    }
  }

  /**
   * Envía un email genérico
   * @param to - Email del destinatario
   * @param subject - Asunto del email
   * @param text - Contenido en texto plano
   * @param html - Contenido en HTML
   */
  async enviarEmail(
    to: string,
    subject: string,
    text: string,
    html: string
  ): Promise<void> {
    try {
      const mailOptions = {
        from: `"Sistema de Eventos" <${process.env.SMTP_USER}>`,
        to,
        subject,
        text,
        html,
      };

      const info = await this.transporter.sendMail(mailOptions);
      console.log('Email enviado exitosamente:', info.messageId);
    } catch (error) {
      console.error('Error al enviar email:', error);
      // No lanzamos el error para no interrumpir el flujo
    }
  }

  /**
   * Envía un email de confirmación de inscripción como SUPLENTE
   * @param userEmail - Email del usuario inscrito
   * @param userName - Nombre del usuario
   * @param evento - Datos del evento
   * @param ordenSuplente - Posición en la lista de espera
   */
  async enviarConfirmacionInscripcionSuplente(
    userEmail: string,
    userName: string,
    evento: Evento,
    ordenSuplente: number
  ): Promise<void> {
    try {
      const fechaEvento = new Date(evento.fecha).toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const fechaLimiteBaja = evento.fecha_limite_baja 
        ? new Date(evento.fecha_limite_baja).toLocaleDateString('es-AR', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })
        : 'No especificada';

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background-color: #f9f9f9; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .header { background-color: #f59e0b; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background-color: white; padding: 30px; border-radius: 0 0 10px 10px; }
            .event-details { background-color: #fef3c7; padding: 15px; border-left: 4px solid #f59e0b; margin: 20px 0; }
            .position-badge { background-color: #f59e0b; color: white; padding: 10px 20px; border-radius: 50px; font-size: 24px; font-weight: bold; display: inline-block; margin: 10px 0; }
            .warning { background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>📝 Inscripción en Lista de Espera</h1>
            </div>
            <div class="content">
              <p>Hola <strong>${userName}</strong>,</p>
              
              <p>Te has inscrito exitosamente como <strong style="color: #f59e0b;">SUPLENTE</strong> en el evento.</p>
              
              <div style="text-align: center; margin: 20px 0;">
                <p style="margin: 5px 0;">Tu posición en la lista de espera es:</p>
                <div class="position-badge">#${ordenSuplente}</div>
              </div>
              
              <div class="event-details">
                <h2>📅 Detalles del Evento</h2>
                <p><strong>Evento:</strong> ${evento.nombre}</p>
                <p><strong>Fecha y hora:</strong> ${fechaEvento}</p>
                ${evento.lugar ? `<p><strong>Lugar:</strong> ${evento.lugar}</p>` : ''}
              </div>

              <div class="warning">
                <h3 style="margin-top: 0;">⚠️ Importante sobre tu inscripción como suplente:</h3>
                <ul>
                  <li>Estás en <strong>lista de espera</strong> para este evento.</li>
                  <li>Si alguien se da de baja antes del <strong>${fechaLimiteBaja}</strong>, pasarás automáticamente a ser <strong>titular</strong>.</li>
                  <li>Recibirás un email de confirmación si eres promovido a titular.</li>
                  <li>Los suplentes se convierten en titulares por orden de inscripción.</li>
                </ul>
              </div>

              <p>Te mantendremos informado sobre cualquier cambio en tu estado.</p>
              
              <p>¡Esperamos que puedas asistir!</p>
            </div>
            
            <div class="footer">
              <p>Este es un correo automático, por favor no responder.</p>
              <p>&copy; ${new Date().getFullYear()} Sistema de Gestión de Eventos</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
Hola ${userName},

Te has inscrito como SUPLENTE en el evento "${evento.nombre}".

TU POSICIÓN EN LISTA DE ESPERA: #${ordenSuplente}

📋 Detalles del Evento:
- Evento: ${evento.nombre}
- Fecha: ${fechaEvento}
${evento.lugar ? `- Lugar: ${evento.lugar}` : ''}

⚠️ IMPORTANTE:
Estás en lista de espera. Si alguien se da de baja antes del ${fechaLimiteBaja}, pasarás automáticamente a ser titular y recibirás un email de confirmación.

Te mantendremos informado.

Saludos,
Sistema de Gestión de Eventos
      `;

      await this.enviarEmail(userEmail, `Inscripción como Suplente - ${evento.nombre}`, textContent, htmlContent);
    } catch (error) {
      console.error('Error al enviar email de confirmación suplente:', error);
    }
  }

  /**
   * Envía notificación cuando un suplente es promovido a titular
   * @param userEmail - Email del usuario promovido
   * @param userName - Nombre del usuario
   * @param evento - Datos del evento
   */
  async enviarNotificacionPromocionSuplente(
    userEmail: string,
    userName: string,
    evento: Evento
  ): Promise<void> {
    try {
      const fechaEvento = new Date(evento.fecha).toLocaleDateString('es-AR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
            .container { background-color: #f9f9f9; border-radius: 10px; padding: 30px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            .header { background-color: #10b981; color: white; padding: 20px; border-radius: 10px 10px 0 0; text-align: center; }
            .content { background-color: white; padding: 30px; border-radius: 0 0 10px 10px; }
            .promotion-box { background-color: #d1fae5; padding: 20px; border-radius: 10px; text-align: center; margin: 20px 0; }
            .event-details { background-color: #f3f4f6; padding: 15px; border-left: 4px solid #10b981; margin: 20px 0; }
            .footer { text-align: center; margin-top: 30px; color: #666; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 ¡Buenas Noticias!</h1>
            </div>
            <div class="content">
              <p>¡Hola <strong>${userName}</strong>!</p>
              
              <div class="promotion-box">
                <p style="font-size: 18px; margin: 0;">Has pasado de suplente a</p>
                <h2 style="color: #10b981; font-size: 32px; margin: 10px 0;">✅ TITULAR</h2>
                <p style="margin: 0;">en el evento</p>
              </div>
              
              <p style="text-align: center; font-size: 18px;"><strong>¡Tu plaza está confirmada!</strong></p>
              
              <div class="event-details">
                <h2>📅 Detalles del Evento</h2>
                <p><strong>Evento:</strong> ${evento.nombre}</p>
                <p><strong>Fecha y hora:</strong> ${fechaEvento}</p>
                ${evento.lugar ? `<p><strong>Lugar:</strong> ${evento.lugar}</p>` : ''}
                ${evento.descripcion ? `<p><strong>Descripción:</strong> ${evento.descripcion}</p>` : ''}
              </div>

              <p>Un participante se ha dado de baja y ahora ocupas su lugar como titular.</p>
              
              <p style="color: #10b981; font-weight: bold; font-size: 18px; text-align: center;">¡Te esperamos en el evento!</p>
            </div>
            
            <div class="footer">
              <p>Este es un correo automático, por favor no responder.</p>
              <p>&copy; ${new Date().getFullYear()} Sistema de Gestión de Eventos</p>
            </div>
          </div>
        </body>
        </html>
      `;

      const textContent = `
¡Hola ${userName}!

¡BUENAS NOTICIAS!

Has pasado de suplente a TITULAR en el evento "${evento.nombre}".

📋 Detalles del Evento:
- Evento: ${evento.nombre}
- Fecha: ${fechaEvento}
${evento.lugar ? `- Lugar: ${evento.lugar}` : ''}

✅ Tu plaza está confirmada. ¡Te esperamos en el evento!

Saludos,
Sistema de Gestión de Eventos
      `;

      await this.enviarEmail(userEmail, `¡Buenas noticias! Ahora eres titular - ${evento.nombre}`, textContent, htmlContent);
    } catch (error) {
      console.error('Error al enviar email de promoción:', error);
    }
  }

  /**
   * Envía un email de verificación de cuenta
   * @param userEmail - Email del usuario
   * @param userName - Nombre del usuario
   * @param token - Token de verificación
   */
  async enviarEmailVerificacion(
    userEmail: string,
    userName: string,
    token: string
  ): Promise<void> {
    try {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
      const verificationLink = `${frontendUrl}/verificar-email?token=${token}`;

      // Contenido del email en texto plano
      const textContent = `
Hola ${userName},

¡Bienvenido a nuestro sistema de gestión de eventos!

Para completar tu registro, por favor verifica tu correo electrónico haciendo clic en el siguiente enlace:

${verificationLink}

Este enlace expirará en 24 horas.

Si no creaste una cuenta con nosotros, puedes ignorar este mensaje.

Saludos,
Sistema de Gestión de Eventos
      `;

      // Contenido del email en HTML
      const htmlContent = `
        <!DOCTYPE html>
        <html lang="es">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #f9f9f9;
              border-radius: 10px;
              padding: 30px;
              box-shadow: 0 2px 5px rgba(0,0,0,0.1);
            }
            .header {
              background-color: #2196F3;
              color: white;
              padding: 20px;
              border-radius: 10px 10px 0 0;
              text-align: center;
            }
            .content {
              background-color: white;
              padding: 30px;
              border-radius: 0 0 10px 10px;
            }
            .button {
              display: inline-block;
              padding: 15px 30px;
              background-color: #2196F3;
              color: white;
              text-decoration: none;
              border-radius: 5px;
              margin: 20px 0;
              font-weight: bold;
            }
            .button:hover {
              background-color: #1976D2;
            }
            .warning {
              background-color: #fff3cd;
              border-left: 4px solid #ffc107;
              padding: 15px;
              margin: 20px 0;
            }
            .footer {
              text-align: center;
              margin-top: 30px;
              color: #666;
              font-size: 12px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 ¡Bienvenido!</h1>
            </div>
            <div class="content">
              <h2>Hola ${userName},</h2>
              <p>Gracias por registrarte en nuestro sistema de gestión de eventos.</p>
              <p>Para completar tu registro y poder acceder a todas las funcionalidades, necesitamos verificar tu correo electrónico.</p>
              
              <div style="text-align: center;">
                <a href="${verificationLink}" class="button">
                  Verificar mi correo electrónico
                </a>
              </div>

              <div class="warning">
                <strong>⚠️ Importante:</strong>
                <ul>
                  <li>Este enlace expirará en <strong>24 horas</strong></li>
                  <li>Una vez verificado, podrás iniciar sesión y acceder a todos los eventos</li>
                  <li>Si no creaste esta cuenta, puedes ignorar este mensaje</li>
                </ul>
              </div>

              <p>Si el botón no funciona, copia y pega el siguiente enlace en tu navegador:</p>
              <p style="word-break: break-all; color: #2196F3;">${verificationLink}</p>

              <p>¡Gracias por unirte a nuestra comunidad!</p>
            </div>
            <div class="footer">
              <p>Este es un correo electrónico automático, por favor no respondas.</p>
              <p>© 2025 Sistema de Gestión de Eventos</p>
            </div>
          </div>
        </body>
        </html>
      `;

      await this.enviarEmail(
        userEmail,
        '✉️ Verifica tu correo electrónico',
        textContent,
        htmlContent
      );
    } catch (error) {
      console.error('Error al enviar email de verificación:', error);
      throw new Error('No se pudo enviar el correo de verificación');
    }
  }

  /**
   * Reenvía el email de verificación
   * @param userEmail - Email del usuario
   * @param userName - Nombre del usuario
   * @param token - Nuevo token de verificación
   */
  async reenviarEmailVerificacion(
    userEmail: string,
    userName: string,
    token: string
  ): Promise<void> {
    await this.enviarEmailVerificacion(userEmail, userName, token);
  }

  /**
   * Envía un email para recuperar la contraseña
   * @param userEmail - Email del usuario
   * @param userName - Nombre del usuario
   * @param token - Token de recuperación
   */
  async enviarEmailRecuperacionContrasena(
    userEmail: string,
    userName: string,
    token: string
  ): Promise<void> {
    const urlRecuperacion = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/restablecer-contrasena?token=${token}`;

    const textContent = `
      Hola ${userName},
      
      Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.
      
      Para restablecer tu contraseña, haz clic en el siguiente enlace:
      ${urlRecuperacion}
      
      Este enlace es válido por 1 hora.
      
      Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.
      
      Saludos,
      El equipo de Inscripciones
    `;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="es">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
          body {
            font-family: Arial, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
          }
          .container {
            background-color: #f9f9f9;
            border-radius: 10px;
            padding: 30px;
            box-shadow: 0 2px 5px rgba(0,0,0,0.1);
          }
          .header {
            background-color: #FF9800;
            color: white;
            padding: 20px;
            border-radius: 10px 10px 0 0;
            text-align: center;
          }
          .content {
            background-color: white;
            padding: 30px;
            border-radius: 0 0 10px 10px;
          }
          .button {
            display: inline-block;
            padding: 15px 30px;
            background-color: #FF9800;
            color: white;
            text-decoration: none;
            border-radius: 5px;
            margin: 20px 0;
            font-weight: bold;
          }
          .warning {
            background-color: #fff3cd;
            border-left: 4px solid #ffc107;
            padding: 15px;
            margin: 20px 0;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            color: #666;
            font-size: 12px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Recuperación de Contraseña</h1>
          </div>
          <div class="content">
            <p>Hola <strong>${userName}</strong>,</p>
            
            <p>Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
            
            <p>Para restablecer tu contraseña, haz clic en el siguiente botón:</p>
            
            <div style="text-align: center;">
              <a href="${urlRecuperacion}" class="button">Restablecer Contraseña</a>
            </div>
            
            <p>O copia y pega este enlace en tu navegador:</p>
            <p style="word-break: break-all; color: #666; font-size: 14px;">${urlRecuperacion}</p>
            
            <div class="warning">
              <strong>⏰ Importante:</strong> Este enlace es válido por <strong>1 hora</strong>.
            </div>
            
            <p>Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura. Tu contraseña no será modificada.</p>
            
            <p>Saludos,<br>El equipo de Inscripciones</p>
          </div>
          <div class="footer">
            <p>Este es un correo automático, por favor no respondas a este mensaje.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    try {
      await this.enviarEmail(
        userEmail,
        'Recuperación de Contraseña',
        textContent,
        htmlContent
      );
      console.log(`Email de recuperación de contraseña enviado a: ${userEmail}`);
    } catch (error) {
      console.error('Error al enviar email de recuperación:', error);
      throw new Error('No se pudo enviar el correo de recuperación de contraseña');
    }
  }
}

