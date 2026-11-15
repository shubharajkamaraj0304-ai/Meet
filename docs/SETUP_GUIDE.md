# IntellMeet Setup Guide

## A. Install prerequisites

Install Node.js 20 or later and npm. Install MongoDB Community Server locally, or create a MongoDB Atlas database and copy its connection string.

## B. Configure environment

At repository root:

```bash
cp .env.example .env
```

Edit `.env`:
- `MONGODB_URI`: your database connection string.
- `JWT_SECRET`: a unique random secret (at least 32 random bytes recommended).
- `CLIENT_URL`: frontend origin.
- `OPENAI_API_KEY`: optional; leave blank for demo fallback.

For a local MongoDB service, ensure it is running before starting the API.

## C. Install and run

From the repository root:

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The backend is `http://localhost:5000`.

## D. First use

1. Choose Create an account.
2. Register with your name, email and password (10+ characters).
3. Open Meetings and create a room.
4. Join the room. Open a second browser window and sign in as another user to test room chat after adding that user's meeting membership through a future invitation flow; the current simple MVP join endpoint permits joining by meeting ID, so secure it before production.
5. Enter transcript text in AI meeting notes, save it, then select Summarize.
6. Open My tasks, create a task and move it between statuses.

## E. Build

```bash
npm run build
```

## F. Troubleshooting

- **Mongo connection error:** check the service is running and `MONGODB_URI` is correct.
- **CORS error:** ensure `CLIENT_URL` matches the exact frontend origin.
- **401 after login:** sign in again; the access token may have expired.
- **AI summary says demo fallback:** set `OPENAI_API_KEY` in the root `.env` and restart the server.
- **Port already in use:** change `PORT` or stop the process using port 5000.

## G. Before a public demo

Never deploy with the example JWT secret. Add socket authentication and meeting authorization before public exposure. Use HTTPS, production database credentials, environment-based CORS, request validation, backups, logs, error monitoring and consent controls. The video controls in the current UI are demonstrative and do not capture camera or microphone media.

## H. Docker Compose

With Docker Desktop running:

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
docker compose up --build
```

Open `http://localhost:8080`. Stop with `docker compose down`; add `-v` only if you intentionally want to remove the local MongoDB volume.
