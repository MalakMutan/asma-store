from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./dev.db"
    secret_key: str = "dev-secret"
    admin_email: str = "admin@example.com"
    admin_password: str = "admin12345"
    frontend_url: str = "http://localhost:5173"
    currency: str = "ILS"  # شيكل
    cloudinary_cloud_name: str = ""
    cloudinary_api_key: str = ""
    cloudinary_api_secret: str = ""

    @property
    def sqlalchemy_url(self) -> str:
        """Neon/Render give postgres:// or postgresql:// — we use the psycopg3 driver."""
        url = self.database_url
        if url.startswith("postgres://"):
            url = url.replace("postgres://", "postgresql+psycopg://", 1)
        elif url.startswith("postgresql://"):
            url = url.replace("postgresql://", "postgresql+psycopg://", 1)
        return url


settings = Settings()
