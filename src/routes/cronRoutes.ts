import { Router, Request, Response } from "express";
import { DonantesFijosService } from "../services/donantesFijosService";
import { EmailService } from "../services/emailService";
import { crearPreferenciaDonacion } from "../services/mercadoPagoService";

const router = Router();
const donantesService = new DonantesFijosService();
const emailService = new EmailService();
const MONTO_DEFAULT = 1000;

// Cron para el día 1 de cada mes
router.get("/recordatorio-dia-1", async (req: Request, res: Response) => {
  console.log("🗓️ [CRON Día 1] Enviando recordatorio inicial de donación...");

  try {
    const donantes = await donantesService.obtenerTodosDonantes();
    let enviados = 0;

    for (const d of donantes) {
      if (!d.email) continue;

      const preference = await crearPreferenciaDonacion(
        MONTO_DEFAULT,
        `Donación mensual - ${d.nombre} ${d.apellido}`,
        d.email,
        `${d.nombre} ${d.apellido}`
      );

      const subject = "💚 Recordatorio de tu donación mensual";
      const html = `
        <p>¡Hola ${d.nombre}!</p>
        <p>Te recordamos que ya podés realizar tu donación mensual.</p>
        <p>Podés hacerlo directamente desde el siguiente enlace de pago:</p>
        <p><a href="${preference.preferenceUrl}" target="_blank">Realizar Donación</a></p>
        <p>Monto sugerido: $${MONTO_DEFAULT}</p>
        <p>¡Gracias por tu compromiso!</p>
      `;

      await emailService.enviarEmail(d.email, subject, "", html);
      console.log(`📧 Recordatorio Día 1 enviado a ${d.email}`);
      enviados++;
    }

    res.status(200).json({
      success: true,
      message: `✅ ${enviados} correos enviados correctamente`,
    });
  } catch (err: any) {
    console.error("❌ Error CRON Día 1:", err);
    res.status(500).json({
      success: false,
      message: "Error al enviar recordatorios",
      error: err.message,
    });
  }
});

// Cron para el día 5 de cada mes
router.get("/recordatorio-dia-5", async (req: Request, res: Response) => {
  console.log("🗓️ [CRON Día 5] Enviando segundo recordatorio...");

  try {
    const donantes = await donantesService.obtenerTodosDonantes();
    let enviados = 0;

    for (const d of donantes) {
      if (!d.email) continue;

      const preference = await crearPreferenciaDonacion(
        MONTO_DEFAULT,
        `Donación mensual - ${d.nombre} ${d.apellido}`,
        d.email,
        `${d.nombre} ${d.apellido}`
      );

      const subject = "💚 Segundo recordatorio de donación mensual";
      const html = `
        <p>¡Hola ${d.nombre}!</p>
        <p>Te recordamos que ya podés realizar tu donación mensual.</p>
        <p>Podés hacerlo directamente desde el siguiente enlace de pago:</p>
        <p><a href="${preference.preferenceUrl}" target="_blank">Realizar Donación</a></p>
        <p>Monto sugerido: $${MONTO_DEFAULT}</p>
        <p>Si ya realizaste tu donación, por favor ignorá este mensaje.</p>
        <p>¡Gracias por tu compromiso!</p>
      `;

      await emailService.enviarEmail(d.email, subject, "", html);
      console.log(`📧 Recordatorio Día 5 enviado a ${d.email}`);
      enviados++;
    }

    res.status(200).json({
      success: true,
      message: `✅ ${enviados} correos enviados correctamente`,
    });
  } catch (err: any) {
    console.error("❌ Error CRON Día 5:", err);
    res.status(500).json({
      success: false,
      message: "Error al enviar recordatorios",
      error: err.message,
    });
  }
});

export default router;
