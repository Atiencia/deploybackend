import express from 'express';
import {
  CrearPreferenciaDonacion,
  ObtenerDonacionesUsuario,
  ObtenerTodasLasDonaciones,
  ObtenerDonacionesFiltradas,
  ObtenerTotalesPorPeriodo,
  ObtenerEstadisticasGlobales
} from '../controllers/donacionesController';
import { authenticate, optionalAuthenticate } from '../middleware/authMiddleware';

const router = express.Router();

// Ruta POST: crea una preferencia de pago para donación en Mercado Pago, devuelve una URL para redirigir al usuario al checkout de Mercado Pago con los datos enviados.
// El frontend debe enviar en body: "monto", "descripcion".
// Usa optionalAuthenticate para permitir donaciones con o sin autenticación
router.post('/crear_preferencia_donacion', CrearPreferenciaDonacion);

// Ruta GET: obtener las donaciones del usuario autenticado
router.get('/mis-donaciones', authenticate, ObtenerDonacionesUsuario);

// Ruta GET: obtener todas las donaciones (requiere rol admin)
router.get('/todas', authenticate, ObtenerTodasLasDonaciones);

// Ruta GET: obtener donaciones filtradas (para admin y secretaria)
router.get('/filtradas', authenticate, ObtenerDonacionesFiltradas);

// Ruta GET: obtener totales por periodo
router.get('/totales-periodo', authenticate, ObtenerTotalesPorPeriodo);

// Ruta GET: obtener estadísticas globales (solo admin)
router.get('/estadisticas-globales', authenticate, ObtenerEstadisticasGlobales);

export default router;
