"""Vercel build step: run Alembic migrations on production deployments only.

Uses MIGRATION_DATABASE_URL (Neon's *direct* connection string; DDL through the
pooled PgBouncer endpoint is unreliable). Preview deployments skip migrations so a
pull request can never change the production schema.
"""

from __future__ import annotations

import os
import subprocess
import sys


def main() -> int:
    vercel_env = os.environ.get("VERCEL_ENV", "")
    migration_url = os.environ.get("MIGRATION_DATABASE_URL", "")
    if vercel_env != "production":
        print(f"[build] VERCEL_ENV={vercel_env or 'local'}: skipping migrations.")
        return 0
    if not migration_url:
        print("[build] MIGRATION_DATABASE_URL is not set: skipping migrations. Run them manually (see README).")
        return 0
    print("[build] Applying database migrations…")
    env = {**os.environ, "DATABASE_URL": migration_url}
    result = subprocess.run([sys.executable, "-m", "alembic", "upgrade", "head"], env=env, check=False)
    if result.returncode != 0:
        print("[build] Migrations failed; stopping the deployment so old code keeps serving.", file=sys.stderr)
    return result.returncode


if __name__ == "__main__":
    sys.exit(main())
