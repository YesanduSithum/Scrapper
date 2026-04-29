$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$pythonPath = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"

if (!(Test-Path $pythonPath)) {
    Write-Host "[setup] Creating virtual environment..."
    python -m venv .venv
}

Write-Host "[setup] Ensuring dependencies are installed..."
& $pythonPath -m pip install -r requirements.txt | Out-Null

Write-Host "[run] Starting FastAPI on http://localhost:5000"
& $pythonPath -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
