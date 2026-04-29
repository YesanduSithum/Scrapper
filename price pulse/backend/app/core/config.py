from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Price Pulse API"
    environment: str = "development"
    port: int = 5000
    database_url: str
    jwt_secret: str = "your-secret-key"
    jwt_expires_in: str = "7d"
    frontend_url: str = "http://localhost:5173"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


settings = Settings()
