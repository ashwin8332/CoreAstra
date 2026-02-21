/**
 * CoreAstra Main Application
 * AI-Powered Terminal & Intelligent Control Interface
 *
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 */

import React, { useState, useCallback, useEffect, useMemo } from "react";
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Tabs,
  Tab,
  Drawer,
  Divider,
  Tooltip,
  Badge,
  Chip,
  useMediaQuery,
  useTheme,
  ToggleButtonGroup,
  ToggleButton,
  Paper,
} from "@mui/material";
import List from "@mui/material/List";
import ListItem from "@mui/material/ListItem";
import ListItemButton from "@mui/material/ListItemButton";
import ListItemIcon from "@mui/material/ListItemIcon";
import ListItemText from "@mui/material/ListItemText";
import {
  Terminal as TerminalIcon,
  SmartToy,
  Assignment,
  Monitor,
  Menu as MenuIcon,
  Settings,
  Notifications,
  DarkMode,
  LightMode,
  Folder,
  CloudQueue,
  ViewSidebar,
  Close,
} from "@mui/icons-material";
import { alpha } from "@mui/material/styles";
import { Terminal, AIChat, TaskPlanner, SystemMonitor } from "./components";
import FileManager from "./components/FileManager";
import ConnectionManager from "./components/ConnectionManager";
import ApprovalModal from "./components/ApprovalModal";
import SettingsDialog from "./components/SettingsDialog";
import NavigationSettingsDialog, {
  NavigationSection,
} from "./components/NavigationSettingsDialog";
import { useThemeMode } from "./theme";
import { terminalApi } from "./services/api";
import coreAstraLogo from "./assets/coreastra-logo.svg";

type TabType =
  | "terminal"
  | "chat"
  | "planner"
  | "monitor"
  | "files"
  | "connections";
type PanelView = "chat" | "files" | "connections";

type NavigationSectionWithTab = NavigationSection & { id: TabType };

const NAV_CONFIG_STORAGE_KEY = "coreastra:navigation:config";
const NAV_ORDER_STORAGE_KEY = "coreastra:navigation:order";

const NAVIGATION_SECTIONS_META: Array<{
  id: TabType;
  label: string;
  description: string;
}> = [
  {
    id: "terminal",
    label: "Terminal",
    description: "Execute commands and monitor real-time output.",
  },
  {
    id: "chat",
    label: "AI Chat",
    description: "Collaborate with the CoreAstra assistant and share prompts.",
  },
  {
    id: "files",
    label: "Files",
    description: "Browse, preview, and organize project files securely.",
  },
  {
    id: "connections",
    label: "Connections",
    description: "Manage remote endpoints, tunnels, and service bridges.",
  },
  {
    id: "planner",
    label: "Tasks",
    description: "Track, refine, and schedule automated task plans.",
  },
  {
    id: "monitor",
    label: "System",
    description: "Inspect resource usage, diagnostics, and safety signals.",
  },
];

const DEFAULT_NAVIGATION_ORDER: TabType[] = NAVIGATION_SECTIONS_META.map(
  (section) => section.id
);

const getDefaultNavigationConfig = (): Record<string, boolean> => {
  return DEFAULT_NAVIGATION_ORDER.reduce((acc, id) => {
    acc[id] = true;
    return acc;
  }, {} as Record<string, boolean>);
};

const sanitizeConfigInput = (
  input: Record<string, boolean>
): Record<string, boolean> => {
  const defaults = getDefaultNavigationConfig();
  Object.entries(input ?? {}).forEach(([key, value]) => {
    if ((DEFAULT_NAVIGATION_ORDER as string[]).includes(key)) {
      defaults[key] = Boolean(value);
    }
  });
  return defaults;
};

const sanitizeOrderInput = (input: string[]): TabType[] => {
  const filtered = Array.isArray(input)
    ? input.filter((id): id is TabType =>
        (DEFAULT_NAVIGATION_ORDER as string[]).includes(id)
      )
    : [];
  const missing = DEFAULT_NAVIGATION_ORDER.filter(
    (id) => !filtered.includes(id)
  );
  return [...filtered, ...missing];
};

const readStoredNavigationConfig = (): Record<string, boolean> => {
  if (typeof window === "undefined") {
    return getDefaultNavigationConfig();
  }
  try {
    const rawValue = window.localStorage.getItem(NAV_CONFIG_STORAGE_KEY);
    if (!rawValue) {
      return getDefaultNavigationConfig();
    }
    const parsed = JSON.parse(rawValue);
    if (typeof parsed !== "object" || parsed === null) {
      return getDefaultNavigationConfig();
    }
    return sanitizeConfigInput(parsed as Record<string, boolean>);
  } catch (error) {
    console.warn("Failed to read navigation config", error);
    return getDefaultNavigationConfig();
  }
};

const readStoredNavigationOrder = (): TabType[] => {
  if (typeof window === "undefined") {
    return [...DEFAULT_NAVIGATION_ORDER];
  }
  try {
    const rawValue = window.localStorage.getItem(NAV_ORDER_STORAGE_KEY);
    if (!rawValue) {
      return [...DEFAULT_NAVIGATION_ORDER];
    }
    const parsed = JSON.parse(rawValue);
    return sanitizeOrderInput(parsed as string[]);
  } catch (error) {
    console.warn("Failed to read navigation order", error);
    return [...DEFAULT_NAVIGATION_ORDER];
  }
};

const NAVIGATION_ICON_MAP: Record<TabType, typeof TerminalIcon> = {
  terminal: TerminalIcon,
  chat: SmartToy,
  planner: Assignment,
  monitor: Monitor,
  files: Folder,
  connections: CloudQueue,
};

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

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>("terminal");
  const [navigationConfig, setNavigationConfig] = useState<
    Record<string, boolean>
  >(() => readStoredNavigationConfig());
  const [navigationOrder, setNavigationOrder] = useState<TabType[]>(() =>
    readStoredNavigationOrder()
  );
  const [navigationSettingsOpen, setNavigationSettingsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [rightPanelView, setRightPanelView] = useState<PanelView>("chat");
  const [showRightPanel, setShowRightPanel] = useState(true);

  // Theme
  const { mode, toggleMode } = useThemeMode();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("lg"));
  const surfaceBorder =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.1)
      : theme.palette.divider;
  const footerBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.common.white, 0.02)
      : alpha(theme.palette.primary.main, 0.04);
  const drawerSelectedBg =
    theme.palette.mode === "dark"
      ? alpha(theme.palette.primary.main, 0.1)
      : alpha(theme.palette.primary.main, 0.18);

  // Approval modal state
  const [approvalModalOpen, setApprovalModalOpen] = useState(false);
  const [pendingCommand, setPendingCommand] = useState<string | null>(null);
  const [commandAnalysis, setCommandAnalysis] =
    useState<CommandAnalysis | null>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);

  // Handle run command with approval flow
  const handleRunCommand = useCallback(async (command: string) => {
    setActiveTab("terminal");

    try {
      // Analyze command first
      const analysis = await terminalApi.analyze(command);

      // If high risk, show approval modal
      if (
        analysis.risk_level === "high" ||
        analysis.risk_level === "critical"
      ) {
        setPendingCommand(command);
        setCommandAnalysis(analysis);
        setApprovalModalOpen(true);
      } else {
        // Execute directly for safe/low/medium risk
        // Terminal component will handle execution
      }
    } catch (error) {
      console.error("Command analysis failed:", error);
    }
  }, []);

  const handleApproveCommand = useCallback(
    async (createBackup: boolean) => {
      if (!pendingCommand) return;

      setApprovalLoading(true);
      try {
        // Execute the command with confirmation
        await terminalApi.execute(pendingCommand, true, (data) => {
          console.log("Command output:", data);
        });

        setApprovalModalOpen(false);
        setPendingCommand(null);
        setCommandAnalysis(null);
      } catch (error) {
        console.error("Command execution failed:", error);
      } finally {
        setApprovalLoading(false);
      }
    },
    [pendingCommand]
  );

  const handleRejectCommand = useCallback(() => {
    setApprovalModalOpen(false);
    setPendingCommand(null);
    setCommandAnalysis(null);
  }, []);

  const menuItems = [
    { icon: <TerminalIcon />, label: "Terminal", tab: "terminal" as TabType },
    { icon: <SmartToy />, label: "AI Chat", tab: "chat" as TabType },
    { icon: <Folder />, label: "Files", tab: "files" as TabType },
    {
      icon: <CloudQueue />,
      label: "Connections",
      tab: "connections" as TabType,
    },
    { icon: <Assignment />, label: "Tasks", tab: "planner" as TabType },
    { icon: <Monitor />, label: "System", tab: "monitor" as TabType },
  ];

  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        bgcolor: "background.default",
      }}
    >
      {/* App Bar */}
      <AppBar
        position="static"
        elevation={0}
        color="transparent"
        sx={{
          bgcolor: "background.paper",
          borderBottom: `1px solid ${surfaceBorder}`,
          color: "text.primary",
        }}
      >
        <Toolbar sx={{ gap: 2 }}>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => setDrawerOpen(true)}
            sx={{ display: { md: "none" } }}
          >
            <MenuIcon />
          </IconButton>

          {/* Logo */}
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5 }}>
            <Box
              component="img"
              src={coreAstraLogo}
              alt="CoreAstra logo"
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                boxShadow: theme.shadows[1],
                bgcolor: "background.default",
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: "linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              CoreAstra
            </Typography>
          </Box>

          {/* Navigation Tabs - Desktop */}
          <Tabs
            value={activeTab}
            onChange={(_: React.SyntheticEvent, value: TabType) =>
              setActiveTab(value)
            }
            sx={{
              display: { xs: "none", md: "flex" },
              ml: 4,
              "& .MuiTab-root": {
                minHeight: 48,
                textTransform: "none",
                fontWeight: 500,
                minWidth: 100,
              },
            }}
          >
            <Tab
              icon={<TerminalIcon sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Terminal"
              value="terminal"
            />
            <Tab
              icon={<SmartToy sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="AI Chat"
              value="chat"
            />
            <Tab
              icon={<Folder sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Files"
              value="files"
            />
            <Tab
              icon={<CloudQueue sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Remote"
              value="connections"
            />
            <Tab
              icon={<Assignment sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="Tasks"
              value="planner"
            />
            <Tab
              icon={<Monitor sx={{ fontSize: 20 }} />}
              iconPosition="start"
              label="System"
              value="monitor"
            />
          </Tabs>

          <Box sx={{ flex: 1 }} />

          {/* Right Panel Toggle - Desktop */}
          <ToggleButtonGroup
            value={rightPanelView}
            exclusive
            onChange={(_, val) => val && setRightPanelView(val)}
            size="small"
            sx={{ display: { xs: "none", lg: "flex" }, mr: 2 }}
          >
            <ToggleButton value="chat" title="AI Chat">
              <SmartToy fontSize="small" />
            </ToggleButton>
            <ToggleButton value="files" title="File Manager">
              <Folder fontSize="small" />
            </ToggleButton>
            <ToggleButton value="connections" title="Connections">
              <CloudQueue fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          {/* Toggle Right Panel Button */}
          <Tooltip title={showRightPanel ? "Hide Panel" : "Show Panel"}>
            <IconButton
              color="inherit"
              onClick={() => setShowRightPanel(!showRightPanel)}
              sx={{ display: { xs: "none", lg: "flex" } }}
            >
              <ViewSidebar />
            </IconButton>
          </Tooltip>

          {/* Status Chip */}
          <Chip
            label="Connected"
            size="small"
            color="success"
            sx={{ display: { xs: "none", sm: "flex" } }}
          />

          {/* Theme Toggle */}
          <Tooltip title={mode === "dark" ? "Light Mode" : "Dark Mode"}>
            <IconButton color="inherit" onClick={toggleMode}>
              {mode === "dark" ? <LightMode /> : <DarkMode />}
            </IconButton>
          </Tooltip>

          {/* Action Buttons */}
          <Tooltip title="Notifications">
            <IconButton color="inherit">
              <Badge badgeContent={0} color="error">
                <Notifications />
              </Badge>
            </IconButton>
          </Tooltip>

          <Tooltip title="Settings">
            <IconButton color="inherit" onClick={() => setSettingsOpen(true)}>
              <Settings />
            </IconButton>
          </Tooltip>
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        sx={{
          "& .MuiDrawer-paper": {
            width: 280,
            bgcolor: "background.paper",
            color: "text.primary",
          },
        }}
      >
        <Box sx={{ p: 2 }}>
          <Box sx={{ display: "flex", alignItems: "center", gap: 1.5, mb: 2 }}>
            <Box
              component="img"
              src={coreAstraLogo}
              alt="CoreAstra logo"
              sx={{
                width: 40,
                height: 40,
                borderRadius: 1.5,
                boxShadow: theme.shadows[1],
              }}
            />
            <Typography
              variant="h6"
              sx={{
                fontWeight: 700,
                background: "linear-gradient(135deg, #6366f1 0%, #22d3ee 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              CoreAstra
            </Typography>
          </Box>
          <Divider sx={{ mb: 2 }} />
          <List>
            {menuItems.map(
              (item: {
                icon: React.ReactNode;
                label: string;
                tab: TabType;
              }) => (
                <ListItem key={item.tab} disablePadding sx={{ mb: 0.5 }}>
                  <ListItemButton
                    selected={activeTab === item.tab}
                    onClick={() => {
                      setActiveTab(item.tab);
                      setDrawerOpen(false);
                    }}
                    sx={{
                      borderRadius: 1,
                      "&.Mui-selected": {
                        bgcolor: drawerSelectedBg,
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 40 }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText primary={item.label} />
                  </ListItemButton>
                </ListItem>
              )
            )}
          </List>
        </Box>
      </Drawer>

      {/* Main Content */}
      <Box
        sx={{
          flex: 1,
          display: "flex",
          overflow: "hidden",
          p: { xs: 1, md: 2 },
          gap: 2,
        }}
      >
        {/* Split View for Desktop */}
        <Box
          sx={{
            display: { xs: "none", lg: "flex" },
            width: "100%",
            gap: 2,
          }}
        >
          {/* Left Panel - Terminal or selected tab */}
          <Box
            sx={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
            }}
          >
            {activeTab === "terminal" && <Terminal />}
            {activeTab === "chat" && <AIChat onRunCommand={handleRunCommand} />}
            {activeTab === "files" && <FileManager />}
            {activeTab === "connections" && <ConnectionManager />}
            {activeTab === "planner" && (
              <TaskPlanner onRunCommand={handleRunCommand} />
            )}
            {activeTab === "monitor" && <SystemMonitor />}
          </Box>

          {/* Right Panel - Contextual tools */}
          {showRightPanel && (
            <Box
              sx={{
                width: 450,
                minWidth: 350,
                display: "flex",
                flexDirection: "column",
              }}
            >
              <Paper
                sx={{
                  display: "flex",
                  alignItems: "center",
                  px: 2,
                  py: 1,
                  mb: 1,
                  borderRadius: 2,
                }}
              >
                <Typography
                  variant="subtitle2"
                  sx={{ flexGrow: 1, fontWeight: 600 }}
                >
                  {rightPanelView === "chat" && "AI Assistant"}
                  {rightPanelView === "files" && "File Manager"}
                  {rightPanelView === "connections" && "Connections"}
                </Typography>
                <IconButton
                  size="small"
                  onClick={() => setShowRightPanel(false)}
                >
                  <Close fontSize="small" />
                </IconButton>
              </Paper>
              {rightPanelView === "chat" && (
                <AIChat onRunCommand={handleRunCommand} />
              )}
              {rightPanelView === "files" && <FileManager />}
              {rightPanelView === "connections" && <ConnectionManager />}
            </Box>
          )}
        </Box>

        {/* Single Panel for Tablet/Mobile */}
        <Box
          sx={{
            display: { xs: "flex", lg: "none" },
            width: "100%",
            flexDirection: "column",
          }}
        >
          {activeTab === "terminal" && <Terminal />}
          {activeTab === "chat" && <AIChat onRunCommand={handleRunCommand} />}
          {activeTab === "files" && <FileManager />}
          {activeTab === "connections" && <ConnectionManager />}
          {activeTab === "planner" && (
            <TaskPlanner onRunCommand={handleRunCommand} />
          )}
          {activeTab === "monitor" && <SystemMonitor />}
        </Box>
      </Box>

      {/* Approval Modal */}
      <ApprovalModal
        open={approvalModalOpen}
        command={pendingCommand || ""}
        analysis={commandAnalysis}
        onApprove={handleApproveCommand}
        onReject={handleRejectCommand}
        loading={approvalLoading}
      />

      {/* Settings Dialog */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} />

      {/* Footer */}
      <Box
        sx={{
          py: 1,
          px: 2,
          bgcolor: footerBg,
          borderTop: `1px solid ${surfaceBorder}`,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          fontSize: "0.75rem",
          color: "text.secondary",
        }}
      >
        <Typography variant="caption">
          © {new Date().getFullYear()} GROWEAGLES TECHSOUL PRIVATE LIMITED
          (TECHSOUL)
        </Typography>
        <Box sx={{ display: "flex", alignItems: "center", gap: 2 }}>
          <Typography variant="caption">v1.0.0</Typography>
        </Box>
      </Box>
    </Box>
  );
};

export default App;
