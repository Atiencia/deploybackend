import dotenv from "dotenv";
import app from "../api/index";

dotenv.config({ quiet: true });

const PORT = process.env.PORT || 5000;

// Servidor para desarrollo local
const server = app.listen(PORT, () => {
  console.log(`Servidor corriendo en el puerto ${PORT}`);
});

// Socket.io comentado - no se usa por ahora
// try {
//   const { initSocket } = require('../src/socket');
//   initSocket(server);
// } catch (err: any) {
//   console.warn('Socket.io no pudo inicializarse:', err?.message || err);
// }

export default app;
