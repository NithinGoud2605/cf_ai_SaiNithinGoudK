export type Role = "user" | "assistant" | "system";

export interface ChatMessage {
  id: string;
  role: Role;
  content: string;
  timestamp: number;
  sessionId: string;
}

export interface ChatSession {
  id: string;
  userId: string;
  messages: ChatMessage[];
  createdAt: number;
  lastActivity: number;
}

export interface AgentResponse {
  message: string;
  sessionId: string;
  timestamp: number;
  memory?: {
    action: 'store' | 'retrieve';
    key: string;
    value?: string;
  };
}

export interface WorkflowTask {
  id: string;
  type: 'memory_store' | 'memory_retrieve' | 'external_api' | 'data_processing';
  payload: any;
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

export interface WebSocketMessage {
  type: 'message' | 'typing' | 'error' | 'memory_update';
  data: any;
  sessionId: string;
}

export interface MemoryItem {
  id: string;
  sessionId: string;
  key: string;        // "name" | "preference" | "fact" | "conversation" ...
  content: string;    // short fact
  createdAt: number;
  updatedAt: number;
  ttl?: number;       // optional expiration in ms
}

export interface Env {
  AI: any; // Cloudflare AI binding
  AI_MODEL: string;
  MEMORY_DO: any; // DurableObjectNamespace
}
