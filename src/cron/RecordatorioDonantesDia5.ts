import cron from "node-cron";
import { DonantesFijosService } from "../services/donantesFijosService";
import { EmailService } from "../services/emailService";
import { crearPreferenciaDonacion } from "../services/mercadoPagoService";

const donantesService = new DonantesFijosService();
const emailService = new EmailService();

const MONTO_DEFAULT = 1000; // Monto sugerido para donación

// Día 5 de cada mes a las 9:00 AM
cron.schedule("0 9 5 * *", async () => {
  console.log("🗓️ [CRON Día 5] Enviando segundo recordatorio...");

  try {
    const donantes = await donantesService.obtenerTodosDonantes();
    for (const d of donantes) {
      if (!d.email) continue;

      // Crear enlace de pago personalizado para el donante
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
      console.log(`📧 Recordatorio Día 5 enviado a ${d.email} con enlace de pago`);
    }

    console.log("✅ Todos los correos del día 5 fueron enviados.");
  } catch (err) {
    console.error("❌ Error CRON Día 5:", err);
  }
});
