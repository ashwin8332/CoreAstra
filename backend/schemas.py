"""
CoreAstra API Schemas
AI-Powered Terminal & Intelligent Control Interface

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved. Unauthorized usage or distribution is prohibited.
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum


class RiskLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


class AIEngine(str, Enum):
    GEMINI = "gemini"
    GROQ = "groq"
    CLAUDE = "claude"
    OLLAMA = "ollama"
    OPENAI = "openai"


# Terminal Schemas
class CommandRequest(BaseModel):
    command: str = Field(..., description="The command to execute")
    confirmed: bool = Field(False, description="Whether user confirmed risky command")
    create_backup: bool = Field(True, description="Create backup before execution")
    cwd: Optional[str] = Field(None, description="Working directory for command")


class CommandAnalysis(BaseModel):
    command: str
    is_risky: bool
    risk_level: str
    reason: str
    affected_paths: List[str]
    requires_confirmation: bool
    backup_recommended: bool


class CommandResult(BaseModel):
    command: str
    exit_code: int
    success: bool
    stdout: str
    stderr: str
    backups: List[Dict[str, str]] = []


class DirectoryChangeRequest(BaseModel):
    path: str


# AI Chat Schemas
class ChatMessage(BaseModel):
    role: str = Field(..., description="Message role: user, assistant, system")
    content: str = Field(..., description="Message content")


class ChatRequest(BaseModel):
    messages: List[ChatMessage]
    engine: Optional[AIEngine] = Field(None, description="AI engine to use")
    stream: bool = Field(True, description="Stream response")
    session_id: Optional[str] = Field(None, description="Session ID for conversation tracking")


class ChatResponse(BaseModel):
    content: str
    engine: str
    session_id: Optional[str]


# Task Planning Schemas
class TaskStep(BaseModel):
    order: int
    description: str
    command: Optional[str]
    is_risky: bool = False
    completed: bool = False


class TaskPlanRequest(BaseModel):
    objective: str = Field(..., description="What you want to accomplish")
    engine: Optional[AIEngine] = None


class TaskPlanResponse(BaseModel):
    id: int
    title: str
    description: str
    steps: List[TaskStep]
    status: str
    ai_engine: str
    created_at: datetime


# Backup Schemas
class BackupInfo(BaseModel):
    name: str
    path: str
    size: int
    created: str
    is_directory: bool


class RestoreRequest(BaseModel):
    backup_path: str
    original_path: str


# Audit Schemas
class AuditEntry(BaseModel):
    id: int
    action_type: str
    action_details: Dict[str, Any]
    risk_level: Optional[str]
    status: str
    created_at: datetime
    executed_at: Optional[datetime]


# System Schemas
class SystemInfo(BaseModel):
    platform: str
    python_version: str
    cpu_count: int
    cpu_percent: float
    memory: Dict[str, Any]
    disk: Dict[str, Any]
    current_directory: str


class EngineStatus(BaseModel):
    name: str
    is_available: bool
    reason: Optional[str] = None


class AvailableEngines(BaseModel):
    engines: List[EngineStatus]
    default: Optional[str]


class AIEngineConfigRequest(BaseModel):
    engine: AIEngine
    api_key: Optional[str] = None
    model_name: Optional[str] = None


class AIEngineConfigResponse(BaseModel):
    engine: str
    has_api_key: bool
    model_name: Optional[str]
    is_available: bool
    default_engine: Optional[str]
    reason: Optional[str] = None
