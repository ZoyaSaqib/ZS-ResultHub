
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "ResultHub Pakistan"
    environment: str = "development"

    database_url: str = "sqlite:///./resulthub.db"

    secret_key: str = "CHANGE_THIS_SECRET_KEY"
    access_token_minutes: int = 60

    frontend_origin: str = "http://127.0.0.1:8000"

    cookie_secure: bool = False

    model_config = SettingsConfigDict(
        env_file=".env",
        extra="ignore"
    )


settings = Settings()
