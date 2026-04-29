$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot

$pythonPath = Join-Path $PSScriptRoot ".venv\Scripts\python.exe"
$envPath = Join-Path $PSScriptRoot ".env"

if (!(Test-Path $pythonPath)) {
    Write-Host "[setup] Creating virtual environment..."
    py -3 -m venv .venv
}

if (!(Test-Path $pythonPath)) {
    throw "Python virtual environment was not created correctly. Make sure the Windows Python launcher (py) is installed."
}

if (!(Test-Path $envPath)) {
    throw "Missing backend .env file. Copy .env.example to .env and set DATABASE_URL before starting the server."
}

Write-Host "[setup] Ensuring dependencies are installed..."
& $pythonPath -m pip install -r requirements.txt | Out-Null

Write-Host "[run] Starting FastAPI on http://localhost:5000"
& $pythonPath -m uvicorn app.main:app --host 0.0.0.0 --port 5000 --reload
