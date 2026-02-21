"""
SSH Service - Paramiko Connection Engine
Handles SSH connections, SFTP, and command execution
"""
import paramiko
from typing import Tuple, Optional
from connection_config import DEFAULT_CONNECTION_TIMEOUT


def open_ssh_connection(
    host: str,
    username: str,
    port: int = 22,
    password: Optional[str] = None,
    key_path: Optional[str] = None,
    timeout: int = DEFAULT_CONNECTION_TIMEOUT
) -> Tuple[paramiko.SSHClient, paramiko.SFTPClient]:
    """
    Open SSH connection with optional key-based or password authentication
    
    Args:
        host: Remote hostname or IP
        username: SSH username
        port: SSH port (default 22)
        password: Password for authentication (optional if key_path provided)
        key_path: Path to private key file (optional if password provided)
        timeout: Connection timeout in seconds
        
    Returns:
        Tuple of (SSHClient, SFTPClient)
        
    Raises:
        Exception: On connection failure, authentication failure, etc.
    """
    client = paramiko.SSHClient()
    
    # Auto-add unknown hosts (WARNING: Production should verify host keys)
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    
    try:
        # Key-based authentication
        if key_path:
            # Try multiple key types
            private_key = None
            for key_class in [paramiko.RSAKey, paramiko.Ed25519Key, paramiko.ECDSAKey]:
                try:
                    private_key = key_class.from_private_key_file(key_path)
                    break
                except Exception:
                    continue
            
            if not private_key:
                raise Exception(f"Could not load private key from {key_path}")
            
            client.connect(
                hostname=host,
                port=port,
                username=username,
                pkey=private_key,
                timeout=timeout,
                look_for_keys=False,
                allow_agent=False
            )
        
        # Password authentication
        elif password:
            client.connect(
                hostname=host,
                port=port,
                username=username,
                password=password,
                timeout=timeout,
                look_for_keys=False,
                allow_agent=False
            )
        
        else:
            raise Exception("Either password or key_path must be provided")
        
        # Open SFTP channel for file operations
        sftp = client.open_sftp()
        
        return client, sftp
        
    except paramiko.AuthenticationException:
        client.close()
        raise Exception("Authentication failed - check username/password/key")
    except paramiko.SSHException as e:
        client.close()
        raise Exception(f"SSH connection failed: {str(e)}")
    except Exception as e:
        client.close()
        raise Exception(f"Connection error: {str(e)}")


def execute_ssh_command(client: paramiko.SSHClient, command: str) -> str:
    """
    Execute command on remote SSH server
    
    Args:
        client: Active SSHClient
        command: Shell command to execute
        
    Returns:
        Combined stdout and stderr output
        
    Raises:
        Exception: On execution failure
    """
    try:
        stdin, stdout, stderr = client.exec_command(command)
        
        # Read output (blocking)
        stdout_data = stdout.read().decode('utf-8', errors='replace')
        stderr_data = stderr.read().decode('utf-8', errors='replace')
        
        # Combine output
        output = stdout_data
        if stderr_data:
            output += "\n" + stderr_data
        
        return output.strip()
        
    except Exception as e:
        raise Exception(f"Command execution failed: {str(e)}")
