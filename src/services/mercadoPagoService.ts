import pool from '../db';
import axios from 'axios';
import { Preference } from 'mercadopago';
import client from '../config/mercadoPagoClient';

/** Guarda los datos del pago recibido en Mercado Pago en la base de datosh */
export const guardarPago = async (idInscripcion: number | null, payment: any) => {
  try {
    const query = `
      INSERT INTO evento_pago (
        id_inscripcion,
        metodo_pago,
        monto,
        estado,
        id_pago_mercadopago,
        fecha_pago,
        comprobante_url,
        detalle,
        detalle_estado,
        monto_neto_recibido,
        moneda,
        detalle_comisiones,
        correo_pagador,
        nombre_pagador,
        apellido_pagador
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, $11, $12::jsonb, $13, $14, $15
      ) RETURNING *;
    `;

    const values = [
      idInscripcion || null,
      payment.payment_method_id || null,
      payment.transaction_amount || null,
      payment.status || null,
      payment.id || null,
      payment.date_approved ? new Date(payment.date_approved) : null,
      null, 
      JSON.stringify(payment) || null, 
      payment.status_detail || null,
      payment.transaction_details?.net_received_amount || null,
      payment.currency_id || null,
      JSON.stringify(payment.fee_details || []) || null,
      payment.payer?.email || null,
      payment.payer?.first_name || null,
      payment.payer?.last_name || null,
    ];

    const { rows } = await pool.query(query, values);
    console.log('Pago guardado en BD:', rows[0].id_pago);
    return rows[0];

  } catch (error) {
    console.error('Error guardando el pago en DB:', error);
    throw error;
  }
};


// Consulta a la API de Mercado Pago para obtener los detalles de un pago por su ID
export const obtenerPagoPorId = async (paymentId: string) => {
  const url = `https://api.mercadopago.com/v1/payments/${paymentId}`;
  const headers = {
    Authorization: `Bearer ${process.env.MERCADO_PAGO_ACCESS_TOKEN}`
  };

  const response = await axios.get(url, { headers });
  return response.data;
};

/** Crea una preferencia de pago para donación */
export const crearPreferenciaDonacion = async (monto: number, descripcion: string, email: string, nombre: string) => {
  const preference = new Preference(client);

  try {
    const preferenceData = await preference.create({
      body: {
        items: [
          {
            id: `donacion_${email}_${Date.now()}`,
            title: descripcion,
            quantity: 1,
            unit_price: parseFloat(monto.toString()),
          }
        ],
        metadata: {
          usuario_id: null,
          tipo: 'donacion',
          email: email,
          nombre: nombre,
        },
        back_urls: {
          success: `${process.env.FRONTEND_URL}/eventos`,
          failure: `${process.env.FRONTEND_URL}/eventos`,
          pending: `${process.env.FRONTEND_URL}/eventos`
        },
        statement_descriptor: "Instituto",
        notification_url: `${process.env.BACKEND_URL}/api/mercadopago/webhook`
      }
    });

    return {
      preferenceId: preferenceData.id,
      preferenceUrl: preferenceData.init_point,
    };
  } catch (error) {
    console.error("Error al crear la preferencia de donación:", error);
    throw error;
  }
};
