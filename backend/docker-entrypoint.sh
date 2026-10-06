#!/bin/sh
set -e

echo "==> Waiting for PostgreSQL at ${DB_HOST:-db}:${DB_PORT:-5432} ..."
python - <<'PY'
import os, time
import psycopg
host = os.environ.get("DB_HOST", "db")
port = os.environ.get("DB_PORT", "5432")
name = os.environ.get("DB_NAME", "jaz")
user = os.environ.get("DB_USER", "jaz")
pw = os.environ.get("DB_PASSWORD", "")
for i in range(60):
    try:
        psycopg.connect(host=host, port=port, dbname=name, user=user, password=pw, connect_timeout=3).close()
        print("    database is ready")
        break
    except Exception as e:
        time.sleep(2)
else:
    raise SystemExit("Database not reachable after 120s")
PY

echo "==> Applying migrations"
python manage.py migrate --noinput

echo "==> Seeding catalog + users (idempotent)"
python manage.py seed || true

echo "==> Collecting static files"
python manage.py collectstatic --noinput

echo "==> Starting Gunicorn"
exec gunicorn brio.wsgi:application --bind 0.0.0.0:8000 --workers 3 --timeout 120
