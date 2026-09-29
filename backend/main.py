"""FastAPI application entrypoint for Vercel deployment."""
import sys
import traceback
from pathlib import Path

# Ensure backend root is on sys.path
backend_dir = Path(__file__).resolve().parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

try:
    from app.main import app
except Exception as e:
    err_tb = traceback.format_exc()
    print("FATAL STARTUP ERROR:", err_tb)
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    app = FastAPI(title="PRAHAR Startup Error Diagnostic")

    @app.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "HEAD", "PATCH"])
    async def catch_all(path: str):
        return JSONResponse(
            status_code=500,
            content={
                "error": "STARTUP_IMPORT_ERROR",
                "details": str(e),
                "traceback": err_tb.splitlines()
            }
        )

__all__ = ["app"]
