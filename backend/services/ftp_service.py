"""
FTP Service - FTP/FTPS Connection Engine
Handles FTP connections for file operations
"""
from ftplib import FTP, FTP_TLS
from typing import Optional
from connection_config import DEFAULT_CONNECTION_TIMEOUT


def open_ftp_connection(
    host: str,
    username: str,
    password: str,
    port: int = 21,
    use_tls: bool = False,
    timeout: int = DEFAULT_CONNECTION_TIMEOUT
):
    """
    Open FTP or FTPS connection
    
    Args:
        host: FTP server hostname or IP
        username: FTP username
        password: FTP password
        port: FTP port (default 21)
        use_tls: Use FTPS (FTP over TLS)
        timeout: Connection timeout in seconds
        
    Returns:
        FTP or FTP_TLS client object
        
    Raises:
        Exception: On connection or authentication failure
    """
    try:
        # Create client
        if use_tls:
            client = FTP_TLS()
        else:
            client = FTP()
        
        # Set timeout
        client.connect(host, port, timeout=timeout)
        
        # Login
        client.login(username, password)
        
        # Enable TLS for data connections if using FTPS
        if use_tls:
            client.prot_p()
        
        return client
        
    except Exception as e:
        raise Exception(f"FTP connection failed: {str(e)}")
