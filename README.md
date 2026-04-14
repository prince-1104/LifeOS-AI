# TrackerAgent

## Backend (port 6060)

From the repository root:

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
```
uvicorn main:app  --host 127.0.0.1 --port 6060

uvicorn main:app --reload --host 127.0.0.1 --port 6060

Create `backend/.env` from [`backend/.env.example`](backend/.env.example). Required variables include `DATABASE_URL`, AI keys, Qdrant, and **Clerk** settings for JWT verification:

- **`CLERK_JWKS_URL`** — from the Clerk Dashboard (API keys / JWT verification), usually `https://<your-instance>.clerk.accounts.dev/.well-known/jwks.json`.
- **`CLERK_ISSUER`** — must match the JWT `iss` claim (typically `https://<your-instance>.clerk.accounts.dev`).

The API **never** trusts `user_id` from the client. The frontend sends `Authorization: Bearer <Clerk session JWT>`; FastAPI verifies the token and uses the `sub` claim as `user_id`.

```bash

```

## Frontend (port 3006)

```bash
cd frontend
npm install
```

Copy [`frontend/.env.local.example`](frontend/.env.local.example) to `frontend/.env.local` and set **`NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`** and **`CLERK_SECRET_KEY`** from the Clerk Dashboard.

```bash
npm run dev
```

The dev server listens on **http://localhost:3006** and calls the API at `NEXT_PUBLIC_API_BASE_URL` (default `http://127.0.0.1:6060`) with a **Clerk Bearer token** on each request.

Sign-in uses **Clerk** (landing page, `/sign-in`, `/sign-up`). The sidebar **UserButton** signs you out to `/`.

**Security:** If API keys were ever exposed in chat or commits, rotate them in Clerk and in your hosting secrets.
