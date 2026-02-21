# CoreAstra

## AI-Powered Terminal & Intelligent Control Interface

### Professional-grade GUI application combining a smart terminal with multi-AI chat interface

---

## 🌟 Features

### 🖥️ Smart Terminal

- Full-featured terminal with command history
- Real-time command execution with streaming output
- Syntax highlighting and auto-completion
- Directory navigation

### 🤖 Multi-AI Engine Support

- **Google Gemini** - Advanced reasoning and coding
- **Groq** - Ultra-fast inference
- **Anthropic Claude** - Thoughtful and detailed responses
- **Ollama** - Local-first, privacy-focused AI

### 🛡️ Safety & Security

- **Permission-based execution** - Risky commands require confirmation
- **Automatic backups** - Creates backups before critical operations
- **Risk analysis** - AI-powered command analysis

### 📋 Audit & Logging

- Full command execution history
- Detailed audit trail
- Security event logging
- Session management

### 📊 Task Planning

- AI-generated step-by-step plans
- Execute plans with one click
- Track progress and status

---

## 🚀 Quick Start

### Prerequisites

- **Python 3.10+**
- **Node.js 18+**
- **npm or yarn**

### Backend Setup

```bash
# Navigate to backend directory
cd backend

# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\Scripts\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Copy environment file
copy .env.example .env  # Windows
# cp .env.example .env  # Linux/Mac

# Edit .env and add your API keys

# Start the server
python main.py
```

### Frontend Setup

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm start
```

### Access the Application

Open your browser and navigate to: **<http://localhost:3000>**

---

## ⚙️ Configuration

### Environment Variables

Create a `.env` file in the `backend` directory:

```env
# Application Settings
DEBUG=false
SECRET_KEY=your-super-secret-key-here

# AI Engine API Keys
GEMINI_API_KEY=your-gemini-api-key
GROQ_API_KEY=your-groq-api-key
ANTHROPIC_API_KEY=your-anthropic-api-key
OLLAMA_HOST=http://localhost:11434

# Default AI Engine (ollama, gemini, groq, claude)
DEFAULT_AI_ENGINE=ollama
```

### AI Engine Setup

#### Ollama (Local, Recommended)

```bash
# Install Ollama from https://ollama.ai
# Pull a model
ollama pull llama2
```

#### Gemini

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Create an API key
3. Add to `.env` as `GEMINI_API_KEY`

#### Groq

1. Visit [Groq Console](https://console.groq.com)
2. Create an API key
3. Add to `.env` as `GROQ_API_KEY`

#### Claude

1. Visit [Anthropic Console](https://console.anthropic.com)
2. Create an API key
3. Add to `.env` as `ANTHROPIC_API_KEY`

---

## 🏗️ Architecture

```text
CoreAstra/
├── backend/                 # Python FastAPI Backend
│   ├── main.py             # Application entry point
│   ├── config.py           # Configuration management
│   ├── models.py           # Database models
│   ├── database.py         # Database connection
│   ├── schemas.py          # Pydantic schemas
│   ├── ai_engines.py       # Multi-AI engine support
│   ├── terminal.py         # Terminal execution & safety
│   ├── logger.py           # Logging system
│   ├── requirements.txt    # Python dependencies
│   └── .env.example        # Environment template
│
├── frontend/               # React TypeScript Frontend
│   ├── public/            # Static assets
│   ├── src/
│   │   ├── components/    # React components
│   │   │   ├── Terminal.tsx
│   │   │   ├── AIChat.tsx
│   │   │   ├── TaskPlanner.tsx
│   │   │   └── SystemMonitor.tsx
│   │   ├── services/      # API services
│   │   ├── theme/         # MUI theme
│   │   ├── types/         # TypeScript types
│   │   ├── App.tsx        # Main app component
│   │   └── index.tsx      # Entry point
│   ├── package.json       # NPM dependencies
│   └── tsconfig.json      # TypeScript config
│
└── README.md              # This file
```

---

## 📡 API Endpoints

### Terminal

- `POST /api/terminal/analyze` - Analyze command for risks
- `POST /api/terminal/execute` - Execute command (SSE)
- `POST /api/terminal/cd` - Change directory
- `GET /api/terminal/pwd` - Get current directory

### AI Chat

- `GET /api/ai/engines` - List available AI engines
- `POST /api/ai/chat` - Chat with AI (SSE)
- `POST /api/ai/analyze-command` - AI command analysis
- `GET /api/ai/conversation/{session_id}` - Get conversation

### Tasks

- `POST /api/tasks/plan` - Create task plan
- `GET /api/tasks` - List task plans
- `GET /api/tasks/{id}` - Get task plan

### System

- `GET /api/system/info` - System information
- `GET /api/backups` - List backups
- `POST /api/backups/restore` - Restore backup
- `GET /api/audit` - Audit logs
- `GET /api/commands/history` - Command history

### WebSocket

- `WS /ws/terminal` - Real-time terminal

---

## 🔒 Security Features

### Command Risk Levels

- **Low**: Standard operations (ls, cat, echo)
- **Medium**: Package installs, downloads
- **High**: Permission changes, process kills
- **Critical**: Destructive operations (rm -rf, format)

### Dangerous Command Detection

The system automatically detects and warns about:

- `rm -rf`, `del /f /s /q`
- `format`, `fdisk`, `mkfs`
- `dd if=`, `shutdown`, `reboot`
- Permission changes, registry modifications

---


