/**
 * CoreAstra API Service
 * AI-Powered Terminal & Intelligent Control Interface
 * 
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 */

import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const CONNECTION_API_URL = process.env.REACT_APP_CONNECTION_API_URL || 'http://localhost:8001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

const connectionApi = axios.create({
  baseURL: CONNECTION_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    const networkIssue =
      error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';

    if (networkIssue) {
      error.message = `Unable to reach the CoreAstra backend at ${API_BASE_URL}. Ensure the backend server is running and reachable.`;
    } else if (error?.response?.data?.detail && typeof error.response.data.detail === 'string') {
      error.message = error.response.data.detail;
    }

    return Promise.reject(error);
  }
);

connectionApi.interceptors.response.use(
  (response) => response,
  (error) => {
    const networkIssue =
      error?.code === 'ERR_NETWORK' || error?.message === 'Network Error';

    if (networkIssue) {
      error.message = `Unable to reach the Connection Manager at ${CONNECTION_API_URL}. Ensure the connection backend is running on port 8001.`;
    } else if (error?.response?.data?.detail && typeof error.response.data.detail === 'string') {
      error.message = error.response.data.detail;
    }

    return Promise.reject(error);
  }
);

// Terminal API
export const terminalApi = {
  analyze: async (command: string) => {
    const response = await api.post('/api/terminal/analyze', { command });
    return response.data;
  },

  execute: async (
    command: string,
    confirmed: boolean = false,
    onData: (data: any) => void
  ) => {
    const response = await fetch(`${API_BASE_URL}/api/terminal/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, confirmed, create_backup: true }),
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(
        errorText?.trim() || `Terminal execute endpoint returned ${response.status}`
      );
    }

    if (!response.body) {
      throw new Error('Terminal execute endpoint did not provide a response stream.');
    }

    const reader = response.body.getReader();

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          onData(data);
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      }
    }
  },

  changeDirectory: async (path: string) => {
    const response = await api.post('/api/terminal/cd', { path });
    return response.data;
  },

  getCurrentDirectory: async () => {
    const response = await api.get('/api/terminal/pwd');
    return response.data;
  },

  getHistory: async (limit: number = 50) => {
    const response = await api.get(`/api/commands/history?limit=${limit}`);
    return response.data;
  },
};

// AI Chat API
export const aiApi = {
  getEngines: async () => {
    const response = await api.get('/api/ai/engines');
    return response.data;
  },

  chat: async (
    messages: { role: string; content: string }[],
    engine: string | null,
    sessionId: string,
    onData: (data: any) => void
  ) => {
    const response = await fetch(`${API_BASE_URL}/api/ai/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages,
        engine,
        stream: true,
        session_id: sessionId,
      }),
    });

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const text = decoder.decode(value);
      const lines = text.split('\n').filter((line) => line.startsWith('data: '));

      for (const line of lines) {
        try {
          const data = JSON.parse(line.slice(6));
          onData(data);
        } catch (e) {
          console.error('Failed to parse SSE data:', e);
        }
      }
    }
  },

  analyzeCommand: async (command: string) => {
    const response = await api.post('/api/ai/analyze-command', { command });
    return response.data;
  },

  getConversation: async (sessionId: string) => {
    const response = await api.get(`/api/ai/conversation/${sessionId}`);
    return response.data;
  },

  getConfig: async (engine: string) => {
    const response = await api.get(`/api/ai/config/${engine}`);
    return response.data;
  },

  updateConfig: async (
    engine: string,
    options: { apiKey?: string | null; modelName?: string | null } = {}
  ) => {
    const response = await api.post('/api/ai/config', {
      engine,
      api_key: options.apiKey ?? null,
      model_name: options.modelName ?? null,
    });
    return response.data;
  },
};

// Task Planning API
export const taskApi = {
  createPlan: async (objective: string, engine?: string) => {
    const response = await api.post('/api/tasks/plan', { objective, engine });
    return response.data;
  },

  getPlans: async () => {
    const response = await api.get('/api/tasks');
    return response.data;
  },

  getPlan: async (taskId: number) => {
    const response = await api.get(`/api/tasks/${taskId}`);
    return response.data;
  },
};

// Backup API
export const backupApi = {
  list: async () => {
    const response = await api.get('/api/backups');
    return response.data;
  },

  restore: async (backupPath: string, originalPath: string) => {
    const response = await api.post('/api/backups/restore', {
      backup_path: backupPath,
      original_path: originalPath,
    });
    return response.data;
  },
};

// Audit API
export const auditApi = {
  getLogs: async (limit: number = 100, offset: number = 0) => {
    const response = await api.get(`/api/audit?limit=${limit}&offset=${offset}`);
    return response.data;
  },
};

// System API
export const systemApi = {
  getInfo: async () => {
    const response = await api.get('/api/system/info');
    return response.data;
  },

  healthCheck: async () => {
    const response = await api.get('/health');
    return response.data;
  },
};

// Files API
export const filesApi = {
  list: async (path?: string, showHidden: boolean = false, sortBy: string = 'name') => {
    const params = new URLSearchParams();
    if (path) params.append('path', path);
    params.append('show_hidden', String(showHidden));
    params.append('sort_by', sortBy);
    const response = await api.get(`/api/files/list?${params}`);
    return response.data;
  },

  read: async (path: string, encoding: string = 'utf-8') => {
    const params = new URLSearchParams({ path, encoding });
    const response = await api.get(`/api/files/read?${params}`);
    return response.data;
  },

  metadata: async (path: string) => {
    const params = new URLSearchParams({ path });
    const response = await api.get(`/api/files/metadata?${params}`);
    return response.data;
  },

  preview: async (path: string, maxBytes: number = 512 * 1024) => {
    const params = new URLSearchParams({ path, max_bytes: String(maxBytes) });
    const response = await api.get(`/api/files/preview?${params}`);
    return response.data;
  },

  write: async (path: string, content: string, createBackup: boolean = true) => {
    const response = await api.post('/api/files/write', {
      path,
      content,
      create_backup: createBackup,
    });
    return response.data;
  },

  create: async (path: string, content: string = '') => {
    const response = await api.post('/api/files/create', { path, content });
    return response.data;
  },

  mkdir: async (path: string) => {
    const response = await api.post('/api/files/mkdir', { path });
    return response.data;
  },

  delete: async (path: string, confirmed: boolean = false) => {
    const params = new URLSearchParams({ path, confirmed: String(confirmed) });
    const response = await api.delete(`/api/files/delete?${params}`);
    return response.data;
  },

  rename: async (path: string, newName: string) => {
    const response = await api.post('/api/files/rename', { path, new_name: newName });
    return response.data;
  },

  copy: async (source: string, destination: string) => {
    const response = await api.post('/api/files/copy', { source, destination });
    return response.data;
  },

  move: async (source: string, destination: string) => {
    const response = await api.post('/api/files/move', { source, destination });
    return response.data;
  },

  search: async (pattern: string, path?: string, recursive: boolean = true) => {
    const params = new URLSearchParams({ pattern, recursive: String(recursive) });
    if (path) params.append('path', path);
    const response = await api.get(`/api/files/search?${params}`);
    return response.data;
  },

  download: async (path: string) => {
    const response = await api.get(`/api/files/download?path=${encodeURIComponent(path)}`, {
      responseType: 'blob',
    });
    
    const blob = new Blob([response.data], { type: response.headers['content-type'] });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    
    const contentDisposition = response.headers['content-disposition'];
    let filename = path.split(/[/\\]/).pop() || 'download';
    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="?(.+)"?/);
      if (filenameMatch && filenameMatch.length > 1) {
        filename = filenameMatch[1];
      }
    }
    
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    
    link.parentNode?.removeChild(link);
    window.URL.revokeObjectURL(url);
  },
};

// Connections API (SSH/FTP) - Updated to match Flask backend
export const connectionsApi = {
  connectSSH: async (
    host: string,
    username: string,
    options: {
      port?: number;
      password?: string;
      keyPath?: string;
      timeout?: number;
      sessionName?: string;
    } = {}
  ) => {
    const response = await connectionApi.post('/connections/ssh', {
      host,
      username,
      port: options.port || 22,
      password: options.password,
      keyPath: options.keyPath,
      timeout: options.timeout || 30,
      sessionName: options.sessionName,
    });
    return response.data;
  },

  connectFTP: async (
    host: string,
    username: string,
    password: string,
    options: {
      port?: number;
      useTLS?: boolean;
      timeout?: number;
      sessionName?: string;
    } = {}
  ) => {
    const response = await connectionApi.post('/connections/ftp', {
      host,
      username,
      password,
      port: options.port || 21,
      useTLS: options.useTLS || false,
      timeout: options.timeout || 30,
      sessionName: options.sessionName,
    });
    return response.data;
  },

  disconnect: async (sessionId: string) => {
    const response = await connectionApi.delete(`/connections/${sessionId}`);
    return response.data;
  },

  list: async () => {
    const response = await connectionApi.get('/connections');
    return response.data;
  },

  getSession: async (sessionId: string) => {
    const response = await connectionApi.get(`/connections/${sessionId}`);
    return response.data;
  },

  listRemoteFiles: async (sessionId: string, path?: string) => {
    const params = path ? `?path=${encodeURIComponent(path)}` : '';
    const response = await connectionApi.get(`/connections/${sessionId}/files${params}`);
    return response.data;
  },

  downloadFile: async (sessionId: string, remotePath: string, localPath?: string) => {
    const response = await connectionApi.post(`/connections/${sessionId}/download`, {
      remotePath: remotePath,
      localPath: localPath,
    });
    return response.data;
  },

  uploadFile: async (sessionId: string, localPath: string, remotePath: string) => {
    const response = await connectionApi.post(`/connections/${sessionId}/upload`, {
      localPath: localPath,
      remotePath: remotePath,
    });
    return response.data;
  },

  executeCommand: async (sessionId: string, command: string, timeout: number = 30) => {
    const response = await connectionApi.post(`/connections/${sessionId}/execute`, {
      command,
      timeout,
    });
    return response.data;
  },
};

// Settings API
export const settingsApi = {
  getAIModels: async () => {
    const response = await api.get('/api/settings/ai-models');
    return response.data;
  },

  createOrUpdateAIModel: async (config: {
    engine_name: string;
    api_key?: string;
    model_name?: string;
    base_url?: string;
    is_enabled?: boolean;
    is_custom?: boolean;
    settings?: Record<string, any>;
  }) => {
    const response = await api.post('/api/settings/ai-models', config);
    return response.data;
  },

  deleteAIModel: async (engineName: string) => {
    const response = await api.delete(`/api/settings/ai-models/${engineName}`);
    return response.data;
  },

  getSystemSettings: async () => {
    const response = await api.get('/api/settings/system');
    return response.data;
  },

  updateSystemSetting: async (
    key: string,
    value: any,
    type: string,
    description?: string
  ) => {
    const response = await api.post('/api/settings/system', {
      setting_key: key,
      setting_value: value,
      setting_type: type,
      description,
    });
    return response.data;
  },

  getAvailableModels: async () => {
    const response = await api.get('/api/settings/ai/available-models');
    return response.data;
  },
};

// WebSocket connection for real-time terminal
export const createTerminalWebSocket = () => {
  const wsUrl = API_BASE_URL.replace('http', 'ws') + '/ws/terminal';
  return new WebSocket(wsUrl);
};

export default api;
