#!/bin/bash
# Production deploy for the JAZ quotation site (Docker stack "jazquote" in /opt/jaz).
#
# Installed on the VPS as /opt/jaz-deploy/deploy.sh and bound to the CI deploy key
# via a forced command in /root/.ssh/authorized_keys, so that key can run nothing else.
# Invoked by GitHub Actions as:
#     git archive --format=tar.gz HEAD | ssh root@VPS <commit-sha>
# (the sha arrives in SSH_ORIGINAL_COMMAND, the code tarball on stdin).
#
# Steps: validate → back up DB → build new images (old containers keep serving)
#        → swap code → restart → health check → auto-rollback on failure.
set -euo pipefail

APP=/opt/jaz                        # live code (compose project "jazquote")
HOME_DIR=/opt/jaz-deploy            # this script, logs, previous releases
BACKUPS=/opt/jaz-backups            # database dumps
KEEP_RELEASES=3
KEEP_DB_BACKUPS=14
HEALTH_URL=http://127.0.0.1:${WEB_PORT:-8086}

TS=$(date +%Y%m%d-%H%M%S)
mkdir -p "$HOME_DIR/logs" "$HOME_DIR/releases" "$BACKUPS"
LOG="$HOME_DIR/logs/deploy-$TS.log"
exec > >(tee -a "$LOG") 2>&1

# One deploy at a time.
exec 9>/var/lock/jazquote-deploy.lock
flock -w 900 9 || { echo "!! another deploy is still running"; exit 1; }

SHA="${SSH_ORIGINAL_COMMAND:-${1:-manual}}"
[[ "$SHA" =~ ^([0-9a-f]{7,40}|manual)$ ]] || { echo "!! invalid commit id: $SHA"; exit 2; }
echo "==> Deploying $SHA at $TS"

STAGE=$(mktemp -d /opt/jaz-stage.XXXXXX)
trap 'rm -rf "$STAGE"' EXIT

# ---------------------------------------------------------------- receive + validate
head -c 200000000 > "$STAGE/code.tar.gz"          # 200 MB cap
tar -tzf "$STAGE/code.tar.gz" >/dev/null || { echo "!! upload is not a valid tar.gz"; exit 3; }
mkdir "$STAGE/src"
tar -xzf "$STAGE/code.tar.gz" -C "$STAGE/src"
for f in docker-compose.yml backend/manage.py backend/Dockerfile frontend/Dockerfile; do
  [ -f "$STAGE/src/$f" ] || { echo "!! missing $f in upload"; exit 3; }
done
# Server-only secrets are never in git — carry them over from the live release.
cp -p "$APP/.env" "$STAGE/src/.env"
cp -p "$APP/backend/.env" "$STAGE/src/backend/.env"
# Belt and braces: shell scripts must be LF inside Linux containers.
find "$STAGE/src" -name '*.sh' -exec sed -i 's/\r$//' {} +
echo "$SHA" > "$STAGE/src/.deployed_commit"

# ---------------------------------------------------------------- back up database
set -a; . "$APP/.env"; set +a
docker exec jazquote-db-1 pg_dump -U "$DB_USER" -d "$DB_NAME" | gzip > "$BACKUPS/jazquote-db-$TS.sql.gz"
echo "==> DB backup: $BACKUPS/jazquote-db-$TS.sql.gz ($(du -h "$BACKUPS/jazquote-db-$TS.sql.gz" | cut -f1))"

# ---------------------------------------------------------------- build (site stays up)
for svc in backend web; do
  docker image inspect "jazquote-$svc:latest" >/dev/null 2>&1 && docker tag "jazquote-$svc:latest" "jazquote-$svc:rollback"
done
echo "==> Building images"
(cd "$STAGE/src" && docker compose build --pull 2>&1 | tail -5)

# ---------------------------------------------------------------- swap + restart
PREV="$HOME_DIR/releases/$TS-prev"
mv "$APP" "$PREV"
mv "$STAGE/src" "$APP"
echo "==> Restarting containers"
(cd "$APP" && docker compose up -d --remove-orphans 2>&1 | tail -4)

healthy() {
  local site api
  site=$(curl -s -o /dev/null -w '%{http_code}' "$HEALTH_URL/")
  api=$(curl -s -o /dev/null -w '%{http_code}' -X POST "$HEALTH_URL/api/quote/rules")
  [ "$site" = 200 ] && [ "$api" = 401 ]   # 401 = API up and enforcing auth
}

echo "==> Health check"
for i in $(seq 1 45); do
  if healthy; then
    echo "==> Healthy after ~$((i * 2))s"
    # Prune old releases and backups.
    ls -1dt "$HOME_DIR"/releases/*-prev 2>/dev/null | tail -n +$((KEEP_RELEASES + 1)) | xargs -r rm -rf
    ls -1t "$BACKUPS"/jazquote-db-*.sql.gz 2>/dev/null | tail -n +$((KEEP_DB_BACKUPS + 1)) | xargs -r rm -f
    ls -1t "$HOME_DIR"/logs/deploy-*.log 2>/dev/null | tail -n +31 | xargs -r rm -f
    docker image prune -f >/dev/null 2>&1 || true
    echo "==> DEPLOYED $SHA"
    exit 0
  fi
  sleep 2
done

# ---------------------------------------------------------------- rollback
echo "!! Health check failed — rolling back"
docker logs --tail 40 jazquote-backend-1 2>&1 | sed 's/^/   backend| /' || true
mv "$APP" "$HOME_DIR/releases/$TS-failed"
mv "$PREV" "$APP"
for svc in backend web; do
  docker image inspect "jazquote-$svc:rollback" >/dev/null 2>&1 && docker tag "jazquote-$svc:rollback" "jazquote-$svc:latest"
done
(cd "$APP" && docker compose up -d --no-build --force-recreate 2>&1 | tail -4)
sleep 15
healthy && echo "!! Rolled back to the previous release (site is up). New migrations, if any, remain applied; DB backup: $BACKUPS/jazquote-db-$TS.sql.gz" \
        || echo "!! ROLLBACK ALSO UNHEALTHY — manual attention needed"
exit 1
