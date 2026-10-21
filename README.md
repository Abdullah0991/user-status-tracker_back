# User Status Tracker — Back-end

REST API for the **User Status Tracker** application: it authenticates users, tracks the
availability status of regular (non-admin) users, and exposes aggregated statistics for
dashboards.

Built with **Node.js + TypeScript + Express 5**, using **Prisma ORM** on **PostgreSQL** and
**JWT** bearer-token authentication.

The React front-end lives in the sibling `../front-end` directory and talks to this API
through `VITE_API_URL` (defaults to `http://localhost:5000/api`).

---

## Features

- **Authentication** — register / login with bcrypt-hashed passwords and stateless JWT
  sessions (24 h expiry).
- **Role-based access control** — `ADMIN` and `USER` roles, enforced with Passport's JWT
  strategy plus custom middleware.
- **User management (admin)** — list with search / filtering / sorting / pagination, view,
  create, update and delete users. Admins cannot delete their own account.
- **Status tracking (regular users)** — a signed-in user updates their own status;
  admins are not part of the status pool and always keep a `null` status.
- **Dashboard statistics** — total users, total regular users, per-status counts and
  percentages, a bar-chart series and an available/unavailable pie-chart series.
- **Database migrations & seeding** — Prisma migrations are applied automatically on
  container start, and an admin account is seeded idempotently.
- **Graceful shutdown** — the Prisma client is disconnected on `SIGINT`.

---

## Tech stack

| Layer         | Choice                                                |
| ------------- | ----------------------------------------------------- |
| Runtime       | Node.js 20                                            |
| Language      | TypeScript 5.9 (`strict`)                             |
| Framework     | Express 5                                             |
| ORM           | Prisma 6 (`@prisma/client`)                           |
| Database      | PostgreSQL 15                                         |
| Auth          | Passport + `passport-jwt` + `jsonwebtoken`             |
| Hashing       | `bcryptjs`                                            |
| Misc          | `cors`, `dotenv`, `ts-node-dev`                       |
| Deployment    | Docker (multi-stage) + Docker Compose                |

---

## Project structure

```
back-end/
├── prisma/
│   ├── migrations/            # Applied SQL migrations
│   └── schema.prisma          # User model, Role & Status enums
├── src/
│   ├── config/
│   │   └── passport.ts        # JWT strategy (verifies token -> loads user)
│   ├── routes/
│   │   ├── auth.ts            # /api/auth  (register, login)
│   │   ├── users.ts           # /api/users (admin CRUD, own status update)
│   │   └── dashboard.ts       # /api/dashboard (stats)
│   ├── seed/
│   │   └── seed-admin.ts      # Creates the ADMIN account
│   ├── types/
│   │   └── index.ts           # Shared request/response interfaces
│   └── server.ts              # Express app, middleware, routes, shutdown
├── Dockerfile                 # Multi-stage build (node:20 -> node:20-slim)
├── .env.example               # Template for environment variables
├── docker-compose.yml         # Lives in the project root (../docker-compose.yml)
├── package.json
└── tsconfig.json
```

---

## Getting started

### 1. Prerequisites

- Node.js 20+ and npm
- A PostgreSQL 15 instance (local, or via Docker: `docker run -d -p 5454:5454 ... postgres:15`)

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

```bash
cp .env.example .env
```

| Variable        | Required | Description                                                        | Example                                                 |
| --------------- | -------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| `DATABASE_URL`  | yes      | PostgreSQL connection string                                        | `postgresql://postgres:postgres@localhost:5432/user_status_tracker` |
| `JWT_SECRET`    | yes      | Secret used to sign/verify JWTs                                     | a long random string                                    |
| `PORT`          | no       | HTTP port (default `5000`)                                          | `5000`                                                  |
| `NODE_ENV`      | no       | Runtime environment                                                 | `development`                                           |
| `ADMIN_EMAIL`   | no       | Email for the seeded admin account                                  | `admin@app.com`                                         |
| `ADMIN_PASSWORD`| no       | Password for the seeded admin account                               | `uu123456`                                              |
| `ADMIN_ROLE`    | no       | Role assigned to the seeded account (default `ADMIN`)               | `ADMIN`                                                 |

> The `DATABASE_URL` in `.env.example` points at `db:5454`, which is the Docker Compose
> service name. Use `localhost:<port>` when running the API outside Docker.

### 4. Prepare the database

```bash
npm run prisma:generate   # generate the Prisma client
npm run prisma:migrate    # create/apply migrations in development
npm run prisma:seed       # create the ADMIN user (idempotent)
```

Use `npm run prisma:push` instead of `prisma:migrate` if you prefer to sync the schema
without creating migration files.

### 5. Run the server

```bash
npm run dev      # ts-node-dev with auto-respawn (hot reload)
npm run build    # type-check and compile to ./dist
npm start        # run the compiled server
```

The API is then available at `http://localhost:5000`.

---

## npm scripts

| Script                | Description                                             |
| --------------------- | ------------------------------------------------------- |
| `npm run dev`         | Start the dev server with hot reload                    |
| `npm run build`       | Compile TypeScript to `dist/`                           |
| `npm start`           | Run the compiled server (`dist/server.js`)               |
| `npm run prisma:generate` | Regenerate the Prisma client                       |
| `npm run prisma:migrate`  | Create/apply a development migration                 |
| `npm run prisma:push`     | Push the schema directly to the database             |
| `npm run prisma:seed`     | Seed the admin account (`src/seed/seed-admin.ts`)   |

---

## Database schema

```prisma
model User {
  id        String   @id @default(cuid())
  email     String   @unique
  password  String          // bcrypt hash
  name      String
  role      Role     @default(USER)
  status    Status?         // null for ADMIN accounts
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@map("users")
}

enum Role {
  USER
  ADMIN
}

enum Status {
  AVAILABLE_NO_TASK
  AVAILABLE_ROUTINE_TASK
  AVAILABLE_URGENT_TASK
  UNAVAILABLE
}
```

**Status semantics** — status is a *workload + availability* signal for regular users:

| Status                  | Meaning                                   | Chart color |
| ----------------------- | ----------------------------------------- | ----------- |
| `AVAILABLE_NO_TASK`     | Available, no task assigned (new users)   | `#10b981`   |
| `AVAILABLE_ROUTINE_TASK`| Available with a routine task             | `#3b82f6`   |
| `AVAILABLE_URGENT_TASK` | Available with an urgent task             | `#ef4444`   |
| `UNAVAILABLE`           | Not available                             | `#6b7280`   |

`ADMIN` accounts are excluded from status tracking, so their `status` stays `null` and they
are not counted in the dashboard distributions.

---

## Authentication

1. `POST /api/auth/login` (or `/register`) returns a signed JWT:
   `{ id, email, role }`, valid for **24 hours**.
2. Send it on every protected request:
   `Authorization: Bearer <token>`.
3. Passport's JWT strategy verifies the signature and loads the user from the database, so
   deleted or modified accounts are rejected immediately.

Role checks are applied per route with two small middlewares in `src/routes/users.ts`:

- `requireAdmin` — rejects non-`ADMIN` callers with `403 Admin access required`.
- `canUpdateStatus` — rejects non-`USER` callers with `403 Only regular users can update status`.

---

## API reference

All protected endpoints require the `Authorization: Bearer <token>` header.

### `POST /api/auth/register` — public

Creates an account and returns a JWT.

```bash
curl -X POST http://localhost:5000/api/auth/register \
  -H 'Content-Type: application/json' \
  -d '{"email":"jane@example.com","password":"secret123","name":"Jane Doe","role":"USER"}'
```

```json
{
  "token": "eyJhbGciOi...",
  "user": {
    "id": "clx1...",
    "email": "jane@example.com",
    "name": "Jane Doe",
    "role": "USER",
    "status": "AVAILABLE_NO_TASK"
  }
}
```

Regular users are created with `status = AVAILABLE_NO_TASK`; admins are created with
`status = null`.

### `POST /api/auth/login` — public

```bash
curl -X POST http://localhost:5000/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"admin@app.com","password":"uu123456"}'
```

Returns the same `{ token, user }` shape. Invalid credentials return `400`.

### `GET /api/users` — admin only

Lists users with optional search, filtering, sorting and pagination.

| Query param  | Type    | Default   | Description                                              |
| ------------ | ------- | --------- | -------------------------------------------------------- |
| `search`     | string  | —         | Case-insensitive match on `name` or `email`              |
| `role`       | string  | `ALL`     | `USER` \| `ADMIN` \| `ALL`                               |
| `status`     | string  | `ALL`     | Any `Status` value, `NO_STATUS` (i.e. `null`), or `ALL`  |
| `page`       | number  | `1`       | 1-based page number                                      |
| `limit`      | number  | `50`      | Page size (max 100)                                      |
| `sortBy`     | string  | `createdAt` | `name`, `email`, `role`, `status`, `createdAt`, `updatedAt` |
| `sortOrder`  | string  | `desc`    | `asc` \| `desc`                                          |

```json
{
  "users": [
    {
      "id": "clx1...",
      "email": "jane@example.com",
      "name": "Jane Doe",
      "role": "USER",
      "status": "AVAILABLE_URGENT_TASK",
      "createdAt": "2025-08-15T22:25:04.000Z",
      "updatedAt": "2025-08-16T21:06:44.000Z"
    }
  ],
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalCount": 57,
    "hasNextPage": true,
    "hasPrevPage": false,
    "limit": 50
  },
  "filters": { "search": "", "role": "ALL", "status": "ALL" }
}
```

### `PUT /api/users/status` — regular users only

Updates the caller's own status. Admins cannot call this endpoint.

```bash
curl -X PUT http://localhost:5000/api/users/status \
  -H "Authorization: Bearer $TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"status":"AVAILABLE_URGENT_TASK"}'
```

Returns the updated user (`id`, `email`, `name`, `role`, `status`). An invalid status
returns `400 Valid status is required`.

### `GET /api/users/:id` — admin only

Returns a single user, or `404 User not found`.

### `POST /api/users` — admin only

Creates a user. `email`, `password`, `name` and `role` are required; `status` is optional
and only applied to `USER` accounts.

```json
{ "email": "bob@example.com", "password": "secret123", "name": "Bob", "role": "USER", "status": "UNAVAILABLE" }
```

Returns `201` with the created user.

### `PUT /api/users/:id` — admin only

Partial update. Accepts `email`, `name`, `role`, `status` and `password` (re-hashed with
bcrypt). Promoting a user to `ADMIN` clears their status; demoting to `USER` keeps the
supplied `status`.

### `DELETE /api/users/:id` — admin only

Deletes the user. Deleting your own account is rejected with
`400 Cannot delete your own account`.

### `GET /api/dashboard/stats` — authenticated

Aggregated statistics used by the dashboard charts.

```json
{
  "totalUsers": 57,
  "totalRegularUsers": 50,
  "stats": {
    "AVAILABLE_NO_TASK": { "count": 20, "percentage": "40.0" },
    "AVAILABLE_ROUTINE_TASK": { "count": 12, "percentage": "24.0" },
    "AVAILABLE_URGENT_TASK": { "count": 8, "percentage": "16.0" },
    "UNAVAILABLE": { "count": 10, "percentage": "20.0" }
  },
  "statusDistributionBar": [
    { "status": "Available - No Task", "count": 20, "percentage": 40, "color": "#10b981" }
  ],
  "availabilityDistribution": [
    { "name": "Available", "value": 40, "percentage": 80, "color": "#10b981" },
    { "name": "Unavailable", "value": 10, "percentage": 20, "color": "#ef4444" }
  ]
}
```

`stats` is the legacy shape (percentages as strings), while `statusDistributionBar` and
`availabilityDistribution` are ready-to-plot series for Recharts.

---

## Error handling

Unhandled errors are caught by the global error middleware in `src/server.ts` and returned
as `500 { "message": "Internal server error" }`. Route handlers return explicit client
errors:

| Status | Message                                     | When                                   |
| ------ | ------------------------------------------- | -------------------------------------- |
| `400`  | `User already exists`                        | Register / create with a taken email   |
| `400`  | `Invalid credentials`                        | Login failure                          |
| `400`  | `Valid status is required` / `Invalid status`| Bad status value                       |
| `400`  | `Invalid role`                               | Unknown role value                     |
| `400`  | `Cannot delete your own account`             | Self-delete                            |
| `401`  | `Unauthorized`                               | Missing / invalid / expired JWT        |
| `403`  | `Admin access required`                      | Non-admin on an admin route            |
| `403`  | `Only regular users can update status`       | Admin on the status route              |
| `404`  | `User not found`                             | Unknown user id                        |
| `500`  | `Server error` / `Internal server error`     | Unexpected failure                     |

---

## Docker

The Docker setup lives in the project root (`../docker-compose.yml`) and runs three
services:

| Service   | Image / build        | Ports              |
| --------- | -------------------- | ------------------ |
| `db`      | `postgres:15`        | `5454:5454`        |
| `backend` | `./back-end`         | `5000:5000`        |
| `frontend`| `./front-end`        | `3000:80` (nginx)  |

```bash
cd ..
docker compose up --build
```

### `docker-compose.yml` example

The compose file sits at the project root (next to `back-end/` and `front-end/`) because it
references both images. This is the file used by this project:

```yaml
services:
  db:
    image: postgres:15
    container_name: postgres_db
    restart: always
    command: -p 5454
    environment:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: user_status_tracker
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5454:5454"

  backend:
    build: ./back-end
    container_name: express_backend
    restart: always
    env_file:
      - ./back-end/.env.prod
    depends_on:
      - db
    ports:
      - "5000:5000"
    command: sh -c "npx prisma migrate deploy && npx prisma db seed && node dist/server.js"

  frontend:
    build: ./front-end
    container_name: react_frontend
    restart: always
    depends_on:
      - backend
    ports:
      - "3000:80"

volumes:
  db_data:
```

Key points:

- The Postgres instance listens on the **non-standard port `5454`** (`command: -p 5454`), so
  the API's `DATABASE_URL` must use the same port: `postgres://postgres:postgres@db:5454/user_status_tracker`.
- `backend` reads its configuration from `./back-end/.env.prod` via `env_file`.
- `command` re-runs the migration + seed + start sequence, so the database is always up to
  date before the API accepts requests.
- `db_data` is a named volume, so the database survives `docker compose down` (use
  `docker compose down -v` to wipe it).

### Running the stack

```bash
cd ..
docker compose up --build          # build images and start all three services
docker compose up -d               # run in the background
docker compose logs -f backend     # follow the API logs
docker compose down                # stop the containers (keeps the volume)
docker compose down -v             # stop and delete the database volume
```

Once running, the API is at `http://localhost:5000`, the front-end at
`http://localhost:3000` and Postgres at `localhost:5454`.

### Back-end image details

The `backend` image is a multi-stage build: the first stage installs dependencies,
generates the Prisma client and compiles TypeScript; the second stage copies only
`dist/`, `node_modules/` and `prisma/` onto `node:20-slim`. On start the container runs:

```sh
npx prisma migrate deploy && npx prisma db seed && node dist/server.js
```

so migrations are applied and the admin account is seeded before the API comes up.
Environment values for the container come from `./back-end/.env.prod`.

To run the back-end image on its own:

```bash
docker build -t user-status-tracker-api .
docker run -p 5000:5000 --env-file .env.prod user-status-tracker-api
```

---

## Notes & known limitations

- `POST /api/auth/register` accepts a `role` in the request body, so anyone can self-register
  as an `ADMIN`. In production this should be restricted to admins or ignored server-side.
- `GET /api/dashboard/stats` only requires authentication, so any signed-in user can read the
  aggregated numbers. Add `requireAdmin` if the dashboard is meant to be admin-only.
- `JWT_SECRET` falls back to the hard-coded string `fallback_secret` when the variable is
  missing — always set it explicitly outside local development.
- A `PrismaClient` instance is created in every module (`server.ts`, each route, `passport.ts`,
  the seed script) instead of sharing a single one; a shared singleton would reduce
  connection-pool usage.
- There is no refresh-token or logout flow: the JWT simply expires after 24 hours.
- No test suite is wired up yet.
