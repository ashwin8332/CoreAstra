"""
CoreAstra Configuration
AI-Powered Terminal & Intelligent Control Interface

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved. Unauthorized usage or distribution is prohibited.
"""

import os
from pydantic_settings import BaseSettings
from pydantic import Field
from typing import Optional
from pathlib import Path


class Settings(BaseSettings):
    """Application settings with environment variable support."""
    
    # Application
    APP_NAME: str = "CoreAstra"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    
    # Server
    HOST: str = "127.0.0.1"
    PORT: int = 8000
    
    # Security
    SECRET_KEY: str = "coreastra-secret-key-change-in-production"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    
    # AI Engine API Keys - explicitly read from environment
    GEMINI_API_KEY: Optional[str] = Field(default=None, validation_alias="GEMINI_API_KEY")
    GEMINI_MODEL_NAME: Optional[str] = Field(default=None, validation_alias="GEMINI_MODEL_NAME")
    GROQ_API_KEY: Optional[str] = Field(default=None, validation_alias="GROQ_API_KEY")
    GROQ_MODEL_NAME: str = Field(default="llama-3.3-70b-versatile", validation_alias="GROQ_MODEL_NAME")
    ANTHROPIC_API_KEY: Optional[str] = Field(default=None, validation_alias="ANTHROPIC_API_KEY")
    CLAUDE_MODEL_NAME: str = Field(default="claude-3-haiku-20240307", validation_alias="CLAUDE_MODEL_NAME")
    OPENAI_API_KEY: Optional[str] = Field(default=None, validation_alias="OPENAI_API_KEY")
    OPENAI_MODEL_NAME: str = Field(default="gpt-3.5-turbo", validation_alias="OPENAI_MODEL_NAME")
    OLLAMA_HOST: str = "http://localhost:11434"
    OLLAMA_DEFAULT_MODEL: Optional[str] = Field(default=None, validation_alias="OLLAMA_DEFAULT_MODEL")
    
    # Default AI Engine
    DEFAULT_AI_ENGINE: str = "ollama"  # ollama, gemini, groq, claude
    
    # Paths
    BASE_DIR: Path = Path(__file__).parent
    BACKUP_DIR: Path = BASE_DIR / "backups"
    LOGS_DIR: Path = BASE_DIR / "logs"
    DATABASE_URL: str = "sqlite+aiosqlite:///./coreastra.db"
    
    # Safety Settings
    REQUIRE_CONFIRMATION_FOR_RISKY: bool = True
    AUTO_BACKUP_ENABLED: bool = True
    MAX_BACKUP_SIZE_MB: int = 100
    
    # Command Safety
    DANGEROUS_COMMANDS: list = [
        "rm -rf", "del /f /s /q", "format", "fdisk",
        "mkfs", "dd if=", "shutdown", "reboot",
        "chmod 777", "chown", "> /dev/", "registry delete",
        "reg delete", "net user", "takeown", "icacls"
    ]
    
    model_config = {
        "env_file": str(Path(__file__).parent / ".env"),
        "env_file_encoding": "utf-8",
        "case_sensitive": False,
    }


settings = Settings()

# Ensure directories exist
settings.BACKUP_DIR.mkdir(parents=True, exist_ok=True)
settings.LOGS_DIR.mkdir(parents=True, exist_ok=True)
