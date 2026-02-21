"""
Session Routes - Session management endpoints
Handles listing, disconnecting, and cleanup
"""
from flask import Blueprint
from services.session_store import get_all_sessions, destroy_session, cleanup_expired_sessions
from utils.response import success, error

session_bp = Blueprint("session", __name__)


@session_bp.get("/connections")
def list_sessions():
    """
    List all active sessions
    
    Response:
        - sessions: list of session objects
    """
    try:
        sessions = get_all_sessions()
        return success({"sessions": sessions})
        
    except Exception as e:
        return error(f"Failed to list sessions: {str(e)}", 500)


@session_bp.delete("/connections/<session_id>")
def disconnect(session_id):
    """
    Disconnect and destroy session
    
    Response:
        - message: str
    """
    try:
        destroyed = destroy_session(session_id)
        
        if not destroyed:
            return error("Session not found", 404)
        
        return success({"message": "Session disconnected"})
        
    except Exception as e:
        return error(f"Failed to disconnect: {str(e)}", 500)


@session_bp.post("/connections/cleanup")
def cleanup():
    """
    Cleanup expired sessions
    
    Response:
        - cleaned: int (number of sessions cleaned)
    """
    try:
        cleaned = cleanup_expired_sessions()
        return success({
            "cleaned": cleaned,
            "message": f"Cleaned up {cleaned} expired sessions"
        })
        
    except Exception as e:
        return error(f"Cleanup failed: {str(e)}", 500)
