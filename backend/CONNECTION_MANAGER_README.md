# CoreAstra Connection Manager - Flask Backend

## Overview

Production-safe Flask backend for SSH/FTP connection management, fully integrated with the React ConnectionManager component.

## ⚠️ Critical Requirements

1. **Python 3.10+** required
2. **Single process only** - Do NOT use with Gunicorn workers > 1
3. **In-memory sessions** - Restart will clear all connections
4. Sessions auto-expire after 30 minutes of inactivity

## Quick Start

### Windows

```cmd
start_connection_backend.bat
```

### Linux/Mac

```bash
chmod +x start_connection_backend.sh
./start_connection_backend.sh
```

### Manual Setup

```bash
cd backend

# Create virtual environment
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate

# Install dependencies
pip install -r connection_requirements.txt

# Start server
python connection_app.py
```

Server runs on: **http://localhost:8000**

## Architecture

```
backend/
├── connection_app.py          # Flask application entry point
├── connection_config.py       # Configuration (timeouts, limits)
├── connection_requirements.txt # Python dependencies
│
├── routes/
│   ├── ssh_routes.py         # SSH connection endpoints
│   ├── ftp_routes.py         # FTP connection endpoints
│   └── session_routes.py     # Session management endpoints
│
├── services/
│   ├── ssh_service.py        # Paramiko SSH engine
│   ├── ftp_service.py        # FTP/FTPS engine
│   └── session_store.py      # In-memory session manager
│
└── utils/
    └── response.py           # API response formatter
```

## API Endpoints

### Connection Management

**Connect SSH**
```http
POST /connections/ssh
Content-Type: application/json

{
  "host": "example.com",
  "username": "user",
  "port": 22,
  "password": "optional",
  "keyPath": "optional",
  "timeout": 30,
  "sessionName": "optional"
}

Response: {"session_id": "uuid"}
```

**Connect FTP**
```http
POST /connections/ftp
Content-Type: application/json

{
  "host": "example.com",
  "username": "user",
  "password": "required",
  "port": 21,
  "useTLS": false,
  "timeout": 30,
  "sessionName": "optional"
}

Response: {"session_id": "uuid"}
```

**List Sessions**
```http
GET /connections

Response: {
  "sessions": [
    {
      "session_id": "uuid",
      "type": "ssh|ftp",
      "host": "example.com",
      "port": 22,
      "username": "user",
      "session_name": "My Server",
      "connected_at": "2024-01-01T00:00:00",
      "expires_at": "2024-01-01T00:30:00",
      "last_activity": "2024-01-01T00:15:00",
      "is_active": true,
      "time_remaining_seconds": 900
    }
  ]
}
```

**Disconnect**
```http
DELETE /connections/{session_id}

Response: {"message": "Session disconnected"}
```

### File Operations

**List Files**
```http
GET /connections/{session_id}/files?path=/remote/path

Response: {
  "current_path": "/remote/path",
  "files": [
    {
      "name": "file.txt",
      "path": "/remote/path/file.txt",
      "is_directory": false,
      "size": 1024,
      "size_formatted": "1.0 KB",
      "modified": "2024-01-01T00:00:00",
      "permissions": "644"
    }
  ]
}
```

**Download File**
```http
POST /connections/{session_id}/download
Content-Type: application/json

{
  "remotePath": "/remote/file.txt",
  "localPath": "optional"
}

Response: {
  "local_path": "/tmp/file.txt",
  "size": 1024,
  "message": "Downloaded to /tmp/file.txt"
}
```

**Upload File**
```http
POST /connections/{session_id}/upload
Content-Type: application/json

{
  "localPath": "/local/file.txt",
  "remotePath": "/remote/file.txt"
}

Response: {"message": "Uploaded to /remote/file.txt"}
```

### Command Execution (SSH only)

**Execute Command**
```http
POST /connections/{session_id}/execute
Content-Type: application/json

{
  "command": "ls -la"
}

Response: {
  "output": "total 48\ndrwxr-xr-x  12 user  group  384 Jan  1 00:00 .\n..."
}
```

### Utility Endpoints

**Health Check**
```http
GET /health

Response: {"status": "ok", "service": "coreastra-connection-manager"}
```

**Cleanup Expired Sessions**
```http
POST /connections/cleanup

Response: {"cleaned": 3, "message": "Cleaned up 3 expired sessions"}
```

## Configuration

Edit `connection_config.py` to customize:

```python
SESSION_TIMEOUT_SECONDS = 1800  # 30 minutes
MAX_SESSIONS = 20
DEFAULT_CONNECTION_TIMEOUT = 30
MAX_FILE_SIZE = 1024 * 1024 * 1024  # 1GB
```

## Security Considerations

### Current Implementation (Development/Admin Tool)

✅ SSH key-based authentication
✅ Password authentication
✅ TLS/SSL for FTP
✅ Auto-add SSH host keys
✅ Command execution allowed (admin tool)
✅ Session timeouts

### Production Hardening (If Needed)

❌ No rate limiting
❌ No authentication/authorization
❌ No command whitelisting
❌ No audit logging to disk
❌ No connection encryption validation
❌ Passwords not stored (good!)

**If deploying publicly**, add:
- JWT authentication
- Role-based access control
- Command restrictions
- Rate limiting
- Audit logs
- Proper SSL certificate validation

## Known Limitations

### By Design

1. **Single Process Only**
   - Sessions are in-memory
   - Cannot use multiprocessing/Gunicorn workers > 1
   - Restart clears all sessions

2. **No Horizontal Scaling**
   - Cannot run multiple instances
   - Load balancing not supported

3. **Session Persistence**
   - Sessions lost on restart
   - No database/Redis storage
   - Intentional for security

### Technical

1. **Async Limitations**
   - Flask is synchronous
   - Paramiko blocks during operations
   - No concurrent file transfers per session

2. **File Operations**
   - Downloads saved to temp directory by default
   - No streaming for large files
   - 1GB size limit

## Frontend Integration

The React ConnectionManager component expects these exact response formats:

### Error Format
```json
{"detail": "Error message"}
```

### Session List Format
```json
{
  "sessions": [
    {
      "session_id": "string",
      "type": "ssh|ftp",
      "host": "string",
      "port": number,
      "username": "string",
      "session_name": "string",
      "connected_at": "ISO8601",
      "expires_at": "ISO8601",
      "last_activity": "ISO8601",
      "is_active": boolean,
      "time_remaining_seconds": number
    }
  ]
}
```

**DO NOT change these formats** - frontend expects exact keys.

## Troubleshooting

### Connection Refused

```
Error: Connection failed: [Errno 111] Connection refused
```

**Solutions:**
- Verify remote host is reachable
- Check firewall rules
- Confirm SSH/FTP service is running
- Verify port number (22 for SSH, 21 for FTP)

### Authentication Failed

```
Error: Authentication failed - check username/password/key
```

**Solutions:**
- Verify credentials
- For SSH keys: ensure private key has correct permissions (chmod 600)
- Check if key is encrypted (passphrase required)
- Verify username is correct

### Session Expired

```
Error: Session expired or not found
```

**Solutions:**
- Session idle for >30 minutes
- Backend was restarted
- Reconnect to create new session

### Import Errors

```
ModuleNotFoundError: No module named 'paramiko'
```

**Solutions:**
```bash
pip install -r connection_requirements.txt
```

### Port Already in Use

```
OSError: [Errno 48] Address already in use
```

**Solutions:**
- Change port in `connection_app.py`
- Kill existing process: `lsof -ti:8000 | xargs kill -9`

## Testing

### Manual Testing

1. **Start Backend**
   ```bash
   python connection_app.py
   ```

2. **Test SSH Connection**
   ```bash
   curl -X POST http://localhost:8000/connections/ssh \
     -H "Content-Type: application/json" \
     -d '{
       "host": "your-server.com",
       "username": "your-user",
       "password": "your-password",
       "port": 22
     }'
   ```

3. **Test File Listing**
   ```bash
   curl http://localhost:8000/connections/{session_id}/files
   ```

4. **Test Command Execution**
   ```bash
   curl -X POST http://localhost:8000/connections/{session_id}/execute \
     -H "Content-Type: application/json" \
     -d '{"command": "pwd"}'
   ```

### With Frontend

1. Start backend: `python connection_app.py`
2. Start frontend: `npm start` (from frontend directory)
3. Open ConnectionManager component
4. Click "New Connection"
5. Enter credentials and connect

## Migration Path

### Current: Flask + In-Memory

```
✅ Simple deployment
✅ Fast performance
✅ Easy debugging
❌ Single process
❌ No session persistence
```

### Future: FastAPI + Redis (Optional)

```python
# Async operations
async def connect_ssh(...)
  
# Session storage
redis_client.setex(session_id, 1800, json.dumps(session))

# WebSocket terminal
@app.websocket("/ws/terminal/{session_id}")
async def terminal_ws(...)
```

**When to migrate:**
- Need >100 concurrent sessions
- Require session persistence
- Want WebSocket terminal
- Need horizontal scaling

## Dependencies

```
flask==3.0.0              # Web framework
flask-cors==4.0.0         # CORS support
paramiko==3.4.0           # SSH/SFTP
cryptography==41.0.7      # Encryption (paramiko dependency)
python-dotenv==1.0.1      # Environment variables
```

## License

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved.

## Support

For issues or questions:
1. Check this README
2. Review error messages in terminal
3. Check backend logs
4. Verify network connectivity

## Version

**1.0.0** - Initial Flask implementation
- SSH/SFTP support
- FTP/FTPS support
- In-memory sessions
- File operations
- Command execution
