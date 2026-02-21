"""
CoreAstra Connection Manager - Configuration
Strict configuration for session management and timeouts
"""

# Session Configuration
SESSION_TIMEOUT_SECONDS = 1800  # 30 minutes
MAX_SESSIONS = 20

# Connection Defaults
DEFAULT_SSH_PORT = 22
DEFAULT_FTP_PORT = 21
DEFAULT_CONNECTION_TIMEOUT = 30

# Security
ALLOWED_COMMANDS = None  # None means all commands allowed (admin tool)
MAX_COMMAND_LENGTH = 10000
MAX_FILE_SIZE = 1024 * 1024 * 1024  # 1GB

# Logging
LOG_CONNECTIONS = True
LOG_COMMANDS = True
LOG_FILE_OPERATIONS = True
