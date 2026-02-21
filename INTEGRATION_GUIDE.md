# CoreAstra Connection Manager - Complete Integration Guide

## 🎯 Quick Start (3 Steps)

### Step 1: Install Backend Dependencies

```bash
cd backend
pip install -r connection_requirements.txt
```

### Step 2: Start Backend

**Windows:**
```cmd
cd ..
start_connection_backend.bat
```

**Linux/Mac:**
```bash
cd ..
chmod +x start_connection_backend.sh
./start_connection_backend.sh
```

### Step 3: Test Backend

```bash
cd backend
python test_connection_backend.py
```

Expected output:
```
✅ All tests passed!
Backend is ready for frontend integration.
```

---

## 🔧 Integration with Frontend

The React ConnectionManager component is **already configured** and will work automatically once the backend is running.

### Verify Integration

1. **Start Backend** (port 8000)
   ```bash
   python backend/connection_app.py
   ```

2. **Start Frontend** (port 3000)
   ```bash
   cd frontend
   npm start
   ```

3. **Open Connection Manager**
   - Navigate to Connection Manager tab in CoreAstra
   - Click "New Connection"
   - Select SSH or FTP
   - Enter test credentials
   - Click "Connect"

### Expected Behavior

✅ **Success:**
- Connection card appears
- Time remaining countdown starts
- "Browse" button opens file browser
- "Terminal" button (SSH only) opens command executor

❌ **Expected Failures:**
- Invalid credentials → Error alert shows
- Network timeout → "Connection failed" error
- Session expired → "Session expired or not found" error

---

## 📡 API Endpoint Mapping

Frontend component uses `connectionsApi` which maps to:

| Frontend Call | Backend Endpoint | Method |
|--------------|------------------|--------|
| `connectSSH()` | `/connections/ssh` | POST |
| `connectFTP()` | `/connections/ftp` | POST |
| `list()` | `/connections` | GET |
| `disconnect()` | `/connections/{id}` | DELETE |
| `listRemoteFiles()` | `/connections/{id}/files` | GET |
| `downloadFile()` | `/connections/{id}/download` | POST |
| `uploadFile()` | `/connections/{id}/upload` | POST |
| `executeCommand()` | `/connections/{id}/execute` | POST |

---

## 🧪 Testing Real Connections

### Test with Public SSH Server

```bash
# Test with a public SSH testing server
curl -X POST http://localhost:8000/connections/ssh \
  -H "Content-Type: application/json" \
  -d '{
    "host": "test.rebex.net",
    "username": "demo",
    "password": "password",
    "port": 22
  }'
```

Response:
```json
{
  "session_id": "abc123-def456-ghi789"
}
```

### List Files

```bash
curl http://localhost:8000/connections/abc123-def456-ghi789/files
```

### Execute Command

```bash
curl -X POST http://localhost:8000/connections/abc123-def456-ghi789/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la"}'
```

---

## 🔍 Troubleshooting

### Backend Won't Start

**Error:** `ModuleNotFoundError: No module named 'flask'`

**Solution:**
```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r connection_requirements.txt
python connection_app.py
```

---

### Frontend Can't Reach Backend

**Error in browser console:** `Unable to reach the CoreAstra backend`

**Solution:**
1. Verify backend is running: `curl http://localhost:8000/health`
2. Check CORS is enabled (already configured)
3. Verify firewall isn't blocking port 8000

---

### Connection Timeout

**Error:** `Connection error: timed out`

**Solution:**
- Increase timeout in frontend connection form
- Verify remote server is reachable: `ping hostname`
- Check firewall rules on remote server
- Verify SSH/FTP service is running on remote server

---

### Session Expired

**Error:** `Session expired or not found`

**Solution:**
- Sessions expire after 30 minutes of inactivity
- Backend restart clears all sessions
- Reconnect to create new session

---

## 🔒 Security Notes

### Development Mode (Current)

✅ Suitable for:
- Local development
- Admin tools
- Trusted networks
- Internal infrastructure

⚠️ NOT suitable for:
- Public internet exposure
- Multi-user SaaS
- Untrusted networks

### Production Hardening Checklist

If deploying to production:

- [ ] Add authentication (JWT/OAuth)
- [ ] Implement rate limiting
- [ ] Add command whitelisting
- [ ] Enable audit logging
- [ ] Use SSL certificates
- [ ] Validate SSH host keys
- [ ] Add role-based access control
- [ ] Implement session storage (Redis)
- [ ] Add input sanitization
- [ ] Enable security headers (helmet)

---

## 📊 Monitoring

### Health Check

```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "ok",
  "service": "coreastra-connection-manager"
}
```

### List Active Sessions

```bash
curl http://localhost:8000/connections
```

### Cleanup Expired Sessions

```bash
curl -X POST http://localhost:8000/connections/cleanup
```

---

## 🚀 Performance Considerations

### Current Limitations

| Metric | Limit | Reason |
|--------|-------|--------|
| Max sessions | 20 | Configurable in `connection_config.py` |
| Session timeout | 30 min | Configurable |
| Max file size | 1 GB | Memory constraint |
| Concurrent operations | 1 per session | Paramiko limitation |
| Processes | 1 | In-memory sessions |

### Optimization Tips

1. **Increase session timeout** for long operations:
   ```python
   # connection_config.py
   SESSION_TIMEOUT_SECONDS = 3600  # 1 hour
   ```

2. **Adjust max sessions** based on RAM:
   ```python
   # connection_config.py
   MAX_SESSIONS = 50  # More sessions
   ```

3. **File transfer optimization:**
   - Use compression for text files
   - Split large files
   - Use SFTP batch operations

---

## 📈 Scaling Path

### Current: Single Process Flask

```
Client → Flask (port 8000) → SSH/FTP Server
```

**Pros:**
- Simple deployment
- Easy debugging
- Fast for <20 sessions

**Cons:**
- Single point of failure
- No horizontal scaling
- Sessions lost on restart

---

### Future: FastAPI + Redis

```
Client → FastAPI (async) → Redis (sessions) → SSH/FTP Server
         ↓
    WebSocket Terminal
```

**Migration steps:**
1. Replace Flask with FastAPI
2. Add Redis for session storage
3. Implement async SSH operations
4. Add WebSocket for real-time terminal
5. Deploy with Gunicorn + multiple workers

---

## 📝 File Structure Reference

```
CoreAstra/
├── backend/
│   ├── connection_app.py              # Flask app entry
│   ├── connection_config.py           # Configuration
│   ├── connection_requirements.txt    # Dependencies
│   ├── test_connection_backend.py     # Test script
│   ├── CONNECTION_MANAGER_README.md   # Documentation
│   │
│   ├── routes/
│   │   ├── ssh_routes.py             # SSH endpoints
│   │   ├── ftp_routes.py             # FTP endpoints
│   │   └── session_routes.py         # Session management
│   │
│   ├── services/
│   │   ├── ssh_service.py            # Paramiko engine
│   │   ├── ftp_service.py            # FTP engine
│   │   └── session_store.py          # Session manager
│   │
│   └── utils/
│       └── response.py               # Response formatter
│
├── frontend/
│   └── src/
│       ├── components/
│       │   └── ConnectionManager.tsx  # React component
│       └── services/
│           └── api.ts                 # API client
│
├── start_connection_backend.bat      # Windows startup
└── start_connection_backend.sh       # Linux/Mac startup
```

---

## ✅ Validation Checklist

Before considering complete:

- [ ] Backend starts without errors
- [ ] Health check returns 200 OK
- [ ] Test script passes all tests
- [ ] Frontend can reach backend
- [ ] SSH connection dialog opens
- [ ] FTP connection dialog opens
- [ ] Error messages display correctly
- [ ] Sessions appear in list
- [ ] Time remaining updates
- [ ] File browser works
- [ ] Command execution works (SSH)
- [ ] Download works
- [ ] Upload works
- [ ] Disconnect works
- [ ] Auto-cleanup works

---

## 🆘 Support

### Common Issues

1. **Port 8000 already in use**
   ```bash
   # Find process
   lsof -ti:8000
   # Kill it
   kill -9 <PID>
   ```

2. **Module not found**
   ```bash
   pip install -r connection_requirements.txt
   ```

3. **Connection refused**
   - Check remote server is reachable
   - Verify credentials
   - Check firewall

4. **Session expired**
   - Reconnect (normal behavior)
   - Increase timeout if needed

### Debug Mode

Enable Flask debug output:
```python
# connection_app.py
app.run(debug=True, ...)
```

View detailed logs in terminal.

---

## 📚 Additional Resources

- [Paramiko Documentation](http://docs.paramiko.org/)
- [Flask Documentation](https://flask.palletsprojects.com/)
- [React Connection Manager Code](frontend/src/components/ConnectionManager.tsx)
- [Backend README](backend/CONNECTION_MANAGER_README.md)

---

## ✨ Success Criteria

The integration is successful when:

1. ✅ Backend starts on port 8000
2. ✅ Frontend connects to backend
3. ✅ Connection cards appear after connecting
4. ✅ File browser shows remote files
5. ✅ Command execution returns output
6. ✅ Downloads save to local system
7. ✅ Uploads reach remote server
8. ✅ Sessions expire after 30 minutes
9. ✅ Error messages are user-friendly
10. ✅ Disconnects work cleanly

---

## 🎉 Next Steps

After successful integration:

1. Test with real SSH/FTP servers
2. Add custom session names
3. Configure timeout values
4. Test file operations
5. Monitor session lifecycle
6. Test concurrent sessions
7. Verify error handling
8. Test session cleanup

---

**Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)**
All rights reserved.
