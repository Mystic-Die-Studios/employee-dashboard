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
# cPanel names the virtualenv after the Application root, so derive it rather
# than hardcoding a name that only matches one possible setup.
VENV_GLOB="${VENV_GLOB:-$HOME/virtualenv/$(basename "$APPROOT")}"

# Timestamped so that a slow step is distinguishable from a stuck one.
say() { printf '\n==> [%s] %s\n' "$(date +%H:%M:%S)" "$1"; }

say "Deploying $REPO_DIR -> $APPROOT"

# Refuse to write application code and secrets into a public document root.
# Passenger normally intercepts every request, but if it ever fails to boot,
# Apache can fall back to serving these as plain files -- including .env.
if [ "${ALLOW_DOCROOT_APPROOT:-0}" != "1" ]; then
    for docroot in "$HOME/public_html" "$HOME"/*.*.*; do
        [ -d "$docroot" ] || continue
        case "$APPROOT/" in
            "$docroot"/*)
                if [ "$APPROOT" = "$docroot" ]; then
                    echo "ERROR: the app root IS the document root ($APPROOT)." >&2
                else
                    echo "ERROR: app root $APPROOT sits inside the document root $docroot." >&2
                fi
                echo "Secrets in .env would be one Passenger failure away from public." >&2
                echo "Recreate the Python App with an Application root outside it," >&2
                echo "such as 'employee-dashboard'." >&2
                echo "To deploy anyway: ALLOW_DOCROOT_APPROOT=1 bash $0" >&2
                exit 1
                ;;
        esac
    done
fi
mkdir -p "$APPROOT" "$APPROOT/tmp" "$APPROOT/frontend"

say "Copying Django code"
# No --delete: $APPROOT also holds .env, staticfiles/ and frontend/.
if command -v rsync >/dev/null 2>&1; then
    rsync -a --exclude '__pycache__' --exclude '*.pyc' "$REPO_DIR/server/" "$APPROOT/"
else
    cp -Rf "$REPO_DIR/server/." "$APPROOT/"
fi

# The build toolchain's floor. Vite 8 refuses to run below this, and on an older
# Node it fails deep inside the CLI rather than with a clean version error.
REQUIRED_NODE="20.19.0"

# Is $1 >= $2, comparing as versions rather than as strings?
version_ge() {
    [ "$(printf '%s\n%s\n' "$2" "$1" | sort -V | head -n1)" = "$2" ]
}

# Every Node bin directory on the box. cPanel keeps them out of the default
# PATH: EasyApache under /opt/cpanel, and "Setup Node.js App" under ~/nodevenv.
node_bin_dirs() {
    local dir
    if command -v npm >/dev/null 2>&1; then
        dirname "$(command -v npm)"
    fi
    for dir in /opt/cpanel/ea-nodejs*/bin "$HOME"/nodevenv/*/*/bin; do
        [ -x "$dir/npm" ] && echo "$dir"
    done
}

# Highest version that actually satisfies REQUIRED_NODE. Ask each node for its
# own version -- the directory name is not reliable, and sorting paths would
# rank ~/nodevenv/standup-bot/18 above ~/nodevenv/other/22.
find_npm_dir() {
    local dir ver best="" best_ver=""
    while read -r dir; do
        [ -n "$dir" ] || continue
        ver="$("$dir/node" -v 2>/dev/null | sed 's/^v//')" || continue
        [ -n "$ver" ] || continue
        version_ge "$ver" "$REQUIRED_NODE" || continue
        if [ -z "$best_ver" ] || version_ge "$ver" "$best_ver"; then
            best="$dir"
            best_ver="$ver"
        fi
    done < <(node_bin_dirs)
    [ -n "$best" ] && echo "$best"
}

report_node_versions() {
    local dir ver
    while read -r dir; do
        [ -n "$dir" ] || continue
        ver="$("$dir/node" -v 2>/dev/null || echo '?')"
        echo "  $ver  $dir" >&2
    done < <(node_bin_dirs)
}

NPM_DIR="${NODE_BIN_DIR:-$(find_npm_dir || true)}"
if [ -n "$NPM_DIR" ] && [ -x "$NPM_DIR/npm" ]; then
    export PATH="$NPM_DIR:$PATH"
elif [ -n "$(node_bin_dirs)" ]; then
    echo "ERROR: Node $REQUIRED_NODE or newer is required to build the frontend." >&2
    echo "Found only:" >&2
    report_node_versions
    echo "" >&2
    echo "In cPanel > Setup Node.js App, create an application with Node 20 or 22" >&2
    echo "(any app root -- it exists purely to install the runtime), then re-run." >&2
    echo "Alternatively build locally and upload client/dist to $APPROOT/frontend/." >&2
    exit 1
fi

say "Building the frontend"
if command -v npm >/dev/null 2>&1; then
    echo "Using npm $(npm -v) from $(dirname "$(command -v npm)")"
    # Cypress pulls a ~200 MB binary from a postinstall hook. The server never
    # runs the E2E suite, and on a shared host that download is the single most
    # common reason this step appears to hang.
    export CYPRESS_INSTALL_BINARY=0
    # Keep npm from stalling on a TTY-less terminal waiting to render progress.
    export npm_config_progress=false
    ( cd "$REPO_DIR/client" && npm ci --no-audit --no-fund --loglevel=http && npm run build )
    cp -Rf "$REPO_DIR/client/dist/." "$APPROOT/frontend/"
elif [ -d "$REPO_DIR/client/dist" ]; then
    echo "npm not found; using the client/dist committed to the repo."
    cp -Rf "$REPO_DIR/client/dist/." "$APPROOT/frontend/"
elif [ -f "$APPROOT/frontend/index.html" ]; then
    echo "WARNING: npm not found and no client/dist in the repo."
    echo "Keeping the frontend already deployed at $APPROOT/frontend."
else
    echo "ERROR: no way to produce a frontend build." >&2
    echo "npm was not found on PATH, under /opt/cpanel/ea-nodejs*/bin, or in" >&2
    echo "$HOME/nodevenv/*/*/bin. Options:" >&2
    echo "  - point at it directly: NODE_BIN_DIR=/path/to/bin bash $0" >&2
    echo "  - create any app in cPanel > Setup Node.js App to install Node" >&2
    echo "  - build locally (npm run build in client/) and upload client/dist" >&2
    echo "    to $APPROOT/frontend/" >&2
    exit 1
fi

# cPanel creates the virtualenv under ~/virtualenv/<app root>/<python version>/.
ACTIVATE="$(ls -1 "$VENV_GLOB"/*/bin/activate 2>/dev/null | head -n 1 || true)"
if [ -z "$ACTIVATE" ]; then
    echo "ERROR: no virtualenv found under $VENV_GLOB." >&2
    echo "cPanel names it after the Application root, so this usually means the" >&2
    echo "Python App root and APPROOT ($APPROOT) disagree." >&2
    echo "Virtualenvs that do exist:" >&2
    ls -1d "$HOME"/virtualenv/*/ 2>/dev/null >&2 || echo "  (none)" >&2
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
