"""
CoreAstra Main Application
AI-Powered Terminal & Intelligent Control Interface

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved. Unauthorized usage or distribution is prohibited.
"""

import uuid
from contextlib import asynccontextmanager
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Depends, Body, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse, FileResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
import json
import os

from config import settings
from database import init_db, get_db
from models import CommandLog, AIConversation, Backup, AuditLog, TaskPlan
from schemas import (
    CommandRequest, CommandAnalysis, DirectoryChangeRequest,
    ChatRequest, TaskPlanRequest, RestoreRequest,
    SystemInfo, AvailableEngines, EngineStatus,
    AIEngineConfigRequest, AIEngineConfigResponse, AIEngine,
)
from terminal import terminal_executor, backup_manager
from ai_engines import ai_manager
from file_manager import file_manager
from connection_manager import connection_manager
from logger import logger, audit_log


def update_env_setting(key: str, value: Optional[str]) -> None:
    """Persist configuration overrides to the .env file."""
    env_path = settings.BASE_DIR / ".env"
    if not env_path.exists():
        if value:
            env_path.write_text(f"{key}={value}\n", encoding="utf-8")
        return

    with env_path.open("r", encoding="utf-8") as env_file:
        lines = env_file.readlines()

    new_lines = []
    updated = False
    for line in lines:
        if line.startswith(f"{key}="):
            updated = True
            if value:
                new_lines.append(f"{key}={value}\n")
            continue
        new_lines.append(line if line.endswith("\n") else f"{line}\n")

    if not updated and value:
        if new_lines and not new_lines[-1].endswith("\n"):
            new_lines[-1] = f"{new_lines[-1]}\n"
        new_lines.append(f"{key}={value}\n")

    # Remove trailing empty lines
    while new_lines and new_lines[-1].strip() == "":
        new_lines.pop()

    if value is None and not new_lines:
        env_path.unlink(missing_ok=True)
        return

    with env_path.open("w", encoding="utf-8") as env_file:
        env_file.writelines(new_lines)

ENGINE_API_ENV_KEYS = {
    "gemini": "GEMINI_API_KEY",
    "groq": "GROQ_API_KEY",
    "claude": "ANTHROPIC_API_KEY",
    "openai": "OPENAI_API_KEY",
}

ENGINE_MODEL_ENV_KEYS = {
    "gemini": "GEMINI_MODEL_NAME",
    "groq": "GROQ_MODEL_NAME",
    "claude": "CLAUDE_MODEL_NAME",
    "openai": "OPENAI_MODEL_NAME",
    "ollama": "OLLAMA_DEFAULT_MODEL",
}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan handler."""
    logger.info("Starting CoreAstra...")
    
    # Initialize database
    await init_db()
    logger.info("Database initialized")
    
    # Load AI configs from database and apply to settings
    try:
        from models import AIModelConfig
        from database import async_session_maker
        async with async_session_maker() as db:
            result = await db.execute(select(AIModelConfig).where(AIModelConfig.is_enabled == True))
            configs = result.scalars().all()
            
            for config in configs:
                # Apply to environment/settings
                if config.api_key:
                    env_key = ENGINE_API_ENV_KEYS.get(config.engine_name)
                    if env_key:
                        os.environ[env_key] = config.api_key
                if config.model_name:
                    model_key = ENGINE_MODEL_ENV_KEYS.get(config.engine_name)
                    if model_key:
                        os.environ[model_key] = config.model_name
            
            logger.info(f"Loaded {len(configs)} AI model configurations from database")
    except Exception as e:
        logger.warning(f"Failed to load AI configs from database: {e}")
    
    # Initialize AI engines
    await ai_manager.initialize()
    logger.info("AI engines initialized")
    
    yield
    
    logger.info("Shutting down CoreAstra...")


app = FastAPI(
    title="CoreAstra",
    description="AI-Powered Terminal & Intelligent Control Interface",
    version=settings.APP_VERSION,
    lifespan=lifespan
)

# CORS middleware for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ==================== Terminal Endpoints ====================

@app.post("/api/terminal/analyze")
async def analyze_command(request: CommandRequest) -> CommandAnalysis:
    """Analyze a command for safety before execution."""
    try:
        analysis = await terminal_executor.analyze_command(request.command)
        return CommandAnalysis(**analysis)
    except Exception as e:
        logger.error(f"Command analysis failed: {str(e)}")
        # Return safe fallback analysis
        return CommandAnalysis(
            command=request.command,
            is_risky=False,
            risk_level="unknown",
            reason="Analysis unavailable - AI engine error",
            affected_paths=[],
            requires_confirmation=False,
            backup_recommended=True
        )


@app.post("/api/terminal/execute")
async def execute_command(request: CommandRequest, db: AsyncSession = Depends(get_db)):
    """Execute a command and stream the output."""
    
    async def generate():
        backup_id = None
        
        async for event in terminal_executor.execute(
            request.command,
            user_confirmed=request.confirmed,
            create_backup=request.create_backup,
            cwd=request.cwd
        ):
            yield f"data: {json.dumps(event)}\n\n"
            
            # Save to database on completion
            if event.get("type") == "execution_complete":
                # Create backup record if backups were made
                if event.get("backups"):
                    # This would be saved to DB
                    pass
                
                # Log command
                cmd_log = CommandLog(
                    command=request.command,
                    output=event.get("stdout", "") + event.get("stderr", ""),
                    exit_code=event.get("exit_code"),
                    user_confirmed=request.confirmed,
                    is_risky=False,  # Would be from analysis
                    backup_id=backup_id
                )
                db.add(cmd_log)
                await db.commit()
    
    return StreamingResponse(
        generate(),
        media_type="text/event-stream"
    )


@app.post("/api/terminal/cd")
async def change_directory(request: DirectoryChangeRequest):
    """Change the current working directory."""
    success, result = terminal_executor.change_directory(request.path)
    if not success:
        raise HTTPException(status_code=400, detail=result)
    return {"success": True, "path": result}


@app.get("/api/terminal/pwd")
async def get_current_directory():
    """Get the current working directory."""
    return {"path": terminal_executor.get_current_directory()}


@app.get("/api/system/info")
async def get_system_info() -> SystemInfo:
    """Get system information."""
    info = terminal_executor.get_system_info()
    return SystemInfo(**info)


# ==================== AI Chat Endpoints ====================

@app.get("/api/ai/engines")
async def get_available_engines() -> AvailableEngines:
    """Get available AI engines."""
    engines = []
    for name, engine in ai_manager.engines.items():
        engines.append(
            EngineStatus(
                name=name,
                is_available=engine.is_available,
                reason=None if engine.is_available else engine.unavailable_reason,
            )
        )
    
    return AvailableEngines(
        engines=engines,
        default=ai_manager.default_engine
    )


@app.get("/api/ai/config/{engine_name}", response_model=AIEngineConfigResponse)
async def get_ai_engine_config(engine_name: AIEngine) -> AIEngineConfigResponse:
    """Retrieve configuration details for a specific AI engine."""
    engine_key = engine_name.value
    engine = ai_manager.engines.get(engine_key)
    if not engine:
        raise HTTPException(status_code=404, detail="Unknown AI engine")

    api_key_value = None
    env_api_key = ENGINE_API_ENV_KEYS.get(engine_key)
    if env_api_key:
        api_key_value = getattr(settings, env_api_key, None)

    model_name = getattr(engine, "preferred_model", None) or getattr(engine, "model_name", None)
    if engine_key == "ollama":
        model_name = getattr(engine, "preferred_model", None) or getattr(engine, "model", None)

    return AIEngineConfigResponse(
        engine=engine_key,
        has_api_key=bool(api_key_value),
        model_name=model_name,
        is_available=engine.is_available,
        default_engine=ai_manager.default_engine,
        reason=None if engine.is_available else engine.unavailable_reason,
    )


@app.post("/api/ai/config", response_model=AIEngineConfigResponse)
async def update_ai_engine_config(
    request: AIEngineConfigRequest,
    db: AsyncSession = Depends(get_db)
) -> AIEngineConfigResponse:
    """Update API key or model name for an AI engine and reinitialize it."""
    from models import AIModelConfig
    from datetime import datetime
    
    engine_key = request.engine.value
    if engine_key not in ai_manager.engines:
        raise HTTPException(status_code=404, detail="Unknown AI engine")

    api_key_value = request.api_key.strip() if request.api_key else None
    model_name_value = request.model_name.strip() if request.model_name else None

    env_api_key = ENGINE_API_ENV_KEYS.get(engine_key)
    env_model_key = ENGINE_MODEL_ENV_KEYS.get(engine_key)

    try:
        result = await ai_manager.update_engine_config(
            engine_key,
            api_key=api_key_value,
            model_name=model_name_value,
            model_provided=request.model_name is not None,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    # Save to database for persistence
    result_db = await db.execute(
        select(AIModelConfig).where(AIModelConfig.engine_name == engine_key)
    )
    config = result_db.scalar_one_or_none()
    
    if config:
        if api_key_value is not None:
            config.api_key = api_key_value
        if model_name_value is not None:
            config.model_name = model_name_value
        config.is_enabled = True
        config.updated_at = datetime.utcnow()
    else:
        config = AIModelConfig(
            engine_name=engine_key,
            api_key=api_key_value,
            model_name=model_name_value,
            is_enabled=True
        )
        db.add(config)
    
    await db.commit()
    logger.info(f"Saved AI config for {engine_key} to database")

    if request.api_key is not None and env_api_key:
        update_env_setting(env_api_key, api_key_value)

    if request.model_name is not None and env_model_key:
        update_env_setting(env_model_key, model_name_value)

    api_key_present = False
    if env_api_key:
        api_key_present = bool(getattr(settings, env_api_key, None))

    model_name_current = result.get("model_name")
    if engine_key == "ollama" and not model_name_current:
        model_name_current = getattr(ai_manager.engines[engine_key], "model", None)

    return AIEngineConfigResponse(
        engine=result["engine"],
        has_api_key=api_key_present,
        model_name=model_name_current,
        is_available=result["is_available"],
        default_engine=result["default_engine"],
        reason=None if result["is_available"] else result.get("reason"),
    )


@app.post("/api/ai/chat")
async def chat(request: ChatRequest, db: AsyncSession = Depends(get_db)):
    """Chat with AI engine with comprehensive error handling."""
    session_id = request.session_id or str(uuid.uuid4())
    engine_name = request.engine.value if request.engine else None
    
    # Check if AI engine is available
    available_engines = ai_manager.get_available_engines()
    if not available_engines:
        raise HTTPException(
            status_code=503,
            detail="No AI engines available. Please configure at least one AI provider."
        )
    
    # Validate requested engine
    if engine_name and engine_name not in available_engines:
        raise HTTPException(
            status_code=400,
            detail=f"Requested engine '{engine_name}' is not available. Available engines: {', '.join(available_engines)}"
        )
    
    try:
        # Save user message
        user_msg = AIConversation(
            session_id=session_id,
            role="user",
            content=request.messages[-1].content,
            ai_engine=engine_name or ai_manager.default_engine
        )
        db.add(user_msg)
        await db.commit()
        
        messages = [{"role": m.role, "content": m.content} for m in request.messages]
        
        # Add system prompt for CoreAstra context
        system_prompt = {
            "role": "system",
            "content": """You are CoreAstra AI Assistant, an intelligent helper for system operations and terminal commands.
You help users with:
1. Understanding and crafting terminal commands
2. System administration tasks
3. Debugging and troubleshooting
4. Code and script assistance
5. Task planning and automation

Always prioritize safety. Warn users about potentially dangerous operations.
When suggesting commands, explain what they do and any risks involved."""
        }
        messages.insert(0, system_prompt)
        
        async def generate():
            full_response = []
            
            try:
                async for chunk in ai_manager.chat(messages, engine_name, stream=request.stream):
                    full_response.append(chunk)
                    yield f"data: {json.dumps({'content': chunk, 'session_id': session_id})}\n\n"
                
                # Save assistant response
                assistant_msg = AIConversation(
                    session_id=session_id,
                    role="assistant",
                    content="".join(full_response),
                    ai_engine=engine_name or ai_manager.default_engine
                )
                db.add(assistant_msg)
                await db.commit()
                
                yield f"data: {json.dumps({'done': True, 'session_id': session_id})}\n\n"
            except Exception as e:
                logger.error(f"Chat stream error: {str(e)}")
                error_msg = f"Error: {str(e)}"
                yield f"data: {json.dumps({'content': error_msg, 'error': True, 'session_id': session_id})}\n\n"
        
        return StreamingResponse(
            generate(),
            media_type="text/event-stream"
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Chat endpoint error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Chat failed: {str(e)}")


@app.post("/api/ai/analyze-command")
async def ai_analyze_command(request: CommandRequest):
    """Use AI to analyze a command."""
    engine_name = None  # Use default
    analysis = await ai_manager.analyze_command(request.command, engine_name)
    return analysis


@app.get("/api/ai/conversation/{session_id}")
async def get_conversation(session_id: str, db: AsyncSession = Depends(get_db)):
    """Get conversation history by session ID."""
    result = await db.execute(
        select(AIConversation)
        .where(AIConversation.session_id == session_id)
        .order_by(AIConversation.created_at)
    )
    messages = result.scalars().all()
    
    return {
        "session_id": session_id,
        "messages": [
            {
                "role": msg.role,
                "content": msg.content,
                "created_at": msg.created_at.isoformat()
            }
            for msg in messages
        ]
    }


# ==================== Task Planning Endpoints ====================

@app.post("/api/tasks/plan")
async def create_task_plan(request: TaskPlanRequest, db: AsyncSession = Depends(get_db)):
    """Create a task plan using AI with comprehensive error handling."""
    engine_name = request.engine.value if request.engine else None
    
    # Check if AI engine is available
    available_engines = ai_manager.get_available_engines()
    if not available_engines:
        raise HTTPException(
            status_code=503, 
            detail="No AI engines available. Please configure at least one AI provider (Gemini, Groq, Claude, OpenAI, or Ollama)."
        )
    
    # Validate requested engine
    if engine_name and engine_name not in available_engines:
        raise HTTPException(
            status_code=400,
            detail=f"Requested engine '{engine_name}' is not available. Available engines: {', '.join(available_engines)}"
        )
    
    messages = [{
        "role": "system",
        "content": """You are a task planning assistant. Create detailed step-by-step plans for system operations.
For each step, provide:
1. A clear description
2. The exact command to execute (if applicable)
3. Whether the step is risky

Respond in JSON format:
{
    "title": "Plan title",
    "description": "Overall description",
    "steps": [
        {"order": 1, "description": "...", "command": "...", "is_risky": false},
        ...
    ]
}"""
    }, {
        "role": "user",
        "content": f"Create a task plan for: {request.objective}"
    }]
    
    try:
        response_text = ""
        async for chunk in ai_manager.chat(messages, engine_name, stream=False):
            response_text += chunk
        
        if not response_text or response_text.startswith("Error:") or response_text.startswith("No AI engine"):
            raise HTTPException(
                status_code=503,
                detail=f"AI engine failed to generate response: {response_text[:200]}"
            )
        
        # Try to extract JSON from markdown code blocks if present
        import re
        json_match = re.search(r'```(?:json)?\s*(\{.*?\})\s*```', response_text, re.DOTALL)
        if json_match:
            response_text = json_match.group(1)
        
        try:
            import json as json_lib
            plan_data = json_lib.loads(response_text)
        except json.JSONDecodeError as je:
            logger.error(f"Failed to parse AI response as JSON: {response_text[:500]}")
            # Create a basic plan from the objective
            plan_data = {
                "title": request.objective[:100],
                "description": f"AI generated response (parsing failed): {response_text[:200]}",
                "steps": [{
                    "order": 1,
                    "description": "Review AI response and create steps manually",
                    "command": None,
                    "is_risky": False
                }]
            }
        
        task_plan = TaskPlan(
            title=plan_data.get("title", request.objective[:100]),
            description=plan_data.get("description", ""),
            steps=plan_data.get("steps", []),
            ai_engine=engine_name or ai_manager.default_engine
        )
        db.add(task_plan)
        await db.commit()
        await db.refresh(task_plan)
        
        return {
            "id": task_plan.id,
            "title": task_plan.title,
            "description": task_plan.description,
            "steps": task_plan.steps,
            "status": task_plan.status,
            "ai_engine": task_plan.ai_engine,
            "created_at": task_plan.created_at.isoformat()
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Task plan creation failed: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to create task plan: {str(e)}"
        )


@app.get("/api/tasks")
async def get_task_plans(db: AsyncSession = Depends(get_db)):
    """Get all task plans."""
    result = await db.execute(select(TaskPlan).order_by(TaskPlan.created_at.desc()))
    plans = result.scalars().all()
    
    return [
        {
            "id": plan.id,
            "title": plan.title,
            "status": plan.status,
            "created_at": plan.created_at.isoformat()
        }
        for plan in plans
    ]


@app.get("/api/tasks/{task_id}")
async def get_task_plan(task_id: int, db: AsyncSession = Depends(get_db)):
    """Get a specific task plan."""
    result = await db.execute(select(TaskPlan).where(TaskPlan.id == task_id))
    plan = result.scalar_one_or_none()
    
    if not plan:
        raise HTTPException(status_code=404, detail="Task plan not found")
    
    return {
        "id": plan.id,
        "title": plan.title,
        "description": plan.description,
        "steps": plan.steps,
        "status": plan.status,
        "ai_engine": plan.ai_engine,
        "created_at": plan.created_at.isoformat()
    }


# ==================== Backup Endpoints ====================

@app.get("/api/backups")
async def list_backups():
    """List all backups."""
    return backup_manager.list_backups()


@app.post("/api/backups/restore")
async def restore_backup(request: RestoreRequest):
    """Restore a backup."""
    success = await backup_manager.restore_backup(request.backup_path, request.original_path)
    if not success:
        raise HTTPException(status_code=500, detail="Failed to restore backup")
    return {"success": True, "message": "Backup restored successfully"}


# ==================== Audit Log Endpoints ====================

@app.get("/api/audit")
async def get_audit_logs(
    limit: int = 100,
    offset: int = 0,
    db: AsyncSession = Depends(get_db)
):
    """Get audit logs."""
    result = await db.execute(
        select(AuditLog)
        .order_by(AuditLog.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    logs = result.scalars().all()
    
    return [
        {
            "id": log.id,
            "action_type": log.action_type,
            "action_details": log.action_details,
            "risk_level": log.risk_level,
            "status": log.status,
            "created_at": log.created_at.isoformat()
        }
        for log in logs
    ]


@app.get("/api/commands/history")
async def get_command_history(
    limit: int = 50,
    db: AsyncSession = Depends(get_db)
):
    """Get command execution history."""
    result = await db.execute(
        select(CommandLog)
        .order_by(CommandLog.executed_at.desc())
        .limit(limit)
    )
    commands = result.scalars().all()
    
    return [
        {
            "id": cmd.id,
            "command": cmd.command,
            "exit_code": cmd.exit_code,
            "executed_at": cmd.executed_at.isoformat(),
            "is_risky": cmd.is_risky
        }
        for cmd in commands
    ]


# ==================== WebSocket for Real-time Terminal ====================

class ConnectionManager:
    def __init__(self):
        self.active_connections: list[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
    
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)


manager = ConnectionManager()


@app.websocket("/ws/terminal")
async def websocket_terminal(websocket: WebSocket):
    """WebSocket endpoint for real-time terminal interaction."""
    await manager.connect(websocket)
    
    try:
        while True:
            data = await websocket.receive_json()
            
            if data.get("type") == "command":
                command = data.get("command", "")
                confirmed = data.get("confirmed", False)
                
                async for event in terminal_executor.execute(
                    command,
                    user_confirmed=confirmed,
                    create_backup=True
                ):
                    await websocket.send_json(event)
            
            elif data.get("type") == "cd":
                path = data.get("path", "")
                success, result = terminal_executor.change_directory(path)
                await websocket.send_json({
                    "type": "cd_result",
                    "success": success,
                    "path": result
                })
            
            elif data.get("type") == "pwd":
                await websocket.send_json({
                    "type": "pwd_result",
                    "path": terminal_executor.get_current_directory()
                })
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)


# ==================== File Manager Endpoints ====================

@app.get("/api/files/list")
async def list_files(path: Optional[str] = None, show_hidden: bool = False, sort_by: str = "name"):
    """List directory contents."""
    result = await file_manager.list_directory(path, show_hidden, sort_by)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.get("/api/files/read")
async def read_file_content(path: str, encoding: str = "utf-8"):
    """Read file contents."""
    result = await file_manager.read_file(path, encoding)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.get("/api/files/metadata")
async def get_file_metadata(path: str):
    """Get metadata for a file or directory."""
    result = await file_manager.get_metadata(path)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.get("/api/files/preview")
async def preview_file_content(path: str, max_bytes: int = 512 * 1024):
    """Get a lightweight preview of a file."""
    if max_bytes <= 0:
        raise HTTPException(status_code=400, detail="max_bytes must be positive")

    result = await file_manager.preview_file(path, max_bytes)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/files/write")
async def write_file_content(
    path: str = Body(...),
    content: str = Body(...),
    create_backup: bool = Body(True)
):
    """Write content to file."""
    result = await file_manager.write_file(path, content, create_backup)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/files/create")
async def create_new_file(path: str = Body(...), content: str = Body("")):
    """Create a new file."""
    result = await file_manager.create_file(path, content)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/files/mkdir")
async def create_directory(path: str = Body(...)):
    """Create a new directory."""
    result = await file_manager.create_directory(path)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.delete("/api/files/delete")
async def delete_file_or_directory(path: str, confirmed: bool = False):
    """Delete a file or directory."""
    result = await file_manager.delete(path, require_confirmation=not confirmed)
    if not result["success"] and not result.get("requires_confirmation"):
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/files/rename")
async def rename_file(old_path: str = Body(...), new_name: str = Body(...)):
    """Rename a file or directory."""
    result = await file_manager.rename(old_path, new_name)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/files/copy")
async def copy_file(source: str = Body(...), destination: str = Body(...)):
    """Copy a file or directory."""
    result = await file_manager.copy(source, destination)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/files/move")
async def move_file(source: str = Body(...), destination: str = Body(...)):
    """Move a file or directory."""
    result = await file_manager.move(source, destination)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.get("/api/files/download")
async def download_file(path: str):
    """Download a file."""
    result = await file_manager.get_download_path(path)
    if not result["success"]:
        raise HTTPException(status_code=404, detail=result.get("error"))
    
    file_path = result["path"]
    return FileResponse(path=file_path, filename=os.path.basename(file_path))


@app.get("/api/files/search")
async def search_files(path: str, pattern: str, recursive: bool = True):
    """Search for files."""
    result = await file_manager.search(path, pattern, recursive)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ==================== Connection Manager Endpoints ====================

@app.post("/api/connections/ssh")
async def connect_ssh(
    host: str = Body(...),
    port: int = Body(22),
    username: str = Body(...),
    password: Optional[str] = Body(None),
    key_file: Optional[str] = Body(None),
    duration_minutes: int = Body(30)
):
    """Connect via SSH/SFTP."""
    result = await connection_manager.connect_ssh(
        host, port, username, password, key_file, duration_minutes
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/connections/ftp")
async def connect_ftp(
    host: str = Body(...),
    port: int = Body(21),
    username: str = Body("anonymous"),
    password: str = Body(""),
    duration_minutes: int = Body(30),
    use_tls: bool = Body(False)
):
    """Connect via FTP."""
    result = await connection_manager.connect_ftp(
        host, port, username, password, duration_minutes, use_tls
    )
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.delete("/api/connections/{session_id}")
async def disconnect_session(session_id: str):
    """Disconnect a session."""
    result = await connection_manager.disconnect(session_id)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.get("/api/connections")
async def list_connections():
    """List all active connections."""
    return {"sessions": connection_manager.get_active_sessions()}


@app.get("/api/connections/{session_id}")
async def get_connection(session_id: str):
    """Get connection details."""
    session = connection_manager.get_session(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session


@app.get("/api/connections/{session_id}/files")
async def list_remote_files(session_id: str, path: Optional[str] = None):
    """List remote directory contents."""
    result = await connection_manager.list_remote_directory(session_id, path)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/connections/{session_id}/download")
async def download_remote_file(session_id: str, remote_path: str = Body(...)):
    """Download file from remote to local cache."""
    result = await connection_manager.download_file(session_id, remote_path)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/connections/{session_id}/upload")
async def upload_local_file(
    session_id: str,
    local_path: str = Body(...),
    remote_path: str = Body(...)
):
    """Upload file from local to remote."""
    result = await connection_manager.upload_file(session_id, local_path, remote_path)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


@app.post("/api/connections/{session_id}/exec")
async def execute_remote(session_id: str, command: str = Body(...)):
    """Execute command on remote server (SSH only)."""
    result = await connection_manager.execute_remote_command(session_id, command)
    if not result["success"]:
        raise HTTPException(status_code=400, detail=result.get("error"))
    return result


# ==================== Settings Management ====================

@app.get("/api/settings/ai-models")
async def get_ai_model_configs(db: AsyncSession = Depends(get_db)):
    """Get all AI model configurations."""
    from models import AIModelConfig
    result = await db.execute(select(AIModelConfig))
    configs = result.scalars().all()
    
    return {
        "models": [
            {
                "id": config.id,
                "engine_name": config.engine_name,
                "model_name": config.model_name,
                "base_url": config.base_url,
                "is_enabled": config.is_enabled,
                "is_custom": config.is_custom,
                "has_api_key": bool(config.api_key),
                "settings": config.settings or {},
                "updated_at": config.updated_at.isoformat()
            }
            for config in configs
        ]
    }


@app.post("/api/settings/ai-models")
async def create_or_update_ai_model(
    engine_name: str = Body(...),
    api_key: Optional[str] = Body(None),
    model_name: Optional[str] = Body(None),
    base_url: Optional[str] = Body(None),
    is_enabled: bool = Body(True),
    is_custom: bool = Body(False),
    settings: Optional[Dict] = Body(None),
    db: AsyncSession = Depends(get_db)
):
    """Create or update AI model configuration."""
    from models import AIModelConfig
    from datetime import datetime
    
    # Check if exists
    result = await db.execute(
        select(AIModelConfig).where(AIModelConfig.engine_name == engine_name)
    )
    config = result.scalar_one_or_none()
    
    if config:
        # Update existing
        if api_key is not None:
            config.api_key = api_key
        if model_name is not None:
            config.model_name = model_name
        if base_url is not None:
            config.base_url = base_url
        config.is_enabled = is_enabled
        config.is_custom = is_custom
        if settings is not None:
            config.settings = settings
        config.updated_at = datetime.utcnow()
    else:
        # Create new
        config = AIModelConfig(
            engine_name=engine_name,
            api_key=api_key,
            model_name=model_name,
            base_url=base_url,
            is_enabled=is_enabled,
            is_custom=is_custom,
            settings=settings or {}
        )
        db.add(config)
    
    await db.commit()
    await db.refresh(config)
    
    # Reinitialize AI engines
    await ai_manager.initialize()
    
    return {
        "success": True,
        "message": "AI model configuration saved",
        "config": {
            "id": config.id,
            "engine_name": config.engine_name,
            "model_name": config.model_name,
            "is_enabled": config.is_enabled,
            "is_custom": config.is_custom
        }
    }


@app.delete("/api/settings/ai-models/{engine_name}")
async def delete_ai_model(engine_name: str, db: AsyncSession = Depends(get_db)):
    """Delete AI model configuration."""
    from models import AIModelConfig
    
    result = await db.execute(
        select(AIModelConfig).where(AIModelConfig.engine_name == engine_name)
    )
    config = result.scalar_one_or_none()
    
    if not config:
        raise HTTPException(status_code=404, detail="Model configuration not found")
    
    await db.delete(config)
    await db.commit()
    
    # Reinitialize AI engines
    await ai_manager.initialize()
    
    return {"success": True, "message": "AI model configuration deleted"}


@app.get("/api/settings/system")
async def get_system_settings(db: AsyncSession = Depends(get_db)):
    """Get all system settings."""
    from models import SystemSettings
    result = await db.execute(select(SystemSettings))
    settings_list = result.scalars().all()
    
    return {
        "settings": {
            setting.setting_key: {
                "value": setting.setting_value,
                "type": setting.setting_type,
                "description": setting.description,
                "updated_at": setting.updated_at.isoformat()
            }
            for setting in settings_list
        }
    }


@app.post("/api/settings/system")
async def update_system_setting(
    setting_key: str = Body(...),
    setting_value: Any = Body(...),
    setting_type: str = Body(...),
    description: Optional[str] = Body(None),
    db: AsyncSession = Depends(get_db)
):
    """Update or create a system setting."""
    from models import SystemSettings
    from datetime import datetime
    
    result = await db.execute(
        select(SystemSettings).where(SystemSettings.setting_key == setting_key)
    )
    setting = result.scalar_one_or_none()
    
    if setting:
        setting.setting_value = setting_value
        setting.setting_type = setting_type
        if description:
            setting.description = description
        setting.updated_at = datetime.utcnow()
    else:
        setting = SystemSettings(
            setting_key=setting_key,
            setting_value=setting_value,
            setting_type=setting_type,
            description=description
        )
        db.add(setting)
    
    await db.commit()
    await db.refresh(setting)
    
    return {
        "success": True,
        "message": "System setting updated",
        "setting": {
            "key": setting.setting_key,
            "value": setting.setting_value,
            "type": setting.setting_type
        }
    }


@app.get("/api/settings/ai/available-models")
async def get_available_ai_models():
    """Get list of all supported AI models with their requirements and current valid models."""
    return {
        "models": {
            "gemini": {
                "name": "Google Gemini",
                "requires_api_key": True,
                "api_key_name": "GEMINI_API_KEY",
                "models": ["gemini-2.0-flash-exp", "gemini-1.5-flash", "gemini-1.5-flash-8b", "gemini-1.5-pro"],
                "default_model": "gemini-2.0-flash-exp",
                "get_api_key_url": "https://makersuite.google.com/app/apikey",
                "status": "available"
            },
            "groq": {
                "name": "Groq",
                "requires_api_key": True,
                "api_key_name": "GROQ_API_KEY",
                "models": ["llama-3.3-70b-versatile", "llama-3.1-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
                "default_model": "llama-3.3-70b-versatile",
                "get_api_key_url": "https://console.groq.com/keys",
                "status": "available",
                "note": "mixtral-8x7b-32768 is deprecated, use llama-3.3-70b-versatile instead"
            },
            "claude": {
                "name": "Anthropic Claude",
                "requires_api_key": True,
                "api_key_name": "ANTHROPIC_API_KEY",
                "models": ["claude-3-5-sonnet-20240620", "claude-3-haiku-20240307", "claude-3-opus-20240229"],
                "default_model": "claude-3-haiku-20240307",
                "get_api_key_url": "https://console.anthropic.com/",
                "status": "available"
            },
            "openai": {
                "name": "OpenAI",
                "requires_api_key": True,
                "api_key_name": "OPENAI_API_KEY",
                "models": ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo", "gpt-4", "gpt-3.5-turbo"],
                "default_model": "gpt-3.5-turbo",
                "get_api_key_url": "https://platform.openai.com/api-keys",
                "status": "available"
            },
            "ollama": {
                "name": "Ollama (Local)",
                "requires_api_key": False,
                "api_key_name": None,
                "models": ["llama2", "llama3", "llama3.1", "mistral", "codellama", "phi3"],
                "default_model": "llama2",
                "get_api_key_url": None,
                "requires_local_install": True,
                "install_url": "https://ollama.ai/download",
                "status": "available"
            }
        }
    }


# ==================== Health Check ====================

@app.get("/health")
@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "version": settings.APP_VERSION,
        "ai_engines": ai_manager.get_available_engines(),
        "active_connections": len(connection_manager.get_active_sessions())
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG
    )
