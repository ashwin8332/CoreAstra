"""
Session Store - In-Memory Session Management
CRITICAL: Do NOT persist to disk, do NOT use multiprocessing
"""
import uuid
import time
from datetime import datetime, timedelta
from typing import Dict, Optional, List, Any
from connection_config import SESSION_TIMEOUT_SECONDS, MAX_SESSIONS

# Global in-memory session storage
# WARNING: Single process only - do NOT use with Gunicorn workers > 1
SESSIONS: Dict[str, Dict[str, Any]] = {}


def create_session(payload: Dict[str, Any]) -> str:
    """
    Create a new session with auto-generated ID
    
    Args:
        payload: Session data including type, client objects, connection details
        
    Returns:
        session_id: UUID string
        
    Raises:
        Exception: If MAX_SESSIONS reached
    """
    if len(SESSIONS) >= MAX_SESSIONS:
        # Cleanup expired first
        cleanup_expired_sessions()
        if len(SESSIONS) >= MAX_SESSIONS:
            raise Exception(f"Maximum sessions ({MAX_SESSIONS}) reached")
    
    session_id = str(uuid.uuid4())
    created_time = time.time()
    
    payload.update({
        "session_id": session_id,
        "created_at": created_time,
        "last_activity": created_time,
        "is_active": True,
    })
    
    SESSIONS[session_id] = payload
    return session_id


def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Retrieve session and update last_activity
    
    Args:
        session_id: UUID string
        
    Returns:
        Session dict or None if expired/not found
    """
    session = SESSIONS.get(session_id)
    if not session:
        return None
    
    # Check expiration
    time_alive = time.time() - session["last_activity"]
    if time_alive > SESSION_TIMEOUT_SECONDS:
        destroy_session(session_id)
        return None
    
    # Update activity timestamp
    session["last_activity"] = time.time()
    return session


def get_all_sessions() -> List[Dict[str, Any]]:
    """
    Get all active sessions formatted for frontend
    
    Returns:
        List of session objects matching ConnectionSession interface
    """
    cleanup_expired_sessions()
    
    result = []
    for session in SESSIONS.values():
        created_dt = datetime.fromtimestamp(session["created_at"])
        expires_dt = created_dt + timedelta(seconds=SESSION_TIMEOUT_SECONDS)
        last_activity_dt = datetime.fromtimestamp(session["last_activity"])
        
        time_remaining = SESSION_TIMEOUT_SECONDS - (time.time() - session["last_activity"])
        time_remaining = max(0, int(time_remaining))
        
        result.append({
            "session_id": session["session_id"],
            "type": session["type"],
            "host": session["host"],
            "port": session["port"],
            "username": session["username"],
            "session_name": session.get("session_name", f"{session['username']}@{session['host']}"),
            "connected_at": created_dt.isoformat(),
            "expires_at": expires_dt.isoformat(),
            "last_activity": last_activity_dt.isoformat(),
            "is_active": session["is_active"],
            "time_remaining_seconds": time_remaining
        })
    
    return result


def destroy_session(session_id: str) -> bool:
    """
    Close connections and remove session
    
    Args:
        session_id: UUID string
        
    Returns:
        True if session existed and was destroyed
    """
    session = SESSIONS.pop(session_id, None)
    if not session:
        return False
    
    # Close connections gracefully
    try:
        if session["type"] == "ssh":
            # Close SFTP first, then SSH client
            if "sftp" in session and session["sftp"]:
                session["sftp"].close()
            if "client" in session and session["client"]:
                session["client"].close()
                
        elif session["type"] == "ftp":
            # Close FTP connection
            if "client" in session and session["client"]:
                session["client"].close()
                
    except Exception as e:
        # Ignore cleanup errors - session is already removed
        print(f"Error closing session {session_id}: {e}")
    
    return True


def cleanup_expired_sessions() -> int:
    """
    Remove all expired sessions
    
    Returns:
        Number of sessions cleaned up
    """
    expired = []
    current_time = time.time()
    
    for session_id, session in SESSIONS.items():
        time_alive = current_time - session["last_activity"]
        if time_alive > SESSION_TIMEOUT_SECONDS:
            expired.append(session_id)
    
    for session_id in expired:
        destroy_session(session_id)
    
    return len(expired)
