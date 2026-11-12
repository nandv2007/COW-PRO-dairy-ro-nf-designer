# COW PRO — Dairy Membrane Processing Design & Simulation Platform

**COW PRO** is a full-stack engineering design, sizing, validation, and simulation web platform for dairy **Reverse Osmosis (RO)** and **Nanofiltration (NF)** membrane concentration systems.

## Architecture

- **Frontend (`frontend/`)**: Next.js (App Router, TypeScript, Tailwind CSS, React Hook Form, Zod, Lucide Icons, React Flow, Recharts, Vitest).
- **Backend (`backend/`)**: Python FastAPI centralized engineering calculation & simulation engine (`NumPy`, `SciPy`, `Pydantic`, `SQLAlchemy`, `ReportLab`, `Matplotlib`, `PyJWT`, `bcrypt`, `pytest`).
- **Database & Auth (`supabase/`)**: Full PostgreSQL schema and Row-Level Security (RLS) migrations (`001_initial_schema.sql`, `002_seed_membranes.sql`) for Supabase deployments, plus an out-of-the-box local SQLite + JWT/cookie persistence mode for zero-config local execution.

## Key Engineering Features

1. **Authentication & Account Management**: Split-screen Login/Registration with email verification, remember session, password reset, unit preferences (`L/h` / `m³/h`, `bar` / `kPa` / `psi`, `°C` / `°F`), and strict user project ownership protection.
2. **Module 1 — Feed Analysis (`Composition → Feed → Final`)**:
   - Milk composition (% w/w mass basis) with `SNF` selected by default (`Total Solids = SNF + Fat` and `SNF = Total Solids − Fat`).
   - Never fabricates missing protein, lactose, or ash values.
   - Enforces the COW PRO v1 Ash-Based Membrane Rule (restricting selection to NF when ash/mineral separation properties are supplied, while explaining this is a COW PRO v1 rule).
   - Direct feed flow (`L/h`, `m³/h`) or capacity/operating time conversion (requiring positive density for `kg`).
   - Target concentration & preliminary Concentration Factor calculation with volumetric assumption warnings.
3. **Module 2 — Equipment Design**:
   - Total Permeate Removal = `Feed Flow × (1 − 1 / CF)`.
   - Automatic loop selection (`1 <= CF <= 1.6` Single Loop; `1.6 < CF < 3` Two Loops with 2/3 & 1/3 permeate split; `CF >= 3` flagged outside automatic range).
   - Exact 8 preliminary RO/NF membrane catalog entries (separate IDs 1–8) with per-property verification tracking (`Manufacturer Verified`, `Experimentally Measured`, `User Supplied`, `Estimated`, `Unknown`).
   - Separate Loop 1 & Loop 2 design flux inputs (`User Supplied`), rounded-up membrane counts, installed membrane area, housing sizing with spare-position detection, and SI hydraulic & pump sizing.
4. **Process Flow Diagram & Simulation**:
   - Interactive React Flow schematic with clickable membrane loop modules and separate recirculation loops.
   - Level 1 Preliminary Simulation + guarded Level 2 Advanced Simulation readiness check (never fabricates unverified physical outputs).
5. **Results, Validation Engine & Reporting**:
   - 7 KPI summary cards, Loop 1 vs Loop 2 comparison table, 5 Recharts visualizations, and 5-category Engineering Validation Engine (`Passed`, `Warning`, `Failed`, `Not Evaluated`).
   - Server-generated 12-section PDF engineering report (with vector PFD and Matplotlib charts), CSV calculations export, and portable JSON export/import.

## Running Locally

### 1. Start the Python FastAPI Backend (Port 8000)

```bash
cd backend
.venv/bin/uvicorn app.main:app --reload --port 8000
```

### 2. Start the Next.js Frontend (Port 3000)

```bash
cd frontend
npm run dev
```

Open `http://localhost:3000` in your browser.
A seeded demonstration engineer account (`engineer@cowpro.dev` / `CowProDemo2026!`) includes the **Section 27 NF 3838 TS40 (CF = 2)** demonstration case, or you can register a new account.

## Running Automated Tests

```bash
# Backend engineering & API tests (17 tests)
cd backend && .venv/bin/pytest -v

# Frontend unit & component tests
cd frontend && npm test -- --run
```

## Deploying on Render (Blueprint)

COW PRO includes a ready-to-deploy [`render.yaml`](./render.yaml) Render Blueprint that provisions:
1. **`cowpro-db`**: Managed PostgreSQL database.
2. **`cowpro-api`**: Python FastAPI service (`backend/`) with automatic SQLAlchemy schema initialization, PostgreSQL `psycopg` normalization, and initial seeding (8 preliminary membranes + demo engineer + Section 27 project).
3. **`cowpro-web`**: Responsive Next.js frontend (`frontend/`) with a runtime `/api/[...path]` proxy route targeting `cowpro-api` (`BACKEND_URL`), eliminating build-time CORS/URL ordering issues.

### Steps to Deploy on Render
1. Push this repository to GitHub:
   ```bash
   git remote add origin https://github.com/nandv2007/COW-PRO-dairy-ro-nf-designer.git
   git push -u origin main
   ```
2. Open [Render Blueprints](https://dashboard.render.com/blueprints) → **New Blueprint Instance**.
3. Connect the `COW-PRO-dairy-ro-nf-designer` repository containing `render.yaml` and click **Apply**.
4. Wait for `cowpro-db`, `cowpro-api` (`/api/health`), and `cowpro-web` (`/login`) to finish deploying, then open your `.onrender.com` URL.
