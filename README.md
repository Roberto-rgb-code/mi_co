# Isuzu Cotizador

Sistema de cotización para camiones Isuzu (ELF y Forward).

## Stack

- **Backend**: NestJS + TypeORM + PostgreSQL
- **Frontend**: React (próximamente)
- **Base de datos**: Railway PostgreSQL
- **Deploy**: Railway

## Requisitos

- Node.js 18+
- Cuenta en [Railway](https://railway.app)
- Cuenta en [GitHub](https://github.com)

## Instalación

### 1. Clonar y dependencias

```bash
git clone <tu-repo>
cd isuzu_miche
npm install
```

### 2. Variables de entorno

Crear archivo `.env` en la raíz (copiar de `.env.example`):

```env
DATABASE_URL=postgresql://usuario:password@host:puerto/railway
PORT=3000
```

⚠️ **Nunca** subir `.env` a GitHub. Está en `.gitignore`.

### 3. Ejecutar migraciones

```bash
npm run db:migrate
```

### 4. (Opcional) Cargar datos de ejemplo

```bash
cd backend && npm run seed
```

### 5. Iniciar backend y frontend

```bash
# Terminal 1 - Backend
npm run backend

# Terminal 2 - Frontend (dev con hot reload)
npm run frontend
```

- Backend: http://localhost:3000
- Frontend: http://localhost:5173

## Scripts

| Comando | Descripción |
|---------|-------------|
| `npm run backend` | Inicia backend en modo desarrollo |
| `npm run backend:build` | Compila backend para producción |
| `npm run db:migrate` | Ejecuta migraciones |
| `npm run db:migrate:generate` | Genera migración desde entidades |

## Deploy en Railway

1. Conectar tu repo de GitHub a [Railway](https://railway.app)
2. Crear **Nuevo Proyecto** → **Deploy from GitHub repo**
3. Seleccionar el repositorio `isuzu_miche`
4. Configurar variables de entorno en Railway:
   - `DATABASE_URL`: tu conexión PostgreSQL (ej. la de Railway)
   - `NODE_ENV`: `production`
5. Railway detectará el proyecto y usará `nixpacks.toml`
6. Opcional: antes del deploy, ejecutar migraciones (o configurar un job)

**Nota**: Las migraciones se pueden ejecutar manualmente con `npm run db:migrate` localmente apuntando a la DB de Railway, o agregar un script de release.

## Estructura

```
isuzu_miche/
├── backend/          # NestJS API
│   ├── src/
│   │   ├── entities/
│   │   ├── migrations/
│   │   └── config/
│   └── package.json
├── frontend/         # React (próximamente)
├── .env              # Variables (no subir)
├── .env.example      # Plantilla
└── package.json      # Monorepo root
```
