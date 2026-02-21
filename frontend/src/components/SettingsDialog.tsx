/**
 * CoreAstra Settings Dialog
 * Comprehensive system settings management
 *
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 **/

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Tabs,
  Tab,
  Box,
  Typography,
  TextField,
  Switch,
  FormControlLabel,
  Slider,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  IconButton,
  Chip,
  Alert,
  CircularProgress,
  InputAdornment,
  Tooltip,
  Link,
  Divider,
  Stack,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Snackbar,
  Select,
  MenuItem as MuiMenuItem,
  Card,
  CardContent,
  Grid,
  FormControl,
  InputLabel,
} from "@mui/material";
import {
  ExpandMore,
  Add,
  Delete,
  Refresh,
  CheckCircle,
  Error as ErrorIcon,
  Warning,
  Info,
  Visibility,
  VisibilityOff,
  OpenInNew,
  Save,
  Key,
} from "@mui/icons-material";
import { settingsApi, aiApi } from "../services/api";

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
}

interface AIModelInfo {
  name: string;
  requires_api_key: boolean;
  api_key_name: string | null;
  models: string[];
  default_model: string;
  get_api_key_url: string | null;
  status: string;
  requires_local_install?: boolean;
  install_url?: string;
}

interface AIModelConfig {
  id: number;
  engine_name: string;
  model_name: string | null;
  base_url: string | null;
  is_enabled: boolean;
  is_custom: boolean;
  has_api_key: boolean;
  settings: Record<string, any>;
  updated_at: string;
}

// Helper function to extract error message from various error formats
const formatErrorMessage = (err: any): string => {
  if (typeof err === "string") return err;
  if (err?.message) return err.message;

  // Handle FastAPI validation errors
  if (err?.response?.data?.detail) {
    const detail = err.response.data.detail;

    // If detail is an array of validation errors
    if (Array.isArray(detail)) {
      return detail
        .map((e: any) => {
          if (typeof e === "string") return e;
          if (e.msg) return `${e.loc ? e.loc.join(".") + ": " : ""}${e.msg}`;
          return JSON.stringify(e);
        })
        .join("; ");
    }

    // If detail is a string
    if (typeof detail === "string") return detail;

    // If detail is an object
    if (typeof detail === "object") {
      return JSON.stringify(detail);
    }
  }

  return err?.toString() || "An unknown error occurred";
};

const SettingsDialog: React.FC<SettingsDialogProps> = ({ open, onClose }) => {
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [notificationMessage, setNotificationMessage] = useState("");
  const [notificationType, setNotificationType] = useState<
    "success" | "error" | "info"
  >("info");

  // AI Models
  const [availableModels, setAvailableModels] = useState<
    Record<string, AIModelInfo>
  >({});
  const [configuredModels, setConfiguredModels] = useState<AIModelConfig[]>([]);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});
  const [modelForms, setModelForms] = useState<Record<string, any>>({});

  // System Settings
  const [systemSettings, setSystemSettings] = useState<Record<string, any>>({});
  const [aiSettings, setAISettings] = useState({
    temperature: 0.7,
    max_tokens: 2048,
    top_p: 1.0,
    frequency_penalty: 0.0,
    presence_penalty: 0.0,
    stop_sequences: "",
  });

  // Terminal Settings
  const [terminalSettings, setTerminalSettings] = useState({
    auto_backup_enabled: true,
    require_confirmation_risky: true,
    command_history_limit: 1000,
    output_buffer_size: 10000,
    default_shell: "powershell",
    timeout_seconds: 300,
    max_concurrent_commands: 5,
    enable_command_suggestions: true,
    save_output_to_file: false,
  });

  // Security Settings
  const [securitySettings, setSecuritySettings] = useState({
    enable_audit_logging: true,
    block_dangerous_commands: true,
    require_sudo_confirmation: true,
    max_file_size_mb: 100,
    allowed_file_operations: ["read", "write", "delete", "rename"],
    enable_path_restrictions: true,
    session_timeout_minutes: 60,
    max_failed_attempts: 3,
    enable_two_factor: false,
  });

  // Load data
  useEffect(() => {
    if (open) {
      loadAllSettings();
    }
  }, [open]);

  const loadAllSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      const [available, configured, system] = await Promise.all([
        settingsApi.getAvailableModels(),
        settingsApi.getAIModels(),
        settingsApi.getSystemSettings(),
      ]);

      setAvailableModels(available.models || {});
      setConfiguredModels(configured.models || []);
      setSystemSettings(system.settings || {});

      // Load AI settings if they exist
      if (system.settings?.ai_temperature) {
        setAISettings((prev) => ({
          ...prev,
          temperature: system.settings.ai_temperature.value,
        }));
      }
      if (system.settings?.ai_max_tokens) {
        setAISettings((prev) => ({
          ...prev,
          max_tokens: system.settings.ai_max_tokens.value,
        }));
      }

      // Load Terminal settings
      if (system.settings?.terminal_auto_backup) {
        setTerminalSettings((prev) => ({
          ...prev,
          auto_backup_enabled: system.settings.terminal_auto_backup.value,
        }));
      }
      if (system.settings?.terminal_require_confirmation) {
        setTerminalSettings((prev) => ({
          ...prev,
          require_confirmation_risky:
            system.settings.terminal_require_confirmation.value,
        }));
      }

      // Load Security settings
      if (system.settings?.security_audit_logging) {
        setSecuritySettings((prev) => ({
          ...prev,
          enable_audit_logging: system.settings.security_audit_logging.value,
        }));
      }
      if (system.settings?.security_block_dangerous) {
        setSecuritySettings((prev) => ({
          ...prev,
          block_dangerous_commands:
            system.settings.security_block_dangerous.value,
        }));
      }

      // Initialize model forms
      const forms: Record<string, any> = {};
      Object.keys(available.models || {}).forEach((key) => {
        const model = available.models[key];
        const config = configured.models?.find(
          (c: AIModelConfig) => c.engine_name === key
        );
        forms[key] = {
          api_key: "",
          model_name: config?.model_name || model.default_model,
          is_enabled: config?.is_enabled ?? true,
          base_url: config?.base_url || "",
        };
      });
      setModelForms(forms);
    } catch (err: any) {
      setError(formatErrorMessage(err) || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const showNotification = (
    message: string,
    type: "success" | "error" | "info" = "success"
  ) => {
    setNotificationMessage(message);
    setNotificationType(type);
    setNotificationOpen(true);
  };

  const handleSaveAIModel = async (engineName: string) => {
    setLoading(true);
    setError(null);
    setSuccess(null);
    try {
      const form = modelForms[engineName];
      await settingsApi.createOrUpdateAIModel({
        engine_name: engineName,
        api_key: form.api_key || undefined,
        model_name: form.model_name,
        is_enabled: form.is_enabled,
        is_custom: false,
        base_url: form.base_url || undefined,
        settings: {},
      });

      setSuccess(`${engineName} configuration saved successfully!`);
      showNotification(
        `✓ ${engineName} configuration saved! Reloading engines...`,
        "success"
      );
      await loadAllSettings();

      // Refresh AI engines list
      setTimeout(() => {
        window.location.reload();
      }, 1500);
    } catch (err: any) {
      const errorMsg =
        formatErrorMessage(err) || "Failed to save configuration";
      setError(errorMsg);
      showNotification(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveAISettings = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        settingsApi.updateSystemSetting(
          "ai_temperature",
          aiSettings.temperature,
          "ai",
          "AI model temperature setting"
        ),
        settingsApi.updateSystemSetting(
          "ai_max_tokens",
          aiSettings.max_tokens,
          "ai",
          "Maximum tokens for AI responses"
        ),
        settingsApi.updateSystemSetting(
          "ai_top_p",
          aiSettings.top_p,
          "ai",
          "Top P sampling parameter"
        ),
        settingsApi.updateSystemSetting(
          "ai_frequency_penalty",
          aiSettings.frequency_penalty,
          "ai",
          "Frequency penalty for AI responses"
        ),
        settingsApi.updateSystemSetting(
          "ai_presence_penalty",
          aiSettings.presence_penalty,
          "ai",
          "Presence penalty for AI responses"
        ),
      ]);

      setSuccess("AI settings saved successfully!");
      showNotification("✓ AI parameters saved successfully!", "success");
    } catch (err: any) {
      const errorMsg = formatErrorMessage(err) || "Failed to save AI settings";
      setError(errorMsg);
      showNotification(errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTerminalSettings = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        settingsApi.updateSystemSetting(
          "terminal_auto_backup",
          terminalSettings.auto_backup_enabled,
          "terminal",
          "Automatically create backups before risky operations"
        ),
        settingsApi.updateSystemSetting(
          "terminal_require_confirmation",
          terminalSettings.require_confirmation_risky,
          "terminal",
          "Require user confirmation for risky commands"
        ),
        settingsApi.updateSystemSetting(
          "terminal_history_limit",
          terminalSettings.command_history_limit,
          "terminal",
          "Maximum number of commands to keep in history"
        ),
        settingsApi.updateSystemSetting(
          "terminal_output_buffer",
          terminalSettings.output_buffer_size,
          "terminal",
          "Maximum output buffer size in bytes"
        ),
        settingsApi.updateSystemSetting(
          "terminal_default_shell",
          terminalSettings.default_shell,
          "terminal",
          "Default shell for command execution"
        ),
        settingsApi.updateSystemSetting(
          "terminal_timeout",
          terminalSettings.timeout_seconds,
          "terminal",
          "Command execution timeout in seconds"
        ),
      ]);

      setSuccess("Terminal settings saved successfully!");
      showNotification("✓ Terminal settings saved and applied!", "success");
    } catch (err: any) {
      const errorMsg =
        formatErrorMessage(err) || "Failed to save terminal settings";
      setError(errorMsg);
      showNotification("✗ " + errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSecuritySettings = async () => {
    setLoading(true);
    setError(null);
    try {
      await Promise.all([
        settingsApi.updateSystemSetting(
          "security_audit_logging",
          securitySettings.enable_audit_logging,
          "security",
          "Enable comprehensive audit logging"
        ),
        settingsApi.updateSystemSetting(
          "security_block_dangerous",
          securitySettings.block_dangerous_commands,
          "security",
          "Block execution of dangerous commands"
        ),
        settingsApi.updateSystemSetting(
          "security_sudo_confirmation",
          securitySettings.require_sudo_confirmation,
          "security",
          "Require confirmation for elevated commands"
        ),
        settingsApi.updateSystemSetting(
          "security_max_file_size",
          securitySettings.max_file_size_mb,
          "security",
          "Maximum file size for operations in MB"
        ),
        settingsApi.updateSystemSetting(
          "security_path_restrictions",
          securitySettings.enable_path_restrictions,
          "security",
          "Enable system path restrictions"
        ),
        settingsApi.updateSystemSetting(
          "security_session_timeout",
          securitySettings.session_timeout_minutes,
          "security",
          "Session timeout in minutes"
        ),
        settingsApi.updateSystemSetting(
          "security_max_attempts",
          securitySettings.max_failed_attempts,
          "security",
          "Maximum failed authentication attempts"
        ),
      ]);

      setSuccess("Security settings saved successfully!");
      showNotification("✓ Security settings saved and enforced!", "success");
    } catch (err: any) {
      const errorMsg =
        formatErrorMessage(err) || "Failed to save security settings";
      setError(errorMsg);
      showNotification("✗ " + errorMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  const getModelStatus = (engineName: string): React.ReactNode => {
    const config = configuredModels.find((c) => c.engine_name === engineName);
    const modelInfo = availableModels[engineName];

    if (!config && modelInfo?.requires_api_key) {
      return (
        <Chip
          size="small"
          label="Not Configured"
          color="warning"
          icon={<Warning />}
        />
      );
    }

    if (config && !config.is_enabled) {
      return <Chip size="small" label="Disabled" color="default" />;
    }

    if (config && config.has_api_key) {
      return (
        <Chip
          size="small"
          label="Configured"
          color="success"
          icon={<CheckCircle />}
        />
      );
    }

    if (config && !modelInfo?.requires_api_key) {
      return (
        <Chip
          size="small"
          label="Ready"
          color="success"
          icon={<CheckCircle />}
        />
      );
    }

    return (
      <Chip
        size="small"
        label="Not Configured"
        color="warning"
        icon={<Warning />}
      />
    );
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" justifyContent="space-between">
          <Typography variant="h6">System Settings</Typography>
          <Tooltip title="Refresh">
            <IconButton onClick={loadAllSettings} disabled={loading}>
              <Refresh />
            </IconButton>
          </Tooltip>
        </Box>
      </DialogTitle>

      <DialogContent dividers>
        {loading && (
          <Box display="flex" justifyContent="center" py={3}>
            <CircularProgress />
          </Box>
        )}

        {error && (
          <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {success && (
          <Alert
            severity="success"
            onClose={() => setSuccess(null)}
            sx={{ mb: 2 }}
          >
            {success}
          </Alert>
        )}

        <Tabs
          value={tabValue}
          onChange={(_, val) => setTabValue(val)}
          sx={{ mb: 2 }}
        >
          <Tab label="AI Models" />
          <Tab label="AI Parameters" />
          <Tab label="Terminal" />
          <Tab label="Security" />
        </Tabs>

        {/* AI Models Tab */}
        {tabValue === 0 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Configure AI models with your API keys. Changes take effect
              immediately after saving.
            </Alert>

            {Object.entries(availableModels).map(([key, modelInfo]) => (
              <Accordion
                key={key}
                expanded={expandedModel === key}
                onChange={() =>
                  setExpandedModel(expandedModel === key ? null : key)
                }
              >
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Box display="flex" alignItems="center" gap={2} width="100%">
                    <Typography sx={{ flexGrow: 1 }}>
                      {modelInfo.name}
                    </Typography>
                    {getModelStatus(key)}
                  </Box>
                </AccordionSummary>
                <AccordionDetails>
                  <Stack spacing={2}>
                    {modelInfo.requires_api_key && (
                      <>
                        <TextField
                          fullWidth
                          label="API Key"
                          type={showApiKeys[key] ? "text" : "password"}
                          value={modelForms[key]?.api_key || ""}
                          onChange={(e) =>
                            setModelForms((prev) => ({
                              ...prev,
                              [key]: { ...prev[key], api_key: e.target.value },
                            }))
                          }
                          InputProps={{
                            startAdornment: (
                              <InputAdornment position="start">
                                <Key fontSize="small" />
                              </InputAdornment>
                            ),
                            endAdornment: (
                              <InputAdornment position="end">
                                <IconButton
                                  onClick={() =>
                                    setShowApiKeys((prev) => ({
                                      ...prev,
                                      [key]: !prev[key],
                                    }))
                                  }
                                  edge="end"
                                >
                                  {showApiKeys[key] ? (
                                    <VisibilityOff />
                                  ) : (
                                    <Visibility />
                                  )}
                                </IconButton>
                              </InputAdornment>
                            ),
                          }}
                          helperText={
                            modelInfo.get_api_key_url && (
                              <Link
                                href={modelInfo.get_api_key_url}
                                target="_blank"
                                rel="noopener"
                              >
                                Get API Key <OpenInNew fontSize="inherit" />
                              </Link>
                            )
                          }
                        />
                      </>
                    )}

                    {modelInfo.requires_local_install && (
                      <Alert severity="info">
                        Requires local installation.{" "}
                        {modelInfo.install_url && (
                          <Link
                            href={modelInfo.install_url}
                            target="_blank"
                            rel="noopener"
                          >
                            Download here <OpenInNew fontSize="inherit" />
                          </Link>
                        )}
                      </Alert>
                    )}

                    <TextField
                      fullWidth
                      select
                      label="Model"
                      value={
                        modelForms[key]?.model_name || modelInfo.default_model
                      }
                      onChange={(e) =>
                        setModelForms((prev) => ({
                          ...prev,
                          [key]: { ...prev[key], model_name: e.target.value },
                        }))
                      }
                      SelectProps={{ native: true }}
                      inputProps={{
                        "aria-label": `Select model for ${modelInfo.name}`,
                        title: `Select model for ${modelInfo.name}`,
                      }}
                    >
                      {modelInfo.models.map((model) => (
                        <option key={model} value={model}>
                          {model}
                        </option>
                      ))}
                    </TextField>

                    <FormControlLabel
                      control={
                        <Switch
                          checked={modelForms[key]?.is_enabled ?? true}
                          onChange={(e) =>
                            setModelForms((prev) => ({
                              ...prev,
                              [key]: {
                                ...prev[key],
                                is_enabled: e.target.checked,
                              },
                            }))
                          }
                        />
                      }
                      label="Enable this AI model"
                    />

                    <Box display="flex" gap={1} justifyContent="flex-end">
                      <Button
                        variant="contained"
                        startIcon={<Save />}
                        onClick={() => handleSaveAIModel(key)}
                        disabled={loading}
                      >
                        Save Configuration
                      </Button>
                    </Box>
                  </Stack>
                </AccordionDetails>
              </Accordion>
            ))}
          </Box>
        )}

        {/* AI Parameters Tab */}
        {tabValue === 1 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Control AI model behavior and response generation parameters.
            </Alert>

            <Stack spacing={3}>
              <Box>
                <Typography gutterBottom>
                  Temperature: {aiSettings.temperature}
                </Typography>
                <Slider
                  value={aiSettings.temperature}
                  onChange={(_, val) =>
                    setAISettings((prev) => ({
                      ...prev,
                      temperature: val as number,
                    }))
                  }
                  min={0}
                  max={2}
                  step={0.1}
                  marks={[
                    { value: 0, label: "0 (Deterministic)" },
                    { value: 1, label: "1 (Balanced)" },
                    { value: 2, label: "2 (Creative)" },
                  ]}
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  Higher values make output more random, lower values make it
                  more focused and deterministic.
                </Typography>
              </Box>

              <TextField
                fullWidth
                type="number"
                label="Max Tokens"
                value={aiSettings.max_tokens}
                onChange={(e) =>
                  setAISettings((prev) => ({
                    ...prev,
                    max_tokens: parseInt(e.target.value),
                  }))
                }
                inputProps={{ min: 100, max: 32000, step: 100 }}
                helperText="Maximum number of tokens to generate in the response"
              />

              <Box>
                <Typography gutterBottom>Top P: {aiSettings.top_p}</Typography>
                <Slider
                  value={aiSettings.top_p}
                  onChange={(_, val) =>
                    setAISettings((prev) => ({ ...prev, top_p: val as number }))
                  }
                  min={0}
                  max={1}
                  step={0.05}
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  Controls diversity via nucleus sampling. Lower values = more
                  focused responses.
                </Typography>
              </Box>

              <Box>
                <Typography gutterBottom>
                  Frequency Penalty: {aiSettings.frequency_penalty}
                </Typography>
                <Slider
                  value={aiSettings.frequency_penalty}
                  onChange={(_, val) =>
                    setAISettings((prev) => ({
                      ...prev,
                      frequency_penalty: val as number,
                    }))
                  }
                  min={-2}
                  max={2}
                  step={0.1}
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  Reduces repetition of frequently used tokens.
                </Typography>
              </Box>

              <Box>
                <Typography gutterBottom>
                  Presence Penalty: {aiSettings.presence_penalty}
                </Typography>
                <Slider
                  value={aiSettings.presence_penalty}
                  onChange={(_, val) =>
                    setAISettings((prev) => ({
                      ...prev,
                      presence_penalty: val as number,
                    }))
                  }
                  min={-2}
                  max={2}
                  step={0.1}
                  valueLabelDisplay="auto"
                />
                <Typography variant="caption" color="text.secondary">
                  Encourages the model to talk about new topics.
                </Typography>
              </Box>

              <TextField
                fullWidth
                multiline
                rows={2}
                label="Stop Sequences (comma-separated)"
                value={aiSettings.stop_sequences}
                onChange={(e) =>
                  setAISettings((prev) => ({
                    ...prev,
                    stop_sequences: e.target.value,
                  }))
                }
                helperText="Sequences where the AI will stop generating further tokens"
              />

              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSaveAISettings}
                  disabled={loading}
                >
                  Save AI Parameters
                </Button>
              </Box>
            </Stack>
          </Box>
        )}

        {/* Terminal Tab */}
        {tabValue === 2 && (
          <Box>
            <Alert severity="info" sx={{ mb: 2 }}>
              Configure terminal behavior and command execution settings.
            </Alert>

            <Stack spacing={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Execution Safety
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={terminalSettings.auto_backup_enabled}
                          onChange={(e) =>
                            setTerminalSettings((prev) => ({
                              ...prev,
                              auto_backup_enabled: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Auto-create backups before risky operations"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={terminalSettings.require_confirmation_risky}
                          onChange={(e) =>
                            setTerminalSettings((prev) => ({
                              ...prev,
                              require_confirmation_risky: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Require confirmation for high-risk commands"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={terminalSettings.enable_command_suggestions}
                          onChange={(e) =>
                            setTerminalSettings((prev) => ({
                              ...prev,
                              enable_command_suggestions: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Enable AI command suggestions"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={terminalSettings.save_output_to_file}
                          onChange={(e) =>
                            setTerminalSettings((prev) => ({
                              ...prev,
                              save_output_to_file: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Automatically save command output to files"
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Performance & Limits
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Command History Limit"
                      value={terminalSettings.command_history_limit}
                      onChange={(e) =>
                        setTerminalSettings((prev) => ({
                          ...prev,
                          command_history_limit: parseInt(e.target.value),
                        }))
                      }
                      inputProps={{ min: 100, max: 10000, step: 100 }}
                      helperText="Maximum commands to keep in history"
                    />
                    <TextField
                      fullWidth
                      type="number"
                      label="Output Buffer Size (bytes)"
                      value={terminalSettings.output_buffer_size}
                      onChange={(e) =>
                        setTerminalSettings((prev) => ({
                          ...prev,
                          output_buffer_size: parseInt(e.target.value),
                        }))
                      }
                      inputProps={{ min: 1000, max: 100000, step: 1000 }}
                      helperText="Maximum output buffer size"
                    />
                    <TextField
                      fullWidth
                      type="number"
                      label="Execution Timeout (seconds)"
                      value={terminalSettings.timeout_seconds}
                      onChange={(e) =>
                        setTerminalSettings((prev) => ({
                          ...prev,
                          timeout_seconds: parseInt(e.target.value),
                        }))
                      }
                      inputProps={{ min: 30, max: 3600, step: 30 }}
                      helperText="Maximum time for command execution"
                    />
                    <TextField
                      fullWidth
                      type="number"
                      label="Max Concurrent Commands"
                      value={terminalSettings.max_concurrent_commands}
                      onChange={(e) =>
                        setTerminalSettings((prev) => ({
                          ...prev,
                          max_concurrent_commands: parseInt(e.target.value),
                        }))
                      }
                      inputProps={{ min: 1, max: 20 }}
                      helperText="Maximum number of commands running simultaneously"
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Shell Configuration
                  </Typography>
                  <TextField
                    fullWidth
                    select
                    label="Default Shell"
                    value={terminalSettings.default_shell}
                    onChange={(e) =>
                      setTerminalSettings((prev) => ({
                        ...prev,
                        default_shell: e.target.value,
                      }))
                    }
                    helperText="Default shell for command execution"
                    inputProps={{
                      "aria-label":
                        "Select default shell for command execution",
                    }}
                  >
                    <MuiMenuItem value="powershell">PowerShell</MuiMenuItem>
                    <MuiMenuItem value="cmd">Command Prompt (cmd)</MuiMenuItem>
                    <MuiMenuItem value="bash">Bash (WSL)</MuiMenuItem>
                    <MuiMenuItem value="zsh">Zsh</MuiMenuItem>
                  </TextField>
                </CardContent>
              </Card>

              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  startIcon={<Save />}
                  onClick={handleSaveTerminalSettings}
                  disabled={loading}
                >
                  Save Terminal Settings
                </Button>
              </Box>
            </Stack>
          </Box>
        )}

        {/* Security Tab */}
        {tabValue === 3 && (
          <Box>
            <Alert severity="warning" sx={{ mb: 2 }}>
              <strong>Security Settings</strong> - These settings protect your
              system from unauthorized access and dangerous operations.
            </Alert>

            <Stack spacing={3}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Access Control
                  </Typography>
                  <Stack spacing={2}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={securitySettings.enable_audit_logging}
                          onChange={(e) =>
                            setSecuritySettings((prev) => ({
                              ...prev,
                              enable_audit_logging: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Enable comprehensive audit logging"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={securitySettings.block_dangerous_commands}
                          onChange={(e) =>
                            setSecuritySettings((prev) => ({
                              ...prev,
                              block_dangerous_commands: e.target.checked,
                            }))
                          }
                          color="error"
                        />
                      }
                      label="Block dangerous commands (rm -rf, format, etc.)"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={securitySettings.require_sudo_confirmation}
                          onChange={(e) =>
                            setSecuritySettings((prev) => ({
                              ...prev,
                              require_sudo_confirmation: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Require confirmation for elevated privileges"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={securitySettings.enable_path_restrictions}
                          onChange={(e) =>
                            setSecuritySettings((prev) => ({
                              ...prev,
                              enable_path_restrictions: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Enable system path restrictions"
                    />
                    <FormControlLabel
                      control={
                        <Switch
                          checked={securitySettings.enable_two_factor}
                          onChange={(e) =>
                            setSecuritySettings((prev) => ({
                              ...prev,
                              enable_two_factor: e.target.checked,
                            }))
                          }
                        />
                      }
                      label="Enable two-factor authentication (Coming Soon)"
                      disabled
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    File Operations Security
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Max File Size (MB)"
                      value={securitySettings.max_file_size_mb}
                      onChange={(e) =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          max_file_size_mb: parseInt(e.target.value),
                        }))
                      }
                      inputProps={{ min: 1, max: 1000 }}
                      helperText="Maximum file size for read/write operations"
                    />
                    <Alert severity="info" sx={{ mt: 1 }}>
                      <Typography variant="body2">
                        <strong>Protected Paths:</strong>
                        <br />• System directories (/, /sys, /proc, C:\Windows)
                        <br />• Critical files (.bashrc, passwd, hosts)
                        <br />• SSH keys and certificates
                      </Typography>
                    </Alert>
                  </Stack>
                </CardContent>
              </Card>

              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Session Management
                  </Typography>
                  <Stack spacing={2}>
                    <TextField
                      fullWidth
                      type="number"
                      label="Session Timeout (minutes)"
                      value={securitySettings.session_timeout_minutes}
                      onChange={(e) =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          session_timeout_minutes: parseInt(e.target.value),
                        }))
                      }
                      inputProps={{ min: 5, max: 480 }}
                      helperText="Auto-logout after inactivity"
                    />
                    <TextField
                      fullWidth
                      type="number"
                      label="Max Failed Attempts"
                      value={securitySettings.max_failed_attempts}
                      onChange={(e) =>
                        setSecuritySettings((prev) => ({
                          ...prev,
                          max_failed_attempts: parseInt(e.target.value),
                        }))
                      }
                      inputProps={{ min: 1, max: 10 }}
                      helperText="Maximum failed authentication attempts before lockout"
                    />
                  </Stack>
                </CardContent>
              </Card>

              <Alert severity="success">
                <Typography variant="body2">
                  <strong>Current Security Status:</strong>
                  <br />✓ All sensitive operations are logged
                  <br />✓ Dangerous commands require confirmation
                  <br />✓ Protected system paths are restricted
                  <br />✓ Automatic backups before risky operations
                </Typography>
              </Alert>

              <Box display="flex" justifyContent="flex-end">
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Save />}
                  onClick={handleSaveSecuritySettings}
                  disabled={loading}
                >
                  Save Security Settings
                </Button>
              </Box>
            </Stack>
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>

      {/* Notification Snackbar */}
      <Snackbar
        open={notificationOpen}
        autoHideDuration={4000}
        onClose={() => setNotificationOpen(false)}
        anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
      >
        <Alert
          onClose={() => setNotificationOpen(false)}
          severity={notificationType}
          variant="filled"
          sx={{ width: "100%" }}
        >
          {notificationMessage}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default SettingsDialog;
