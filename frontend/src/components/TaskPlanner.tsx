/**
 * CoreAstra Task Planner Component
 * AI-Powered Terminal & Intelligent Control Interface
 *
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 */

import React, { useState, useEffect } from "react";
import {
  Box,
  Typography,
  TextField,
  Button,
  Card,
  CardContent,
  Stepper,
  Step,
  StepLabel,
  StepContent,
  Chip,
  IconButton,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  CircularProgress,
  Alert,
  Tooltip,
} from "@mui/material";
import { alpha, useTheme } from "@mui/material/styles";
import {
  PlayArrow,
  CheckCircle,
  Warning,
  Add,
  Assignment,
  Schedule,
  ContentCopy,
  Visibility,
} from "@mui/icons-material";
import { taskApi } from "../services/api";
import { TaskPlan, TaskStep } from "../types";

interface TaskPlannerProps {
  onRunCommand?: (command: string) => void;
}

const TaskPlanner: React.FC<TaskPlannerProps> = ({ onRunCommand }) => {
  const [objective, setObjective] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [plans, setPlans] = useState<TaskPlan[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<TaskPlan | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const theme = useTheme();
  const listItemBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.02)
      : alpha(theme.palette.primary.main, 0.05);
  const listItemHover =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.05)
      : alpha(theme.palette.primary.main, 0.1);

  useEffect(() => {
    loadPlans();
  }, []);

  const loadPlans = async () => {
    try {
      const data = await taskApi.getPlans();
      setPlans(data);
    } catch (error) {
      console.error("Failed to load plans:", error);
    }
  };

  const handleCreatePlan = async () => {
    if (!objective.trim()) return;

    setIsCreating(true);
    try {
      const plan = await taskApi.createPlan(objective);
      setPlans((prev: TaskPlan[]) => [plan, ...prev]);
      setSelectedPlan(plan);
      setObjective("");
      setActiveStep(0);
    } catch (error) {
      console.error("Failed to create plan:", error);
    } finally {
      setIsCreating(false);
    }
  };

  const handleViewPlan = async (planId: number) => {
    try {
      const plan = await taskApi.getPlan(planId);
      setSelectedPlan(plan);
      setViewDialogOpen(true);
    } catch (error) {
      console.error("Failed to load plan:", error);
    }
  };

  const handleExecuteStep = (step: TaskStep) => {
    if (step.command && onRunCommand) {
      onRunCommand(step.command);
    }
    setActiveStep((prev: number) => prev + 1);
  };

  const getRiskIcon = (isRisky: boolean) => {
    return isRisky ? (
      <Warning sx={{ color: "warning.main", fontSize: 18 }} />
    ) : (
      <CheckCircle sx={{ color: "success.main", fontSize: 18 }} />
    );
  };

  return (
    <Box sx={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {/* Create New Plan */}
      <Card sx={{ mb: 2 }}>
        <CardContent>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            <Assignment sx={{ fontSize: 18, mr: 1, verticalAlign: "middle" }} />
            Create Task Plan
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Describe what you want to accomplish and AI will create a
            step-by-step plan.
          </Typography>
          <Box sx={{ display: "flex", gap: 1 }}>
            <TextField
              fullWidth
              size="small"
              placeholder="e.g., Set up a Node.js project with TypeScript"
              value={objective}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setObjective(e.target.value)
              }
              onKeyDown={(e: React.KeyboardEvent<HTMLDivElement>) =>
                e.key === "Enter" && handleCreatePlan()
              }
              disabled={isCreating}
            />
            <Button
              variant="contained"
              onClick={handleCreatePlan}
              disabled={isCreating || !objective.trim()}
              startIcon={isCreating ? <CircularProgress size={16} /> : <Add />}
            >
              Create
            </Button>
          </Box>
        </CardContent>
      </Card>

      {/* Current Plan Execution */}
      {selectedPlan && !viewDialogOpen && (
        <Card sx={{ mb: 2, flex: 1, overflow: "auto" }}>
          <CardContent>
            <Box sx={{ display: "flex", alignItems: "center", mb: 2 }}>
              <Typography variant="subtitle2" sx={{ fontWeight: 600, flex: 1 }}>
                {selectedPlan.title}
              </Typography>
              <Chip
                label={selectedPlan.status}
                size="small"
                color={
                  selectedPlan.status === "completed" ? "success" : "default"
                }
              />
            </Box>

            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              {selectedPlan.description}
            </Typography>

            <Stepper activeStep={activeStep} orientation="vertical">
              {selectedPlan.steps.map((step: TaskStep, index: number) => (
                <Step key={index}>
                  <StepLabel
                    optional={
                      step.is_risky && (
                        <Typography variant="caption" color="warning.main">
                          ⚠️ Risky operation
                        </Typography>
                      )
                    }
                  >
                    {step.description}
                  </StepLabel>
                  <StepContent>
                    {step.command && (
                      <Box
                        sx={{
                          p: 1.5,
                          bgcolor: "background.default",
                          borderRadius: 1,
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: "0.8rem",
                          mb: 1,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <code>{step.command}</code>
                        <Tooltip title="Copy">
                          <IconButton
                            size="small"
                            onClick={() =>
                              navigator.clipboard.writeText(step.command!)
                            }
                          >
                            <ContentCopy sx={{ fontSize: 14 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    )}
                    <Box sx={{ display: "flex", gap: 1 }}>
                      {step.command && (
                        <Button
                          size="small"
                          variant="contained"
                          onClick={() => handleExecuteStep(step)}
                          startIcon={<PlayArrow />}
                          color={step.is_risky ? "warning" : "primary"}
                        >
                          Execute
                        </Button>
                      )}
                      <Button
                        size="small"
                        onClick={() =>
                          setActiveStep((prev: number) => prev + 1)
                        }
                      >
                        Skip
                      </Button>
                    </Box>
                  </StepContent>
                </Step>
              ))}
            </Stepper>

            {activeStep === selectedPlan.steps.length && (
              <Alert severity="success" sx={{ mt: 2 }}>
                All steps completed!
              </Alert>
            )}
          </CardContent>
        </Card>
      )}

      {/* Recent Plans */}
      <Card
        sx={{ flex: selectedPlan && !viewDialogOpen ? 0 : 1, overflow: "auto" }}
      >
        <CardContent>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
            <Schedule sx={{ fontSize: 18, mr: 1, verticalAlign: "middle" }} />
            Recent Plans
          </Typography>

          {plans.length === 0 ? (
            <Typography variant="body2" color="text.secondary">
              No plans yet. Create one above!
            </Typography>
          ) : (
            <List dense>
              {plans.slice(0, 10).map((plan: TaskPlan) => (
                <ListItem
                  key={plan.id}
                  button
                  onClick={() => handleViewPlan(plan.id)}
                  sx={{
                    borderRadius: 1,
                    mb: 0.5,
                    bgcolor: listItemBg,
                    "&:hover": { bgcolor: listItemHover },
                  }}
                >
                  <ListItemIcon sx={{ minWidth: 36 }}>
                    <Assignment sx={{ fontSize: 18, color: "primary.main" }} />
                  </ListItemIcon>
                  <ListItemText
                    primary={plan.title}
                    secondary={new Date(plan.created_at).toLocaleDateString()}
                    primaryTypographyProps={{ variant: "body2" }}
                    secondaryTypographyProps={{ variant: "caption" }}
                  />
                  <Chip label={plan.status} size="small" />
                  <IconButton size="small" sx={{ ml: 1 }}>
                    <Visibility sx={{ fontSize: 16 }} />
                  </IconButton>
                </ListItem>
              ))}
            </List>
          )}
        </CardContent>
      </Card>

      {/* View Plan Dialog */}
      <Dialog
        open={viewDialogOpen}
        onClose={() => setViewDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        {selectedPlan && (
          <>
            <DialogTitle>
              <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                <Assignment color="primary" />
                {selectedPlan.title}
                <Chip
                  label={selectedPlan.ai_engine}
                  size="small"
                  sx={{ ml: "auto" }}
                />
              </Box>
            </DialogTitle>
            <DialogContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                {selectedPlan.description}
              </Typography>

              <List>
                {selectedPlan.steps.map((step: TaskStep, index: number) => (
                  <ListItem
                    key={index}
                    sx={{
                      flexDirection: "column",
                      alignItems: "flex-start",
                      bgcolor: listItemBg,
                      mb: 1,
                      borderRadius: 1,
                    }}
                  >
                    <Box
                      sx={{
                        display: "flex",
                        alignItems: "center",
                        width: "100%",
                        mb: 1,
                      }}
                    >
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Step {step.order}: {step.description}
                      </Typography>
                      <Box sx={{ ml: "auto" }}>
                        {getRiskIcon(step.is_risky)}
                      </Box>
                    </Box>
                    {step.command && (
                      <Box
                        sx={{
                          width: "100%",
                          p: 1,
                          bgcolor: "background.default",
                          borderRadius: 1,
                          fontFamily: '"JetBrains Mono", monospace',
                          fontSize: "0.8rem",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                        }}
                      >
                        <code>{step.command}</code>
                        <Button
                          size="small"
                          startIcon={<PlayArrow />}
                          onClick={() => {
                            onRunCommand?.(step.command!);
                            setViewDialogOpen(false);
                          }}
                        >
                          Run
                        </Button>
                      </Box>
                    )}
                  </ListItem>
                ))}
              </List>
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
              <Button
                variant="contained"
                onClick={() => {
                  setViewDialogOpen(false);
                  setActiveStep(0);
                }}
              >
                Execute Plan
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
};

export default TaskPlanner;
