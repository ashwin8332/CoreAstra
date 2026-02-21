import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  IconButton,
  List,
  ListItem,
  Paper,
  Switch,
  Tooltip,
  Typography,
} from "@mui/material";
import {
  ArrowDownward,
  ArrowUpward,
  Refresh,
  Settings as SettingsIcon,
} from "@mui/icons-material";
import { alpha, useTheme } from "@mui/material/styles";

export interface NavigationSection {
  id: string;
  label: string;
  description: string;
  icon?: React.ReactNode;
}

interface NavigationSettingsDialogProps {
  open: boolean;
  sections: NavigationSection[];
  config: Record<string, boolean>;
  order: string[];
  onSave: (payload: {
    config: Record<string, boolean>;
    order: string[];
  }) => void;
  onReset?: () => {
    config: Record<string, boolean>;
    order: string[];
  };
  onClose: () => void;
}

const NavigationSettingsDialog: React.FC<NavigationSettingsDialogProps> = ({
  open,
  sections,
  config,
  order,
  onSave,
  onReset,
  onClose,
}) => {
  const [draftConfig, setDraftConfig] =
    useState<Record<string, boolean>>(config);
  const [draftOrder, setDraftOrder] = useState<string[]>(order);
  const [error, setError] = useState<string | null>(null);
  const theme = useTheme();

  useEffect(() => {
    if (open) {
      setDraftConfig(config);
      setDraftOrder(order);
      setError(null);
    }
  }, [open, config, order]);

  const sectionMap = useMemo(() => {
    const map = new Map<string, NavigationSection>();
    sections.forEach((section) => {
      map.set(section.id, section);
    });
    return map;
  }, [sections]);

  const enabledCount = useMemo(() => {
    return Object.values(draftConfig).filter(Boolean).length;
  }, [draftConfig]);

  const handleToggle = useCallback((id: string, checked: boolean) => {
    setDraftConfig((prev) => {
      const next = { ...prev, [id]: checked };
      const nextEnabled = Object.values(next).filter(Boolean).length;
      if (nextEnabled === 0) {
        setError("Keep at least one section enabled.");
        return prev;
      }
      setError(null);
      return next;
    });
  }, []);

  const handleMove = useCallback((id: string, direction: "up" | "down") => {
    setDraftOrder((prev) => {
      const index = prev.indexOf(id);
      if (index === -1) {
        return prev;
      }
      const targetIndex = direction === "up" ? index - 1 : index + 1;
      if (targetIndex < 0 || targetIndex >= prev.length) {
        return prev;
      }
      const next = [...prev];
      const [item] = next.splice(index, 1);
      next.splice(targetIndex, 0, item);
      return next;
    });
  }, []);

  const handleSave = () => {
    if (!Object.values(draftConfig).some(Boolean)) {
      setError("Enable at least one section to continue.");
      return;
    }
    onSave({ config: draftConfig, order: draftOrder });
    onClose();
  };

  const handleReset = () => {
    if (!onReset) {
      return;
    }
    const defaults = onReset();
    if (defaults) {
      setDraftConfig(defaults.config);
      setDraftOrder(defaults.order);
      setError(null);
    }
  };

  const renderReorderButton = (
    id: string,
    direction: "up" | "down",
    disabled: boolean
  ) => {
    const Icon = direction === "up" ? ArrowUpward : ArrowDownward;
    return (
      <Tooltip title={direction === "up" ? "Move up" : "Move down"}>
        <span>
          <IconButton
            size="small"
            disabled={disabled}
            onClick={() => handleMove(id, direction)}
          >
            <Icon fontSize="small" />
          </IconButton>
        </span>
      </Tooltip>
    );
  };

  const highlightBorder = useMemo(() => {
    return alpha(
      theme.palette.primary.main,
      theme.palette.mode === "dark" ? 0.4 : 0.3
    );
  }, [theme.palette.primary.main, theme.palette.mode]);

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Navigation Preferences</DialogTitle>
      <DialogContent dividers>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Choose which CoreAstra workspaces appear in the main navigation. You
          can adjust these settings anytime.
        </Typography>
        <Box
          sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            mb: 2,
          }}
        >
          <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
            <SettingsIcon fontSize="small" color="primary" />
            <Typography variant="body2" color="text.secondary">
              {enabledCount} section{enabledCount === 1 ? "" : "s"} active
            </Typography>
          </Box>
          {onReset && (
            <Button
              size="small"
              variant="outlined"
              startIcon={<Refresh fontSize="small" />}
              onClick={handleReset}
            >
              Restore defaults
            </Button>
          )}
        </Box>
        <Divider sx={{ mb: 2 }} />
        <List sx={{ display: "flex", flexDirection: "column", gap: 1.5, p: 0 }}>
          {draftOrder.map((id, index) => {
            const section = sectionMap.get(id);
            if (!section) {
              return null;
            }
            const isEnabled = draftConfig[section.id] ?? true;
            return (
              <ListItem key={section.id} sx={{ p: 0 }}>
                <Paper
                  elevation={0}
                  sx={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    width: "100%",
                    borderRadius: 2,
                    px: 1.5,
                    py: 1.25,
                    border: `1px solid ${
                      isEnabled ? highlightBorder : theme.palette.divider
                    }`,
                    transition: "border-color 0.2s ease, box-shadow 0.2s ease",
                    boxShadow: isEnabled
                      ? `0 4px 16px ${alpha(theme.palette.primary.main, 0.05)}`
                      : "none",
                  }}
                >
                  <Box
                    sx={{
                      display: "flex",
                      alignItems: "center",
                      gap: 1.5,
                      flex: 1,
                    }}
                  >
                    {section.icon && (
                      <Box sx={{ display: "flex", alignItems: "center" }}>
                        {section.icon}
                      </Box>
                    )}
                    <Box>
                      <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                        {section.label}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {section.description}
                      </Typography>
                    </Box>
                  </Box>
                  <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                    {renderReorderButton(section.id, "up", index === 0)}
                    {renderReorderButton(
                      section.id,
                      "down",
                      index === draftOrder.length - 1
                    )}
                    <FormControlLabel
                      control={
                        <Switch
                          checked={isEnabled}
                          onChange={(event) =>
                            handleToggle(section.id, event.target.checked)
                          }
                          color="primary"
                          size="small"
                        />
                      }
                      labelPlacement="start"
                      label={isEnabled ? "Visible" : "Hidden"}
                      sx={{ m: 0, ml: 1 }}
                    />
                  </Box>
                </Paper>
              </ListItem>
            );
          })}
        </List>
        {error && (
          <Alert severity="warning" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button onClick={handleSave} variant="contained">
          Save Changes
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default NavigationSettingsDialog;
