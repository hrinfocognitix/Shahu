# Shahu Backend

Node.js LTS, Express, MongoDB, JWT, role-based access, Swagger, Socket.io-ready backend.

## Scripts

- `npm run dev` starts the API with Nodemon.
- `npm start` starts the production server.
- `npm run lint` runs ESLint.
- `npm test` runs Jest tests.

## API

- Health: `GET /api/v1/health`
- Auth: `/api/v1/auth/register`, `/api/v1/auth/login`, `/api/v1/auth/refresh`
- Users: `/api/v1/users`
- Swagger: `/api-docs`

Copy `.env.local` values into your environment and set production secrets before deployment.
