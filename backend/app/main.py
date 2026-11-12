"""COW PRO FastAPI Application Entrypoint."""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth.router import router as auth_router
from .config import get_settings
from .db.database import Base, SessionLocal, engine
from .db.seed import seed_initial_data
from .membranes.router import router as membranes_router
from .projects.router import router as projects_router
from .reports.router import router as reports_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


def create_app() -> FastAPI:
    settings = get_settings()
    app = FastAPI(
        title=settings.app_name,
        version=settings.app_version,
        description="Dairy Reverse Osmosis (RO) & Nanofiltration (NF) Membrane Engineering Design Platform",
        lifespan=lifespan,
    )

    origins = settings.cors_origins_list
    app.add_middleware(
        CORSMiddleware,
        allow_origins=origins,
        allow_origin_regex=settings.cors_origin_regex,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(auth_router)
    app.include_router(membranes_router)
    app.include_router(projects_router)
    app.include_router(reports_router)

    @app.get("/api/health")
    def health():
        return {"status": "ok", "service": settings.app_name, "version": settings.app_version}

    return app


app = create_app()
