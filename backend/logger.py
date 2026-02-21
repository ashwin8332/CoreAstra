"""
CoreAstra Logging System
AI-Powered Terminal & Intelligent Control Interface

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved. Unauthorized usage or distribution is prohibited.
"""

import sys
from loguru import logger
from config import settings
from datetime import datetime

# Remove default handler
logger.remove()

# Console handler with color
logger.add(
    sys.stdout,
    colorize=True,
    format="<green>{time:YYYY-MM-DD HH:mm:ss}</green> | <level>{level: <8}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>",
    level="DEBUG" if settings.DEBUG else "INFO"
)

# File handler for general logs
logger.add(
    settings.LOGS_DIR / "coreastra_{time:YYYY-MM-DD}.log",
    rotation="00:00",
    retention="30 days",
    compression="zip",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {name}:{function}:{line} - {message}",
    level="DEBUG"
)

# Separate file for audit logs
logger.add(
    settings.LOGS_DIR / "audit_{time:YYYY-MM-DD}.log",
    rotation="00:00",
    retention="90 days",
    compression="zip",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}",
    level="INFO",
    filter=lambda record: "audit" in record["extra"]
)

# Separate file for security events
logger.add(
    settings.LOGS_DIR / "security_{time:YYYY-MM-DD}.log",
    rotation="00:00",
    retention="365 days",
    compression="zip",
    format="{time:YYYY-MM-DD HH:mm:ss} | {level: <8} | {message}",
    level="WARNING",
    filter=lambda record: "security" in record["extra"]
)


def audit_log(action: str, details: dict, risk_level: str = "low"):
    """Log audit events."""
    logger.bind(audit=True).info(
        f"ACTION: {action} | RISK: {risk_level} | DETAILS: {details}"
    )


def security_log(event: str, details: dict):
    """Log security events."""
    logger.bind(security=True).warning(
        f"SECURITY: {event} | DETAILS: {details}"
    )


def command_log(command: str, exit_code: int, is_risky: bool):
    """Log command execution."""
    level = "WARNING" if is_risky else "INFO"
    logger.log(level, f"COMMAND: {command} | EXIT: {exit_code} | RISKY: {is_risky}")


# Export logger
__all__ = ["logger", "audit_log", "security_log", "command_log"]
