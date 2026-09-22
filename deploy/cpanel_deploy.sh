#!/bin/bash
# Deploy the app into the cPanel Python App root.
#
# Invoked by .cpanel.yml from the repository cPanel cloned into ~/repositories/.
# Safe to re-run, and safe to run by hand from the cPanel Terminal:
#
#   bash ~/repositories/employee-dashboard/deploy/cpanel_deploy.sh
#
# It never touches $APPROOT/.env, which holds the production secrets and is not
# in the repository.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APPROOT="${APPROOT:-$HOME/employee-dashboard}"
VENV_GLOB="${VENV_GLOB:-$HOME/virtualenv/employee-dashboard}"

say() { printf '\n==> %s\n' "$1"; }

say "Deploying $REPO_DIR -> $APPROOT"
mkdir -p "$APPROOT" "$APPROOT/tmp" "$APPROOT/frontend"

say "Copying Django code"
# No --delete: $APPROOT also holds .env, staticfiles/ and frontend/.
if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude '__pycache__' --exclude '*.pyc' "$REPO_DIR/server/" "$APPROOT/"
else
    cp -Rf "$REPO_DIR/server/." "$APPROOT/"
fi

say "Building the frontend"
if command -v npm >/dev/null 2>&1; then
    ( cd "$REPO_DIR/client" && npm ci --no-audit --no-fund && npm run build )
    cp -Rf "$REPO_DIR/client/dist/." "$APPROOT/frontend/"
elif [ -d "$REPO_DIR/client/dist" ]; then
    echo "npm not found; using the client/dist committed to the repo."
    cp -Rf "$REPO_DIR/client/dist/." "$APPROOT/frontend/"
elif [ -f "$APPROOT/frontend/index.html" ]; then
    echo "WARNING: npm not found and no client/dist in the repo."
    echo "Keeping the frontend already deployed at $APPROOT/frontend."
else
    echo "ERROR: no way to produce a frontend build." >&2
    echo "Install Node on the host, or build locally and upload client/dist" >&2
    echo "to $APPROOT/frontend/." >&2
    exit 1
fi

# cPanel creates the virtualenv under ~/virtualenv/<app root>/<python version>/.
ACTIVATE="$(ls -1 "$VENV_GLOB"/*/bin/activate 2>/dev/null | head -n 1 || true)"
if [ -z "$ACTIVATE" ]; then
    echo "ERROR: no virtualenv found under $VENV_GLOB." >&2
    echo "Create the app in cPanel > Setup Python App first." >&2
    exit 1
fi

say "Using virtualenv $ACTIVATE"
# shellcheck disable=SC1090
source "$ACTIVATE"

say "Installing Python dependencies"
pip install --upgrade pip
pip install -r "$APPROOT/requirements.txt"

if [ ! -f "$APPROOT/.env" ]; then
    echo "ERROR: $APPROOT/.env is missing. Create it before deploying." >&2
    exit 1
fi

say "Applying migrations"
python "$APPROOT/manage.py" migrate --noinput

say "Collecting Django admin static files"
python "$APPROOT/manage.py" collectstatic --noinput

say "Checking deployment settings"
python "$APPROOT/manage.py" check --deploy || true

say "Restarting the Passenger app"
touch "$APPROOT/tmp/restart.txt"

say "Done."
