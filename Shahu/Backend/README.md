# Shahu Backend

Node.js LTS, Express, MongoDB, JWT, role-based access, Swagger, Socket.io-ready backend.

## Scripts

- `npm run dev` starts the local API with Nodemon.
- `npm start` / `npm run start:local` starts the local API using `.env.local`.
- `npm run start:production` starts the production API using `.env.production`.
- `npm run lint` runs ESLint.
- `npm test` runs Jest tests.

## API

- Health: `GET /api/v1/health`
- Auth: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`
- Users: `/api/v1/users`
- Swagger: `/api-docs`

## Environments

Local development uses `.env.local` and the local database:

```env
NODE_ENV=development
HOST=0.0.0.0
PORT=5001
MONGO_URI=mongodb://127.0.0.1:27017/shahu?retryWrites=false
```

Production uses `.env.production`, supplied by the deployment platform's secret manager. Do not commit this file or the Atlas password:

```env
NODE_ENV=production
HOST=0.0.0.0
PORT=5000
MONGO_URI=mongodb+srv://Rinanu-bandhPublications:<db_password>@cluster0.ntdrs1m.mongodb.net/shahu?retryWrites=true&w=majority&appName=Cluster0
CLIENT_ORIGIN=https://your-public-frontend-domain
```

Replace `<db_password>` with a URL-encoded Atlas database-user password in the host's secret setting. Pushing code alone does not deploy it: configure your hosting/CI provider to run `npm run start:production` with these production secrets.
