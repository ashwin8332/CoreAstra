/**
 * CoreAstra System Monitor Component
 * AI-Powered Terminal & Intelligent Control Interface
 * 
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 */

import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Card,
  CardContent,
  Grid,
  LinearProgress,
  Chip,
  List,
  ListItem,
  ListItemText,
  ListItemIcon,
  Divider,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  Memory,
  Storage,
  Computer,
  Speed,
  Refresh,
  History,
  Backup,
  Security,
} from '@mui/icons-material';
import { systemApi, backupApi, auditApi, terminalApi } from '../services/api';
import { SystemInfo, BackupInfo, AuditEntry, CommandHistory } from '../types';

const SystemMonitor: React.FC = () => {
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const [backups, setBackups] = useState<BackupInfo[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditEntry[]>([]);
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [sysInfo, backupList, audit, history] = await Promise.all([
        systemApi.getInfo(),
        backupApi.list(),
        auditApi.getLogs(20),
        terminalApi.getHistory(20),
      ]);
      setSystemInfo(sysInfo);
      setBackups(backupList);
      setAuditLogs(audit);
      setCommandHistory(history);
    } catch (error) {
      console.error('Failed to load system data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const formatBytes = (bytes: number) => {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  };

  const getProgressColor = (percent: number) => {
    if (percent > 90) return 'error';
    if (percent > 70) return 'warning';
    return 'primary';
  };

  const getRiskColor = (level: string | null) => {
    switch (level) {
      case 'critical':
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      default:
        return 'default';
    }
  };

  if (isLoading && !systemInfo) {
    return (
      <Box sx={{ p: 2, textAlign: 'center' }}>
        <Typography>Loading system information...</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ fontWeight: 600, flex: 1 }}>
          <Computer sx={{ mr: 1, verticalAlign: 'middle' }} />
          System Monitor
        </Typography>
        <Tooltip title="Refresh">
          <IconButton onClick={loadData} disabled={isLoading}>
            <Refresh />
          </IconButton>
        </Tooltip>
      </Box>

      <Grid container spacing={2}>
        {/* CPU & Memory */}
        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                <Speed sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
                CPU Usage
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">Usage</Typography>
                  <Typography variant="body2">
                    {systemInfo?.cpu_percent.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={systemInfo?.cpu_percent || 0}
                  color={getProgressColor(systemInfo?.cpu_percent || 0)}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {systemInfo?.cpu_count} cores available
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                <Memory sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
                Memory Usage
              </Typography>
              <Box sx={{ mb: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">
                    {formatBytes(
                      (systemInfo?.memory.total || 0) - (systemInfo?.memory.available || 0)
                    )}{' '}
                    / {formatBytes(systemInfo?.memory.total || 0)}
                  </Typography>
                  <Typography variant="body2">
                    {systemInfo?.memory.percent.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={systemInfo?.memory.percent || 0}
                  color={getProgressColor(systemInfo?.memory.percent || 0)}
                />
              </Box>
            </CardContent>
          </Card>
        </Grid>

        {/* Disk */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                <Storage sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
                Disk Usage
              </Typography>
              <Box sx={{ mb: 1 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
                  <Typography variant="body2">
                    {formatBytes(
                      (systemInfo?.disk.total || 0) - (systemInfo?.disk.free || 0)
                    )}{' '}
                    used of {formatBytes(systemInfo?.disk.total || 0)}
                  </Typography>
                  <Typography variant="body2">
                    {systemInfo?.disk.percent.toFixed(1)}%
                  </Typography>
                </Box>
                <LinearProgress
                  variant="determinate"
                  value={systemInfo?.disk.percent || 0}
                  color={getProgressColor(systemInfo?.disk.percent || 0)}
                />
              </Box>
              <Typography variant="caption" color="text.secondary">
                {formatBytes(systemInfo?.disk.free || 0)} free
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* Backups */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 300, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, overflow: 'auto' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                <Backup sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
                Recent Backups
              </Typography>
              {backups.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No backups yet
                </Typography>
              ) : (
                <List dense>
                  {backups.slice(0, 5).map((backup: BackupInfo, i: number) => (
                    <ListItem key={i} sx={{ px: 0 }}>
                      <ListItemIcon sx={{ minWidth: 32 }}>
                        <Storage sx={{ fontSize: 16 }} />
                      </ListItemIcon>
                      <ListItemText
                        primary={backup.name}
                        secondary={`${formatBytes(backup.size)} • ${new Date(
                          backup.created
                        ).toLocaleString()}`}
                        primaryTypographyProps={{ variant: 'body2', noWrap: true }}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Command History */}
        <Grid item xs={12} md={6}>
          <Card sx={{ height: 300, display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flex: 1, overflow: 'auto' }}>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                <History sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
                Command History
              </Typography>
              {commandHistory.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No commands executed yet
                </Typography>
              ) : (
                <List dense>
                  {commandHistory.slice(0, 5).map((cmd: CommandHistory) => (
                    <ListItem key={cmd.id} sx={{ px: 0 }}>
                      <ListItemText
                        primary={
                          <Box
                            component="code"
                            sx={{
                              fontFamily: '"JetBrains Mono", monospace',
                              fontSize: '0.75rem',
                            }}
                          >
                            {cmd.command.length > 40
                              ? cmd.command.slice(0, 40) + '...'
                              : cmd.command}
                          </Box>
                        }
                        secondary={new Date(cmd.executed_at).toLocaleString()}
                        secondaryTypographyProps={{ variant: 'caption' }}
                      />
                      <Chip
                        label={cmd.exit_code === 0 ? 'OK' : `Exit ${cmd.exit_code}`}
                        size="small"
                        color={cmd.exit_code === 0 ? 'success' : 'error'}
                        sx={{ fontSize: '0.65rem', height: 20 }}
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Audit Log */}
        <Grid item xs={12}>
          <Card>
            <CardContent>
              <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 600 }}>
                <Security sx={{ fontSize: 18, mr: 1, verticalAlign: 'middle' }} />
                Audit Log
              </Typography>
              {auditLogs.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No audit entries yet
                </Typography>
              ) : (
                <List dense>
                  {auditLogs.slice(0, 5).map((log: AuditEntry) => (
                    <React.Fragment key={log.id}>
                      <ListItem sx={{ px: 0 }}>
                        <ListItemText
                          primary={log.action_type}
                          secondary={new Date(log.created_at).toLocaleString()}
                          primaryTypographyProps={{ variant: 'body2' }}
                          secondaryTypographyProps={{ variant: 'caption' }}
                        />
                        {log.risk_level && (
                          <Chip
                            label={log.risk_level}
                            size="small"
                            color={getRiskColor(log.risk_level) as any}
                            sx={{ fontSize: '0.65rem', height: 20 }}
                          />
                        )}
                        <Chip
                          label={log.status}
                          size="small"
                          sx={{ ml: 0.5, fontSize: '0.65rem', height: 20 }}
                        />
                      </ListItem>
                      <Divider />
                    </React.Fragment>
                  ))}
                </List>
              )}
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};

export default SystemMonitor;
