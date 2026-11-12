"""COW PRO Backend Configuration."""

from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    app_name: str = "COW PRO Engineering API"
    app_version: str = "1.0.0"
    environment: str = "development"

    # Database: defaults to local SQLite; override with PostgreSQL / Supabase DATABASE_URL in production
    database_url: str = f"sqlite:///{BASE_DIR / 'cowpro.db'}"

    # Authentication
    jwt_secret_key: str = "cowpro-dev-secret-change-in-production-min-32-chars"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24  # 24 hours
    remember_token_expire_minutes: int = 60 * 24 * 30  # 30 days

    # Optional Supabase JWT validation (if frontend uses Supabase Auth directly)
    supabase_url: str | None = None
    supabase_jwt_secret: str | None = None

    # CORS (comma-separated origins; bare Render hostnames auto-prepend https://)
    cors_origins: str = "http://localhost:3000,http://127.0.0.1:3000"
    cors_origin_regex: str | None = r"https://.*\.onrender\.com"

    # When no outbound SMTP mailer is attached, expose verification/reset tokens cleanly in API payload
    expose_dev_tokens: bool = True

    # Reports output directory
    reports_dir: Path = BASE_DIR / "generated_reports"

    @property
    def cors_origins_list(self) -> list[str]:
        origins: list[str] = []
        for raw in self.cors_origins.split(","):
            item = raw.strip().rstrip("/")
            if not item:
                continue
            if not item.startswith(("http://", "https://")):
                item = f"https://{item}"
            origins.append(item)
        return origins

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.reports_dir.mkdir(parents=True, exist_ok=True)
    return settings
