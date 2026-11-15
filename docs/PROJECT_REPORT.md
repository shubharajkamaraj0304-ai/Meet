# IntellMeet — AI-Powered Enterprise Meeting & Collaboration Platform

**Project report | Zidio Development — Web Development (MERN) domain**

## 1. Abstract

IntellMeet is a web application concept that brings meeting workflows and follow-up tasks into one workspace. The supplied project brief calls for real-time meetings, AI-assisted meeting intelligence, collaboration, task management and analytics. This implementation provides a working development MVP for authentication, meeting records, room chat, transcript storage, optional AI summarization and personal tasks.

## 2. Problem statement

Teams can lose decisions and follow-up actions when meeting notes, conversations and tasks are spread across different tools. IntellMeet aims to connect meeting context with clear next steps so participants can revisit discussions and track work.

## 3. Objectives

- Provide account registration and secure password hashing.
- Allow users to create and join meeting records.
- Provide real-time room chat using Socket.IO.
- Store meeting transcript text and request a summary.
- Extract action items when a configured AI provider returns them.
- Provide a task board for tracking personal work.
- Establish a modular MERN architecture that can be extended.

## 4. Scope and implementation status

| Requirement from brief | Included in this starter | Status |
|---|---|---|
| Authentication and profiles | Register, login, current-user endpoint, name/email/role | Implemented MVP |
| Video meetings | Meeting records, room UI, signaling relay hook | Partial; no media connection |
| AI meeting intelligence | Transcript input, optional OpenAI summary/action extraction | Partial; no live transcription |
| Real-time chat | Socket.IO room chat | Implemented MVP; harden socket auth |
| Post-meeting dashboard | Meeting list and stored summary/transcript | Partial |
| Team/project management | Personal task board | Partial; no shared workspace/assignment |
| Analytics | Basic counts on overview | Basic only |

## 5. Technology stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 19, TypeScript, Vite | Responsive single-page application |
| UI | CSS, Lucide icons | Application layout and controls |
| Backend | Node.js, Express | REST API |
| Database | MongoDB, Mongoose | User, meeting and task persistence |
| Real time | Socket.IO | Room chat and signaling relay event |
| Authentication | JWT, bcryptjs | API authentication and password hashing |
| AI | OpenAI API (optional) | Transcript summary and action-item extraction |
| Security baseline | Helmet, CORS, express-rate-limit | Headers, origin policy and auth throttling |

## 6. Architecture

The browser uses REST endpoints for account, meeting and task operations. Socket.IO carries chat events. Express persists records in MongoDB. The AI route sends supplied transcript text to the configured model only when `OPENAI_API_KEY` is present. See `ARCHITECTURE.md` for context, data relationships and trust boundaries.

## 7. Core workflows

### Authentication
1. User submits registration or login form.
2. Server validates fields and hashes passwords with bcrypt on registration.
3. Server issues a signed JWT.
4. Browser attaches the token to subsequent API calls.

### Meeting collaboration
1. User creates a meeting record.
2. User joins a meeting room.
3. Browser joins the Socket.IO room and exchanges chat messages.
4. User can enter transcript text and save it to the meeting.

### Meeting intelligence
1. User supplies transcript text or uses the saved meeting transcript.
2. If an AI key exists, the backend requests a JSON summary and action-item list.
3. Otherwise, the API returns a clearly labelled demo fallback, not a model-generated summary.
4. The result is saved to the meeting when a meeting ID is supplied.

### Task management
Users create tasks and move them among To do, In progress and Done. Tasks are scoped to their creator in this MVP.

## 8. Data model

- **User:** name, unique email, password hash, avatar URL and role.
- **Meeting:** title, description, host, participants, schedule, status, room ID, transcript, summary and action items.
- **Task:** title, description, status, priority, assignee, creator and optional meeting reference.

## 9. Security and privacy

The application uses password hashing, JWT verification, auth endpoint rate limiting, Helmet, a configured CORS origin and a JSON payload limit. These are baseline controls, not a complete security certification. The socket event handlers currently lack authentication and room membership authorization; WebRTC signaling must not be exposed publicly until these checks exist. Use TLS, managed secrets, database access controls, backups, audit trails and explicit consent/retention controls for recordings and transcripts.

## 10. Testing and acceptance

Manual smoke-test checklist:
- Register with a valid email and password of at least 10 characters.
- Log in and reload; current-user authentication should restore the session.
- Create a meeting and confirm it appears in the list.
- Join the room and send a chat message from another browser session.
- Save transcript text and request a summary.
- Test both configured AI and no-key fallback paths.
- Create tasks and move each through the three statuses.
- Confirm one user's REST resources are not returned to another user.

Automated unit, integration, accessibility, browser and load tests have not yet been added. No performance, concurrency, uptime or accuracy figures are claimed by this report.

## 11. Deployment plan

- Build the frontend with `npm run build -w client`.
- Run the API with `npm run start -w server`.
- Provision MongoDB and configure environment variables.
- Deploy frontend and backend behind HTTPS with a strict CORS allowlist.
- Add process health checks, logs, monitoring, backups and a rollback strategy.

## 12. Limitations and future enhancements

- Implement full WebRTC peer connection management, camera/microphone capture, screen sharing and STUN/TURN.
- Add authenticated Socket.IO middleware, per-room membership authorization, rate limiting and Redis adapter.
- Add refresh tokens, revocation and stronger session handling.
- Add live transcription, consent-aware recording and durable media storage.
- Add shared workspaces, invitations, team roles and task assignment.
- Add analytics, exports, search, notifications and audit logs.
- Add automated tests, CI/CD, Docker/Kubernetes manifests and load testing.

## 13. Conclusion

The starter demonstrates the core full-stack pattern and provides a foundation for extending IntellMeet. Its current implementation should be described as an MVP, not as a production-ready enterprise service. The roadmap identifies the work required to meet the broader project brief.
