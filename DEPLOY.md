# Deploying JAZ Home Theatres Quotations to a VPS (Ubuntu + PostgreSQL + Nginx)

Stack: **Django/Gunicorn** (API) · **PostgreSQL** (database) · **React/Vite** (frontend, static build) · **Nginx** (reverse proxy + static) · **Chromium** (quote PDFs).

Assumed layout on the server: `/var/www/jaz` (the repo root).

---

## 1. Server packages

```bash
sudo apt-get update
sudo apt-get install -y python3 python3-venv python3-pip \
    postgresql nginx chromium-browser git curl
# Node 20 (for the frontend build)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs
```

## 2. Database

```bash
sudo -u postgres psql <<'SQL'
CREATE DATABASE jaz;
CREATE USER jaz WITH PASSWORD 'change-this-strong-password';
ALTER ROLE jaz SET client_encoding TO 'utf8';
ALTER ROLE jaz SET default_transaction_isolation TO 'read committed';
GRANT ALL PRIVILEGES ON DATABASE jaz TO jaz;
\c jaz
GRANT ALL ON SCHEMA public TO jaz;
SQL
```

## 3. Get the code + configure env

```bash
sudo mkdir -p /var/www && sudo chown -R $USER:www-data /var/www
git clone <your-repo> /var/www/jaz       # or scp the folder up
cd /var/www/jaz/backend
cp .env.example .env
```

Edit `backend/.env`:
- Set a **fresh** `SECRET_KEY` and `FERNET_KEY` (commands are in the file's comments).
- Set `DEBUG=false`, your real `ALLOWED_HOSTS` / `CSRF_TRUSTED_ORIGINS`.
- Set `DB_ENGINE=postgres` and the `DB_*` values from step 2.

> The `FERNET_KEY` encrypts the login tokens. Keep it secret and **do not rotate it
> without logging everyone out** (existing tokens become undecryptable, which is fine —
> users just log in again).

## 4. Build & release

A one-shot helper does the venv, deps, migrate, seed, static, frontend build and restart:

```bash
cd /var/www/jaz
bash deploy/deploy.sh
```

(Or run those steps manually — see the script.) The `seed` command creates the two
logins below on first run.

## 5. Services

```bash
# Gunicorn (Django) as a service
sudo cp deploy/jaz.service /etc/systemd/system/jaz.service
sudo systemctl daemon-reload
sudo systemctl enable --now jaz

# Nginx site
sudo cp deploy/nginx.conf /etc/nginx/sites-available/jaz
sudo ln -sf /etc/nginx/sites-available/jaz /etc/nginx/sites-enabled/jaz
sudo nano /etc/nginx/sites-available/jaz     # set server_name + root
sudo nginx -t && sudo systemctl reload nginx
```

## 6. HTTPS

```bash
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## First login (created by `manage.py seed`)

The seed creates one Admin login (it can also create quotations) from `backend/.env`:

| Setting | Meaning |
|---------|---------|
| `SEED_ADMIN_EMAIL` | the admin's email — login OTP codes go here, so use a real mailbox |
| `SEED_ADMIN_PASSWORD` | the first password — **change it after the first sign-in** |

It is created only when no Admin exists yet. Then add the team from **Admin → Users & Hierarchy**.

## Updating a running deployment

```bash
cd /var/www/jaz && git pull && bash deploy/deploy.sh
```

## Security summary

- Passwords are stored **one-way hashed** by Django — Argon2 when `argon2-cffi` is
  installed (it is, via `requirements.txt`), otherwise PBKDF2.
- Issued **JWT access/refresh tokens are encrypted with Fernet** (`FERNET_KEY`) so they
  are opaque ciphertext in transit and in browser storage.
- **Two-step login (email OTP)**: after a correct password the API emails a 6-digit code
  (5-min expiry, single-use, max 5 attempts) and only issues tokens once it is verified.
  Configure the SMTP account via `EMAIL_HOST_USER` / `EMAIL_HOST_PASSWORD` in `.env`
  (a Gmail/Workspace **App Password**). Set `OTP_ENABLED=false` to disable. Codes are
  sent to each user's own email, so every login account must be a reachable mailbox.
- With `DEBUG=false` the app enables HSTS, secure cookies, HTTPS redirect, nosniff and
  `X-Frame-Options: DENY`.

## Troubleshooting

- **PDF fails** → ensure `chromium-browser` is installed and on `PATH` (`which chromium-browser`).
- **502 from Nginx** → `journalctl -u jaz -f` (Gunicorn logs); check `.env` DB settings.
- **Static/admin CSS missing** → re-run `manage.py collectstatic --noinput`.
