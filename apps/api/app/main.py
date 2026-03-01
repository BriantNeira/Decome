from fastapi import Depends, FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.routers import auth, branding, health, users
from app.services import branding_service

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/docs",
    redoc_url="/redoc",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(health.router)
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(branding.router)


@app.get("/favicon.ico", include_in_schema=False)
async def favicon(db: AsyncSession = Depends(get_db)):
    """Serve the active favicon at the conventional browser path."""
    config = await branding_service.get_branding(db)
    favicon_url = config.get("favicon_url")
    if not favicon_url:
        raise HTTPException(status_code=404, detail="No favicon configured.")
    filename = favicon_url.split("/")[-1]
    path = await branding_service.get_asset_path(filename)
    return FileResponse(path)


@app.get("/")
async def root():
    return {"message": f"{settings.app_name} API", "version": settings.app_version, "docs": "/docs"}
