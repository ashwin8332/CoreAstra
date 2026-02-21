/**
 * CoreAstra Terminal Component
 * AI-Powered Terminal & Intelligent Control Interface
 *
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 */

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import {
  Box,
  TextField,
  Typography,
  IconButton,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Alert,
  Tooltip,
  CircularProgress,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  Terminal as TerminalIcon,
  Send,
  Warning,
  CheckCircle,
  Folder,
  History,
} from "@mui/icons-material";
import { terminalApi } from "../services/api";
import { CommandResult, TerminalLine, CommandAnalysis } from "../types";
import { v4 as uuidv4 } from "uuid";
import { terminalColors } from "../theme";

interface TerminalProps {
  onCommandExecuted?: (command: string, result: CommandResult) => void;
}

const Terminal: React.FC<TerminalProps> = ({ onCommandExecuted }) => {
  const [input, setInput] = useState("");
  const [lines, setLines] = useState<TerminalLine[]>([]);
  const [currentDir, setCurrentDir] = useState("");
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    command: string;
    analysis: CommandAnalysis | null;
  }>({ open: false, command: "", analysis: null });

  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const theme = useTheme();
  const isDarkMode = theme.palette.mode === "dark";
  const sectionBorder =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.1)
      : theme.palette.divider;
  const headerBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.05)
      : alpha(theme.palette.common.black, 0.05);
  const hoverOverlay =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.02)
      : alpha(theme.palette.common.black, 0.03);
  const chipBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.primary.main, 0.12)
      : alpha(theme.palette.primary.main, 0.18);
  const currentTerminalColors = useMemo(() => {
    if (isDarkMode) {
      return { ...terminalColors };
    }

    return {
      ...terminalColors,
      background: alpha(theme.palette.background.paper, 0.92),
      foreground: theme.palette.text.primary,
      cursor: theme.palette.primary.main,
      cursorAccent: theme.palette.background.paper,
      selection: alpha(theme.palette.primary.main, 0.24),
      black: theme.palette.grey[700],
      red: theme.palette.error.main,
      green: theme.palette.success.main,
      yellow: theme.palette.warning.main,
      blue: theme.palette.primary.main,
      magenta: theme.palette.secondary.main,
      cyan: theme.palette.info.main,
      white: theme.palette.common.white,
      brightBlack: theme.palette.grey[600],
      brightRed: theme.palette.error.light,
      brightGreen: theme.palette.success.light,
      brightYellow: theme.palette.warning.light,
      brightBlue: theme.palette.info.light,
      brightMagenta: theme.palette.secondary.light,
      brightCyan: theme.palette.info.light,
      brightWhite: theme.palette.common.white,
    };
  }, [isDarkMode, theme]);
  const chipColor =
    theme.palette.mode === "dark"
      ? theme.palette.primary.light
      : theme.palette.primary.dark;

  useEffect(() => {
    let isCancelled = false;

    const loadInitialDirectory = async () => {
      try {
        const data = await terminalApi.getCurrentDirectory();
        if (isCancelled) return;
        setCurrentDir(data.path);
        addLine("info", `CoreAstra Terminal v1.0.0`);
        addLine("info", `© GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)`);
        addLine("info", `Current directory: ${data.path}`);
        addLine("info", "");
      } catch (error: any) {
        if (isCancelled) return;
        const message =
          error?.message || "Unable to reach the CoreAstra backend.";
        setCurrentDir("(offline)");
        addLine("error", `Failed to connect to backend services: ${message}`);
      }
    };

    loadInitialDirectory();

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    // Auto-scroll to bottom
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [lines]);

  const addLine = useCallback((type: TerminalLine["type"], content: string) => {
    setLines((prev: TerminalLine[]) => [
      ...prev,
      {
        id: uuidv4(),
        type,
        content,
        timestamp: new Date(),
      },
    ]);
  }, []);

  const handleCommand = async (command: string, confirmed: boolean = false) => {
    if (!command.trim()) return;

    // Add to history
    setHistory((prev: string[]) => [
      ...prev.filter((c: string) => c !== command),
      command,
    ]);
    setHistoryIndex(-1);

    // Handle built-in commands
    const trimmedCommand = command.trim();

    if (trimmedCommand === "clear" || trimmedCommand === "cls") {
      setLines([]);
      return;
    }

    if (trimmedCommand.startsWith("cd ")) {
      const path = trimmedCommand.slice(3).trim();
      try {
        const result = await terminalApi.changeDirectory(path);
        setCurrentDir(result.path);
        addLine("info", `Changed directory to: ${result.path}`);
      } catch (error: any) {
        addLine(
          "error",
          `Error: ${error.response?.data?.detail || error.message}`
        );
      }
      return;
    }

    // Add input line
    addLine("input", `${currentDir}> ${command}`);

    // Check if command needs confirmation
    if (!confirmed) {
      try {
        const analysis = await terminalApi.analyze(command);
        if (analysis.requires_confirmation) {
          setConfirmDialog({
            open: true,
            command,
            analysis,
          });
          return;
        }
      } catch (error) {
        console.error("Analysis failed:", error);
      }
    }

    setIsExecuting(true);

    try {
      await terminalApi.execute(command, confirmed, (data: CommandResult) => {
        if (data.type === "output") {
          addLine(
            data.stream === "stderr" ? "error" : "output",
            data.content || ""
          );
        } else if (data.type === "execution_complete") {
          if (!data.success) {
            addLine("error", `Command exited with code ${data.exit_code}`);
          }
          onCommandExecuted?.(command, data);
        } else if (data.type === "error") {
          addLine("error", `Error: ${data.message}`);
        } else if (data.type === "execution_start" && data.backups?.length) {
          addLine(
            "info",
            `Created ${data.backups.length} backup(s) before execution`
          );
        }
      });
    } catch (error: any) {
      addLine("error", `Execution failed: ${error.message}`);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCommand(input);
      setInput("");
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (history.length > 0) {
        const newIndex =
          historyIndex < history.length - 1 ? historyIndex + 1 : historyIndex;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || "");
      }
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        setInput(history[history.length - 1 - newIndex] || "");
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInput("");
      }
    }
  };

  const handleConfirmExecution = () => {
    const { command } = confirmDialog;
    setConfirmDialog({ open: false, command: "", analysis: null });
    handleCommand(command, true);
  };

  const getRiskColor = (level: string) => {
    switch (level) {
      case "critical":
      case "high":
        return "error";
      case "medium":
        return "warning";
      default:
        return "success";
    }
  };

  const getLineColor = useCallback(
    (type: TerminalLine["type"]) => {
      switch (type) {
        case "input":
          return currentTerminalColors.cyan;
        case "output":
          return currentTerminalColors.foreground;
        case "error":
          return currentTerminalColors.red;
        case "warning":
          return currentTerminalColors.yellow;
        case "info":
          return currentTerminalColors.blue;
        default:
          return currentTerminalColors.foreground;
      }
    },
    [currentTerminalColors]
  );

  return (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: currentTerminalColors.background,
        borderRadius: 2,
        overflow: "hidden",
      }}
    >
      {/* Terminal Header */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1.5,
          bgcolor: headerBg,
          borderBottom: `1px solid ${sectionBorder}`,
        }}
      >
        <TerminalIcon sx={{ color: "primary.main", fontSize: 20 }} />
        <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
          Smart Terminal
        </Typography>
        <Chip
          icon={<Folder sx={{ fontSize: 14 }} />}
          label={currentDir}
          size="small"
          sx={{
            ml: "auto",
            maxWidth: 300,
            bgcolor: chipBg,
            color: chipColor,
            "& .MuiChip-label": {
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.75rem",
            },
          }}
        />
        <Tooltip title="Command History">
          <IconButton size="small" sx={{ color: "text.secondary" }}>
            <History fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      {/* Terminal Output */}
      <Box
        ref={terminalRef}
        sx={{
          flex: 1,
          overflow: "auto",
          p: 2,
          fontFamily: '"JetBrains Mono", monospace',
          fontSize: "0.875rem",
          lineHeight: 1.6,
        }}
        onClick={() => inputRef.current?.focus()}
      >
        {lines.map((line: TerminalLine) => (
          <Box
            key={line.id}
            sx={{
              color: getLineColor(line.type),
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              "&:hover": {
                bgcolor: hoverOverlay,
              },
            }}
          >
            {line.content}
          </Box>
        ))}

        {isExecuting && (
          <Box sx={{ display: "flex", alignItems: "center", gap: 1, mt: 1 }}>
            <CircularProgress size={14} />
            <Typography variant="body2" sx={{ color: "text.secondary" }}>
              Executing...
            </Typography>
          </Box>
        )}
      </Box>

      {/* Input Area */}
      <Box
        sx={{
          display: "flex",
          alignItems: "center",
          gap: 1,
          p: 1.5,
          borderTop: `1px solid ${sectionBorder}`,
          bgcolor: hoverOverlay,
        }}
      >
        <Typography
          sx={{
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: "0.875rem",
            color: currentTerminalColors.green,
            whiteSpace: "nowrap",
          }}
        >
          {currentDir}&gt;
        </Typography>
        <TextField
          inputRef={inputRef}
          fullWidth
          variant="standard"
          placeholder="Enter command..."
          value={input}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
            setInput(e.target.value)
          }
          onKeyDown={handleKeyDown}
          disabled={isExecuting}
          InputProps={{
            disableUnderline: true,
            sx: {
              fontFamily: '"JetBrains Mono", monospace',
              fontSize: "0.875rem",
               color: currentTerminalColors.foreground,
            },
          }}
          sx={{
            "& .MuiInputBase-root": {
              bgcolor: "transparent",
            },
          }}
        />
        <IconButton
          onClick={() => {
            handleCommand(input);
            setInput("");
          }}
          disabled={isExecuting || !input.trim()}
          sx={{ color: "primary.main" }}
        >
          <Send />
        </IconButton>
      </Box>

      {/* Confirmation Dialog */}
      <Dialog
        open={confirmDialog.open}
        onClose={() =>
          setConfirmDialog({ open: false, command: "", analysis: null })
        }
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <Warning color="warning" />
          Confirmation Required
        </DialogTitle>
        <DialogContent>
          {confirmDialog.analysis && (
            <>
              <Alert
                severity={
                  getRiskColor(confirmDialog.analysis.risk_level) as any
                }
                sx={{ mb: 2 }}
              >
                <Typography variant="subtitle2" gutterBottom>
                  Risk Level: {confirmDialog.analysis.risk_level.toUpperCase()}
                </Typography>
                <Typography variant="body2">
                  {confirmDialog.analysis.reason}
                </Typography>
              </Alert>

              <Typography variant="subtitle2" gutterBottom>
                Command:
              </Typography>
              <Box
                sx={{
                  p: 1.5,
                  bgcolor: "background.default",
                  borderRadius: 1,
                  fontFamily: '"JetBrains Mono", monospace',
                  fontSize: "0.875rem",
                  mb: 2,
                }}
              >
                {confirmDialog.command}
              </Box>

              {confirmDialog.analysis.affected_paths.length > 0 && (
                <>
                  <Typography variant="subtitle2" gutterBottom>
                    Affected Paths:
                  </Typography>
                  <Box sx={{ mb: 2 }}>
                    {confirmDialog.analysis.affected_paths.map(
                      (path: string, i: number) => (
                        <Chip
                          key={i}
                          label={path}
                          size="small"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )
                    )}
                  </Box>
                </>
              )}

              {confirmDialog.analysis.backup_recommended && (
                <Alert severity="info" icon={<CheckCircle />}>
                  A backup will be created before execution.
                </Alert>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button
            onClick={() =>
              setConfirmDialog({ open: false, command: "", analysis: null })
            }
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            color="warning"
            onClick={handleConfirmExecution}
            startIcon={<Warning />}
          >
            Execute Anyway
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default Terminal;
