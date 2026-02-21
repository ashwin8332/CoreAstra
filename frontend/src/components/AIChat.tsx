/**
 * CoreAstra AI Chat Component
 * AI-Powered Terminal & Intelligent Control Interface
 *
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 */

import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  useMemo,
} from "react";
import {
  Box,
  TextField,
  Typography,
  IconButton,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Avatar,
  Paper,
  Chip,
  CircularProgress,
  Tooltip,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Stack,
  FormHelperText,
  InputAdornment,
} from "@mui/material";
import {
  Send,
  SmartToy,
  Person,
  ContentCopy,
  PlayArrow,
  Refresh,
  AutoAwesome,
  Settings,
  Key,
  Category,
  Warning,
} from "@mui/icons-material";
import ReactMarkdown from "react-markdown";
import { aiApi, settingsApi } from "../services/api";
import { ChatMessage, EngineStatus } from "../types";
import { v4 as uuidv4 } from "uuid";
import { alpha, useTheme } from "@mui/material/styles";

interface AIChatProps {
  onRunCommand?: (command: string) => void;
}

const AIChat: React.FC<AIChatProps> = ({ onRunCommand }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [engines, setEngines] = useState<EngineStatus[]>([]);
  const [selectedEngine, setSelectedEngine] = useState<string>("");
  const [sessionId] = useState(uuidv4());
  const [configDialogOpen, setConfigDialogOpen] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [configForm, setConfigForm] = useState({ apiKey: "", modelName: "" });
  const [configTouched, setConfigTouched] = useState({
    apiKey: false,
    modelName: false,
  });
  const [configHasApiKey, setConfigHasApiKey] = useState(false);
  const [configMessage, setConfigMessage] = useState<{
    severity: "success" | "error";
    text: string;
  } | null>(null);

  const chatRef = useRef<HTMLDivElement>(null);
  const theme = useTheme();
  const headerBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.03)
      : alpha(theme.palette.primary.main, 0.06);
  const sectionBorder =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.1)
      : theme.palette.divider;
  const assistantMessageBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.03)
      : alpha(theme.palette.primary.light, 0.18);
  const userMessageBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.primary.main, 0.18)
      : alpha(theme.palette.primary.main, 0.12);
  const inputSectionBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.02)
      : alpha(theme.palette.primary.main, 0.05);
  const quickActionBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.05)
      : alpha(theme.palette.primary.main, 0.08);
  const quickActionHover =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.1)
      : alpha(theme.palette.primary.main, 0.16);
  const inlineCodeBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.black, 0.4)
      : alpha(theme.palette.common.black, 0.08);
  const codeBlockBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.black, 0.4)
      : alpha(theme.palette.common.black, 0.06);

  const loadEngines = useCallback(async () => {
    try {
      // Get currently configured engines
      const data = await aiApi.getEngines();

      // Get all available engine types from settings
      const availableModels = await settingsApi.getAvailableModels();

      // Create a comprehensive list of all engines
      const allEngines: EngineStatus[] = [];
      const configuredEngineNames = new Set(
        data.engines.map((e: EngineStatus) => e.name)
      );

      // Add all available engine types
      Object.entries(availableModels.models || {}).forEach(
        ([key, info]: [string, any]) => {
          const configured = data.engines.find(
            (e: EngineStatus) => e.name === key
          );

          if (configured) {
            // Engine is configured and initialized
            allEngines.push(configured);
          } else {
            // Engine is available but not configured
            let reason = "Not configured";
            if (info.requires_api_key) {
              reason = `Requires ${info.api_key_name} - Click settings to configure`;
            } else if (info.requires_local_install) {
              reason = "Requires local installation";
            }

            allEngines.push({
              name: key,
              is_available: false,
              reason: reason,
            });
          }
        }
      );

      setEngines(allEngines);

      // Select first available engine or first engine in list
      const firstAvailable = allEngines.find((e) => e.is_available);
      setSelectedEngine(
        (prev) =>
          prev ||
          firstAvailable?.name ||
          data.default ||
          (allEngines[0]?.name ?? "")
      );
    } catch (error) {
      console.error("Failed to load engines:", error);
      // Fallback to just configured engines
      const data = await aiApi.getEngines();
      setEngines(data.engines);
      setSelectedEngine(
        (prev) => prev || data.default || (data.engines[0]?.name ?? "")
      );
    }
  }, []);

  const selectedEngineStatus = useMemo(
    () =>
      engines.find((engine: EngineStatus) => engine.name === selectedEngine),
    [engines, selectedEngine]
  );

  useEffect(() => {
    loadEngines().catch((error) => {
      console.error("Failed to load AI engines", error);
    });

    // Welcome message
    setMessages([
      {
        id: uuidv4(),
        role: "assistant",
        content: `# Welcome to CoreAstra AI Assistant! 👋

I'm here to help you with:
- **Terminal commands** - Get help crafting the right commands
- **System operations** - Understand what commands do and their risks
- **Task planning** - Break down complex tasks into steps
- **Debugging** - Troubleshoot issues and errors

Just type your question or describe what you want to accomplish!`,
        timestamp: new Date(),
      },
    ]);
  }, [loadEngines]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    // Check if selected engine is available
    if (selectedEngineStatus && !selectedEngineStatus.is_available) {
      // Show config dialog
      handleOpenConfig();
      return;
    }

    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: "user",
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev: ChatMessage[]) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    // Create assistant message placeholder
    const assistantId = uuidv4();
    setMessages((prev: ChatMessage[]) => [
      ...prev,
      {
        id: assistantId,
        role: "assistant",
        content: "",
        timestamp: new Date(),
        engine: selectedEngine,
      },
    ]);

    try {
      const chatMessages = messages
        .filter((m: ChatMessage) => m.role !== "system")
        .map((m: ChatMessage) => ({ role: m.role, content: m.content }));

      chatMessages.push({ role: "user", content: userMessage.content });

      await aiApi.chat(
        chatMessages,
        selectedEngine || null,
        sessionId,
        (data: { content?: string }) => {
          if (data.content) {
            setMessages((prev: ChatMessage[]) =>
              prev.map((m: ChatMessage) =>
                m.id === assistantId
                  ? { ...m, content: m.content + data.content }
                  : m
              )
            );
          }
        }
      );
    } catch (error) {
      console.error("Chat error:", error);
      setMessages((prev: ChatMessage[]) =>
        prev.map((m: ChatMessage) =>
          m.id === assistantId
            ? { ...m, content: "Sorry, an error occurred. Please try again." }
            : m
        )
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const extractCommands = (content: string): string[] => {
    const codeBlockRegex =
      /```(?:bash|sh|cmd|powershell|shell)?\n([\s\S]*?)```/g;
    const commands: string[] = [];
    let match;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      commands.push(match[1].trim());
    }

    // Also look for inline code that looks like commands
    const inlineCodeRegex = /`([^`]+)`/g;
    while ((match = inlineCodeRegex.exec(content)) !== null) {
      const code = match[1].trim();
      if (code.includes(" ") && !code.includes("=") && code.length < 100) {
        commands.push(code);
      }
    }

    return commands;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const getEngineIcon = (engine: string) => {
    const colors: Record<string, string> = {
      gemini: "#4285f4",
      groq: "#f97316",
      claude: "#8b5cf6",
      ollama: "#10b981",
    };
    return colors[engine] || "#6366f1";
  };

  const handleOpenConfig = async () => {
    if (!selectedEngine) return;
    setConfigDialogOpen(true);
    setConfigLoading(true);
    const unavailableReason =
      selectedEngineStatus &&
      !selectedEngineStatus.is_available &&
      selectedEngineStatus.reason
        ? selectedEngineStatus.reason
        : null;
    setConfigMessage(
      unavailableReason ? { severity: "error", text: unavailableReason } : null
    );
    setConfigTouched({ apiKey: false, modelName: false });
    try {
      const data = await aiApi.getConfig(selectedEngine);
      setConfigHasApiKey(Boolean(data.has_api_key));
      setConfigForm({
        apiKey: "",
        modelName: data.model_name || "",
      });
    } catch (error: any) {
      console.error("Failed to load engine config", error);
      setConfigMessage({
        severity: "error",
        text:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to load engine configuration.",
      });
    } finally {
      setConfigLoading(false);
    }
  };

  const handleSaveConfig = async () => {
    if (!selectedEngine) return;
    const payload: { apiKey?: string | null; modelName?: string | null } = {};
    if (configTouched.apiKey) {
      payload.apiKey = configForm.apiKey ? configForm.apiKey.trim() : null;
    }
    if (configTouched.modelName) {
      payload.modelName = configForm.modelName
        ? configForm.modelName.trim()
        : null;
    }

    if (Object.keys(payload).length === 0) {
      setConfigMessage({ severity: "error", text: "No changes to save." });
      return;
    }

    setConfigLoading(true);
    setConfigMessage(null);
    try {
      const result = await aiApi.updateConfig(selectedEngine, payload);
      setConfigHasApiKey(Boolean(result.has_api_key));
      setConfigForm((prev) => ({
        ...prev,
        modelName: result.model_name || "",
      }));
      setConfigTouched({ apiKey: false, modelName: false });
      setConfigMessage({
        severity: result.is_available ? "success" : "error",
        text: result.is_available
          ? "Configuration updated successfully. Engine is available."
          : result.reason
          ? `Configuration saved, but the engine is still unavailable: ${result.reason}`
          : "Configuration saved. Engine is still unavailable; verify credentials.",
      });
      await loadEngines();
    } catch (error: any) {
      console.error("Failed to update engine config", error);
      setConfigMessage({
        severity: "error",
        text:
          error?.response?.data?.detail ||
          error?.message ||
          "Failed to update engine configuration.",
      });
    } finally {
      setConfigLoading(false);
    }
  };

  const handleCloseConfig = () => {
    setConfigDialogOpen(false);
    setConfigMessage(null);
  };

  return (
    <>
      <Box
        sx={{
          height: "100%",
          display: "flex",
          flexDirection: "column",
          bgcolor: "background.paper",
          borderRadius: 2,
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            gap: 2,
            p: 1.5,
            bgcolor: headerBg,
            borderBottom: `1px solid ${sectionBorder}`,
          }}
        >
          <AutoAwesome sx={{ color: "secondary.main", fontSize: 20 }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
            AI Assistant
          </Typography>

          <FormControl size="small" sx={{ ml: "auto", minWidth: 200 }}>
            <InputLabel>AI Engine</InputLabel>
            <Select
              value={selectedEngine}
              onChange={(e: { target: { value: string } }) =>
                setSelectedEngine(e.target.value)
              }
              label="AI Engine"
              sx={{ fontSize: "0.875rem" }}
            >
              {engines.map((engine: EngineStatus) => (
                <MenuItem key={engine.name} value={engine.name}>
                  <Box
                    sx={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 0.25,
                      width: "100%",
                    }}
                  >
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: engine.is_available
                            ? "success.main"
                            : "warning.main",
                        }}
                      />
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {engine.name.charAt(0).toUpperCase() +
                          engine.name.slice(1)}
                      </Typography>
                      {!engine.is_available && (
                        <Chip
                          label="Configure"
                          size="small"
                          color="warning"
                          sx={{ ml: "auto", height: 20, fontSize: "0.7rem" }}
                        />
                      )}
                    </Box>
                    {!engine.is_available && engine.reason && (
                      <Typography
                        variant="caption"
                        sx={{
                          color: "text.secondary",
                          fontSize: "0.7rem",
                          pl: 2.5,
                        }}
                      >
                        {engine.reason}
                      </Typography>
                    )}
                  </Box>
                </MenuItem>
              ))}
            </Select>
            {selectedEngineStatus &&
              !selectedEngineStatus.is_available &&
              selectedEngineStatus.reason && (
                <FormHelperText
                  sx={{
                    mt: 0.5,
                    display: "flex",
                    alignItems: "center",
                    gap: 0.5,
                  }}
                >
                  <Warning fontSize="small" sx={{ color: "warning.main" }} />
                  {selectedEngineStatus.reason}
                </FormHelperText>
              )}
          </FormControl>

          <Tooltip title="Open Settings to Configure Engines">
            <span>
              <IconButton
                size="small"
                onClick={handleOpenConfig}
                disabled={!selectedEngine}
                sx={{ color: "text.secondary" }}
              >
                <Settings fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>

          <Tooltip title="New Conversation">
            <IconButton
              size="small"
              onClick={() => {
                setMessages([]);
              }}
              sx={{ color: "text.secondary" }}
            >
              <Refresh fontSize="small" />
            </IconButton>
          </Tooltip>
        </Box>

        {/* Messages */}
        <Box
          ref={chatRef}
          sx={{
            flex: 1,
            overflow: "auto",
            p: 2,
            display: "flex",
            flexDirection: "column",
            gap: 2,
          }}
        >
          {selectedEngineStatus && !selectedEngineStatus.is_available && (
            <Alert
              severity="warning"
              sx={{ mb: 1 }}
              action={
                <Button
                  size="small"
                  onClick={handleOpenConfig}
                  startIcon={<Settings />}
                >
                  Configure
                </Button>
              }
            >
              <strong>
                {selectedEngineStatus.name.charAt(0).toUpperCase() +
                  selectedEngineStatus.name.slice(1)}
              </strong>{" "}
              is not configured.
              {selectedEngineStatus.reason}
            </Alert>
          )}
          {messages.map((message: ChatMessage) => (
            <Box
              key={message.id}
              sx={{
                display: "flex",
                gap: 1.5,
                alignItems: "flex-start",
                flexDirection: message.role === "user" ? "row-reverse" : "row",
              }}
            >
              <Avatar
                sx={{
                  width: 32,
                  height: 32,
                  bgcolor:
                    message.role === "user" ? "primary.main" : "secondary.main",
                }}
              >
                {message.role === "user" ? (
                  <Person sx={{ fontSize: 18 }} />
                ) : (
                  <SmartToy sx={{ fontSize: 18 }} />
                )}
              </Avatar>

              <Paper
                elevation={0}
                sx={{
                  p: 2,
                  maxWidth: "80%",
                  bgcolor:
                    message.role === "user"
                      ? userMessageBg
                      : assistantMessageBg,
                  border: `1px solid ${sectionBorder}`,
                }}
              >
                {message.role === "user" ? (
                  <Typography variant="body2">{message.content}</Typography>
                ) : (
                  <Box
                    sx={{
                      "& h1, & h2, & h3": {
                        mt: 0,
                        mb: 1,
                        fontSize: "1rem",
                        fontWeight: 600,
                      },
                      "& p": { my: 0.5 },
                      "& ul, & ol": { my: 0.5, pl: 2 },
                      "& code": {
                        px: 0.5,
                        py: 0.25,
                        bgcolor: inlineCodeBg,
                        borderRadius: 0.5,
                        fontFamily: '"JetBrains Mono", monospace',
                        fontSize: "0.8rem",
                      },
                      "& pre": {
                        p: 1.5,
                        bgcolor: codeBlockBg,
                        borderRadius: 1,
                        overflow: "auto",
                        position: "relative",
                        "& code": {
                          bgcolor: "transparent",
                          p: 0,
                        },
                      },
                    }}
                  >
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </Box>
                )}

                {/* Command Actions */}
                {message.role === "assistant" &&
                  extractCommands(message.content).length > 0 && (
                    <Box
                      sx={{
                        mt: 1.5,
                        pt: 1.5,
                        borderTop: `1px solid ${sectionBorder}`,
                        display: "flex",
                        flexWrap: "wrap",
                        gap: 0.5,
                      }}
                    >
                      <Typography
                        variant="caption"
                        sx={{ width: "100%", color: "text.secondary", mb: 0.5 }}
                      >
                        Detected Commands:
                      </Typography>
                      {extractCommands(message.content).map((cmd, i) => (
                        <Chip
                          key={i}
                          label={
                            cmd.length > 40 ? cmd.slice(0, 40) + "..." : cmd
                          }
                          size="small"
                          onClick={() => onRunCommand?.(cmd)}
                          onDelete={() => copyToClipboard(cmd)}
                          deleteIcon={
                            <Tooltip title="Copy">
                              <ContentCopy sx={{ fontSize: 14 }} />
                            </Tooltip>
                          }
                          icon={<PlayArrow sx={{ fontSize: 14 }} />}
                          sx={{
                            fontFamily: '"JetBrains Mono", monospace',
                            fontSize: "0.7rem",
                            "& .MuiChip-deleteIcon": {
                              color: "inherit",
                            },
                          }}
                        />
                      ))}
                    </Box>
                  )}

                {message.engine && (
                  <Typography
                    variant="caption"
                    sx={{
                      display: "block",
                      mt: 1,
                      color: "text.secondary",
                      fontSize: "0.7rem",
                    }}
                  >
                    via {message.engine}
                  </Typography>
                )}
              </Paper>
            </Box>
          ))}

          {isLoading && messages[messages.length - 1]?.content === "" && (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, pl: 5 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                Thinking...
              </Typography>
            </Box>
          )}
        </Box>

        {/* Input Area */}
        <Box
          sx={{
            p: 2,
            borderTop: `1px solid ${sectionBorder}`,
            bgcolor: inputSectionBg,
          }}
        >
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              fullWidth
              multiline
              maxRows={4}
              placeholder={
                selectedEngineStatus && !selectedEngineStatus.is_available
                  ? `Configure ${selectedEngineStatus.name} in Settings to start chatting...`
                  : "Ask me anything..."
              }
              value={input}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setInput(e.target.value)
              }
              onKeyDown={handleKeyDown}
              disabled={
                isLoading ||
                (selectedEngineStatus && !selectedEngineStatus.is_available)
              }
              sx={{
                "& .MuiOutlinedInput-root": {
                  bgcolor: "background.default",
                },
              }}
            />
            <IconButton
              onClick={handleSend}
              disabled={
                isLoading ||
                !input.trim() ||
                (selectedEngineStatus && !selectedEngineStatus.is_available)
              }
              sx={{
                bgcolor: "primary.main",
                color: "white",
                "&:hover": { bgcolor: "primary.dark" },
                "&:disabled": { bgcolor: "rgba(99, 102, 241, 0.3)" },
              }}
            >
              <Send />
            </IconButton>
          </Box>

          {/* Quick Actions */}
          <Box sx={{ display: "flex", gap: 0.5, mt: 1, flexWrap: "wrap" }}>
            {[
              "How do I list all files?",
              "Explain this error",
              "Create a backup script",
            ].map((suggestion) => (
              <Chip
                key={suggestion}
                label={suggestion}
                size="small"
                onClick={() => setInput(suggestion)}
                sx={{
                  bgcolor: quickActionBg,
                  "&:hover": { bgcolor: quickActionHover },
                }}
              />
            ))}
          </Box>
        </Box>
      </Box>

      <Dialog
        open={configDialogOpen}
        onClose={handleCloseConfig}
        fullWidth
        maxWidth="sm"
      >
        <DialogTitle>
          Configure {selectedEngine ? selectedEngine.toUpperCase() : "AI"}{" "}
          Engine
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            {configMessage && (
              <Alert severity={configMessage.severity}>
                {configMessage.text}
              </Alert>
            )}

            {configHasApiKey && !configTouched.apiKey && (
              <Alert severity="info">
                An API key is currently configured. Enter a new key to replace
                it or leave blank to keep the existing value. Submit an empty
                value to remove it.
              </Alert>
            )}

            <TextField
              label="API Key"
              type="password"
              value={configForm.apiKey}
              onChange={(e) => {
                setConfigForm((prev) => ({ ...prev, apiKey: e.target.value }));
                setConfigTouched((prev) => ({ ...prev, apiKey: true }));
              }}
              placeholder={
                configHasApiKey
                  ? "Enter new key to replace existing"
                  : "Enter API key"
              }
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Key fontSize="small" />
                  </InputAdornment>
                ),
              }}
              disabled={configLoading}
            />
            <FormHelperText>
              Leave empty to keep the existing key. Submit empty after editing
              to remove it.
            </FormHelperText>

            <TextField
              label="Preferred Model Name"
              value={configForm.modelName}
              onChange={(e) => {
                setConfigForm((prev) => ({
                  ...prev,
                  modelName: e.target.value,
                }));
                setConfigTouched((prev) => ({ ...prev, modelName: true }));
              }}
              placeholder="e.g., mixtral-8x7b-32768"
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <Category fontSize="small" />
                  </InputAdornment>
                ),
              }}
              disabled={configLoading}
            />
            <FormHelperText>
              Leave blank to use the default model for the selected provider.
            </FormHelperText>
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseConfig} disabled={configLoading}>
            Cancel
          </Button>
          <Button
            onClick={handleSaveConfig}
            variant="contained"
            disabled={configLoading}
            startIcon={
              configLoading ? <CircularProgress size={16} /> : undefined
            }
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};

export default AIChat;
