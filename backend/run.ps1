# One-shot dev bootstrap for the Django backend (Windows PowerShell).
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not (Test-Path ".venv")) {
    python -m venv .venv
}
# Install deps. Prefer PyPI; fall back to the offline wheelhouse when no network.
try {
    .\.venv\Scripts\python.exe -m pip install -q -r requirements.txt
} catch {
    Write-Host "PyPI unreachable - installing Django from local wheelhouse (no DRF needed)."
    .\.venv\Scripts\python.exe -m pip install --no-index --no-deps --find-links wheelhouse django asgiref sqlparse
}

.\.venv\Scripts\python.exe manage.py migrate
.\.venv\Scripts\python.exe manage.py seed
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8080
