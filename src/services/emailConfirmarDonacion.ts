import { EmailService } from "./emailService";

export async function enviarEmailConfirmarDonacion(nombre: string, email: string) {
  const emailService = new EmailService();

  const titulo = `Gracias por tu apoyo, ${nombre}! Tu donación fue registrada correctamente.`;
  const contenido = `
    <h2>¡Gracias por tu apoyo, ${nombre}!</h2>
    <p>Tu donación fue registrada correctamente.</p>
    <p>El Instituto Misionero te agradece tu compromiso.</p>
  `;

  await emailService.enviarEmail(
    email,
    "Confirmación de Donación",
    titulo,
    contenido
  );
}
