# IntellMeet — AI-powered meeting & collaboration starter

A MERN application scaffold inspired by the supplied Zidio project brief. It includes a React + TypeScript workspace, Express API, MongoDB models, JWT authentication, meeting management, Socket.IO room chat, task tracking and an optional AI transcript-summary endpoint.

> **Scope honesty:** this is a runnable development MVP, not a production-grade enterprise video platform. The meeting screen currently provides a room UI and chat. WebRTC signaling is only a relay hook; camera, peer-to-peer media, screen sharing, recording, live transcription, team invitations, analytics, Redis clustering, Kubernetes and CI/CD still require implementation and validation. The no-key AI path is explicitly labelled demo fallback.

## Features implemented

- Register, login and current-user API with bcrypt password hashing and JWT.
- Create/list/join meetings; meeting membership and transcript storage.
- Socket.IO room chat.
- Create/list/update/delete personal tasks with status and priority.
- Optional OpenAI summary and action-item extraction from transcript text.
- Responsive React workspace UI, overview, meeting list, meeting notes and task board.
- Health endpoint, Helmet, CORS, JSON request limit and auth rate limit.

## Requirements

- Node.js 20+ and npm 10+
- MongoDB Community Server or MongoDB Atlas connection
- Optional OpenAI API key for model-generated summaries

## Quick start

1. Clone or extract this project.
2. Copy `.env.example` to `.env` in the repository root.
3. Set `MONGODB_URI` and replace `JWT_SECRET` with a long random secret.
4. Install dependencies from the repository root:

   ```bash
   npm install
   ```

5. Start MongoDB locally (if using local MongoDB).
6. Run both applications:

   ```bash
   npm run dev
   ```

7. Open http://localhost:5173. Register an account and create a meeting or task.

The API runs at http://localhost:5000. Check `GET /api/health`.

## Docker Compose

For a local containerized demo, export a strong secret and run:

```bash
export JWT_SECRET="$(openssl rand -hex 32)"
docker compose up --build
```

Open http://localhost:8080. The API is exposed on port 5000. This compose file is a local-demo baseline; configure production TLS, secrets, network boundaries and origin settings before deployment.

## Environment variables

| Variable | Purpose | Default |
|---|---|---|
| `PORT` | API port | `5000` |
| `CLIENT_URL` | Allowed browser origin | `http://localhost:5173` |
| `MONGODB_URI` | Mongo connection string | local `intellmeet` DB |
| `JWT_SECRET` | JWT signing secret | development-only value; change it |
| `JWT_EXPIRES_IN` | Access-token lifetime | `1d` |
| `OPENAI_API_KEY` | Optional AI provider key | unset |
| `OPENAI_MODEL` | Chat model name | `gpt-4o-mini` |
| `VITE_API_URL` | Frontend API base URL | `http://localhost:5000/api` |
| `VITE_SOCKET_URL` | Frontend Socket.IO URL | `http://localhost:5000` |

Vite variables must be set in `client/.env` if you override them. Never put secret keys in a `VITE_` variable.

## API overview

All endpoints except health and auth registration/login require `Authorization: Bearer <token>`.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Health check |
| POST | `/api/auth/register` | Create account |
| POST | `/api/auth/login` | Sign in |
| GET | `/api/auth/me` | Current user |
| GET / POST | `/api/meetings` | List / create meetings |
| GET | `/api/meetings/:id` | Get a meeting the user belongs to |
| POST | `/api/meetings/:id/join` | Join meeting |
| PATCH | `/api/meetings/:id/status` | Host updates lifecycle status |
| PATCH | `/api/meetings/:id/notes` | Save transcript |
| GET / POST | `/api/tasks` | List / create personal tasks |
| PATCH / DELETE | `/api/tasks/:id` | Update / delete task |
| POST | `/api/ai/summarize` | Summarize transcript; accepts `meetingId` and/or `transcript` |

## Socket events

- Client → server: `room:join`, `chat:message`, `webrtc:signal`
- Server → client: `participant:joined`, `chat:message`, `webrtc:signal`

**Important:** the included signaling relay does not authenticate sockets or verify meeting membership. Do not expose it publicly until authorization is implemented. Chat events also need schema validation, rate limiting and membership checks before production.

## Project structure

```text
intellmeet/
├── client/                 # React + TypeScript + Vite
│   └── src/
│       ├── App.tsx
│       ├── api.ts
│       └── styles.css
├── server/
│   └── src/
│       ├── middleware/
│       ├── models/
│       ├── routes/
│       ├── config.js
│       └── index.js
├── docs/
│   ├── ARCHITECTURE.md
│   └── PROJECT_REPORT.md
├── .env.example
└── README.md
```

## Security checklist before deployment

- [ ] Set strong, unique secrets in a secret manager.
- [ ] Add refresh-token rotation, revocation and secure cookie strategy.
- [ ] Authenticate Socket.IO connections and authorize every room event.
- [ ] Add membership checks for all meeting updates and AI operations.
- [ ] Add request validation, output encoding, CSRF strategy and tighter CORS.
- [ ] Configure HTTPS/WSS, database network rules, backups and retention.
- [ ] Add audit logs, monitoring, error reporting and alerting.
- [ ] Add automated tests, dependency scanning and OWASP review.
- [ ] Obtain informed consent before recording or transcribing meetings.

## Roadmap mapped to the Zidio brief

1. **Foundation:** auth, meetings, MongoDB and REST APIs.
2. **Collaboration:** Socket.IO chat and personal task board.
3. **Meeting intelligence:** transcript input and optional AI summary/action extraction.
4. **Video:** implement WebRTC peer connections, STUN/TURN, device controls and screen share.
5. **Operations:** tests, CI, containerization, deployment, observability and scale testing.

## License

Educational starter project. Add a license and attribution details appropriate to your submission.
