"""
CoreAstra File Manager Service
Handles local and remote file operations with security controls.

Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
All rights reserved. Unauthorized usage or distribution is prohibited.
"""

import os
import shutil
import mimetypes
import asyncio
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from datetime import datetime
import hashlib
import json
import base64

from logger import logger, audit_log


class FileInfo:
    """File/Directory information container."""
    
    def __init__(self, path: str, is_directory: bool, size: int, modified: datetime,
                 permissions: str = "", is_hidden: bool = False):
        self.path = path
        self.name = os.path.basename(path)
        self.is_directory = is_directory
        self.size = size
        self.modified = modified
        self.permissions = permissions
        self.is_hidden = is_hidden
        self.extension = os.path.splitext(path)[1].lower() if not is_directory else ""
        self.mime_type = mimetypes.guess_type(path)[0] if not is_directory else "directory"
    
    def to_dict(self) -> Dict:
        return {
            "path": self.path,
            "name": self.name,
            "is_directory": self.is_directory,
            "size": self.size,
            "size_formatted": self._format_size(self.size),
            "modified": self.modified.isoformat(),
            "permissions": self.permissions,
            "is_hidden": self.is_hidden,
            "extension": self.extension,
            "mime_type": self.mime_type or "unknown",
            "icon": self._get_icon()
        }
    
    def _format_size(self, size: int) -> str:
        """Format size in human readable format."""
        if size < 1024:
            return f"{size} B"
        elif size < 1024 * 1024:
            return f"{size / 1024:.1f} KB"
        elif size < 1024 * 1024 * 1024:
            return f"{size / (1024 * 1024):.1f} MB"
        else:
            return f"{size / (1024 * 1024 * 1024):.2f} GB"
    
    def _get_icon(self) -> str:
        """Get icon name based on file type."""
        if self.is_directory:
            return "folder"
        
        icon_map = {
            ".py": "python",
            ".js": "javascript",
            ".ts": "typescript",
            ".tsx": "react",
            ".jsx": "react",
            ".html": "html",
            ".css": "css",
            ".json": "json",
            ".md": "markdown",
            ".txt": "text",
            ".pdf": "pdf",
            ".jpg": "image",
            ".jpeg": "image",
            ".png": "image",
            ".gif": "image",
            ".svg": "image",
            ".mp4": "video",
            ".mp3": "audio",
            ".zip": "archive",
            ".tar": "archive",
            ".gz": "archive",
            ".exe": "executable",
            ".sh": "shell",
            ".bat": "shell",
            ".ps1": "powershell",
            ".yaml": "config",
            ".yml": "config",
            ".env": "config",
            ".git": "git",
            ".gitignore": "git",
        }
        return icon_map.get(self.extension, "file")


class FileManager:
    """Secure file management service."""
    
    # Dangerous paths that should never be modified
    PROTECTED_PATHS = [
        "/",
        "/bin",
        "/sbin",
        "/etc",
        "/usr",
        "/boot",
        "/sys",
        "/proc",
        "C:\\Windows",
        "C:\\Windows\\System32",
        "C:\\Program Files",
        "C:\\Program Files (x86)",
    ]
    
    # Dangerous file patterns
    DANGEROUS_PATTERNS = [
        ".bashrc",
        ".profile",
        ".bash_profile",
        "passwd",
        "shadow",
        "sudoers",
        "hosts",
        "id_rsa",
        "id_ed25519",
    ]
    
    def __init__(self, workspace_root: Optional[str] = None):
        self.workspace_root = workspace_root or os.path.expanduser("~")
        self.current_path = self.workspace_root
        self._temp_cache: Dict[str, str] = {}  # For remote file editing
        self._text_mime_prefixes = {"text/", "application/json", "application/xml"}
        self._text_extensions = {
            ".txt",
            ".py",
            ".js",
            ".ts",
            ".tsx",
            ".jsx",
            ".html",
            ".css",
            ".json",
            ".md",
            ".csv",
            ".ini",
            ".cfg",
            ".env",
            ".yml",
            ".yaml",
            ".log",
        }
    
    def _is_safe_path(self, path: str) -> Tuple[bool, str]:
        """Check if path is safe to access/modify."""
        try:
            abs_path = os.path.abspath(path)
            
            # Check against protected paths
            for protected in self.PROTECTED_PATHS:
                if abs_path.lower().startswith(protected.lower()):
                    # Allow reading but not writing to these
                    return True, "read_only"
            
            # Check for dangerous files
            basename = os.path.basename(abs_path)
            for pattern in self.DANGEROUS_PATTERNS:
                if pattern in basename.lower():
                    return True, "dangerous"
            
            return True, "safe"
        except Exception as e:
            logger.error(f"Path safety check failed: {e}")
            return False, str(e)
    
    async def list_directory(self, path: Optional[str] = None, 
                            show_hidden: bool = False,
                            sort_by: str = "name") -> Dict:
        """List contents of a directory."""
        target_path = path or self.current_path
        
        try:
            abs_path = os.path.abspath(target_path)
            
            if not os.path.exists(abs_path):
                return {"success": False, "error": "Path does not exist"}
            
            if not os.path.isdir(abs_path):
                return {"success": False, "error": "Path is not a directory"}
            
            items: List[FileInfo] = []
            
            for item_name in os.listdir(abs_path):
                item_path = os.path.join(abs_path, item_name)
                
                # Skip hidden files if not requested
                is_hidden = item_name.startswith(".") or item_name.startswith("$")
                if is_hidden and not show_hidden:
                    continue
                
                try:
                    stat_info = os.stat(item_path)
                    is_dir = os.path.isdir(item_path)
                    
                    # Get permissions string (Unix style)
                    try:
                        mode = stat_info.st_mode
                        perms = ""
                        perms += "d" if is_dir else "-"
                        perms += "r" if mode & 0o400 else "-"
                        perms += "w" if mode & 0o200 else "-"
                        perms += "x" if mode & 0o100 else "-"
                        perms += "r" if mode & 0o040 else "-"
                        perms += "w" if mode & 0o020 else "-"
                        perms += "x" if mode & 0o010 else "-"
                        perms += "r" if mode & 0o004 else "-"
                        perms += "w" if mode & 0o002 else "-"
                        perms += "x" if mode & 0o001 else "-"
                    except:
                        perms = "----------"
                    
                    file_info = FileInfo(
                        path=item_path,
                        is_directory=is_dir,
                        size=stat_info.st_size if not is_dir else 0,
                        modified=datetime.fromtimestamp(stat_info.st_mtime),
                        permissions=perms,
                        is_hidden=is_hidden
                    )
                    items.append(file_info)
                except PermissionError:
                    # Skip files we can't access
                    continue
                except Exception as e:
                    logger.warning(f"Error accessing {item_path}: {e}")
                    continue
            
            # Sort items
            if sort_by == "name":
                items.sort(key=lambda x: (not x.is_directory, x.name.lower()))
            elif sort_by == "size":
                items.sort(key=lambda x: (not x.is_directory, -x.size))
            elif sort_by == "modified":
                items.sort(key=lambda x: (not x.is_directory, -x.modified.timestamp()))
            elif sort_by == "type":
                items.sort(key=lambda x: (not x.is_directory, x.extension, x.name.lower()))
            
            # Get parent path
            parent_path = os.path.dirname(abs_path) if abs_path != os.path.dirname(abs_path) else None
            
            audit_log("file_list", {"path": abs_path, "item_count": len(items)})
            
            return {
                "success": True,
                "path": abs_path,
                "parent": parent_path,
                "items": [item.to_dict() for item in items],
                "item_count": len(items)
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to list directory: {e}")
            return {"success": False, "error": str(e)}
    
    async def read_file(self, path: str, encoding: str = "utf-8") -> Dict:
        """Read file contents."""
        try:
            abs_path = os.path.abspath(path)
            
            if not os.path.exists(abs_path):
                return {"success": False, "error": "File does not exist"}
            
            if os.path.isdir(abs_path):
                return {"success": False, "error": "Path is a directory"}
            
            # Check file size (limit to 50MB for text files)
            size = os.path.getsize(abs_path)
            if size > 50 * 1024 * 1024:
                return {
                    "success": False, 
                    "error": "File too large (max 50MB for text files)",
                    "size": size
                }
            
            # Determine if file is binary
            mime_type = mimetypes.guess_type(abs_path)[0]
            is_binary = False
            content = None

            if mime_type:
                is_binary = not mime_type.startswith("text/") and \
                            "json" not in mime_type and \
                            "xml" not in mime_type
            
            if is_binary:
                return {
                    "success": True,
                    "path": abs_path,
                    "name": os.path.basename(abs_path),
                    "content": None,
                    "size": size,
                    "modified": datetime.fromtimestamp(os.stat(abs_path).st_mtime).isoformat(),
                    "mime_type": mime_type,
                    "is_binary": True,
                    "message": "This is a binary file. Please download it to view."
                }
            
            # Read file
            try:
                with open(abs_path, "r", encoding=encoding) as f:
                    content = f.read()
            except UnicodeDecodeError:
                try:
                    # Try with different encoding
                    with open(abs_path, "r", encoding="latin-1") as f:
                        content = f.read()
                except Exception as e:
                     return {
                        "success": False,
                        "error": f"Could not read file with utf-8 or latin-1 encoding: {e}",
                    }
            
            # Get file info
            stat_info = os.stat(abs_path)
            
            audit_log("file_read", {"path": abs_path, "size": size})
            
            return {
                "success": True,
                "path": abs_path,
                "name": os.path.basename(abs_path),
                "content": content,
                "size": size,
                "modified": datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                "mime_type": mime_type,
                "encoding": encoding,
                "line_count": content.count("\n") + 1
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to read file: {e}")
            return {"success": False, "error": str(e)}
    
    async def write_file(self, path: str, content: str, 
                        create_backup: bool = True,
                        encoding: str = "utf-8") -> Dict:
        """Write content to file."""
        try:
            abs_path = os.path.abspath(path)
            
            # Safety check
            is_safe, safety_status = self._is_safe_path(abs_path)
            if safety_status == "read_only":
                return {"success": False, "error": "Path is read-only (system protected)"}
            if safety_status == "dangerous":
                return {"success": False, "error": "Modifying this file could be dangerous"}
            
            # Create backup if file exists
            backup_path = None
            if create_backup and os.path.exists(abs_path):
                backup_dir = os.path.join(os.path.dirname(abs_path), ".coreastra_backups")
                os.makedirs(backup_dir, exist_ok=True)
                
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                backup_name = f"{os.path.basename(abs_path)}.{timestamp}.bak"
                backup_path = os.path.join(backup_dir, backup_name)
                
                shutil.copy2(abs_path, backup_path)
            
            # Write file
            os.makedirs(os.path.dirname(abs_path), exist_ok=True)
            with open(abs_path, "w", encoding=encoding) as f:
                f.write(content)
            
            audit_log("file_write", {
                "path": abs_path, 
                "size": len(content),
                "backup": backup_path
            })
            
            return {
                "success": True,
                "path": abs_path,
                "size": len(content),
                "backup_path": backup_path,
                "message": "File saved successfully"
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to write file: {e}")
            return {"success": False, "error": str(e)}
    
    def _should_treat_as_text(self, path: str, mime_type: Optional[str]) -> bool:
        """Determine if a file should be handled as text."""
        if mime_type:
            if any(mime_type.startswith(prefix) for prefix in self._text_mime_prefixes):
                return True
            if mime_type in {"application/javascript", "application/typescript"}:
                return True
        extension = os.path.splitext(path)[1].lower()
        return extension in self._text_extensions

    async def get_metadata(self, path: str) -> Dict:
        """Return metadata for a file or directory."""
        try:
            abs_path = os.path.abspath(path)

            if not os.path.exists(abs_path):
                return {"success": False, "error": "Path does not exist"}

            stat_info = os.stat(abs_path)
            is_directory = os.path.isdir(abs_path)
            mime_type = "directory" if is_directory else mimetypes.guess_type(abs_path)[0]

            return {
                "success": True,
                "path": abs_path,
                "name": os.path.basename(abs_path),
                "size": stat_info.st_size,
                "modified": datetime.fromtimestamp(stat_info.st_mtime).isoformat(),
                "is_directory": is_directory,
                "mime_type": mime_type or "application/octet-stream",
                "can_preview": not is_directory,
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to read metadata: {e}")
            return {"success": False, "error": str(e)}

    async def preview_file(self, path: str, max_bytes: int = 512 * 1024) -> Dict:
        """Return a lightweight preview for the given file."""
        try:
            abs_path = os.path.abspath(path)

            if not os.path.exists(abs_path):
                return {"success": False, "error": "File does not exist"}

            if os.path.isdir(abs_path):
                return {"success": False, "error": "Cannot preview a directory"}

            file_size = os.path.getsize(abs_path)
            mime_type = mimetypes.guess_type(abs_path)[0] or "application/octet-stream"
            treat_as_text = self._should_treat_as_text(abs_path, mime_type)

            # Read only the required portion of the file in binary mode
            with open(abs_path, "rb") as f:
                raw_content = f.read(max(1, max_bytes))

            truncated = file_size > len(raw_content)

            if treat_as_text:
                try:
                    content = raw_content.decode("utf-8")
                    encoding_used = "utf-8"
                except UnicodeDecodeError:
                    content = raw_content.decode("latin-1")
                    encoding_used = "latin-1"

                audit_log(
                    "file_preview",
                    {"path": abs_path, "size": file_size, "truncated": truncated},
                )

                return {
                    "success": True,
                    "path": abs_path,
                    "name": os.path.basename(abs_path),
                    "mime_type": mime_type,
                    "encoding": "text",
                    "encoding_used": encoding_used,
                    "content": content,
                    "truncated": truncated,
                    "size": file_size,
                }

            # Binary preview encoded in base64
            encoded_content = base64.b64encode(raw_content).decode("ascii")

            audit_log(
                "file_preview",
                {"path": abs_path, "size": file_size, "truncated": truncated},
            )

            return {
                "success": True,
                "path": abs_path,
                "name": os.path.basename(abs_path),
                "mime_type": mime_type,
                "encoding": "base64",
                "content": encoded_content,
                "truncated": truncated,
                "size": file_size,
            }

        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to preview file: {e}")
            return {"success": False, "error": str(e)}

    async def prepare_download(self, path: str) -> Dict:
        """Validate and prepare a file for download."""
        try:
            abs_path = os.path.abspath(path)

            if not os.path.exists(abs_path):
                return {"success": False, "error": "File does not exist"}

            if os.path.isdir(abs_path):
                return {"success": False, "error": "Cannot download a directory"}

            mime_type = mimetypes.guess_type(abs_path)[0] or "application/octet-stream"

            audit_log("file_download_prepare", {"path": abs_path, "mime_type": mime_type})

            return {
                "success": True,
                "path": abs_path,
                "name": os.path.basename(abs_path),
                "mime_type": mime_type,
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to prepare download: {e}")
            return {"success": False, "error": str(e)}

    async def create_file(self, path: str, content: str = "") -> Dict:
        """Create a new file."""
        abs_path = os.path.abspath(path)
        
        if os.path.exists(abs_path):
            return {"success": False, "error": "File already exists"}
        
        return await self.write_file(path, content, create_backup=False)
    
    async def create_directory(self, path: str) -> Dict:
        """Create a new directory."""
        try:
            abs_path = os.path.abspath(path)
            
            if os.path.exists(abs_path):
                return {"success": False, "error": "Path already exists"}
            
            os.makedirs(abs_path)
            
            audit_log("directory_create", {"path": abs_path})
            
            return {
                "success": True,
                "path": abs_path,
                "message": "Directory created successfully"
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to create directory: {e}")
            return {"success": False, "error": str(e)}

    async def get_download_path(self, path: str) -> Dict:
        """Get the safe path for a file to be downloaded."""
        try:
            abs_path = os.path.abspath(path)

            if not os.path.exists(abs_path):
                return {"success": False, "error": "File does not exist"}

            if os.path.isdir(abs_path):
                return {"success": False, "error": "Path is a directory, cannot download"}

            # Basic safety check
            is_safe, _ = self._is_safe_path(abs_path)
            if not is_safe:
                return {"success": False, "error": "Access to this file is restricted"}

            return {"success": True, "path": abs_path}
        except Exception as e:
            logger.error(f"Failed to get download path: {e}")
            return {"success": False, "error": str(e)}

    async def delete(self, path: str, require_confirmation: bool = True) -> Dict:
        """Delete a file or directory."""
        try:
            abs_path = os.path.abspath(path)
            
            if not os.path.exists(abs_path):
                return {"success": False, "error": "Path does not exist"}
            
            # Safety check
            is_safe, safety_status = self._is_safe_path(abs_path)
            if safety_status in ["read_only", "dangerous"]:
                return {"success": False, "error": "Cannot delete protected/dangerous path"}
            
            is_dir = os.path.isdir(abs_path)
            
            if is_dir:
                # Check if directory is empty
                contents = os.listdir(abs_path)
                if contents and require_confirmation:
                    return {
                        "success": False,
                        "requires_confirmation": True,
                        "error": f"Directory not empty ({len(contents)} items)",
                        "item_count": len(contents)
                    }
                shutil.rmtree(abs_path)
            else:
                os.remove(abs_path)
            
            audit_log("file_delete", {"path": abs_path, "is_directory": is_dir})
            
            return {
                "success": True,
                "path": abs_path,
                "message": f"{'Directory' if is_dir else 'File'} deleted successfully"
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to delete: {e}")
            return {"success": False, "error": str(e)}
    
    async def rename(self, old_path: str, new_name: str) -> Dict:
        """Rename a file or directory."""
        try:
            abs_old = os.path.abspath(old_path)
            
            if not os.path.exists(abs_old):
                return {"success": False, "error": "Path does not exist"}
            
            # New path is in the same directory
            new_path = os.path.join(os.path.dirname(abs_old), new_name)
            
            if os.path.exists(new_path):
                return {"success": False, "error": "Target name already exists"}
            
            os.rename(abs_old, new_path)
            
            audit_log("file_rename", {"old_path": abs_old, "new_path": new_path})
            
            return {
                "success": True,
                "old_path": abs_old,
                "new_path": new_path,
                "message": "Renamed successfully"
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to rename: {e}")
            return {"success": False, "error": str(e)}
    
    async def copy(self, source: str, destination: str) -> Dict:
        """Copy a file or directory."""
        try:
            abs_source = os.path.abspath(source)
            abs_dest = os.path.abspath(destination)
            
            if not os.path.exists(abs_source):
                return {"success": False, "error": "Source does not exist"}
            
            if os.path.isdir(abs_source):
                shutil.copytree(abs_source, abs_dest)
            else:
                os.makedirs(os.path.dirname(abs_dest), exist_ok=True)
                shutil.copy2(abs_source, abs_dest)
            
            audit_log("file_copy", {"source": abs_source, "destination": abs_dest})
            
            return {
                "success": True,
                "source": abs_source,
                "destination": abs_dest,
                "message": "Copied successfully"
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to copy: {e}")
            return {"success": False, "error": str(e)}
    
    async def move(self, source: str, destination: str) -> Dict:
        """Move a file or directory."""
        try:
            abs_source = os.path.abspath(source)
            abs_dest = os.path.abspath(destination)
            
            if not os.path.exists(abs_source):
                return {"success": False, "error": "Source does not exist"}
            
            os.makedirs(os.path.dirname(abs_dest), exist_ok=True)
            shutil.move(abs_source, abs_dest)
            
            audit_log("file_move", {"source": abs_source, "destination": abs_dest})
            
            return {
                "success": True,
                "source": abs_source,
                "destination": abs_dest,
                "message": "Moved successfully"
            }
        except PermissionError:
            return {"success": False, "error": "Permission denied"}
        except Exception as e:
            logger.error(f"Failed to move: {e}")
            return {"success": False, "error": str(e)}
    
    async def get_file_checksum(self, path: str, algorithm: str = "sha256") -> Dict:
        """Calculate file checksum."""
        try:
            abs_path = os.path.abspath(path)
            
            if not os.path.exists(abs_path):
                return {"success": False, "error": "File does not exist"}
            
            if os.path.isdir(abs_path):
                return {"success": False, "error": "Cannot checksum directory"}
            
            hash_func = hashlib.new(algorithm)
            with open(abs_path, "rb") as f:
                for chunk in iter(lambda: f.read(8192), b""):
                    hash_func.update(chunk)
            
            return {
                "success": True,
                "path": abs_path,
                "algorithm": algorithm,
                "checksum": hash_func.hexdigest()
            }
        except Exception as e:
            logger.error(f"Failed to calculate checksum: {e}")
            return {"success": False, "error": str(e)}
    
    async def search(self, path: str, pattern: str, 
                    recursive: bool = True,
                    include_content: bool = False) -> Dict:
        """Search for files matching pattern."""
        try:
            abs_path = os.path.abspath(path)
            results = []
            
            if not os.path.exists(abs_path):
                return {"success": False, "error": "Path does not exist"}
            
            import fnmatch
            
            def search_dir(dir_path: str, depth: int = 0):
                if depth > 10:  # Max depth
                    return
                
                try:
                    for item in os.listdir(dir_path):
                        item_path = os.path.join(dir_path, item)
                        
                        # Check filename match
                        if fnmatch.fnmatch(item.lower(), pattern.lower()):
                            results.append({
                                "path": item_path,
                                "name": item,
                                "is_directory": os.path.isdir(item_path),
                                "match_type": "filename"
                            })
                        
                        # Search in content
                        if include_content and os.path.isfile(item_path):
                            try:
                                with open(item_path, "r", encoding="utf-8", errors="ignore") as f:
                                    content = f.read()
                                    if pattern.lower() in content.lower():
                                        results.append({
                                            "path": item_path,
                                            "name": item,
                                            "is_directory": False,
                                            "match_type": "content"
                                        })
                            except:
                                pass
                        
                        # Recurse into directories
                        if recursive and os.path.isdir(item_path):
                            search_dir(item_path, depth + 1)
                except PermissionError:
                    pass
            
            search_dir(abs_path)
            
            return {
                "success": True,
                "path": abs_path,
                "pattern": pattern,
                "results": results[:100],  # Limit results
                "total_found": len(results)
            }
        except Exception as e:
            logger.error(f"Search failed: {e}")
            return {"success": False, "error": str(e)}


# Global file manager instance
file_manager = FileManager()
