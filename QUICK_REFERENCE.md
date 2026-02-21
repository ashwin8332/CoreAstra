# CoreAstra Connection Manager - Quick Reference

## 🚀 START IN 3 STEPS

### 1. Install Dependencies
```bash
cd backend
pip install flask flask-cors paramiko python-dotenv
```

### 2. Start Connection Backend
```bash
cd backend
python connection_app.py
```
**Runs on:** `http://localhost:8001`

### 3. Start Frontend
```bash
cd frontend
npm start
```
**Opens at:** `http://localhost:3000`

---

## 📝 QUICK COMMANDS

### Test Backend
```bash
curl http://localhost:8001/health
python backend/test_connection_backend.py
```

### List Sessions
```bash
curl http://localhost:8001/connections
```

### Cleanup Expired
```bash
curl -X POST http://localhost:8001/connections/cleanup
```

---

## 🔌 API ENDPOINTS

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/health` | GET | Health check |
| `/connections/ssh` | POST | Connect SSH |
| `/connections/ftp` | POST | Connect FTP |
| `/connections` | GET | List sessions |
| `/connections/{id}` | DELETE | Disconnect |
| `/connections/{id}/files` | GET | Browse files |
| `/connections/{id}/execute` | POST | Run command |
| `/connections/{id}/download` | POST | Download file |
| `/connections/{id}/upload` | POST | Upload file |

---

## ⚙️ CONFIGURATION

### Backend Port
**File:** `backend/connection_app.py`
```python
app.run(port=8001, ...)
```

### Session Timeout
**File:** `backend/connection_config.py`
```python
SESSION_TIMEOUT_SECONDS = 1800  # 30 minutes
```

### Frontend URL
**File:** `frontend/src/services/api.ts`
```typescript
const CONNECTION_API_URL = 'http://localhost:8001';
```

---

## 🐛 TROUBLESHOOTING

### Backend Won't Start
```bash
# Check dependencies
pip install flask flask-cors paramiko python-dotenv

# Check port
lsof -ti:8001 | xargs kill -9  # Kill existing process
```

### Can't Connect
```bash
# Test backend
curl http://localhost:8001/health

# Check CORS (already configured)
# Verify port 8001 is accessible
```

### Connection Timeout
- Increase timeout in UI dialog
- Check remote server is reachable: `ping hostname`
- Verify firewall rules

---

## 📁 KEY FILES

```
backend/
├── connection_app.py              # Main Flask app
├── connection_config.py           # Configuration
├── test_connection_backend.py     # Test script
└── routes/
    ├── ssh_routes.py             # SSH endpoints
    ├── ftp_routes.py             # FTP endpoints
    └── session_routes.py         # Session management

frontend/src/
├── components/ConnectionManager.tsx  # UI component
└── services/api.ts                   # API client
```

---

## 📚 DOCUMENTATION

- **IMPLEMENTATION_SUMMARY.md** - Complete architecture
- **INTEGRATION_GUIDE.md** - Step-by-step setup
- **CONNECTION_MANAGER_README.md** - API documentation
- **SETUP_COMPLETE.md** - Features and status

---

## ✅ VERIFICATION

Everything works when:
- ✅ Backend starts on port 8001
- ✅ Health check returns OK
- ✅ Test script passes
- ✅ Connection Manager opens in UI
- ✅ Can connect SSH/FTP
- ✅ Can browse files
- ✅ Can execute commands
- ✅ Can download/upload

---

## 🎯 EXAMPLE USAGE

### Connect SSH
```bash
curl -X POST http://localhost:8001/connections/ssh \
  -H "Content-Type: application/json" \
  -d '{
    "host": "example.com",
    "username": "user",
    "password": "pass",
    "port": 22
  }'
```

### List Files
```bash
curl http://localhost:8001/connections/{session_id}/files?path=/home
```

### Execute Command
```bash
curl -X POST http://localhost:8001/connections/{session_id}/execute \
  -H "Content-Type: application/json" \
  -d '{"command": "ls -la"}'
```

---

## ⚠️ IMPORTANT NOTES

1. **Port 8001** for connection manager (Port 8000 = main backend)
2. **Sessions expire** after 30 minutes
3. **Restart clears** all sessions (in-memory)
4. **Development mode** - not for public internet
5. **Single process** - don't use Gunicorn workers > 1

---

## 🔒 SECURITY STATUS

**Development Mode:**
- ✅ No password storage
- ✅ Auto-expiring sessions
- ✅ In-memory only
- ⚠️ No API authentication
- ⚠️ No rate limiting

**Production Hardening Needed:**
- Add authentication
- Implement rate limiting
- Add audit logging
- Enable SSL/TLS
- Validate host keys

---

## 💡 TIPS

1. **Two backends** run simultaneously:
   - Main backend (8000)
   - Connection manager (8001)

2. **Session lifecycle:**
   - Created on connect
   - Auto-expires after 30 min
   - Cleared on disconnect

3. **File operations:**
   - Downloads save to temp by default
   - Can specify custom local path
   - 1GB file size limit

4. **Error messages:**
   - Check backend logs in terminal
   - Frontend shows user-friendly errors
   - All errors have `detail` field

---

**Need help?** Check the full documentation files!

**Ready to use?** Just start the backend and frontend! 🚀
