/**
 * CoreAstra File Manager Component
 * AI-Powered Terminal & Intelligent Control Interface
 *
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Box,
  Typography,
  IconButton,
  TextField,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Breadcrumbs,
  Link,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tooltip,
  Chip,
  CircularProgress,
  Paper,
  Divider,
  ToggleButtonGroup,
  ToggleButton,
  InputAdornment,
  Alert,
} from "@mui/material";
import {
  Folder,
  InsertDriveFile,
  ArrowBack,
  Refresh,
  CreateNewFolder,
  NoteAdd,
  Delete,
  Edit,
  ContentCopy,
  ContentCut,
  ContentPaste,
  Search,
  ViewList,
  ViewModule,
  MoreVert,
  Home,
  Code,
  Image,
  PictureAsPdf,
  Archive,
  Description,
  Settings,
  Terminal,
  CloudUpload,
  CloudDownload,
  Storage,
  VisibilityOff,
  Visibility,
  Download,
} from "@mui/icons-material";
import { filesApi } from "../services/api";

interface FileItem {
  path: string;
  name: string;
  is_directory: boolean;
  size: number;
  size_formatted: string;
  modified: string;
  permissions: string;
  is_hidden: boolean;
  extension: string;
  mime_type: string;
  icon: string;
}

interface FilePreviewState {
  file: FileItem;
  content: string;
  encoding: "text" | "base64";
  mimeType: string;
  truncated: boolean;
  size: number;
  encodingUsed?: string;
}

interface FileManagerProps {
  onOpenFile?: (path: string, content: string) => void;
  onRunCommand?: (command: string) => void;
}

const FileManager: React.FC<FileManagerProps> = ({
  onOpenFile,
  onRunCommand,
}) => {
  const [currentPath, setCurrentPath] = useState<string>("");
  const [parentPath, setParentPath] = useState<string | null>(null);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");
  const [showHidden, setShowHidden] = useState(false);
  const [sortBy, setSortBy] = useState<"name" | "size" | "modified" | "type">(
    "name"
  );

  // Selection and clipboard
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<{
    paths: string[];
    operation: "copy" | "cut";
  } | null>(null);

  // Dialogs
  const [newFolderDialog, setNewFolderDialog] = useState(false);
  const [newFileDialog, setNewFileDialog] = useState(false);
  const [renameDialog, setRenameDialog] = useState<FileItem | null>(null);
  const [deleteDialog, setDeleteDialog] = useState<FileItem | null>(null);
  const [filePreviewDialog, setFilePreviewDialog] =
    useState<FilePreviewState | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editLoading, setEditLoading] = useState(false);
  const [downloadLoading, setDownloadLoading] = useState(false);

  // Context menu
  const [contextMenu, setContextMenu] = useState<{
    mouseX: number;
    mouseY: number;
    file: FileItem;
  } | null>(null);

  // Form values
  const [newFolderName, setNewFolderName] = useState("");
  const [newFileName, setNewFileName] = useState("");
  const [renameValue, setRenameValue] = useState("");
  const [editContent, setEditContent] = useState("");

  // Load directory
  const loadDirectory = useCallback(
    async (path?: string) => {
      setLoading(true);
      setError(null);
      try {
        const result = await filesApi.list(path, showHidden, sortBy);
        setCurrentPath(result.path);
        setParentPath(result.parent);
        setFiles(result.items);
        setSelectedFiles(new Set());
      } catch (err: any) {
        setError(err.message || "Failed to load directory");
      } finally {
        setLoading(false);
      }
    },
    [showHidden, sortBy]
  );

  useEffect(() => {
    loadDirectory();
  }, [loadDirectory]);

  // Handle file click
  const handleFileClick = async (file: FileItem) => {
    if (file.is_directory) {
      loadDirectory(file.path);
    } else {
      try {
        setPreviewLoading(true);
        const result = await filesApi.read(file.path);
        if (!result.success) {
          // Handle binary files - offer to download
          if (result.is_binary) {
            setFilePreviewDialog({
              file,
              content: result.message || "This is a binary file. Please download it to view.",
              encoding: "text" as "text" | "base64",
              mimeType: result.mime_type || "application/octet-stream",
              truncated: false,
              size: result.size || 0,
            });
            setEditContent("");
            setIsEditing(false);
          } else {
            throw new Error(result.error || "Failed to open file");
          }
        } else {
          setFilePreviewDialog({
            file,
            content: result.content,
            encoding: "text" as "text" | "base64",
            mimeType: result.mime_type || "text/plain",
            truncated: false,
            size: result.size,
            encodingUsed: result.encoding,
          });
          setEditContent(result.content);
          if (onOpenFile) {
            onOpenFile(file.path, result.content);
          }
          setIsEditing(false);
        }
      } catch (err: any) {
        setError(err.message || "Failed to open file");
      } finally {
        setPreviewLoading(false);
      }
    }
  };

  // Handle file double click
  const handleFileDoubleClick = (file: FileItem) => {
    if (file.is_directory) {
      loadDirectory(file.path);
    } else {
      handleFileClick(file);
    }
  };

  // Navigate up
  const handleNavigateUp = () => {
    if (parentPath) {
      loadDirectory(parentPath);
    }
  };

  // Navigate to path from breadcrumb
  const handleBreadcrumbClick = (path: string) => {
    loadDirectory(path);
  };

  // Get breadcrumb segments
  const getBreadcrumbs = () => {
    if (!currentPath) return [];

    const parts = currentPath.split(/[/\\]/).filter(Boolean);
    const breadcrumbs: { name: string; path: string }[] = [];
    let accumPath = "";

    // Handle Windows drive letter
    if (currentPath.match(/^[A-Za-z]:/)) {
      accumPath = parts[0] + "/";
      breadcrumbs.push({ name: parts[0], path: accumPath });
      parts.shift();
    } else if (currentPath.startsWith("/")) {
      accumPath = "/";
      breadcrumbs.push({ name: "/", path: "/" });
    }

    parts.forEach((part) => {
      accumPath = accumPath + (accumPath.endsWith("/") ? "" : "/") + part;
      breadcrumbs.push({ name: part, path: accumPath });
    });

    return breadcrumbs;
  };

  // Create new folder
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const path = `${currentPath}/${newFolderName}`.replace(/\/+/g, "/");
      await filesApi.mkdir(path);
      setNewFolderDialog(false);
      setNewFolderName("");
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || "Failed to create folder");
    }
  };

  // Create new file
  const handleCreateFile = async () => {
    if (!newFileName.trim()) return;

    try {
      const path = `${currentPath}/${newFileName}`.replace(/\/+/g, "/");
      await filesApi.create(path, "");
      setNewFileDialog(false);
      setNewFileName("");
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || "Failed to create file");
    }
  };

  // Rename file
  const handleRename = async () => {
    if (!renameDialog || !renameValue.trim()) return;

    try {
      await filesApi.rename(renameDialog.path, renameValue);
      setRenameDialog(null);
      setRenameValue("");
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || "Failed to rename");
    }
  };

  // Delete file
  const handleDelete = async (confirmed: boolean = false) => {
    if (!deleteDialog) return;

    try {
      const result = await filesApi.delete(deleteDialog.path, confirmed);
      if (result.requires_confirmation && !confirmed) {
        // Show confirmation dialog for non-empty directories
        return;
      }
      setDeleteDialog(null);
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || "Failed to delete");
    }
  };

  // Download file
  const handleDownload = async (path: string) => {
    try {
      await filesApi.download(path);
    } catch (err: any) {
      setError(err.message || "Failed to download file");
    }
    setContextMenu(null);
  };

  const handleStartEditing = async () => {
    if (!filePreviewDialog || filePreviewDialog.encoding !== "text") return;

    try {
      setEditLoading(true);
      if (filePreviewDialog.truncated) {
        const result = await filesApi.read(filePreviewDialog.file.path);
        if (!result.success) {
          throw new Error(result.error || "Failed to load full file");
        }
        setEditContent(result.content);
        if (onOpenFile) {
          onOpenFile(filePreviewDialog.file.path, result.content);
        }
      }
      if (!filePreviewDialog.truncated) {
        setEditContent(filePreviewDialog.content);
      }
      setIsEditing(true);
    } catch (err: any) {
      setError(err.message || "Failed to load file for editing");
    } finally {
      setEditLoading(false);
    }
  };

  const handleCancelEditing = () => {
    if (!filePreviewDialog) return;
    setIsEditing(false);
    setEditContent(filePreviewDialog.content);
  };

  // Save file content
  const handleSaveFile = async () => {
    if (!filePreviewDialog) return;

    try {
      setEditLoading(true);
      await filesApi.write(filePreviewDialog.file.path, editContent, true);
      setFilePreviewDialog(null);
      setIsEditing(false);
      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || "Failed to save file");
    } finally {
      setEditLoading(false);
    }
  };

  const handleDownloadFile = async (file: FileItem) => {
    try {
      setDownloadLoading(true);
      await filesApi.download(file.path);
    } catch (err: any) {
      setError(err.message || "Failed to download file");
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleClosePreview = () => {
    setFilePreviewDialog(null);
    setIsEditing(false);
    setEditContent("");
    setEditLoading(false);
    setDownloadLoading(false);
    setPreviewLoading(false);
  };

  // Copy/Cut to clipboard
  const handleCopy = (cut: boolean = false) => {
    const paths = Array.from(selectedFiles);
    if (paths.length > 0) {
      setClipboard({ paths, operation: cut ? "cut" : "copy" });
    }
    setContextMenu(null);
  };

  // Paste from clipboard
  const handlePaste = async () => {
    if (!clipboard) return;

    try {
      for (const sourcePath of clipboard.paths) {
        const fileName = sourcePath.split(/[/\\]/).pop();
        const destPath = `${currentPath}/${fileName}`.replace(/\/+/g, "/");

        if (clipboard.operation === "copy") {
          await filesApi.copy(sourcePath, destPath);
        } else {
          await filesApi.move(sourcePath, destPath);
        }
      }

      if (clipboard.operation === "cut") {
        setClipboard(null);
      }

      loadDirectory(currentPath);
    } catch (err: any) {
      setError(err.message || "Failed to paste");
    }
  };

  // Context menu
  const handleContextMenu = (event: React.MouseEvent, file: FileItem) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, file });
  };

  // Get file icon
  const getFileIcon = (file: FileItem) => {
    if (file.is_directory) {
      return <Folder sx={{ color: "#89b4f8" }} />;
    }

    const iconMap: Record<string, React.ReactNode> = {
      python: <Code sx={{ color: "#3572A5" }} />,
      javascript: <Code sx={{ color: "#f7df1e" }} />,
      typescript: <Code sx={{ color: "#3178c6" }} />,
      react: <Code sx={{ color: "#61dafb" }} />,
      html: <Code sx={{ color: "#e34c26" }} />,
      css: <Code sx={{ color: "#563d7c" }} />,
      json: <Code sx={{ color: "#cbcb41" }} />,
      markdown: <Description sx={{ color: "#083fa1" }} />,
      text: <Description />,
      pdf: <PictureAsPdf sx={{ color: "#ff5722" }} />,
      image: <Image sx={{ color: "#4caf50" }} />,
      archive: <Archive sx={{ color: "#795548" }} />,
      shell: <Terminal sx={{ color: "#4caf50" }} />,
      powershell: <Terminal sx={{ color: "#012456" }} />,
      config: <Settings sx={{ color: "#9e9e9e" }} />,
    };

    return iconMap[file.icon] || <InsertDriveFile />;
  };

  // Filter files by search
  const filteredFiles = files.filter((file) =>
    file.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: "background.paper",
        borderRadius: 2,
      }}
    >
      {/* Toolbar */}
      <Box
        sx={{
          p: 1.5,
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <Tooltip title="Navigate Up">
          <span>
            <IconButton
              onClick={handleNavigateUp}
              disabled={!parentPath}
              size="small"
            >
              <ArrowBack />
            </IconButton>
          </span>
        </Tooltip>

        <Tooltip title="Go Home">
          <IconButton onClick={() => loadDirectory()} size="small">
            <Home />
          </IconButton>
        </Tooltip>

        <Tooltip title="Refresh">
          <IconButton onClick={() => loadDirectory(currentPath)} size="small">
            <Refresh />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        <Tooltip title="New Folder">
          <IconButton onClick={() => setNewFolderDialog(true)} size="small">
            <CreateNewFolder />
          </IconButton>
        </Tooltip>

        <Tooltip title="New File">
          <IconButton onClick={() => setNewFileDialog(true)} size="small">
            <NoteAdd />
          </IconButton>
        </Tooltip>

        <Divider orientation="vertical" flexItem sx={{ mx: 1 }} />

        <Tooltip title={showHidden ? "Hide Hidden Files" : "Show Hidden Files"}>
          <IconButton onClick={() => setShowHidden(!showHidden)} size="small">
            {showHidden ? <Visibility /> : <VisibilityOff />}
          </IconButton>
        </Tooltip>

        <Box sx={{ flexGrow: 1 }} />

        <TextField
          size="small"
          placeholder="Search..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <Search fontSize="small" />
              </InputAdornment>
            ),
          }}
          sx={{ width: 200 }}
        />

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_, val) => val && setViewMode(val)}
          size="small"
        >
          <ToggleButton value="list">
            <ViewList fontSize="small" />
          </ToggleButton>
          <ToggleButton value="grid">
            <ViewModule fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Breadcrumbs */}
      <Box
        sx={{
          px: 2,
          py: 1,
          borderBottom: "1px solid",
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <Breadcrumbs maxItems={6} sx={{ fontSize: "0.875rem" }}>
          {getBreadcrumbs().map((crumb, index, array) =>
            index === array.length - 1 ? (
              <Typography
                key={crumb.path}
                color="text.primary"
                sx={{ fontSize: "0.875rem", fontWeight: 500 }}
              >
                {crumb.name}
              </Typography>
            ) : (
              <Link
                key={crumb.path}
                component="button"
                onClick={() => handleBreadcrumbClick(crumb.path)}
                sx={{ fontSize: "0.875rem", cursor: "pointer" }}
              >
                {crumb.name}
              </Link>
            )
          )}
        </Breadcrumbs>
      </Box>

      {/* Error Alert */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mx: 2, mt: 1 }}
        >
          {error}
        </Alert>
      )}

      {/* Clipboard indicator */}
      {clipboard && (
        <Box
          sx={{
            px: 2,
            py: 0.5,
            bgcolor: "info.main",
            color: "info.contrastText",
          }}
        >
          <Typography variant="caption">
            {clipboard.paths.length} item(s) in clipboard ({clipboard.operation}
            )
            <Button
              size="small"
              color="inherit"
              onClick={() => setClipboard(null)}
              sx={{ ml: 1 }}
            >
              Clear
            </Button>
            <Button
              size="small"
              color="inherit"
              onClick={handlePaste}
              sx={{ ml: 1 }}
            >
              Paste Here
            </Button>
          </Typography>
        </Box>
      )}

      {/* File List */}
      <Box sx={{ flexGrow: 1, overflow: "auto", p: 1 }}>
        {loading ? (
          <Box sx={{ display: "flex", justifyContent: "center", py: 4 }}>
            <CircularProgress />
          </Box>
        ) : filteredFiles.length === 0 ? (
          <Box
            sx={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              py: 4,
              color: "text.secondary",
            }}
          >
            <Storage sx={{ fontSize: 48, mb: 1, opacity: 0.5 }} />
            <Typography>No files found</Typography>
          </Box>
        ) : viewMode === "list" ? (
          <List dense>
            {filteredFiles.map((file) => (
              <ListItem
                key={file.path}
                button
                selected={selectedFiles.has(file.path)}
                onClick={() => handleFileClick(file)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  "&:hover": { bgcolor: "action.hover" },
                  "&.Mui-selected": { bgcolor: "action.selected" },
                  opacity: file.is_hidden ? 0.6 : 1,
                }}
              >
                <ListItemIcon sx={{ minWidth: 36 }}>
                  {getFileIcon(file)}
                </ListItemIcon>
                <ListItemText
                  primary={file.name}
                  secondary={
                    <Box
                      component="span"
                      sx={{ display: "flex", gap: 2, fontSize: "0.75rem" }}
                    >
                      <span>{file.size_formatted}</span>
                      <span>{new Date(file.modified).toLocaleString()}</span>
                      <span>{file.permissions}</span>
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <IconButton
                    edge="end"
                    size="small"
                    onClick={(e) => {
                      e.stopPropagation();
                      setContextMenu({
                        mouseX: e.clientX,
                        mouseY: e.clientY,
                        file,
                      });
                    }}
                  >
                    <MoreVert fontSize="small" />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        ) : (
          <Box
            sx={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
              gap: 2,
            }}
          >
            {filteredFiles.map((file) => (
              <Paper
                key={file.path}
                elevation={0}
                onClick={() => handleFileClick(file)}
                onDoubleClick={() => handleFileDoubleClick(file)}
                onContextMenu={(e) => handleContextMenu(e, file)}
                sx={{
                  p: 1.5,
                  textAlign: "center",
                  cursor: "pointer",
                  border: "1px solid",
                  borderColor: selectedFiles.has(file.path)
                    ? "primary.main"
                    : "divider",
                  borderRadius: 2,
                  "&:hover": { bgcolor: "action.hover" },
                  opacity: file.is_hidden ? 0.6 : 1,
                }}
              >
                <Box sx={{ fontSize: 32, mb: 0.5 }}>{getFileIcon(file)}</Box>
                <Typography variant="caption" noWrap sx={{ display: "block" }}>
                  {file.name}
                </Typography>
              </Paper>
            ))}
          </Box>
        )}
      </Box>

      {/* Status Bar */}
      <Box
        sx={{
          px: 2,
          py: 0.5,
          borderTop: "1px solid",
          borderColor: "divider",
          bgcolor: "action.hover",
        }}
      >
        <Typography variant="caption" color="text.secondary">
          {filteredFiles.length} items
          {selectedFiles.size > 0 && ` | ${selectedFiles.size} selected`}
        </Typography>
      </Box>

      {/* Context Menu */}
      <Menu
        open={contextMenu !== null}
        onClose={() => setContextMenu(null)}
        anchorReference="anchorPosition"
        anchorPosition={
          contextMenu
            ? { top: contextMenu.mouseY, left: contextMenu.mouseX }
            : undefined
        }
      >
        <MenuItem onClick={() => handleFileClick(contextMenu!.file)}>
          <ListItemIcon>
            <Edit fontSize="small" />
          </ListItemIcon>
          <ListItemText>Open / Edit</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleDownload(contextMenu!.file.path)}>
            <ListItemIcon>
                <Download fontSize="small" />
            </ListItemIcon>
            <ListItemText>Download</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => handleCopy(false)}>
          <ListItemIcon>
            <ContentCopy fontSize="small" />
          </ListItemIcon>
          <ListItemText>Copy</ListItemText>
        </MenuItem>
        <MenuItem onClick={() => handleCopy(true)}>
          <ListItemIcon>
            <ContentCut fontSize="small" />
          </ListItemIcon>
          <ListItemText>Cut</ListItemText>
        </MenuItem>
        {clipboard && (
          <MenuItem onClick={handlePaste}>
            <ListItemIcon>
              <ContentPaste fontSize="small" />
            </ListItemIcon>
            <ListItemText>Paste</ListItemText>
          </MenuItem>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            if (contextMenu) setDeleteDialog(contextMenu.file);
            setContextMenu(null);
          }}
        >
          <ListItemIcon>
            <Delete fontSize="small" color="error" />
          </ListItemIcon>
          <ListItemText sx={{ color: "error.main" }}>Delete</ListItemText>
        </MenuItem>
      </Menu>

      {/* New Folder Dialog */}
      <Dialog open={newFolderDialog} onClose={() => setNewFolderDialog(false)}>
        <DialogTitle>Create New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="Folder Name"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFolder()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateFolder} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* New File Dialog */}
      <Dialog open={newFileDialog} onClose={() => setNewFileDialog(false)}>
        <DialogTitle>Create New File</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="File Name"
            value={newFileName}
            onChange={(e) => setNewFileName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleCreateFile()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFileDialog(false)}>Cancel</Button>
          <Button onClick={handleCreateFile} variant="contained">
            Create
          </Button>
        </DialogActions>
      </Dialog>

      {/* Rename Dialog */}
      <Dialog
        open={renameDialog !== null}
        onClose={() => setRenameDialog(null)}
      >
        <DialogTitle>Rename</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            label="New Name"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleRename()}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialog(null)}>Cancel</Button>
          <Button onClick={handleRename} variant="contained">
            Rename
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={deleteDialog !== null}
        onClose={() => setDeleteDialog(null)}
      >
        <DialogTitle>
          Delete {deleteDialog?.is_directory ? "Folder" : "File"}
        </DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete{" "}
            <strong>{deleteDialog?.name}</strong>?
            {deleteDialog?.is_directory && " This will delete all contents."}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialog(null)}>Cancel</Button>
          <Button
            onClick={() => handleDelete(true)}
            color="error"
            variant="contained"
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* File Preview Dialog */}
      <Dialog
        open={filePreviewDialog !== null}
        onClose={handleClosePreview}
        fullWidth
        maxWidth="md"
      >
        {filePreviewDialog && (
          <>
            <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
              {getFileIcon(filePreviewDialog.file)}
              {filePreviewDialog.file.name}
              <Chip
                label={filePreviewDialog.file.size_formatted}
                size="small"
                sx={{ ml: "auto" }}
              />
            </DialogTitle>
            <DialogContent dividers>
              {previewLoading ? (
                <Box
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    minHeight: 200,
                  }}
                >
                  <CircularProgress size={32} />
                </Box>
              ) : filePreviewDialog.encoding === "text" && filePreviewDialog.content ? (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {filePreviewDialog.truncated && !isEditing && (
                    <Alert severity="info">
                      Preview truncated to conserve resources. Use Edit to load
                      the full file for modifications.
                    </Alert>
                  )}
                  <TextField
                    fullWidth
                    multiline
                    minRows={20}
                    maxRows={30}
                    value={isEditing ? editContent : filePreviewDialog.content}
                    onChange={(e) => setEditContent(e.target.value)}
                    InputProps={{
                      readOnly: !isEditing,
                      sx: {
                        fontFamily: "monospace",
                        fontSize: "0.875rem",
                      },
                    }}
                  />
                </Box>
              ) : filePreviewDialog.encoding === "text" && !filePreviewDialog.content ? (
                <Alert severity="warning" icon={<Download />}>
                  {filePreviewDialog.content || "This is a binary file. Please download it to view."}
                </Alert>
              ) : (
                <Box sx={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {filePreviewDialog.truncated && (
                    <Alert severity="info">
                      Preview truncated to conserve resources. Use Download to
                      retrieve the full file.
                    </Alert>
                  )}
                  {filePreviewDialog.mimeType.startsWith("image/") ? (
                    <Box
                      component="img"
                      src={`data:${filePreviewDialog.mimeType};base64,${filePreviewDialog.content}`}
                      alt={filePreviewDialog.file.name}
                      sx={{
                        maxHeight: 500,
                        objectFit: "contain",
                        borderRadius: 1,
                        border: "1px solid",
                        borderColor: "divider",
                      }}
                    />
                  ) : filePreviewDialog.mimeType === "application/pdf" ? (
                    <Box
                      component="iframe"
                      src={`data:${filePreviewDialog.mimeType};base64,${filePreviewDialog.content}`}
                      title={filePreviewDialog.file.name}
                      sx={{ width: "100%", height: 500, borderRadius: 1, border: 0 }}
                    />
                  ) : (
                    <Alert severity="info">
                      Preview not available for this file type. Use Download to
                      view the full content locally.
                    </Alert>
                  )}
                </Box>
              )}
            </DialogContent>
            <DialogActions sx={{ gap: 1 }}>
              <Button onClick={handleClosePreview}>Close</Button>
              <Button
                onClick={() => handleDownloadFile(filePreviewDialog.file)}
                startIcon={downloadLoading ? undefined : <CloudDownload />}
                variant="outlined"
                disabled={downloadLoading}
              >
                {downloadLoading ? <CircularProgress size={18} /> : "Download"}
              </Button>
              {filePreviewDialog.encoding === "text" && !isEditing && (
                <Button
                  onClick={handleStartEditing}
                  variant="contained"
                  disabled={editLoading}
                >
                  {editLoading ? <CircularProgress size={18} color="inherit" /> : "Edit File"}
                </Button>
              )}
              {filePreviewDialog.encoding === "text" && isEditing && (
                <>
                  <Button onClick={handleCancelEditing}>Cancel Edit</Button>
                  <Button
                    onClick={handleSaveFile}
                    variant="contained"
                    disabled={editLoading}
                  >
                    {editLoading ? <CircularProgress size={18} color="inherit" /> : "Save"}
                  </Button>
                </>
              )}
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default FileManager;
