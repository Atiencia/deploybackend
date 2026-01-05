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

dotenv.config({ quiet: true });

const app = express();

// CORS configurado para cookies cross-domain
app.use(cors({
  origin: function (origin, callback) {
    if (!origin) return callback(null, true);
    if (origin.endsWith('.vercel.app')) return callback(null, true);
    if (origin.startsWith('http://localhost')) return callback(null, true);
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));

app.use(express.json());
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

app.use("/api", generalRoutes);
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
app.use("/api/cron", cronRoutes);

export default app;