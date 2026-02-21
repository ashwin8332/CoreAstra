"""
CoreAstra Database Models
AI-Powered Terminal & Intelligent Control Interface

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved. Unauthorized usage or distribution is prohibited.
"""

from sqlalchemy import Column, Integer, String, Text, DateTime, Boolean, JSON, ForeignKey
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import relationship
from datetime import datetime

Base = declarative_base()


class CommandLog(Base):
    """Log of all executed commands."""
    __tablename__ = "command_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    command = Column(Text, nullable=False)
    output = Column(Text)
    exit_code = Column(Integer)
    executed_at = Column(DateTime, default=datetime.utcnow)
    user_confirmed = Column(Boolean, default=False)
    is_risky = Column(Boolean, default=False)
    backup_id = Column(Integer, ForeignKey("backups.id"), nullable=True)
    
    backup = relationship("Backup", back_populates="commands")


class AIConversation(Base):
    """AI chat conversation history."""
    __tablename__ = "ai_conversations"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(String(64), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user, assistant, system
    content = Column(Text, nullable=False)
    ai_engine = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    conversation_metadata = Column(JSON, nullable=True)


class Backup(Base):
    """Backup records for critical operations."""
    __tablename__ = "backups"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    backup_path = Column(String(500), nullable=False)
    original_path = Column(String(500), nullable=False)
    backup_type = Column(String(50))  # file, directory, registry, etc.
    size_bytes = Column(Integer)
    created_at = Column(DateTime, default=datetime.utcnow)
    description = Column(Text)
    is_restored = Column(Boolean, default=False)
    
    commands = relationship("CommandLog", back_populates="backup")


class AuditLog(Base):
    """Complete audit trail of all actions."""
    __tablename__ = "audit_logs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    action_type = Column(String(100), nullable=False)
    action_details = Column(JSON, nullable=False)
    risk_level = Column(String(20))  # low, medium, high, critical
    status = Column(String(20))  # pending, approved, executed, failed, cancelled
    created_at = Column(DateTime, default=datetime.utcnow)
    executed_at = Column(DateTime, nullable=True)
    user_ip = Column(String(50))


class TaskPlan(Base):
    """AI-generated task plans."""
    __tablename__ = "task_plans"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(200), nullable=False)
    description = Column(Text)
    steps = Column(JSON)  # List of steps with commands
    status = Column(String(20), default="pending")  # pending, in_progress, completed, failed
    ai_engine = Column(String(50))
    created_at = Column(DateTime, default=datetime.utcnow)
    completed_at = Column(DateTime, nullable=True)


class AIModelConfig(Base):
    """Persistent storage for AI model configurations and API keys."""
    __tablename__ = "ai_model_configs"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    engine_name = Column(String(50), unique=True, nullable=False, index=True)  # gemini, groq, claude, ollama, openai, etc.
    api_key = Column(String(500), nullable=True)  # Encrypted in production
    model_name = Column(String(200), nullable=True)
    base_url = Column(String(500), nullable=True)  # For custom endpoints
    is_enabled = Column(Boolean, default=True)
    is_custom = Column(Boolean, default=False)  # User-added custom model
    settings = Column(JSON, nullable=True)  # temperature, max_tokens, etc.
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SystemSettings(Base):
    """Global system settings and preferences."""
    __tablename__ = "system_settings"
    
    id = Column(Integer, primary_key=True, autoincrement=True)
    setting_key = Column(String(100), unique=True, nullable=False, index=True)
    setting_value = Column(JSON, nullable=False)
    setting_type = Column(String(50), nullable=False)  # ai, terminal, security, general
    description = Column(Text, nullable=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
