# AGENTS.md

## Cursor Cloud specific instructions

### Project overview

Flowtym PMS is a Property Management System SaaS for boutique hotels. The frontend is a React 19 + Vite 6 + TailwindCSS 4 SPA that connects to a hosted Supabase instance (auth, PostgreSQL, RLS, realtime). A minimal FastAPI backend stub exists but carries no business logic.

### Services

| Service | Port | Command | Required? |
|---------|------|---------|-----------|
| Vite dev server (frontend) | 3000 | `npm run dev` (from repo root) | Yes |
| FastAPI backend stub | 8001 | `uvicorn server:app --port 8001` (from `backend/`) | Optional — stub only |

### Lint / Build / Test

- **Lint**: `npm run lint` (root) runs `tsc --noEmit`. There are **pre-existing TypeScript errors** in the codebase; a non-zero exit code from lint is expected and does not indicate a setup problem.
- **Build**: `npm run build` (root) runs `vite build` targeting `frontend/` as root. This succeeds cleanly.
- **Dev**: `npm run dev` (root) starts Vite on port 3000 with HMR.
- No automated test suite exists in the repo.

### Authentication & data layer

The app uses Supabase Cloud (`hzrzkvdebaadditvbqis.supabase.co`). The Supabase URL and anon key are hardcoded with fallbacks in source, so no `.env` file is strictly required to run the dev server. Test credentials are documented in `memory/test_credentials.md`.

### Gotchas

- The repo has **two `package.json` files**: one at the root and one in `frontend/`. The root `vite.config.ts` sets `root: frontendRoot` pointing to `frontend/`. Always run `npm install` in **both** root and `frontend/` directories.
- The root `tsconfig.json` path alias `@/*` maps to `./*` (root-relative), while `frontend/tsconfig.json` also uses `@/*` mapping to `./*` (frontend-relative). When running `tsc` from root, module resolution uses the root tsconfig.
- Python dependencies (`backend/requirements.txt`) are installed with `pip install -r backend/requirements.txt`. The `uvicorn` binary installs to `~/.local/bin`; ensure that directory is on `PATH`.
