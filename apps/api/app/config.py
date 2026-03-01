from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database
    database_url: str = "postgresql+asyncpg://decome:decome_dev_pass@db:5432/decome"

    # Redis
    redis_url: str = "redis://redis:6379/0"

    # Security
    secret_key: str = "dev-secret-key-change-in-production-must-be-32chars"
    jwt_algorithm: str = "HS256"
    jwt_expiry_minutes: int = 60
    jwt_2fa_temp_expiry_minutes: int = 5
    jwt_reset_expiry_minutes: int = 60

    # CORS
    cors_origins: str = "http://localhost:3000"

    # File storage
    upload_dir: str = "/app/uploads"
    max_logo_size_bytes: int = 2 * 1024 * 1024   # 2 MB
    max_favicon_size_bytes: int = 512 * 1024       # 500 KB

    # App
    environment: str = "development"
    app_name: str = "DecoMe"
    app_version: str = "1.0.0"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]


settings = Settings()
