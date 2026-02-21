"""
FTP Routes - API endpoints for FTP connections
Matches frontend ConnectionManager expectations exactly
"""
from flask import Blueprint, request
import os
import tempfile
from datetime import datetime
from services.ftp_service import open_ftp_connection
from services.session_store import create_session, get_session
from utils.response import success, error

ftp_bp = Blueprint("ftp", __name__)


@ftp_bp.post("/connections/ftp")
def connect_ftp():
    """
    Create new FTP connection
    
    Request body:
        - host: str (required)
        - username: str (required)
        - password: str (required)
        - port: int (optional, default 21)
        - useTLS: bool (optional, default False)
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
    password = data.get("password")
    
    if not host or not username or not password:
        return error("host, username, and password are required")
    
    try:
        client = open_ftp_connection(
            host=host,
            username=username,
            password=password,
            port=data.get("port", 21),
            use_tls=data.get("useTLS", False),
            timeout=data.get("timeout", 30)
        )
        
        session_id = create_session({
            "type": "ftp",
            "client": client,
            "host": host,
            "port": data.get("port", 21),
            "username": username,
            "session_name": data.get("sessionName", f"{username}@{host}")
        })
        
        return success({"session_id": session_id})
        
    except Exception as e:
        return error(str(e), 400)


@ftp_bp.get("/connections/<session_id>/files")
def list_remote_files(session_id):
    """
    List files in remote directory (FTP)
    
    Query params:
        - path: str (optional, default current directory)
        
    Response:
        - current_path: str
        - files: list of file objects
    """
    session = get_session(session_id)
    if not session:
        return error("Session expired or not found", 401)
    
    if session["type"] != "ftp":
        return error("Not an FTP session", 400)
    
    path = request.args.get("path", ".")
    
    try:
        ftp = session["client"]
        
        # Change to directory
        if path and path != ".":
            ftp.cwd(path)
        
        current_path = ftp.pwd()
        
        # List directory
        files = []
        items = []
        
        # Get directory listing
        ftp.dir(lambda x: items.append(x))
        
        for item in items:
            parts = item.split()
            if len(parts) < 9:
                continue
            
            permissions = parts[0]
            size = int(parts[4]) if parts[4].isdigit() else 0
            name = " ".join(parts[8:])
            
            # Skip . and ..
            if name in [".", ".."]:
                continue
            
            # Determine if directory
            is_dir = permissions.startswith('d')
            
            # Build full path
            full_path = os.path.join(current_path, name).replace("\\", "/")
            
            # Format size
            if size < 1024:
                size_formatted = f"{size} B"
            elif size < 1024 * 1024:
                size_formatted = f"{size / 1024:.1f} KB"
            elif size < 1024 * 1024 * 1024:
                size_formatted = f"{size / (1024 * 1024):.1f} MB"
            else:
                size_formatted = f"{size / (1024 * 1024 * 1024):.2f} GB"
            
            files.append({
                "name": name,
                "path": full_path,
                "is_directory": is_dir,
                "size": size,
                "size_formatted": size_formatted,
                "modified": "",
                "permissions": permissions[1:] if len(permissions) > 1 else "---"
            })
        
        # Sort: directories first, then by name
        files.sort(key=lambda x: (not x["is_directory"], x["name"].lower()))
        
        return success({
            "current_path": current_path,
            "files": files
        })
        
    except Exception as e:
        return error(f"Failed to list files: {str(e)}", 500)


@ftp_bp.post("/connections/<session_id>/download")
def download_file(session_id):
    """
    Download file from remote FTP server
    
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
    
    if session["type"] != "ftp":
        return error("Not an FTP session", 400)
    
    data = request.json
    if not data or "remotePath" not in data:
        return error("remotePath is required")
    
    remote_path = data["remotePath"]
    local_path = data.get("localPath")
    
    try:
        ftp = session["client"]
        
        # Generate local path if not provided
        if not local_path:
            filename = os.path.basename(remote_path)
            local_path = os.path.join(tempfile.gettempdir(), filename)
        
        # Download file
        with open(local_path, 'wb') as f:
            ftp.retrbinary(f'RETR {remote_path}', f.write)
        
        # Get file size
        size = os.path.getsize(local_path)
        
        return success({
            "local_path": local_path,
            "size": size,
            "message": f"Downloaded to {local_path}"
        })
        
    except Exception as e:
        return error(f"Download failed: {str(e)}", 500)


@ftp_bp.post("/connections/<session_id>/upload")
def upload_file(session_id):
    """
    Upload file to remote FTP server
    
    Request body:
        - localPath: str (required)
        - remotePath: str (required)
        
    Response:
        - message: str
    """
    session = get_session(session_id)
    if not session:
        return error("Session expired or not found", 401)
    
    if session["type"] != "ftp":
        return error("Not an FTP session", 400)
    
    data = request.json
    if not data or "localPath" not in data or "remotePath" not in data:
        return error("localPath and remotePath are required")
    
    local_path = data["localPath"]
    remote_path = data["remotePath"]
    
    # Check local file exists
    if not os.path.exists(local_path):
        return error(f"Local file not found: {local_path}", 404)
    
    try:
        ftp = session["client"]
        
        # Upload file
        with open(local_path, 'rb') as f:
            ftp.storbinary(f'STOR {remote_path}', f)
        
        return success({
            "message": f"Uploaded to {remote_path}"
        })
        
    except Exception as e:
        return error(f"Upload failed: {str(e)}", 500)
