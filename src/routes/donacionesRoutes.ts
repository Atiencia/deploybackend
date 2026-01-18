import express from 'express';
import {
  CrearPreferenciaDonacion,
  ObtenerDonacionesUsuario,
  ObtenerTodasLasDonaciones,
  ObtenerDonacionesPorGrupo,
  ObtenerDonacionesFiltradas,
  ObtenerTotalesPorPeriodo,
  ObtenerEstadisticasGlobales,
  ProcesarPagoDonacion
} from '../controllers/donacionesController';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware';

const router = express.Router();

// Ruta POST: crea una preferencia de pago para donación en Mercado Pago, devuelve una URL para redirigir al usuario al checkout de Mercado Pago con los datos enviados.
// El frontend debe enviar en body: "monto", "descripcion".
// Usa optionalAuthenticate para permitir donaciones con o sin autenticación
router.post('/crear_preferencia_donacion', CrearPreferenciaDonacion);

// Ruta POST: procesar pago de donación después del pago exitoso
// El frontend envía payment_id, status, external_reference después de la redirección de Mercado Pago
router.post('/procesar-pago', ProcesarPagoDonacion);

// Ruta GET: obtener las donaciones del usuario autenticado
router.get('/mis-donaciones', authenticate, ObtenerDonacionesUsuario);

// Ruta GET: obtener todas las donaciones (requiere rol admin y sec general)
router.get('/todas', authenticate, ObtenerTodasLasDonaciones);

// Ruta GET: obtener donaciones por grupo (secretaria grupal)
router.get('/por-grupo', authenticate, ObtenerDonacionesPorGrupo);

// Ruta GET: obtener donaciones filtradas (para admin y secretaria)
router.get('/filtradas', authenticate, ObtenerDonacionesFiltradas);

// Ruta GET: obtener totales por periodo
router.get('/totales-periodo', authenticate, ObtenerTotalesPorPeriodo);

// Ruta GET: obtener estadísticas globales (solo admin)
router.get('/estadisticas-globales', authenticate, ObtenerEstadisticasGlobales);

export default router;
