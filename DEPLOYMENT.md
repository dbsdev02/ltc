# Little Todds Club — setup & deployment

```
frontend/   Vite + React shop and admin  → Vercel project "ltc-web"  (Root Directory: frontend)
backend/    FastAPI API + migrations     → Vercel project "ltc-api"  (Root Directory: backend)
legacy/     retired Hostinger PHP backend (reference only)
```

Two Vercel projects from this one GitHub repo:

| Project | Root directory | What it is |
|---|---|---|
| **ltc-web** | `frontend/` | Vite + React shop and admin (`/admin`) |
| **ltc-api** | `backend/` | FastAPI on Vercel Python Functions, Neon Postgres, Cloudinary, Razorpay |

The shop calls `/api/*` on its own domain; `frontend/vercel.json` rewrites that to the API project, so
login cookies are first-party and no CORS is needed.

> ⚠️ Vercel's **Hobby** plan is for personal, non-commercial use. A store taking payments is
> commercial use under Vercel's terms and can be paused. Move both projects to **Pro** before
> taking real orders.

---

## 1. Accounts to create (all free tiers)

1. **Neon** (neon.tech) → new project, region **AWS Asia Pacific (Mumbai) ap-south-1**.
   Copy two connection strings from *Connection Details*:
   - **Pooled** (host contains `-pooler`) → `DATABASE_URL`
   - **Direct** (no `-pooler`) → `MIGRATION_DATABASE_URL`
2. **Cloudinary** (cloudinary.com) → *Settings → API Keys*: cloud name, API key, API secret.
3. **Razorpay** → *Account & Settings → API Keys*: start with **Test mode** keys (`rzp_test_…`).
4. **Resend** (resend.com) → add & verify the domain `littletodds.club` (DNS records), create an API key.

## 2. Create the database (once, from your computer)

```powershell
cd backend
uv venv .venv
uv pip install --python .venv -r pyproject.toml --group dev
# Windows Application Control blocks SQLAlchemy's compiled module on this PC; use the pure-Python build:
$env:DISABLE_SQLALCHEMY_CEXT=1; uv pip install --python .venv --reinstall --no-binary sqlalchemy sqlalchemy

$env:DATABASE_URL="<Neon DIRECT connection string>"
.venv\Scripts\python -m alembic upgrade head                       # creates all tables
.venv\Scripts\python -m scripts.seed --admin-email you@example.com # product, stock, settings + owner login
```

`scripts.seed` asks for the admin password (12+ characters). Stock starts at 50 Vanilla Cake /
0 Fruit Punch — change it in **/admin → Product & stock**.

## 3. Deploy the API (project `ltc-api`)

Vercel → *Add New → Project* → import this repo → **Root Directory: `backend`** → Framework: FastAPI (auto-detected).
Name the project **`ltc-api`** so its URL is `https://ltc-793b.vercel.app` (if that name is taken,
use another and update the rewrite in `frontend/vercel.json`).

Environment variables (Production), see `backend/.env.example`:

| Variable | Value |
|---|---|
| `DATABASE_URL` | Neon **pooled** URL |
| `MIGRATION_DATABASE_URL` | Neon **direct** URL (migrations run automatically on each production deploy) |
| `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` | Razorpay keys (test first, then live) |
| `RAZORPAY_WEBHOOK_SECRET` | the secret you'll type in step 5 |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Cloudinary |
| `JWT_SECRET_KEY` | `python -c "import secrets; print(secrets.token_urlsafe(64))"` |
| `FRONTEND_URL` | `https://littletodds.club` |
| `RESEND_API_KEY`, `EMAIL_FROM`, `NOTIFY_EMAIL` | email |
| `ENVIRONMENT` | `production` |

Check: open `https://ltc-793b.vercel.app/api/health` → `"database": true, "razorpay": true, …`.

## 4. Deploy the shop (project `ltc-web`)

Vercel → *Add New → Project* → same repo → **Root Directory: `frontend`** → Framework: Vite.
No environment variables are needed (`VITE_API_BASE_URL` stays empty).
Add the domain `littletodds.club` (+ `www`) under *Settings → Domains* and point DNS
(at your registrar / Hostinger DNS) to Vercel as instructed there.

## 5. Razorpay webhook

Razorpay Dashboard → *Account & Settings → Webhooks → Add New*:
- URL: `https://littletodds.club/api/payments/webhook`
- Secret: same as `RAZORPAY_WEBHOOK_SECRET`
- Events: `payment.captured`, `payment.failed`, `order.paid`

## 6. Go live checklist

1. With **test keys**, place an order with Razorpay's test UPI/card → it appears in /admin as *To ship*,
   stock drops, emails arrive. Cancel it → stock returns.
2. Swap in **live keys** (`rzp_live_…`) in `ltc-api`, redeploy, recreate the webhook in live mode.
3. Upload product photos in **/admin → Images** (until then the built-in images are shown).

## Local development

```powershell
# terminal 1 — API on :8000 (SQLite is fine locally)
cd backend
$env:DATABASE_URL="sqlite:///./dev.db"
.venv\Scripts\python -m alembic upgrade head
$env:ADMIN_PASSWORD="ChooseAStrongOne!"; .venv\Scripts\python -m scripts.seed --admin-email you@example.com
.venv\Scripts\python -m uvicorn app.main:app --reload --port 8000

# terminal 2 — shop on :5173 (proxies /api to :8000)
cd frontend
npm install   # first time only
npm run dev
```

Tests: `cd backend; .venv\Scripts\python -m pytest` (22 tests: pricing, stock, Razorpay signature,
webhooks + idempotency, COD, admin roles, rate limits, accounts, image validation).

## Where things live

- `backend/app/routes/` — `products.py`, `orders.py`, `payments.py`, `auth.py` (customers), `admin.py`
- `backend/app/services/` — pricing (Decimal), orders & stock, Razorpay, Cloudinary, email, security, rate limits
- `backend/alembic/versions/` — database migrations
- `frontend/src/lib/catalog.tsx` — live product data (with built-in fallback); `frontend/src/lib/api.ts` — API client
- `frontend/src/routes/admin.tsx`, `frontend/src/components/admin/` — admin dashboard
- `legacy/hostinger-php/` — the retired Hostinger PHP backend (reference only)
