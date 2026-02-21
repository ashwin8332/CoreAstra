/**
 * CoreAstra Connection Manager Component
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
  Button,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemSecondaryAction,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Tooltip,
  Chip,
  CircularProgress,
  Paper,
  Divider,
  Alert,
  Tabs,
  Tab,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  FormControlLabel,
  Switch,
  LinearProgress,
  Card,
  CardContent,
  CardActions,
  Grid,
  InputAdornment,
} from "@mui/material";
import {
  Computer,
  CloudQueue,
  Wifi,
  WifiOff,
  Add,
  Delete,
  Refresh,
  Folder,
  InsertDriveFile,
  CloudDownload,
  CloudUpload,
  Terminal,
  Timer,
  Lock,
  VpnKey,
  Storage,
  CheckCircle,
  Error as ErrorIcon,
  Schedule,
  Person,
  Dns,
  Close,
} from "@mui/icons-material";
import { connectionsApi } from "../services/api";

interface ConnectionSession {
  session_id: string;
  type: "ssh" | "ftp";
  host: string;
  port: number;
  username: string;
  session_name: string;
  connected_at: string;
  expires_at: string;
  last_activity: string;
  is_active: boolean;
  time_remaining_seconds: number;
}

interface RemoteFile {
  name: string;
  path: string;
  is_directory: boolean;
  size: number;
  size_formatted: string;
  modified: string;
  permissions: string;
}

interface ConnectionManagerProps {
  onFileDownloaded?: (localPath: string) => void;
  onCommandOutput?: (output: string) => void;
}

const ConnectionManager: React.FC<ConnectionManagerProps> = ({
  onFileDownloaded,
  onCommandOutput,
}) => {
  const [sessions, setSessions] = useState<ConnectionSession[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Connection dialog
  const [connectDialog, setConnectDialog] = useState<"ssh" | "ftp" | null>(
    null
  );

  // Active session browser
  const [activeSession, setActiveSession] = useState<string | null>(null);
  const [remotePath, setRemotePath] = useState<string>("");
  const [remoteFiles, setRemoteFiles] = useState<RemoteFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // Command execution
  const [commandDialog, setCommandDialog] = useState(false);
  const [command, setCommand] = useState("");
  const [commandOutput, setCommandOutput] = useState<string | null>(null);

  // Upload/Download dialogs
  const [downloadPath, setDownloadPath] = useState("");
  const [downloadDialog, setDownloadDialog] = useState<RemoteFile | null>(null);
  const [uploadDialog, setUploadDialog] = useState(false);
  const [uploadLocalPath, setUploadLocalPath] = useState("");
  const [uploadRemotePath, setUploadRemotePath] = useState("");

  // Form state
  const [formData, setFormData] = useState({
    host: "",
    port: 22,
    username: "",
    password: "",
    keyPath: "",
    useTLS: false,
    sessionName: "",
    timeout: 30,
  });

  // Load sessions
  const loadSessions = useCallback(async () => {
    try {
      const result = await connectionsApi.list();
      setSessions(result.sessions);
    } catch (err: any) {
      // Don't show error for empty list
    }
  }, []);

  useEffect(() => {
    loadSessions();
    // Refresh every 30 seconds to update time remaining
    const interval = setInterval(loadSessions, 30000);
    return () => clearInterval(interval);
  }, [loadSessions]);

  // Connect SSH
  const handleConnectSSH = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await connectionsApi.connectSSH(
        formData.host,
        formData.username,
        {
          port: formData.port,
          password: formData.password || undefined,
          keyPath: formData.keyPath || undefined,
          timeout: formData.timeout,
          sessionName: formData.sessionName || undefined,
        }
      );
      setSuccess(`Connected to ${formData.host} via SSH`);
      setConnectDialog(null);
      resetForm();
      loadSessions();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "Connection failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // Connect FTP
  const handleConnectFTP = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await connectionsApi.connectFTP(
        formData.host,
        formData.username,
        formData.password,
        {
          port: formData.port,
          useTLS: formData.useTLS,
          timeout: formData.timeout,
          sessionName: formData.sessionName || undefined,
        }
      );
      setSuccess(`Connected to ${formData.host} via FTP`);
      setConnectDialog(null);
      resetForm();
      loadSessions();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || err.message || "Connection failed"
      );
    } finally {
      setLoading(false);
    }
  };

  // Disconnect
  const handleDisconnect = async (sessionId: string) => {
    try {
      await connectionsApi.disconnect(sessionId);
      setSuccess("Disconnected successfully");
      if (activeSession === sessionId) {
        setActiveSession(null);
        setRemoteFiles([]);
      }
      loadSessions();
    } catch (err: any) {
      setError(err.message || "Disconnect failed");
    }
  };

  // Browse remote files
  const loadRemoteFiles = async (sessionId: string, path?: string) => {
    setLoadingFiles(true);
    try {
      const result = await connectionsApi.listRemoteFiles(sessionId, path);
      setRemoteFiles(result.files);
      setRemotePath(result.current_path);
    } catch (err: any) {
      setError(err.message || "Failed to load files");
    } finally {
      setLoadingFiles(false);
    }
  };

  // Handle file click in remote browser
  const handleRemoteFileClick = (file: RemoteFile) => {
    if (file.is_directory) {
      loadRemoteFiles(activeSession!, file.path);
    } else {
      setDownloadDialog(file);
    }
  };

  // Download file
  const handleDownload = async () => {
    if (!downloadDialog || !activeSession) return;

    setLoading(true);
    try {
      const result = await connectionsApi.downloadFile(
        activeSession,
        downloadDialog.path,
        downloadPath || undefined
      );
      setSuccess(`Downloaded to ${result.local_path}`);
      setDownloadDialog(null);
      setDownloadPath("");
      if (onFileDownloaded) {
        onFileDownloaded(result.local_path);
      }
    } catch (err: any) {
      setError(err.message || "Download failed");
    } finally {
      setLoading(false);
    }
  };

  // Upload file
  const handleUpload = async () => {
    if (!uploadLocalPath || !uploadRemotePath || !activeSession) return;

    setLoading(true);
    try {
      await connectionsApi.uploadFile(
        activeSession,
        uploadLocalPath,
        uploadRemotePath
      );
      setSuccess(`Uploaded successfully`);
      setUploadDialog(false);
      setUploadLocalPath("");
      setUploadRemotePath("");
      loadRemoteFiles(activeSession, remotePath);
    } catch (err: any) {
      setError(err.message || "Upload failed");
    } finally {
      setLoading(false);
    }
  };

  // Execute command
  const handleExecuteCommand = async () => {
    if (!command || !activeSession) return;

    setLoading(true);
    setCommandOutput(null);
    try {
      const result = await connectionsApi.executeCommand(
        activeSession,
        command
      );
      setCommandOutput(result.output);
      if (onCommandOutput) {
        onCommandOutput(result.output);
      }
    } catch (err: any) {
      setError(err.message || "Command execution failed");
    } finally {
      setLoading(false);
    }
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      host: "",
      port: connectDialog === "ssh" ? 22 : 21,
      username: "",
      password: "",
      keyPath: "",
      useTLS: false,
      sessionName: "",
      timeout: 30,
    });
  };

  // Format time remaining
  const formatTimeRemaining = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${minutes}m ${secs}s`;
  };

  // Get time progress percentage
  const getTimeProgress = (session: ConnectionSession) => {
    const totalTime = 30 * 60; // 30 minutes default
    const elapsed = totalTime - session.time_remaining_seconds;
    return Math.min((elapsed / totalTime) * 100, 100);
  };

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
      {/* Header */}
      <Box
        sx={{
          p: 2,
          borderBottom: "1px solid",
          borderColor: "divider",
          display: "flex",
          alignItems: "center",
          gap: 1,
        }}
      >
        <CloudQueue sx={{ color: "primary.main" }} />
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Connection Manager
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={loadSessions} size="small">
            <Refresh />
          </IconButton>
        </Tooltip>
        <Button
          variant="contained"
          size="small"
          startIcon={<Add />}
          onClick={() => setConnectDialog("ssh")}
        >
          New Connection
        </Button>
      </Box>

      {/* Alerts */}
      {error && (
        <Alert
          severity="error"
          onClose={() => setError(null)}
          sx={{ mx: 2, mt: 1 }}
        >
          {error}
        </Alert>
      )}
      {success && (
        <Alert
          severity="success"
          onClose={() => setSuccess(null)}
          sx={{ mx: 2, mt: 1 }}
        >
          {success}
        </Alert>
      )}

      {/* Main Content */}
      <Box sx={{ flexGrow: 1, overflow: "auto", p: 2 }}>
        {sessions.length === 0 ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <WifiOff
              sx={{
                fontSize: 64,
                color: "text.secondary",
                opacity: 0.5,
                mb: 2,
              }}
            />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No Active Connections
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Connect to a remote server via SSH or FTP to manage files
            </Typography>
            <Box sx={{ display: "flex", gap: 2, justifyContent: "center" }}>
              <Button
                variant="outlined"
                startIcon={<Terminal />}
                onClick={() => setConnectDialog("ssh")}
              >
                Connect SSH
              </Button>
              <Button
                variant="outlined"
                startIcon={<Storage />}
                onClick={() => setConnectDialog("ftp")}
              >
                Connect FTP
              </Button>
            </Box>
          </Box>
        ) : (
          <Grid container spacing={2}>
            {sessions.map((session) => (
              <Grid item xs={12} md={6} key={session.session_id}>
                <Card
                  variant="outlined"
                  sx={{
                    borderColor:
                      activeSession === session.session_id
                        ? "primary.main"
                        : "divider",
                    cursor: "pointer",
                  }}
                  onClick={() => {
                    setActiveSession(session.session_id);
                    loadRemoteFiles(session.session_id);
                  }}
                >
                  <CardContent>
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mb: 1,
                      }}
                    >
                      {session.is_active ? (
                        <CheckCircle sx={{ color: "success.main" }} />
                      ) : (
                        <ErrorIcon sx={{ color: "error.main" }} />
                      )}
                      <Typography variant="h6" sx={{ flexGrow: 1 }}>
                        {session.session_name || session.host}
                      </Typography>
                      <Chip
                        label={session.type.toUpperCase()}
                        size="small"
                        color={session.type === "ssh" ? "primary" : "secondary"}
                      />
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        gap: 3,
                        mb: 1,
                        color: "text.secondary",
                        fontSize: "0.875rem",
                      }}
                    >
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <Dns fontSize="small" />
                        {session.host}:{session.port}
                      </Box>
                      <Box
                        sx={{ display: "flex", alignItems: "center", gap: 0.5 }}
                      >
                        <Person fontSize="small" />
                        {session.username}
                      </Box>
                    </Box>

                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        mt: 2,
                      }}
                    >
                      <Schedule
                        fontSize="small"
                        sx={{ color: "text.secondary" }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Time remaining:
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={getTimeProgress(session)}
                        sx={{ flexGrow: 1, height: 6, borderRadius: 3 }}
                        color={
                          session.time_remaining_seconds < 300
                            ? "error"
                            : "primary"
                        }
                      />
                      <Typography
                        variant="caption"
                        color={
                          session.time_remaining_seconds < 300
                            ? "error.main"
                            : "text.secondary"
                        }
                      >
                        {formatTimeRemaining(session.time_remaining_seconds)}
                      </Typography>
                    </Box>
                  </CardContent>
                  <CardActions>
                    {session.type === "ssh" && (
                      <Button
                        size="small"
                        startIcon={<Terminal />}
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveSession(session.session_id);
                          setCommandDialog(true);
                        }}
                      >
                        Terminal
                      </Button>
                    )}
                    <Button
                      size="small"
                      startIcon={<Folder />}
                      onClick={(e) => {
                        e.stopPropagation();
                        setActiveSession(session.session_id);
                        loadRemoteFiles(session.session_id);
                      }}
                    >
                      Browse
                    </Button>
                    <Box sx={{ flexGrow: 1 }} />
                    <IconButton
                      size="small"
                      color="error"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDisconnect(session.session_id);
                      }}
                    >
                      <Delete />
                    </IconButton>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}

        {/* Remote File Browser */}
        {activeSession && (
          <Paper variant="outlined" sx={{ mt: 2, p: 2 }}>
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 2 }}>
              <Typography variant="subtitle1" sx={{ flexGrow: 1 }}>
                Remote Files: {remotePath || "/"}
              </Typography>
              <Button
                size="small"
                startIcon={<CloudUpload />}
                onClick={() => setUploadDialog(true)}
              >
                Upload
              </Button>
              <IconButton
                size="small"
                onClick={() => loadRemoteFiles(activeSession, remotePath)}
              >
                <Refresh />
              </IconButton>
            </Box>

            {loadingFiles ? (
              <Box sx={{ display: "flex", justifyContent: "center", py: 2 }}>
                <CircularProgress size={24} />
              </Box>
            ) : (
              <List dense sx={{ maxHeight: 300, overflow: "auto" }}>
                {remotePath && (
                  <ListItem
                    button
                    onClick={() => {
                      const parent =
                        remotePath.split("/").slice(0, -1).join("/") || "/";
                      loadRemoteFiles(activeSession, parent);
                    }}
                  >
                    <ListItemIcon>
                      <Folder />
                    </ListItemIcon>
                    <ListItemText primary=".." secondary="Parent directory" />
                  </ListItem>
                )}
                {remoteFiles.map((file) => (
                  <ListItem
                    key={file.path}
                    button
                    onClick={() => handleRemoteFileClick(file)}
                  >
                    <ListItemIcon>
                      {file.is_directory ? (
                        <Folder sx={{ color: "#ffd54f" }} />
                      ) : (
                        <InsertDriveFile />
                      )}
                    </ListItemIcon>
                    <ListItemText
                      primary={file.name}
                      secondary={`${file.size_formatted} | ${file.permissions}`}
                    />
                    {!file.is_directory && (
                      <ListItemSecondaryAction>
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => setDownloadDialog(file)}
                        >
                          <CloudDownload />
                        </IconButton>
                      </ListItemSecondaryAction>
                    )}
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        )}
      </Box>

      {/* New Connection Dialog */}
      <Dialog
        open={connectDialog !== null}
        onClose={() => setConnectDialog(null)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            {connectDialog === "ssh" ? <Terminal /> : <Storage />}
            New {connectDialog?.toUpperCase()} Connection
          </Box>
        </DialogTitle>
        <DialogContent>
          <Tabs
            value={connectDialog}
            onChange={(_, val) => {
              setConnectDialog(val);
              setFormData((prev) => ({
                ...prev,
                port: val === "ssh" ? 22 : 21,
              }));
            }}
            sx={{ mb: 2 }}
          >
            <Tab value="ssh" label="SSH" />
            <Tab value="ftp" label="FTP" />
          </Tabs>

          <Grid container spacing={2}>
            <Grid item xs={8}>
              <TextField
                fullWidth
                label="Host"
                placeholder="example.com or 192.168.1.1"
                value={formData.host}
                onChange={(e) =>
                  setFormData({ ...formData, host: e.target.value })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Dns />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={4}>
              <TextField
                fullWidth
                label="Port"
                type="number"
                value={formData.port}
                onChange={(e) =>
                  setFormData({ ...formData, port: parseInt(e.target.value) })
                }
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Username"
                value={formData.username}
                onChange={(e) =>
                  setFormData({ ...formData, username: e.target.value })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Person />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Password"
                type="password"
                value={formData.password}
                onChange={(e) =>
                  setFormData({ ...formData, password: e.target.value })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Lock />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            {connectDialog === "ssh" && (
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Private Key Path (optional)"
                  placeholder="~/.ssh/id_rsa"
                  value={formData.keyPath}
                  onChange={(e) =>
                    setFormData({ ...formData, keyPath: e.target.value })
                  }
                  InputProps={{
                    startAdornment: (
                      <InputAdornment position="start">
                        <VpnKey />
                      </InputAdornment>
                    ),
                  }}
                />
              </Grid>
            )}

            {connectDialog === "ftp" && (
              <Grid item xs={12}>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formData.useTLS}
                      onChange={(e) =>
                        setFormData({ ...formData, useTLS: e.target.checked })
                      }
                    />
                  }
                  label="Use TLS/SSL"
                />
              </Grid>
            )}

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Session Name (optional)"
                placeholder="My Server"
                value={formData.sessionName}
                onChange={(e) =>
                  setFormData({ ...formData, sessionName: e.target.value })
                }
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Connection Timeout (seconds)"
                type="number"
                value={formData.timeout}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    timeout: parseInt(e.target.value),
                  })
                }
                InputProps={{
                  startAdornment: (
                    <InputAdornment position="start">
                      <Timer />
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setConnectDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={
              connectDialog === "ssh" ? handleConnectSSH : handleConnectFTP
            }
            disabled={loading || !formData.host || !formData.username}
            startIcon={loading ? <CircularProgress size={16} /> : <Wifi />}
          >
            Connect
          </Button>
        </DialogActions>
      </Dialog>

      {/* Download Dialog */}
      <Dialog
        open={downloadDialog !== null}
        onClose={() => setDownloadDialog(null)}
      >
        <DialogTitle>Download File</DialogTitle>
        <DialogContent>
          <Typography gutterBottom>
            File: <strong>{downloadDialog?.name}</strong>
          </Typography>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Size: {downloadDialog?.size_formatted}
          </Typography>
          <TextField
            fullWidth
            label="Local Path (optional)"
            placeholder="Leave empty to save to temp folder"
            value={downloadPath}
            onChange={(e) => setDownloadPath(e.target.value)}
            sx={{ mt: 2 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDownloadDialog(null)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleDownload}
            disabled={loading}
            startIcon={
              loading ? <CircularProgress size={16} /> : <CloudDownload />
            }
          >
            Download
          </Button>
        </DialogActions>
      </Dialog>

      {/* Upload Dialog */}
      <Dialog open={uploadDialog} onClose={() => setUploadDialog(false)}>
        <DialogTitle>Upload File</DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Local File Path"
            placeholder="/path/to/local/file"
            value={uploadLocalPath}
            onChange={(e) => setUploadLocalPath(e.target.value)}
            sx={{ mt: 1, mb: 2 }}
          />
          <TextField
            fullWidth
            label="Remote Path"
            placeholder={`${remotePath}/filename`}
            value={uploadRemotePath}
            onChange={(e) => setUploadRemotePath(e.target.value)}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setUploadDialog(false)}>Cancel</Button>
          <Button
            variant="contained"
            onClick={handleUpload}
            disabled={loading || !uploadLocalPath || !uploadRemotePath}
            startIcon={
              loading ? <CircularProgress size={16} /> : <CloudUpload />
            }
          >
            Upload
          </Button>
        </DialogActions>
      </Dialog>

      {/* Command Execution Dialog */}
      <Dialog
        open={commandDialog}
        onClose={() => setCommandDialog(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <Terminal />
            Remote Terminal
          </Box>
        </DialogTitle>
        <DialogContent>
          <TextField
            fullWidth
            label="Command"
            placeholder="ls -la"
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleExecuteCommand()}
            sx={{ mb: 2 }}
          />
          {commandOutput !== null && (
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: "#1e1e1e",
                maxHeight: 400,
                overflow: "auto",
              }}
            >
              <Box
                component="pre"
                sx={{
                  m: 0,
                  fontFamily: "monospace",
                  fontSize: "0.875rem",
                  color: "#d4d4d4",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {commandOutput || "(no output)"}
              </Box>
            </Paper>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCommandDialog(false)}>Close</Button>
          <Button
            variant="contained"
            onClick={handleExecuteCommand}
            disabled={loading || !command}
            startIcon={loading ? <CircularProgress size={16} /> : <Terminal />}
          >
            Execute
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default ConnectionManager;
