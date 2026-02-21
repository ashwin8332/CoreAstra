"""
Response formatter for consistent API responses
Matches frontend expectations exactly
"""
from flask import jsonify
from typing import Any, Dict, Optional


def success(data: Optional[Dict[str, Any]] = None, status_code: int = 200):
    """
    Success response format
    Frontend expects direct data object, not nested under 'data' key
    """
    return jsonify(data or {}), status_code


def error(message: str, code: int = 400):
    """
    Error response format
    Frontend expects 'detail' key for error messages
    """
    return jsonify({"detail": message}), code
