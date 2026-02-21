/**
 * CoreAstra Command Approval Modal Component
 * AI-Powered Terminal & Intelligent Control Interface
 *
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 */

import React, { useState, useEffect } from "react";
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  Paper,
  Chip,
  Alert,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Collapse,
  IconButton,
  Divider,
  Checkbox,
  FormControlLabel,
  Tooltip,
} from "@mui/material";
import {
  Warning,
  Error as ErrorIcon,
  Info,
  CheckCircle,
  ExpandMore,
  ExpandLess,
  Shield,
  Delete,
  Create,
  Edit,
  FileCopy,
  Terminal,
  Storage,
  Security,
  Dangerous,
  HighlightOff,
  Undo,
} from "@mui/icons-material";

interface CommandAnalysis {
  risk_level: "safe" | "low" | "medium" | "high" | "critical";
  risk_score: number;
  category: string;
  actions: string[];
  affected_paths: string[];
  reversible: boolean;
  requires_sudo: boolean;
  warnings: string[];
  recommendations: string[];
}

interface ApprovalModalProps {
  open: boolean;
  command: string;
  analysis: CommandAnalysis | null;
  onApprove: (createBackup: boolean) => void;
  onReject: () => void;
  loading?: boolean;
}

const riskConfig = {
  safe: {
    color: "success",
    icon: <CheckCircle />,
    label: "Safe",
    progressColor: "success",
  },
  low: {
    color: "info",
    icon: <Info />,
    label: "Low Risk",
    progressColor: "info",
  },
  medium: {
    color: "warning",
    icon: <Warning />,
    label: "Medium Risk",
    progressColor: "warning",
  },
  high: {
    color: "error",
    icon: <ErrorIcon />,
    label: "High Risk",
    progressColor: "error",
  },
  critical: {
    color: "error",
    icon: <Dangerous />,
    label: "Critical",
    progressColor: "error",
  },
};

const actionIcons: Record<string, React.ReactNode> = {
  read: <Info color="info" />,
  write: <Edit color="warning" />,
  delete: <Delete color="error" />,
  create: <Create color="success" />,
  copy: <FileCopy color="info" />,
  move: <FileCopy color="warning" />,
  execute: <Terminal color="primary" />,
  modify: <Edit color="warning" />,
  network: <Storage color="info" />,
  system: <Security color="warning" />,
};

const ApprovalModal: React.FC<ApprovalModalProps> = ({
  open,
  command,
  analysis,
  onApprove,
  onReject,
  loading = false,
}) => {
  const [showDetails, setShowDetails] = useState(false);
  const [showPaths, setShowPaths] = useState(false);
  const [createBackup, setCreateBackup] = useState(true);
  const [countdown, setCountdown] = useState<number | null>(null);

  // Auto-countdown for critical commands
  useEffect(() => {
    if (open && analysis?.risk_level === "critical") {
      setCountdown(5);
    } else {
      setCountdown(null);
    }
  }, [open, analysis?.risk_level]);

  useEffect(() => {
    if (countdown !== null && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  if (!analysis) {
    return null;
  }

  const risk = riskConfig[analysis.risk_level] || riskConfig.medium;

  return (
    <Dialog
      open={open}
      onClose={onReject}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderTop: `4px solid`,
          borderTopColor: `${risk.color}.main`,
        },
      }}
    >
      <DialogTitle>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Shield sx={{ color: `${risk.color}.main`, fontSize: 32 }} />
          <Box sx={{ flexGrow: 1 }}>
            <Typography variant="h6">Command Approval Required</Typography>
            <Typography variant="body2" color="text.secondary">
              Review the command analysis before execution
            </Typography>
          </Box>
          <Chip
            icon={risk.icon}
            label={risk.label}
            color={risk.color as any}
            variant="filled"
          />
        </Box>
      </DialogTitle>

      <DialogContent>
        {/* Command Display */}
        <Paper
          variant="outlined"
          sx={{
            p: 2,
            mb: 2,
            bgcolor: "#1e1e1e",
            fontFamily: "monospace",
            fontSize: "0.9rem",
            color: "#d4d4d4",
            overflow: "auto",
            maxHeight: 100,
          }}
        >
          <code>{command}</code>
        </Paper>

        {/* Risk Score */}
        <Box sx={{ mb: 3 }}>
          <Box sx={{ display: "flex", justifyContent: "space-between", mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Risk Score
            </Typography>
            <Typography variant="body2" fontWeight="bold">
              {analysis.risk_score}/100
            </Typography>
          </Box>
          <LinearProgress
            variant="determinate"
            value={analysis.risk_score}
            color={risk.progressColor as any}
            sx={{ height: 8, borderRadius: 4 }}
          />
        </Box>

        {/* Quick Stats */}
        <Box sx={{ display: "flex", gap: 1, flexWrap: "wrap", mb: 2 }}>
          <Chip
            icon={<Terminal />}
            label={analysis.category}
            variant="outlined"
            size="small"
          />
          {analysis.reversible ? (
            <Chip
              icon={<Undo />}
              label="Reversible"
              color="success"
              variant="outlined"
              size="small"
            />
          ) : (
            <Chip
              icon={<HighlightOff />}
              label="Not Reversible"
              color="error"
              variant="outlined"
              size="small"
            />
          )}
          {analysis.requires_sudo && (
            <Chip
              icon={<Security />}
              label="Requires Sudo"
              color="warning"
              variant="outlined"
              size="small"
            />
          )}
        </Box>

        {/* Warnings */}
        {analysis.warnings.length > 0 && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Warnings:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {analysis.warnings.map((warning, index) => (
                <Box
                  component="li"
                  key={index}
                  sx={{ listStyleType: "disc", mb: 0.5 }}
                >
                  <Typography variant="body2">{warning}</Typography>
                </Box>
              ))}
            </Box>
          </Alert>
        )}

        {/* Recommendations */}
        {analysis.recommendations.length > 0 && (
          <Alert severity="info" sx={{ mb: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              Recommendations:
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 2 }}>
              {analysis.recommendations.map((rec, index) => (
                <Box
                  component="li"
                  key={index}
                  sx={{ listStyleType: "disc", mb: 0.5 }}
                >
                  <Typography variant="body2">{rec}</Typography>
                </Box>
              ))}
            </Box>
          </Alert>
        )}

        {/* Actions Section */}
        <Box sx={{ mb: 2 }}>
          <Box
            sx={{
              display: "flex",
              alignItems: "center",
              cursor: "pointer",
              py: 1,
            }}
            onClick={() => setShowDetails(!showDetails)}
          >
            <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
              Actions ({analysis.actions.length})
            </Typography>
            <IconButton size="small">
              {showDetails ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          </Box>
          <Collapse in={showDetails}>
            <List dense>
              {analysis.actions.map((action, index) => (
                <ListItem key={index}>
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    {actionIcons[action.toLowerCase()] || <Terminal />}
                  </ListItemIcon>
                  <ListItemText primary={action} />
                </ListItem>
              ))}
            </List>
          </Collapse>
        </Box>

        {/* Affected Paths Section */}
        {analysis.affected_paths.length > 0 && (
          <Box sx={{ mb: 2 }}>
            <Box
              sx={{
                display: "flex",
                alignItems: "center",
                cursor: "pointer",
                py: 1,
              }}
              onClick={() => setShowPaths(!showPaths)}
            >
              <Typography variant="subtitle2" sx={{ flexGrow: 1 }}>
                Affected Paths ({analysis.affected_paths.length})
              </Typography>
              <IconButton size="small">
                {showPaths ? <ExpandLess /> : <ExpandMore />}
              </IconButton>
            </Box>
            <Collapse in={showPaths}>
              <Paper
                variant="outlined"
                sx={{ p: 1, maxHeight: 150, overflow: "auto" }}
              >
                {analysis.affected_paths.map((path, index) => (
                  <Typography
                    key={index}
                    variant="body2"
                    sx={{
                      fontFamily: "monospace",
                      fontSize: "0.8rem",
                      py: 0.5,
                    }}
                  >
                    {path}
                  </Typography>
                ))}
              </Paper>
            </Collapse>
          </Box>
        )}

        <Divider sx={{ my: 2 }} />

        {/* Backup Option */}
        {!analysis.reversible && (
          <Tooltip title="Create a backup of affected files before executing the command">
            <FormControlLabel
              control={
                <Checkbox
                  checked={createBackup}
                  onChange={(e) => setCreateBackup(e.target.checked)}
                  color="primary"
                />
              }
              label="Create backup before execution (recommended)"
            />
          </Tooltip>
        )}

        {/* Critical Warning */}
        {analysis.risk_level === "critical" && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <Typography variant="subtitle2" gutterBottom>
              ⚠️ Critical Command Warning
            </Typography>
            <Typography variant="body2">
              This command has been identified as critical and potentially
              destructive. Please ensure you understand the consequences before
              proceeding.
            </Typography>
          </Alert>
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onReject} disabled={loading}>
          Cancel
        </Button>
        <Button
          variant="contained"
          color={analysis.risk_level === "critical" ? "error" : "primary"}
          onClick={() => onApprove(createBackup)}
          disabled={loading || (countdown !== null && countdown > 0)}
          sx={{ minWidth: 120 }}
        >
          {loading
            ? "Processing..."
            : countdown !== null && countdown > 0
            ? `Wait ${countdown}s`
            : "Approve & Execute"}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ApprovalModal;
