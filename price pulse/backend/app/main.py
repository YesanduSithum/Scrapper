from datetime import datetime, timezone

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.db.session import SessionLocal
from app.routers import auth, categories, products, purchases, retailers
from app.utils.responses import error_response


app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.frontend_url],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(HTTPException)
async def http_exception_handler(_: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content=error_response(str(exc.detail)))


@app.exception_handler(RequestValidationError)
async def validation_exception_handler(_: Request, exc: RequestValidationError):
    first_error = exc.errors()[0]["msg"] if exc.errors() else "Validation error"
    return JSONResponse(status_code=400, content=error_response(first_error))


@app.exception_handler(Exception)
async def unhandled_exception_handler(_: Request, __: Exception):
    return JSONResponse(status_code=500, content=error_response("Internal server error"))


@app.get("/api/health")
def health_check():
    return {
        "status": "ok",
        "message": "Backend is running",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.on_event("startup")
def check_database_connection():
    db = SessionLocal()
    try:
        db.execute(text("SELECT 1"))
        print("✅ Database connected successfully")
    finally:
        db.close()


app.include_router(auth.router, prefix="/api")
app.include_router(products.router, prefix="/api")
app.include_router(purchases.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(retailers.router, prefix="/api")
