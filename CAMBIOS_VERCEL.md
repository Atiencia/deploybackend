# Cambios para Deploy en Vercel

## 📋 Resumen
Este documento detalla todos los cambios realizados para adaptar el backend a Vercel (plataforma serverless).

---

## 🔧 Cambios Realizados

### 1. **Configuración de Vercel** (`vercel.json`)
Archivo creado para configurar el deployment:

```json
{
  "version": 2,
  "builds": [
    {
      "src": "app/index.ts",
      "use": "@vercel/node"
    }
  ],
  "routes": [
    {
      "src": "/(.*)",
      "dest": "app/index.ts"
    }
  ],
  "crons": [
    {
      "path": "/api/cron/recordatorio-dia-1",
      "schedule": "0 9 1 * *"
    },
    {
      "path": "/api/cron/recordatorio-dia-5",
      "schedule": "0 9 5 * *"
    }
  ]
}
```

**Qué hace:**
- Define el punto de entrada de la aplicación
- Configura las rutas
- **Configura cron jobs automáticos** (requiere plan Pro de Vercel)

---

### 2. **Cron Jobs → Endpoints HTTP** (`src/routes/cronRoutes.ts`)
Archivo creado para reemplazar los cron jobs con endpoints HTTP.

**Antes:** Se usaba `node-cron` que no funciona en serverless
```typescript
cron.schedule("0 9 1 * *", async () => { /* enviar emails */ });
```

**Ahora:** Endpoints HTTP que Vercel llama automáticamente
```typescript
router.get("/recordatorio-dia-1", async (req, res) => { /* enviar emails */ });
```

**Endpoints creados:**
- `GET /api/cron/recordatorio-dia-1` - Envía recordatorios el día 1 de cada mes
- `GET /api/cron/recordatorio-dia-5` - Envía recordatorios el día 5 de cada mes

---

### 3. **Servidor adaptado para Serverless** (`app/index.ts`)

#### Cambios realizados:

1. **CORS dinámico**
```typescript
// Antes
origin: "http://localhost:3000"

// Ahora
origin: process.env.FRONTEND_URL || "http://localhost:3000"
```

2. **Servidor solo en desarrollo**
```typescript
// Solo inicia el servidor en desarrollo local, no en Vercel
if (process.env.NODE_ENV !== 'production') {
  const server = app.listen(PORT, () => {
    console.log(`Servidor corriendo en el puerto ${PORT}`);
  });
}
```

3. **Socket.io comentado** (no funciona en serverless)
```typescript
// Socket.io comentado - no se usa por ahora
// try {
//   const { initSocket } = require('../src/socket');
//   initSocket(server);
// } catch (err: any) {
//   console.warn('Socket.io no pudo inicializarse:', err?.message || err);
// }
```

4. **Imports de cron comentados**
```typescript
// import "../src/cron/RecordatorioDonantesDia1";
// import "../src/cron/RecordatorioDonantesDia5";
```

5. **Ruta de cron añadida**
```typescript
app.use("/api/cron", cronRoutes);
```

---

### 4. **Socket.io deshabilitado**
Comentado en todos los archivos porque Vercel no soporta WebSockets persistentes.

**Archivos modificados:**
- `src/services/subgruposService.ts` - Import y emits comentados
- `src/services/eventosService.ts` - Import y emits comentados

```typescript
// import { getIO } from '../socket'; // Socket.io no usado por ahora

// try {
//   getIO().emit('suplentes_actualizados', { eventoId });
// } catch (emitErr) {
//   console.error('[SOCKET EMIT] error', emitErr);
// }
```

---

### 5. **Base de datos optimizada** (`src/db.ts`)
Pool de conexiones optimizado para funciones serverless:

```typescript
const pool: Pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 1, // Optimizado para Vercel serverless
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});
```

**Por qué:**
- Vercel crea una nueva instancia por cada request
- `max: 1` evita crear múltiples conexiones innecesarias
- Timeouts configurados para liberar recursos rápidamente

---

## 🚀 Deploy en Vercel

### Pasos:

1. **Commitear y pushear los cambios**
```bash
git add .
git commit -m "Configure for Vercel deployment"
git push
```

2. **Conectar repositorio en Vercel**
   - Ir a [vercel.com](https://vercel.com)
   - New Project → Import desde GitHub
   - Seleccionar el repositorio `deploybackend`

3. **Configurar variables de entorno en Vercel**
   ```
   DATABASE_URL=tu_connection_string
   FRONTEND_URL=https://tu-frontend.vercel.app
   COOKIE_SECRET=tu_secret
   PORT=5000
   NODE_ENV=production
   
   # Todas las demás variables que uses
   SUPABASE_URL=...
   SUPABASE_KEY=...
   MERCADOPAGO_ACCESS_TOKEN=...
   EMAIL_USER=...
   EMAIL_PASS=...
   ```

4. **Deploy**
   - Click en "Deploy"
   - Vercel compilará y desplegará automáticamente

---

## ⚠️ Limitaciones y Consideraciones

### 1. **Cron Jobs requieren plan Pro**
Los cron jobs en `vercel.json` solo funcionan con **Vercel Pro** (de pago).

**Alternativas gratuitas:**
- **GitHub Actions** - Crear workflow que haga requests a tus endpoints
- **cron-job.org** - Servicio gratuito de cron jobs
- **EasyCron** - Alternativa gratuita

### 2. **Socket.io no funciona**
Vercel no soporta WebSockets persistentes.

**Alternativas:**
- **Pusher** - Servicio de WebSockets managed
- **Ably** - Real-time messaging
- **Polling** - Requests periódicos del frontend

### 3. **Funciones Serverless tienen límites**
- Tiempo máximo de ejecución: **10 segundos** (Hobby) / **60 segundos** (Pro)
- Tamaño máximo de response: **4.5 MB**
- Si tus cron jobs tardan mucho en enviar emails, podrías tener timeouts

### 4. **Conexiones a DB**
Si usas PostgreSQL en servicios como Supabase, Neon o Railway:
- Usa **connection pooling** (PgBouncer o Supabase Pooler)
- Evita demasiadas conexiones simultáneas

---

## 🧪 Probar localmente

Para probar que todo funciona:

```bash
# Instalar dependencias
npm install

# Modo desarrollo (con servidor persistente)
npm run dev

# Build para producción
npm run build

# Ejecutar build
npm start
```

**Probar endpoints de cron manualmente:**
```bash
# Recordatorio día 1
curl http://localhost:5000/api/cron/recordatorio-dia-1

# Recordatorio día 5
curl http://localhost:5000/api/cron/recordatorio-dia-5
```

---

## 📝 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `vercel.json` | **Creado** - Configuración de deployment y cron jobs |
| `src/routes/cronRoutes.ts` | **Creado** - Endpoints HTTP para cron jobs |
| `app/index.ts` | Adaptado para serverless, CORS dinámico, socket.io comentado |
| `src/db.ts` | Optimizado pool de conexiones para serverless |
| `src/services/subgruposService.ts` | Socket.io comentado |
| `src/services/eventosService.ts` | Socket.io comentado |

---

## 🔄 Volver a desarrollo local

Si querés volver a usar el servidor tradicional con socket.io:

1. Descomentar en `app/index.ts`:
```typescript
// Descomentar estas líneas:
import "../src/cron/RecordatorioDonantesDia1";
import "../src/cron/RecordatorioDonantesDia5";

// Y en el bloque del servidor:
try {
  const { initSocket } = require('../src/socket');
  initSocket(server);
} catch (err: any) {
  console.warn('Socket.io no pudo inicializarse:', err?.message || err);
}
```

2. Descomentar socket.io en servicios
3. Remover `if (process.env.NODE_ENV !== 'production')` del servidor

---

## 📞 Soporte

Si tenés problemas con el deployment:
- Revisar logs en Vercel Dashboard
- Verificar que todas las variables de entorno estén configuradas
- Probar los endpoints manualmente después del deploy
