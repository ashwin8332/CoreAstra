"""
CoreAstra Terminal Executor
AI-Powered Terminal & Intelligent Control Interface

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved. Unauthorized usage or distribution is prohibited.
"""

import asyncio
import os
import sys
import subprocess
from typing import Optional, Dict, AsyncGenerator, Tuple
from pathlib import Path
from datetime import datetime
from config import settings
from logger import logger, audit_log, command_log, security_log


class CommandSafetyChecker:
    """Checks commands for potential risks."""
    
    @staticmethod
    def check_command(command: str) -> Tuple[bool, str, str]:
        """
        Check if a command is potentially risky.
        Returns: (is_risky, risk_level, reason)
        """
        command_lower = command.lower().strip()
        
        # Check against known dangerous patterns
        for dangerous in settings.DANGEROUS_COMMANDS:
            if dangerous.lower() in command_lower:
                return True, "critical", f"Contains dangerous pattern: {dangerous}"
        
        # Additional risk patterns
        risk_patterns = {
            "high": [
                ("sudo", "Elevated privileges requested"),
                ("runas", "Elevated privileges requested"),
                ("kill -9", "Force kill process"),
                ("taskkill /f", "Force terminate process"),
                ("netsh", "Network configuration change"),
                ("iptables", "Firewall modification"),
                ("schtasks", "Scheduled task modification"),
                ("crontab", "Cron job modification"),
            ],
            "medium": [
                ("pip install", "Package installation"),
                ("npm install -g", "Global package installation"),
                ("apt install", "System package installation"),
                ("yum install", "System package installation"),
                ("wget", "File download from internet"),
                ("curl", "Network request"),
                ("git push --force", "Force push to repository"),
            ],
            "low": [
                ("mv", "File move operation"),
                ("cp", "File copy operation"),
                ("mkdir", "Directory creation"),
                ("touch", "File creation"),
            ]
        }
        
        for level, patterns in risk_patterns.items():
            for pattern, reason in patterns:
                if pattern.lower() in command_lower:
                    is_risky = level in ["high", "critical"]
                    return is_risky, level, reason
        
        return False, "low", "Standard command"
    
    @staticmethod
    def get_affected_paths(command: str) -> list:
        """Extract file/directory paths that might be affected by the command."""
        import re
        
        # Common path patterns
        path_patterns = [
            r'["\']([^"\']+)["\']',  # Quoted paths
            r'\s(/[^\s]+)',  # Unix absolute paths
            r'\s([A-Za-z]:\\[^\s]+)',  # Windows absolute paths
            r'\s(\.{1,2}/[^\s]+)',  # Relative paths
        ]
        
        paths = []
        for pattern in path_patterns:
            matches = re.findall(pattern, command)
            paths.extend(matches)
        
        return list(set(paths))


class BackupManager:
    """Manages automatic backups before risky operations."""
    
    def __init__(self):
        self.backup_dir = settings.BACKUP_DIR
    
    async def create_backup(self, path: str, description: str = "") -> Optional[str]:
        """Create a backup of a file or directory."""
        source = Path(path)
        if not source.exists():
            logger.warning(f"Cannot backup non-existent path: {path}")
            return None
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_name = f"{source.name}_{timestamp}"
        backup_path = self.backup_dir / backup_name
        
        try:
            if source.is_file():
                # Check file size
                size_mb = source.stat().st_size / (1024 * 1024)
                if size_mb > settings.MAX_BACKUP_SIZE_MB:
                    logger.warning(f"File too large for backup: {size_mb:.2f}MB")
                    return None
                
                import shutil
                shutil.copy2(source, backup_path)
            else:
                # Directory backup
                import shutil
                shutil.copytree(source, backup_path)
            
            audit_log("backup_created", {
                "original": str(source),
                "backup": str(backup_path),
                "description": description
            })
            
            logger.info(f"Backup created: {backup_path}")
            return str(backup_path)
            
        except Exception as e:
            logger.error(f"Backup failed: {e}")
            return None
    
    async def restore_backup(self, backup_path: str, original_path: str) -> bool:
        """Restore a backup to its original location."""
        backup = Path(backup_path)
        original = Path(original_path)
        
        if not backup.exists():
            logger.error(f"Backup not found: {backup_path}")
            return False
        
        try:
            import shutil
            
            if original.exists():
                # Create a backup of current state before restore
                temp_backup = str(original) + "_pre_restore"
                if original.is_file():
                    shutil.copy2(original, temp_backup)
                else:
                    shutil.copytree(original, temp_backup)
            
            if backup.is_file():
                shutil.copy2(backup, original)
            else:
                if original.exists():
                    shutil.rmtree(original)
                shutil.copytree(backup, original)
            
            audit_log("backup_restored", {
                "backup": str(backup),
                "restored_to": str(original)
            })
            
            logger.info(f"Backup restored: {backup_path} -> {original_path}")
            return True
            
        except Exception as e:
            logger.error(f"Restore failed: {e}")
            return False
    
    def list_backups(self) -> list:
        """List all available backups."""
        backups = []
        for item in self.backup_dir.iterdir():
            stat = item.stat()
            backups.append({
                "name": item.name,
                "path": str(item),
                "size": stat.st_size,
                "created": datetime.fromtimestamp(stat.st_ctime).isoformat(),
                "is_directory": item.is_dir()
            })
        return sorted(backups, key=lambda x: x["created"], reverse=True)


class TerminalExecutor:
    """Executes terminal commands with safety checks and logging."""
    
    def __init__(self):
        self.safety_checker = CommandSafetyChecker()
        self.backup_manager = BackupManager()
        self.current_directory = os.getcwd()
        self.environment = os.environ.copy()
        self.is_windows = sys.platform == "win32"
    
    async def analyze_command(self, command: str) -> Dict:
        """Analyze a command before execution."""
        is_risky, risk_level, reason = self.safety_checker.check_command(command)
        affected_paths = self.safety_checker.get_affected_paths(command)
        
        return {
            "command": command,
            "is_risky": is_risky,
            "risk_level": risk_level,
            "reason": reason,
            "affected_paths": affected_paths,
            "requires_confirmation": is_risky and settings.REQUIRE_CONFIRMATION_FOR_RISKY,
            "backup_recommended": is_risky and settings.AUTO_BACKUP_ENABLED
        }
    
    async def execute(
        self,
        command: str,
        user_confirmed: bool = False,
        create_backup: bool = True,
        cwd: Optional[str] = None
    ) -> AsyncGenerator[Dict, None]:
        """Execute a command with safety checks and streaming output."""
        
        # Analyze command
        analysis = await self.analyze_command(command)
        
        # Check if confirmation is required
        if analysis["requires_confirmation"] and not user_confirmed:
            yield {
                "type": "confirmation_required",
                "analysis": analysis,
                "message": f"This command is potentially risky ({analysis['risk_level']}): {analysis['reason']}"
            }
            return
        
        # Create backups if needed
        backup_paths = []
        if analysis["backup_recommended"] and create_backup:
            for path in analysis["affected_paths"]:
                if Path(path).exists():
                    backup = await self.backup_manager.create_backup(
                        path, 
                        f"Pre-execution backup for: {command[:50]}"
                    )
                    if backup:
                        backup_paths.append({"original": path, "backup": backup})
        
        # Log execution start
        audit_log("command_execution_start", {
            "command": command,
            "risk_level": analysis["risk_level"],
            "user_confirmed": user_confirmed,
            "backups": backup_paths
        }, analysis["risk_level"])
        
        yield {
            "type": "execution_start",
            "command": command,
            "backups": backup_paths
        }
        
        # Prepare execution
        working_dir = cwd or self.current_directory
        shell = True
        
        try:
            # Create subprocess
            if self.is_windows:
                process = await asyncio.create_subprocess_shell(
                    command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=working_dir,
                    env=self.environment
                )
            else:
                process = await asyncio.create_subprocess_shell(
                    command,
                    stdout=asyncio.subprocess.PIPE,
                    stderr=asyncio.subprocess.PIPE,
                    cwd=working_dir,
                    env=self.environment,
                    executable="/bin/bash"
                )
            
            # Stream output
            async def read_stream(stream, stream_type):
                while True:
                    line = await stream.readline()
                    if not line:
                        break
                    yield {
                        "type": "output",
                        "stream": stream_type,
                        "content": line.decode("utf-8", errors="replace")
                    }
            
            # Read both streams
            stdout_data = []
            stderr_data = []
            
            async for chunk in read_stream(process.stdout, "stdout"):
                stdout_data.append(chunk["content"])
                yield chunk
            
            async for chunk in read_stream(process.stderr, "stderr"):
                stderr_data.append(chunk["content"])
                yield chunk
            
            # Wait for completion
            exit_code = await process.wait()
            
            # Log completion
            command_log(command, exit_code, analysis["is_risky"])
            
            audit_log("command_execution_complete", {
                "command": command,
                "exit_code": exit_code,
                "success": exit_code == 0
            }, analysis["risk_level"])
            
            yield {
                "type": "execution_complete",
                "exit_code": exit_code,
                "success": exit_code == 0,
                "stdout": "".join(stdout_data),
                "stderr": "".join(stderr_data)
            }
            
        except Exception as e:
            logger.error(f"Command execution failed: {e}")
            security_log("command_execution_error", {
                "command": command,
                "error": str(e)
            })
            
            yield {
                "type": "error",
                "message": str(e)
            }
    
    def change_directory(self, path: str) -> Tuple[bool, str]:
        """Change the current working directory."""
        try:
            target = Path(path)
            if not target.is_absolute():
                target = Path(self.current_directory) / target
            
            target = target.resolve()
            
            if not target.exists():
                return False, f"Directory does not exist: {target}"
            
            if not target.is_dir():
                return False, f"Not a directory: {target}"
            
            self.current_directory = str(target)
            return True, str(target)
            
        except Exception as e:
            return False, str(e)
    
    def get_current_directory(self) -> str:
        """Get the current working directory."""
        return self.current_directory
    
    def set_environment_variable(self, key: str, value: str):
        """Set an environment variable."""
        self.environment[key] = value
    
    def get_system_info(self) -> Dict:
        """Get system information."""
        import psutil
        
        return {
            "platform": sys.platform,
            "python_version": sys.version,
            "cpu_count": psutil.cpu_count(),
            "cpu_percent": psutil.cpu_percent(),
            "memory": {
                "total": psutil.virtual_memory().total,
                "available": psutil.virtual_memory().available,
                "percent": psutil.virtual_memory().percent
            },
            "disk": {
                "total": psutil.disk_usage("/").total if not self.is_windows else psutil.disk_usage("C:\\").total,
                "free": psutil.disk_usage("/").free if not self.is_windows else psutil.disk_usage("C:\\").free,
                "percent": psutil.disk_usage("/").percent if not self.is_windows else psutil.disk_usage("C:\\").percent
            },
            "current_directory": self.current_directory
        }


# Global terminal executor instance
terminal_executor = TerminalExecutor()
backup_manager = BackupManager()
