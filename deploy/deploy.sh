#!/usr/bin/env bash
# JAZ — build & release helper for the VPS.
# Run from the repo root on the server:  bash deploy/deploy.sh
# Assumes the repo lives at /var/www/jaz and .env is already in backend/.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "==> Backend: virtualenv + dependencies"
cd backend
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt

echo "==> Backend: install Chromium for PDF rendering (once)"
command -v chromium-browser >/dev/null 2>&1 || command -v google-chrome >/dev/null 2>&1 || \
  echo "    ! Install Chromium/Chrome so quote PDFs render: apt-get install -y chromium-browser"

echo "==> Backend: migrate, seed, collect static"
./.venv/bin/python manage.py migrate --noinput
./.venv/bin/python manage.py seed || true
./.venv/bin/python manage.py collectstatic --noinput
cd ..

echo "==> Frontend: build"
cd frontend
npm ci
npm run build
cd ..

echo "==> Restart services"
sudo systemctl restart jaz
sudo systemctl reload nginx || true

echo "==> Done. App is live behind Nginx."
