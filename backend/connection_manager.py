"""
CoreAstra Connection Manager
Handles SSH and FTP connections with time-limited sessions.

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved. Unauthorized usage or distribution is prohibited.
"""

import os
import asyncio
import tempfile
import hashlib
import shutil
from typing import Dict, Optional, List, Callable
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from enum import Enum
import uuid
import json

from logger import logger, audit_log


class ConnectionType(str, Enum):
    SSH = "ssh"
    FTP = "ftp"
    SFTP = "sftp"
    LOCAL = "local"


class ConnectionStatus(str, Enum):
    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    TRANSFERRING = "transferring"
    ERROR = "error"
    EXPIRED = "expired"


@dataclass
class ConnectionSession:
    """Represents an active connection session."""
    id: str
    type: ConnectionType
    host: str
    port: int
    username: str
    status: ConnectionStatus = ConnectionStatus.DISCONNECTED
    created_at: datetime = field(default_factory=datetime.now)
    expires_at: Optional[datetime] = None
    last_activity: datetime = field(default_factory=datetime.now)
    bytes_transferred: int = 0
    files_transferred: int = 0
    current_remote_path: str = "/"
    temp_workspace: Optional[str] = None
    
    def to_dict(self) -> Dict:
        return {
            "id": self.id,
            "type": self.type.value,
            "host": self.host,
            "port": self.port,
            "username": self.username,
            "status": self.status.value,
            "created_at": self.created_at.isoformat(),
            "expires_at": self.expires_at.isoformat() if self.expires_at else None,
            "last_activity": self.last_activity.isoformat(),
            "bytes_transferred": self.bytes_transferred,
            "files_transferred": self.files_transferred,
            "current_remote_path": self.current_remote_path,
            "time_remaining": self._get_time_remaining()
        }
    
    def _get_time_remaining(self) -> Optional[int]:
        """Get remaining session time in seconds."""
        if not self.expires_at:
            return None
        remaining = (self.expires_at - datetime.now()).total_seconds()
        return max(0, int(remaining))
    
    def is_expired(self) -> bool:
        """Check if session has expired."""
        if not self.expires_at:
            return False
        return datetime.now() > self.expires_at
    
    def update_activity(self):
        """Update last activity timestamp."""
        self.last_activity = datetime.now()


@dataclass
class RemoteFile:
    """Remote file information."""
    path: str
    name: str
    is_directory: bool
    size: int
    modified: Optional[datetime]
    permissions: str = ""
    local_cache_path: Optional[str] = None
    checksum: Optional[str] = None
    is_modified: bool = False
    
    def to_dict(self) -> Dict:
        return {
            "path": self.path,
            "name": self.name,
            "is_directory": self.is_directory,
            "size": self.size,
            "size_formatted": self._format_size(self.size),
            "modified": self.modified.isoformat() if self.modified else None,
            "permissions": self.permissions,
            "is_cached": self.local_cache_path is not None,
            "is_modified": self.is_modified
        }
    
    def _format_size(self, size: int) -> str:
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        elif size < 1024 * 1024 * 1024:
            return f"{size / (1024 * 1024):.1f} MB"
        else:
            return f"{size / (1024 * 1024 * 1024):.2f} GB"


class ConnectionManager:
    """Manages SSH/FTP connections with security controls."""
    
    # Default session duration in minutes
    DEFAULT_SESSION_DURATION = 30
    MAX_SESSION_DURATION = 120
    IDLE_TIMEOUT = 10  # minutes
    
    def __init__(self):
        self.sessions: Dict[str, ConnectionSession] = {}
        self._clients: Dict[str, any] = {}  # SSH/FTP client instances
        self._temp_base = tempfile.mkdtemp(prefix="coreastra_")
        self._cleanup_task: Optional[asyncio.Task] = None
    
    async def start_cleanup_task(self):
        """Start background task to clean up expired sessions."""
        if self._cleanup_task is None:
            self._cleanup_task = asyncio.create_task(self._cleanup_loop())
    
    async def _cleanup_loop(self):
        """Periodically clean up expired sessions."""
        while True:
            await asyncio.sleep(60)  # Check every minute
            await self._cleanup_expired_sessions()
    
    async def _cleanup_expired_sessions(self):
        """Clean up expired or idle sessions."""
        for session_id in list(self.sessions.keys()):
            session = self.sessions[session_id]
            
            # Check expiration
            if session.is_expired():
                logger.info(f"Session {session_id} expired, disconnecting...")
                await self.disconnect(session_id, reason="Session expired")
                continue
            
            # Check idle timeout
            idle_time = (datetime.now() - session.last_activity).total_seconds() / 60
            if idle_time > self.IDLE_TIMEOUT:
                logger.info(f"Session {session_id} idle for {idle_time:.1f} minutes, disconnecting...")
                await self.disconnect(session_id, reason="Idle timeout")
    
    async def connect_ssh(self, host: str, port: int, username: str,
                         password: Optional[str] = None,
                         key_file: Optional[str] = None,
                         duration_minutes: int = DEFAULT_SESSION_DURATION) -> Dict:
        """Establish SSH/SFTP connection."""
        try:
            # Validate duration
            duration_minutes = min(duration_minutes, self.MAX_SESSION_DURATION)
            
            # Create session
            session_id = str(uuid.uuid4())
            session = ConnectionSession(
                id=session_id,
                type=ConnectionType.SSH,
                host=host,
                port=port,
                username=username,
                status=ConnectionStatus.CONNECTING,
                expires_at=datetime.now() + timedelta(minutes=duration_minutes)
            )
            
            # Create temp workspace for this session
            session.temp_workspace = os.path.join(self._temp_base, session_id)
            os.makedirs(session.temp_workspace, exist_ok=True)
            
            # Try to connect using paramiko
            try:
                import paramiko
                
                ssh_client = paramiko.SSHClient()
                ssh_client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                
                connect_kwargs = {
                    "hostname": host,
                    "port": port,
                    "username": username,
                    "timeout": 30,
                    "allow_agent": False,
                    "look_for_keys": False
                }
                
                if password:
                    connect_kwargs["password"] = password
                elif key_file:
                    connect_kwargs["key_filename"] = key_file
                
                ssh_client.connect(**connect_kwargs)
                
                # Open SFTP channel
                sftp_client = ssh_client.open_sftp()
                
                self._clients[session_id] = {
                    "ssh": ssh_client,
                    "sftp": sftp_client
                }
                
                session.status = ConnectionStatus.CONNECTED
                session.current_remote_path = sftp_client.getcwd() or "/"
                
            except ImportError:
                # Paramiko not installed - return mock/demo mode
                logger.warning("Paramiko not installed - SSH connections unavailable")
                session.status = ConnectionStatus.ERROR
                return {
                    "success": False,
                    "error": "SSH library not installed. Run: pip install paramiko",
                    "install_command": "pip install paramiko"
                }
            
            self.sessions[session_id] = session
            
            audit_log("ssh_connect", {
                "session_id": session_id,
                "host": host,
                "username": username,
                "duration_minutes": duration_minutes
            })
            
            return {
                "success": True,
                "session": session.to_dict(),
                "message": f"Connected to {host}. Session expires in {duration_minutes} minutes."
            }
            
        except Exception as e:
            logger.error(f"SSH connection failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def connect_ftp(self, host: str, port: int = 21, 
                         username: str = "anonymous",
                         password: str = "",
                         duration_minutes: int = DEFAULT_SESSION_DURATION,
                         use_tls: bool = False) -> Dict:
        """Establish FTP connection."""
        try:
            from ftplib import FTP, FTP_TLS
            
            duration_minutes = min(duration_minutes, self.MAX_SESSION_DURATION)
            
            session_id = str(uuid.uuid4())
            session = ConnectionSession(
                id=session_id,
                type=ConnectionType.FTP,
                host=host,
                port=port,
                username=username,
                status=ConnectionStatus.CONNECTING,
                expires_at=datetime.now() + timedelta(minutes=duration_minutes)
            )
            
            session.temp_workspace = os.path.join(self._temp_base, session_id)
            os.makedirs(session.temp_workspace, exist_ok=True)
            
            # Connect
            if use_tls:
                ftp_client = FTP_TLS()
            else:
                ftp_client = FTP()
            
            ftp_client.connect(host, port, timeout=30)
            ftp_client.login(username, password)
            
            if use_tls:
                ftp_client.prot_p()  # Enable data encryption
            
            # Use passive mode
            ftp_client.set_pasv(True)
            
            self._clients[session_id] = {"ftp": ftp_client}
            
            session.status = ConnectionStatus.CONNECTED
            session.current_remote_path = ftp_client.pwd()
            
            self.sessions[session_id] = session
            
            audit_log("ftp_connect", {
                "session_id": session_id,
                "host": host,
                "username": username,
                "duration_minutes": duration_minutes,
                "tls": use_tls
            })
            
            return {
                "success": True,
                "session": session.to_dict(),
                "message": f"Connected to {host}. Session expires in {duration_minutes} minutes."
            }
            
        except Exception as e:
            logger.error(f"FTP connection failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def disconnect(self, session_id: str, reason: str = "User requested") -> Dict:
        """Disconnect and clean up session."""
        if session_id not in self.sessions:
            return {"success": False, "error": "Session not found"}
        
        session = self.sessions[session_id]
        
        try:
            # Close clients
            if session_id in self._clients:
                clients = self._clients[session_id]
                
                if "sftp" in clients:
                    try:
                        clients["sftp"].close()
                    except:
                        pass
                
                if "ssh" in clients:
                    try:
                        clients["ssh"].close()
                    except:
                        pass
                
                if "ftp" in clients:
                    try:
                        clients["ftp"].quit()
                    except:
                        pass
                
                del self._clients[session_id]
            
            # Clean up temp workspace
            if session.temp_workspace and os.path.exists(session.temp_workspace):
                shutil.rmtree(session.temp_workspace, ignore_errors=True)
            
            session.status = ConnectionStatus.DISCONNECTED
            
            audit_log("connection_disconnect", {
                "session_id": session_id,
                "host": session.host,
                "reason": reason,
                "bytes_transferred": session.bytes_transferred,
                "files_transferred": session.files_transferred
            })
            
            del self.sessions[session_id]
            
            return {
                "success": True,
                "message": f"Disconnected from {session.host}",
                "reason": reason
            }
            
        except Exception as e:
            logger.error(f"Disconnect error: {e}")
            return {"success": False, "error": str(e)}
    
    async def list_remote_directory(self, session_id: str, 
                                   path: Optional[str] = None) -> Dict:
        """List remote directory contents."""
        if session_id not in self.sessions:
            return {"success": False, "error": "Session not found"}
        
        session = self.sessions[session_id]
        
        if session.is_expired():
            await self.disconnect(session_id, reason="Session expired")
            return {"success": False, "error": "Session expired"}
        
        session.update_activity()
        
        try:
            target_path = path or session.current_remote_path
            items: List[RemoteFile] = []
            
            if session.type == ConnectionType.SSH:
                sftp = self._clients[session_id]["sftp"]
                
                for item_attr in sftp.listdir_attr(target_path):
                    item_path = os.path.join(target_path, item_attr.filename).replace("\\", "/")
                    
                    import stat
                    is_dir = stat.S_ISDIR(item_attr.st_mode)
                    
                    # Convert permissions to string
                    mode = item_attr.st_mode
                    perms = ""
                    perms += "d" if is_dir else "-"
                    perms += "r" if mode & 0o400 else "-"
                    perms += "w" if mode & 0o200 else "-"
                    perms += "x" if mode & 0o100 else "-"
                    perms += "r" if mode & 0o040 else "-"
                    perms += "w" if mode & 0o020 else "-"
                    perms += "x" if mode & 0o010 else "-"
                    perms += "r" if mode & 0o004 else "-"
                    perms += "w" if mode & 0o002 else "-"
                    perms += "x" if mode & 0o001 else "-"
                    
                    items.append(RemoteFile(
                        path=item_path,
                        name=item_attr.filename,
                        is_directory=is_dir,
                        size=item_attr.st_size,
                        modified=datetime.fromtimestamp(item_attr.st_mtime) if item_attr.st_mtime else None,
                        permissions=perms
                    ))
            
            elif session.type == ConnectionType.FTP:
                ftp = self._clients[session_id]["ftp"]
                
                # Try MLSD first, fall back to LIST
                try:
                    for name, facts in ftp.mlsd(target_path):
                        if name in [".", ".."]:
                            continue
                        
                        is_dir = facts.get("type") == "dir"
                        size = int(facts.get("size", 0))
                        modified = None
                        if "modify" in facts:
                            try:
                                modified = datetime.strptime(facts["modify"], "%Y%m%d%H%M%S")
                            except:
                                pass
                        
                        items.append(RemoteFile(
                            path=f"{target_path}/{name}".replace("//", "/"),
                            name=name,
                            is_directory=is_dir,
                            size=size,
                            modified=modified
                        ))
                except:
                    # Fall back to NLST
                    ftp.cwd(target_path)
                    for name in ftp.nlst():
                        if name in [".", ".."]:
                            continue
                        items.append(RemoteFile(
                            path=f"{target_path}/{name}".replace("//", "/"),
                            name=name,
                            is_directory=False,  # Can't determine from NLST
                            size=0,
                            modified=None
                        ))
            
            # Sort: directories first, then by name
            items.sort(key=lambda x: (not x.is_directory, x.name.lower()))
            
            session.current_remote_path = target_path
            
            return {
                "success": True,
                "path": target_path,
                "items": [item.to_dict() for item in items],
                "session": session.to_dict()
            }
            
        except Exception as e:
            logger.error(f"Remote list failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def download_file(self, session_id: str, remote_path: str,
                           progress_callback: Optional[Callable] = None) -> Dict:
        """Download file from remote to local cache."""
        if session_id not in self.sessions:
            return {"success": False, "error": "Session not found"}
        
        session = self.sessions[session_id]
        
        if session.is_expired():
            await self.disconnect(session_id, reason="Session expired")
            return {"success": False, "error": "Session expired"}
        
        session.update_activity()
        session.status = ConnectionStatus.TRANSFERRING
        
        try:
            # Create local cache path
            filename = os.path.basename(remote_path)
            local_path = os.path.join(session.temp_workspace, filename)
            
            # Ensure unique filename
            base, ext = os.path.splitext(local_path)
            counter = 1
            while os.path.exists(local_path):
                local_path = f"{base}_{counter}{ext}"
                counter += 1
            
            if session.type == ConnectionType.SSH:
                sftp = self._clients[session_id]["sftp"]
                
                # Get file size for progress
                remote_stat = sftp.stat(remote_path)
                total_size = remote_stat.st_size
                
                # Download with progress
                def progress(transferred, total):
                    if progress_callback:
                        progress_callback(transferred, total)
                
                sftp.get(remote_path, local_path, callback=progress)
                
            elif session.type == ConnectionType.FTP:
                ftp = self._clients[session_id]["ftp"]
                
                with open(local_path, "wb") as f:
                    def write_callback(data):
                        f.write(data)
                        session.bytes_transferred += len(data)
                    
                    ftp.retrbinary(f"RETR {remote_path}", write_callback)
            
            # Calculate checksum
            checksum = hashlib.sha256()
            with open(local_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    checksum.update(chunk)
            
            session.files_transferred += 1
            session.bytes_transferred += os.path.getsize(local_path)
            session.status = ConnectionStatus.CONNECTED
            
            audit_log("file_download", {
                "session_id": session_id,
                "remote_path": remote_path,
                "local_path": local_path,
                "size": os.path.getsize(local_path)
            })
            
            return {
                "success": True,
                "local_path": local_path,
                "remote_path": remote_path,
                "size": os.path.getsize(local_path),
                "checksum": checksum.hexdigest(),
                "message": f"Downloaded {filename} to local cache"
            }
            
        except Exception as e:
            session.status = ConnectionStatus.CONNECTED
            logger.error(f"Download failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def upload_file(self, session_id: str, local_path: str, 
                         remote_path: str,
                         verify_checksum: bool = True) -> Dict:
        """Upload file from local to remote."""
        if session_id not in self.sessions:
            return {"success": False, "error": "Session not found"}
        
        session = self.sessions[session_id]
        
        if session.is_expired():
            await self.disconnect(session_id, reason="Session expired")
            return {"success": False, "error": "Session expired"}
        
        if not os.path.exists(local_path):
            return {"success": False, "error": "Local file not found"}
        
        session.update_activity()
        session.status = ConnectionStatus.TRANSFERRING
        
        try:
            file_size = os.path.getsize(local_path)
            
            # Calculate checksum before upload
            local_checksum = hashlib.sha256()
            with open(local_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    local_checksum.update(chunk)
            local_checksum = local_checksum.hexdigest()
            
            if session.type == ConnectionType.SSH:
                sftp = self._clients[session_id]["sftp"]
                sftp.put(local_path, remote_path)
                
                # Verify checksum if requested
                if verify_checksum:
                    ssh = self._clients[session_id]["ssh"]
                    stdin, stdout, stderr = ssh.exec_command(f"sha256sum {remote_path}")
                    remote_checksum = stdout.read().decode().split()[0]
                    
                    if remote_checksum != local_checksum:
                        return {
                            "success": False,
                            "error": "Checksum mismatch - upload may be corrupted"
                        }
                
            elif session.type == ConnectionType.FTP:
                ftp = self._clients[session_id]["ftp"]
                
                with open(local_path, "rb") as f:
                    ftp.storbinary(f"STOR {remote_path}", f)
            
            session.files_transferred += 1
            session.bytes_transferred += file_size
            session.status = ConnectionStatus.CONNECTED
            
            audit_log("file_upload", {
                "session_id": session_id,
                "local_path": local_path,
                "remote_path": remote_path,
                "size": file_size,
                "checksum": local_checksum
            })
            
            return {
                "success": True,
                "local_path": local_path,
                "remote_path": remote_path,
                "size": file_size,
                "checksum": local_checksum,
                "message": f"Uploaded to {remote_path}"
            }
            
        except Exception as e:
            session.status = ConnectionStatus.CONNECTED
            logger.error(f"Upload failed: {e}")
            return {"success": False, "error": str(e)}
    
    async def execute_remote_command(self, session_id: str, command: str,
                                    timeout: int = 30) -> Dict:
        """Execute command on remote server (SSH only)."""
        if session_id not in self.sessions:
            return {"success": False, "error": "Session not found"}
        
        session = self.sessions[session_id]
        
        if session.type != ConnectionType.SSH:
            return {"success": False, "error": "Remote execution only available for SSH"}
        
        if session.is_expired():
            await self.disconnect(session_id, reason="Session expired")
            return {"success": False, "error": "Session expired"}
        
        session.update_activity()
        
        try:
            ssh = self._clients[session_id]["ssh"]
            
            stdin, stdout, stderr = ssh.exec_command(command, timeout=timeout)
            
            exit_code = stdout.channel.recv_exit_status()
            stdout_text = stdout.read().decode()
            stderr_text = stderr.read().decode()
            
            audit_log("remote_command", {
                "session_id": session_id,
                "command": command,
                "exit_code": exit_code
            })
            
            return {
                "success": True,
                "command": command,
                "stdout": stdout_text,
                "stderr": stderr_text,
                "exit_code": exit_code
            }
            
        except Exception as e:
            logger.error(f"Remote command failed: {e}")
            return {"success": False, "error": str(e)}
    
    def get_active_sessions(self) -> List[Dict]:
        """Get all active sessions."""
        return [session.to_dict() for session in self.sessions.values()]
    
    def get_session(self, session_id: str) -> Optional[Dict]:
        """Get specific session info."""
        if session_id in self.sessions:
            return self.sessions[session_id].to_dict()
        return None


# Global connection manager instance
connection_manager = ConnectionManager()
