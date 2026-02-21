/**
 * CoreAstra TypeScript Types
 * AI-Powered Terminal & Intelligent Control Interface
 * 
 * Copyright (c) GROWEAGLES TECHSOUL PRIVATE LIMITED (TECHSOUL)
 * All rights reserved. Unauthorized usage or distribution is prohibited.
 */

export type RiskLevel = 'low' | 'medium' | 'high' | 'critical';
export type AIEngine = 'gemini' | 'groq' | 'claude' | 'ollama';

export interface CommandAnalysis {
  command: string;
  is_risky: boolean;
  risk_level: RiskLevel;
  reason: string;
  affected_paths: string[];
  requires_confirmation: boolean;
  backup_recommended: boolean;
}

export interface CommandResult {
  type: 'output' | 'execution_complete' | 'error' | 'confirmation_required' | 'execution_start';
  stream?: 'stdout' | 'stderr';
  content?: string;
  exit_code?: number;
  success?: boolean;
  stdout?: string;
  stderr?: string;
  message?: string;
  analysis?: CommandAnalysis;
  backups?: { original: string; backup: string }[];
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  engine?: string;
}

export interface EngineStatus {
  name: string;
  is_available: boolean;
  model?: string | null;
  reason?: string | null;
}

export interface AvailableEngines {
  engines: EngineStatus[];
  default: string | null;
}

export interface TaskStep {
  order: number;
  description: string;
  command?: string;
  is_risky: boolean;
  completed: boolean;
}

export interface TaskPlan {
  id: number;
  title: string;
  description: string;
  steps: TaskStep[];
  status: string;
  ai_engine: string;
  created_at: string;
}

export interface BackupInfo {
  name: string;
  path: string;
  size: number;
  created: string;
  is_directory: boolean;
}

export interface AuditEntry {
  id: number;
  action_type: string;
  action_details: Record<string, any>;
  risk_level: RiskLevel | null;
  status: string;
  created_at: string;
}

export interface SystemInfo {
  platform: string;
  python_version: string;
  cpu_count: number;
  cpu_percent: number;
  memory: {
    total: number;
    available: number;
    percent: number;
  };
  disk: {
    total: number;
    free: number;
    percent: number;
  };
  current_directory: string;
}

export interface CommandHistory {
  id: number;
  command: string;
  exit_code: number;
  executed_at: string;
  is_risky: boolean;
}

export interface TerminalLine {
  id: string;
  type: 'input' | 'output' | 'error' | 'info' | 'warning';
  content: string;
  timestamp: Date;
}
