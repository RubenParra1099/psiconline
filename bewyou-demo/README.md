# Bewyou · PsicOnline Analytics (demo)

Demo de la plataforma Bewyou para detectar indicios de soledad en adolescentes y adultos jóvenes con el **ISE (Índice de Saturación Emocional)**. Incluye cuatro módulos que comparten la misma base de datos Postgres:

| Ruta | Módulo | Acceso |
|---|---|---|
| `/app` | App del usuario: cribado, resultado, expediente, Noa, agenda | Público (sin clave) |
| `/panel` | Panel clínico | Con clave |
| `/tablero` | Tablero maestro | Con clave |
| `/banco` | Banco de preguntas · panel de jueces | Con clave |
| `/` | Demo completa con las cuatro pestañas | Con clave |

> **Solo para demostración.** No captures datos reales de pacientes. Ver la sección de seguridad al final.

## Estructura

```
public/index.html     La plataforma (una sola página)
public/bw-runtime.js  Conecta la página con la API (datos e IA)
api/docs.js           API de datos → Postgres (tabla "docs", JSONB)
api/ai.js             API de IA opcional (Anthropic)
db/schema.sql         Tabla de referencia (la API la crea sola)
vercel.json           Rutas /app /panel /tablero /banco
.env.example          Variables de entorno
```

## Publicar paso a paso

### 1. Subir a GitHub
1. Entra a https://github.com/new
2. Nombre: `bewyou-demo` · marca **Private** · **Create repository**.
3. En la página del repositorio vacío elige **uploading an existing file** y arrastra **todo el contenido** de esta carpeta (las carpetas `api`, `public`, `db` y los archivos `package.json`, `vercel.json`, `README.md`, `.gitignore`, `.env.example`).
4. Escribe un mensaje (por ejemplo "Primera versión") y presiona **Commit changes**.

Con terminal, desde esta carpeta:
```bash
git init
git add .
git commit -m "Primera versión de Bewyou"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/bewyou-demo.git
git push -u origin main
```

### 2. Crear el proyecto en Vercel
1. Entra a https://vercel.com/new (inicia sesión con tu cuenta de GitHub).
2. En **Import Git Repository** elige `bewyou-demo` → **Import**.
3. **Framework Preset: Other**. No cambies nada más → **Deploy**.
4. Al terminar ya abre la página, pero todavía no guarda datos: falta la base.

### 3. Conectar Postgres (Neon)
1. En tu proyecto de Vercel ve a **Storage** → **Create Database** → **Neon (Serverless Postgres)** → **Continue**.
2. Elige la región más cercana a tus usuarios y el plan gratuito → **Create**.
3. **Connect** a tu proyecto `bewyou-demo` (deja marcados Production, Preview y Development).
4. Vercel agrega solo la variable `DATABASE_URL`. La tabla se crea sola la primera vez que la plataforma guarda algo.

### 4. Variables de entorno
En **Settings → Environment Variables** agrega:

| Nombre | Valor | ¿Obligatoria? |
|---|---|---|
| `ACCESS_KEY` | Una clave larga para el equipo clínico (ej. `Bewyou-Torreon-2026!`) | Sí. Sin ella nadie puede entrar al panel, tablero ni banco |
| `ANTHROPIC_API_KEY` | Tu clave de https://console.anthropic.com | No. Sin ella Noa y los análisis usan respuestas de ejemplo |
| `ANTHROPIC_MODEL` | El modelo que quieras usar (por defecto `claude-sonnet-4-5`) | No |

### 5. Volver a publicar
Las variables solo aplican a publicaciones nuevas: **Deployments** → los tres puntos del último → **Redeploy**.

### 6. Probar
- `https://TU-PROYECTO.vercel.app/app` → haz el test (o usa "Atajo del demo") y abre un expediente.
- `https://TU-PROYECTO.vercel.app/panel` → escribe la `ACCESS_KEY`; debe aparecer el expediente que acabas de capturar.
- `/tablero` y `/banco` piden la misma clave (se recuerda en ese navegador).

### 7. Ver los datos en Postgres
**Storage → tu base Neon → Open in Neon Console → SQL Editor**:
```sql
select id, data->>'nombre' as nombre, data->>'comunidad' as comunidad, updated_at
from docs where col = 'expedientes' order by updated_at desc;
```

### 8. Cambios futuros
Cada cambio que subas a GitHub (rama `main`) se publica solo en Vercel en un par de minutos.

## Desarrollo local (opcional)
```bash
npm install
npm i -g vercel
vercel link        # conecta la carpeta con tu proyecto de Vercel
vercel env pull .env.local
vercel dev         # abre http://localhost:3000/app
```

## Cómo funciona por dentro
- La página se escribió primero como artefacto de Claude. `bw-runtime.js` reemplaza ese entorno: los datos van a `/api/docs` (Postgres) y la IA a `/api/ai`.
- Los datos viven en una tabla `docs (col, id, data jsonb)` con cuatro colecciones: `expedientes`, `notas`, `jueces` y `config` (preguntas activas y decisiones del comité).
- La app pública puede **leer** `config` y **escribir** `expedientes`. Todo lo demás pide la clave.
- La página revisa cambios cada 6 segundos, así que un cribado nuevo aparece solo en el panel y el tablero.
- Las comunidades, pacientes y jueces de ejemplo están dentro del código (simulados). Los registros reales se suman a ellos.

## Seguridad: antes de usarlo con personas reales
Este repositorio es un demo. Para datos de salud mental reales hace falta, como mínimo:
- Cuentas individuales con roles (psicólogo, coordinador, comité) en lugar de una clave compartida.
- Que la app pública no pueda sobrescribir expedientes ajenos (hoy basta con conocer el folio).
- Aviso de privacidad y consentimiento expreso para datos sensibles (en México, Ley Federal de Protección de Datos Personales en Posesión de los Particulares); consentimiento del tutor en menores; HIPAA si se opera en EE. UU.
- Bitácora de accesos, cifrado y respaldos, límites de uso de la IA y un protocolo de crisis validado por el responsable clínico.
- La grabación de audio de sesiones requiere un servicio de voz a texto y consentimiento registrado (en el demo es simulada).
