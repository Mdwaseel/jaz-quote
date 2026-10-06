# =====================================================================
#  JAZ Home Theatres Quotation — one-command launcher (Windows PowerShell)
#  Sets up backend + frontend on first run, then starts BOTH servers.
#     Backend  -> http://127.0.0.1:8080
#     Frontend -> http://localhost:3000
#  Usage:  ./start.ps1        (from the project root)
# =====================================================================
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

function Info($m) { Write-Host "==> $m" -ForegroundColor Cyan }

# ---------------------------------------------------------------- backend
Info "Preparing Django backend..."
Push-Location backend

if (-not (Test-Path ".venv")) {
    Info "Creating virtual environment..."
    python -m venv .venv
}
$py = ".\.venv\Scripts\python.exe"

# Install dependencies: try PyPI, fall back to the bundled offline wheelhouse.
$djangoInstalled = & $py -c "import django" 2>$null; $ok = $?
if (-not $ok) {
    Info "Installing Python dependencies..."
    try {
        & $py -m pip install -q -r requirements.txt
        if (-not $?) { throw "pip failed" }
    } catch {
        Info "PyPI unreachable - using local wheelhouse (pure-Django, no DRF needed)."
        & $py -m pip install --no-index --no-deps --find-links wheelhouse django asgiref sqlparse
    }
}

Info "Applying migrations + seed data..."
& $py manage.py migrate --noinput
& $py manage.py seed
Pop-Location

# ---------------------------------------------------------------- frontend
Info "Preparing React frontend..."
Push-Location frontend
# Reinstall if node_modules is missing OR a prior install left it incomplete
# (the vite binary is the thing `npm run dev` needs).
if (-not (Test-Path "node_modules\.bin\vite.cmd")) {
    Info "Installing frontend packages (npm install)..."
    npm install
    if (-not $?) { throw "frontend npm install failed" }
}
Pop-Location

# root deps (concurrently) — needed for the combined `npm start`
if (-not (Test-Path "node_modules\.bin\concurrently.cmd")) {
    Info "Installing launcher (concurrently)..."
    npm install
    if (-not $?) { throw "root npm install failed" }
}

# ---------------------------------------------------------------- run both
Info "Starting BOTH servers.  Backend :8080  |  Frontend :3000"
Info "Press Ctrl+C once to stop both."
npm start
