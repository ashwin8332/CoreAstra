"""
CoreAstra Connection Manager - Flask Application
SSH/FTP connection management backend

CRITICAL: Run SINGLE PROCESS ONLY
DO NOT use with Gunicorn workers > 1
Sessions are in-memory and not shared across processes
"""
from flask import Flask
from flask_cors import CORS
from routes.ssh_routes import ssh_bp
from routes.ftp_routes import ftp_bp
from routes.session_routes import session_bp


def create_app():
    """Application factory"""
    app = Flask(__name__)
    
    # CORS configuration
    CORS(app, resources={
        r"/connections/*": {
            "origins": "*",
            "methods": ["GET", "POST", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
    # Register blueprints
    app.register_blueprint(ssh_bp)
    app.register_blueprint(ftp_bp)
    app.register_blueprint(session_bp)
    
    # Health check endpoint
    @app.route("/health")
    def health():
        return {"status": "ok", "service": "coreastra-connection-manager"}
    
    # Root endpoint
    @app.route("/")
    def root():
        return {
            "service": "CoreAstra Connection Manager",
            "version": "1.0.0",
            "endpoints": {
                "health": "/health",
                "ssh_connect": "POST /connections/ssh",
                "ftp_connect": "POST /connections/ftp",
                "list_sessions": "GET /connections",
                "disconnect": "DELETE /connections/<session_id>",
                "execute_command": "POST /connections/<session_id>/execute",
                "list_files": "GET /connections/<session_id>/files",
                "download": "POST /connections/<session_id>/download",
                "upload": "POST /connections/<session_id>/upload",
                "cleanup": "POST /connections/cleanup"
            }
        }
    
    return app


if __name__ == "__main__":
    app = create_app()
    
    print("=" * 60)
    print("CoreAstra Connection Manager")
    print("=" * 60)
    print("⚠️  SINGLE PROCESS MODE")
    print("⚠️  Sessions are in-memory - restart will clear all connections")
    print("=" * 60)
    print("🚀 Starting Flask server on http://localhost:8001")
    print("=" * 60)
    
    app.run(
        host="0.0.0.0",
        port=8001,
        debug=True,
        threaded=True,
        use_reloader=False  # Prevent double initialization
    )
