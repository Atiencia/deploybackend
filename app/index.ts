import cors from "cors";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";
import authRoutes from "../src/routes/authRoutes";
import rolesRoutes from "../src/routes/rolesRoutes";
import gruposRoutes from "../src/routes/gruposRoutes";
import eventoGrupoRoutes from "../src/routes/eventoGrupoRoutes";
import mercadoPagoRoutes from "../src/routes/mercadoPagoRoutes";
import donacionesRoutes from "../src/routes/donacionesRoutes";
import donantesFijosRoutes from "../src/routes/donantesFijosRoutes";
import eventosRoutes from "../src/routes/eventosRoutes";
import generalRoutes from "../src/routes/generalRoutes";
import express from "express";
import noticiaRoutes from "../src/routes/noticiaRoutes";
import path from "path";
import subgruposRoutes from "../src/routes/subgruposRoutes";
import secretariaGrupoRoutes from "../src/routes/secretariaGrupoRoutes";
import cronRoutes from "../src/routes/cronRoutes";
// import "../src/cron/RecordatorioDonantesDia1";
// import "../src/cron/RecordatorioDonantesDia5";


dotenv.config({ quiet: true });


const PORT = process.env.PORT || 5000;
const app = express();


app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:3000",
  credentials: true,
}));

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use("/api", generalRoutes)

app.use("/api", mercadoPagoRoutes);

app.use("/api/noticias", noticiaRoutes);
app.use("/auth", authRoutes);
app.use("/api/donaciones", donacionesRoutes);
app.use("/api", donantesFijosRoutes);
app.use("/api", gruposRoutes);
app.use("/api", rolesRoutes);
app.use("/api", eventoGrupoRoutes);
app.use("/api", eventosRoutes);
app.use("/api", secretariaGrupoRoutes);
app.use("/api", subgruposRoutes);
app.use("/api", donantesFijosRoutes);
app.use("/api/cron", cronRoutes);

// Para desarrollo local
if (process.env.NODE_ENV !== 'production') {
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
}

export default app;
