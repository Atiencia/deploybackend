import { MercadoPagoConfig } from 'mercadopago';
import dotenv from 'dotenv';

dotenv.config();

const client = new MercadoPagoConfig({
  // Se configura el access token en la librería de MercadoPago
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN as string
});

export default client;
