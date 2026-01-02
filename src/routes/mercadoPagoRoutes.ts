import express from 'express';
import { CrearPreferencia, WebhookMercadoPago } from '../controllers/mercadoPagoController';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware';

const router = express.Router();

// Ruta POST: crea una preferencia de pago en Mercado Pago, devuelve una URL para redirigir al usuario al checkout de Mercado Pago con los datos enviados.
// El frontend debe de enviar en body: "title" (nombre del evento) y "unit_price" (precio en formato numérico).
// router.post('/crear_preferencia', CrearPreferencia);

// // Ruta POST: endpoint para recibir Webhooks de Mercado Pago, con información de pagos.
// // Esta ruta es llamada por Mercado Pago cuando hay actualizaciones en los pagos
// router.post('/webhook', WebhookMercadoPago);


router.post('/mercadopago/crear_preferencia', authenticate ,CrearPreferencia);
router.post('/mercadopago/webhook', optionalAuthenticate, WebhookMercadoPago);


export default router;
