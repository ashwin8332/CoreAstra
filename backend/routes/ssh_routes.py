"""
SSH Routes - API endpoints for SSH connections
Matches frontend ConnectionManager expectations exactly
"""
from flask import Blueprint, request
import stat
import os
import tempfile
from services.ssh_service import open_ssh_connection, execute_ssh_command
from services.session_store import create_session, get_session
from utils.response import success, error

ssh_bp = Blueprint("ssh", __name__)


@ssh_bp.post("/connections/ssh")
def connect_ssh():
    """
    Create new SSH connection
    
    Request body:
        - host: str (required)
        - username: str (required)
        - port: int (optional, default 22)
        - password: str (optional)
        - keyPath: str (optional)
        - timeout: int (optional, default 30)
        - sessionName: str (optional)
        
    Response:
        - session_id: str
    """
    data = request.json
    
    if not data:
        return error("Request body required")
    
    host = data.get("host")
    username = data.get("username")
    
    if not host or not username:
        return error("host and username are required")
    
    try:
        client, sftp = open_ssh_connection(
            host=host,
            username=username,
            port=data.get("port", 22),
            password=data.get("password"),
            key_path=data.get("keyPath"),
            timeout=data.get("timeout", 30)
        )
        
        session_id = create_session({
            "type": "ssh",
            "client": client,
            "sftp": sftp,
            "host": host,
            "port": data.get("port", 22),
            "username": username,
            "session_name": data.get("sessionName", f"{username}@{host}")
        })
        
        return success({"session_id": session_id})
        
    except Exception as e:
        return error(str(e), 400)


@ssh_bp.post("/connections/<session_id>/execute")
def execute_command(session_id):
    """
    Execute command on SSH session
    
    Request body:
        - command: str (required)
        
    Response:
        - output: str
    """
    session = get_session(session_id)
    if not session:
        return error("Session expired or not found", 401)
    
    if session["type"] != "ssh":
        return error("Not an SSH session", 400)
    
    data = request.json
    if not data or "command" not in data:
        return error("command is required")
    
    try:
        output = execute_ssh_command(session["client"], data["command"])
        return success({"output": output})
        
    except Exception as e:
        return error(str(e), 500)


@ssh_bp.get("/connections/<session_id>/files")
def list_remote_files(session_id):
    """
    List files in remote directory (SSH/SFTP)
    
    Query params:
        - path: str (optional, default current directory)
        
    Response:
        - current_path: str
        - files: list of file objects
    """
    session = get_session(session_id)
    if not session:
        return error("Session expired or not found", 401)
    
    if session["type"] != "ssh":
        return error("Not an SSH session", 400)
    
    path = request.args.get("path", ".")
    
    try:
        sftp = session["sftp"]
        
        # Normalize path
        if path == ".":
            path = sftp.getcwd() or "/"
        
        # List directory
        files = []
        for attr in sftp.listdir_attr(path):
            # Build full path
            full_path = os.path.join(path, attr.filename).replace("\\", "/")
            
            # Determine if directory
            is_dir = stat.S_ISDIR(attr.st_mode)
            
            # Format size
            size = attr.st_size if hasattr(attr, 'st_size') else 0
            if size < 1024:
                size_formatted = f"{size} B"
            elif size < 1024 * 1024:
                size_formatted = f"{size / 1024:.1f} KB"
            elif size < 1024 * 1024 * 1024:
                size_formatted = f"{size / (1024 * 1024):.1f} MB"
            else:
                size_formatted = f"{size / (1024 * 1024 * 1024):.2f} GB"
            
            # Get permissions
            permissions = oct(attr.st_mode)[-3:] if hasattr(attr, 'st_mode') else "---"
            
            # Get modification time
            modified = ""
            if hasattr(attr, 'st_mtime'):
                from datetime import datetime
                modified = datetime.fromtimestamp(attr.st_mtime).isoformat()
            
            files.append({
                "name": attr.filename,
                "path": full_path,
                "is_directory": is_dir,
                "size": size,
                "size_formatted": size_formatted,
                "modified": modified,
                "permissions": permissions
            })
        
        # Sort: directories first, then by name
        files.sort(key=lambda x: (not x["is_directory"], x["name"].lower()))
        
        return success({
            "current_path": path,
            "files": files
        })
        
    except Exception as e:
        return error(f"Failed to list files: {str(e)}", 500)


@ssh_bp.post("/connections/<session_id>/download")
def download_file(session_id):
    """
    Download file from remote server
    
    Request body:
        - remotePath: str (required)
        - localPath: str (optional, uses temp dir if not provided)
        
    Response:
        - local_path: str
        - size: int
    """
    session = get_session(session_id)
    if not session:
        return error("Session expired or not found", 401)
    
    if session["type"] != "ssh":
        return error("Not an SSH session", 400)
    
    data = request.json
    if not data or "remotePath" not in data:
        return error("remotePath is required")
    
    remote_path = data["remotePath"]
    local_path = data.get("localPath")
    
    try:
        sftp = session["sftp"]
        
        # Generate local path if not provided
        if not local_path:
            filename = os.path.basename(remote_path)
            local_path = os.path.join(tempfile.gettempdir(), filename)
        
        # Download file
        sftp.get(remote_path, local_path)
        
        # Get file size
        size = os.path.getsize(local_path)
        
        return success({
            "local_path": local_path,
            "size": size,
            "message": f"Downloaded to {local_path}"
        })
        
    except Exception as e:
        return error(f"Download failed: {str(e)}", 500)


@ssh_bp.post("/connections/<session_id>/upload")
def upload_file(session_id):
    """
    Upload file to remote server
    
    Request body:
        - localPath: str (required)
        - remotePath: str (required)
        
    Response:
        - message: str
    """
    session = get_session(session_id)
    if not session:
        return error("Session expired or not found", 401)
    
    if session["type"] != "ssh":
        return error("Not an SSH session", 400)
    
    data = request.json
    if not data or "localPath" not in data or "remotePath" not in data:
        return error("localPath and remotePath are required")
    
    local_path = data["localPath"]
    remote_path = data["remotePath"]
    
    # Check local file exists
    if not os.path.exists(local_path):
        return error(f"Local file not found: {local_path}", 404)
    
    try:
        sftp = session["sftp"]
        
        # Upload file
        sftp.put(local_path, remote_path)
        
        return success({
            "message": f"Uploaded to {remote_path}"
        })
        
    except Exception as e:
        return error(f"Upload failed: {str(e)}", 500)
