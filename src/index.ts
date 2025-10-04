import { AIAgent } from './agent';
import { MemoryManager } from './memory';
import { WorkflowManager } from './workflows';
import { WebSocketMessage } from './types';
import { MemoryDO } from './memory-do';
import type { Env } from './types';

export { MemoryDO };

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    
    if (request.headers.get('Upgrade') === 'websocket') {
      return this.handleWebSocket(request, env);
    }

    switch (url.pathname) {
      case '/':
        return this.handleRoot();
      case '/api/chat':
        return this.handleChatAPI(request, env);
      case '/api/sessions':
        return this.handleSessionsAPI(request, env);
      case '/api/memory':
        return this.handleMemoryAPI(request, env);
      case '/api/workflows':
        return this.handleWorkflowsAPI(request, env);
      case '/api/debug':
        return this.handleDebugAPI(request, env);
      default:
        return new Response('Not Found', { status: 404 });
    }
  },

  async handleWebSocket(request: Request, env: Env): Promise<Response> {
    const { 0: client, 1: server } = new WebSocketPair();
    
    const memory = new MemoryManager(env.MEMORY_DO);
    const agent = new AIAgent(env.AI, memory);
    const workflow = new WorkflowManager();

    server.accept();
    
    server.addEventListener('message', async (event) => {
      try {
        const message: WebSocketMessage = JSON.parse(event.data as string);
        
        switch (message.type) {
          case 'message':
            await this.handleWebSocketMessage(message, server, agent, workflow);
            break;
          case 'typing':
            break;
          default:
            console.log('Unknown message type:', message.type);
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        server.send(JSON.stringify({
          type: 'error',
          data: { message: 'Invalid message format' },
          sessionId: 'unknown'
        }));
      }
    });

    server.addEventListener('close', () => {
      console.log('WebSocket connection closed');
    });

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  },

  async handleWebSocketMessage(
    message: WebSocketMessage, 
    server: WebSocket, 
    agent: AIAgent, 
    workflow: WorkflowManager
  ): Promise<void> {
    try {
      const { sessionId, data } = message;
      
      const taskIds = await workflow.runMemoryWorkflow(sessionId, data.content);
      
      const response = await agent.processMessage(
        data.content, 
        sessionId, 
        data.userId || 'anonymous'
      );

      server.send(JSON.stringify({
        type: 'message',
        data: {
          content: response.message,
          timestamp: response.timestamp,
          sessionId: response.sessionId
        },
        sessionId
      }));

      if (response.memory) {
        server.send(JSON.stringify({
          type: 'memory_update',
          data: response.memory,
          sessionId
        }));
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
      server.send(JSON.stringify({
        type: 'error',
        data: { message: 'Error processing message' },
        sessionId: message.sessionId
      }));
    }
  },

  async handleRoot(): Promise<Response> {
    return new Response(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>AI Agent Chat</title>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1">
        </head>
        <body>
          <h1>AI Agent Chat</h1>
          <p>This is the Cloudflare Worker for the AI Agent Chat application.</p>
          <p>Use the frontend at the Pages deployment to interact with the chat interface.</p>
          <p>API endpoints available:</p>
          <ul>
            <li>GET /api/sessions - Get all chat sessions</li>
            <li>POST /api/chat - Send a chat message</li>
            <li>GET /api/memory/:sessionId - Get session memories</li>
            <li>GET /api/workflows - Get workflow status</li>
          </ul>
        </body>
      </html>
    `, {
      headers: { 'Content-Type': 'text/html' }
    });
  },

  async handleChatAPI(request: Request, env: Env): Promise<Response> {
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    }

    if (request.method !== 'POST') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const { message, sessionId, userId } = await request.json();
      
      const memory = new MemoryManager(env.MEMORY_DO);
      const agent = new AIAgent(env.AI, memory);
      
      const response = await agent.processMessage(message, sessionId, userId);
      
      return new Response(JSON.stringify(response), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        }
      });
    } catch (error) {
      console.error('Chat API error:', error);
      return new Response(JSON.stringify({ error: 'Invalid request', details: error.message }), {
        status: 400,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  },

  async handleSessionsAPI(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const memory = new MemoryManager(env.MEMORY_DO);
      const agent = new AIAgent(env.AI, memory);
      
      const sessions = agent.getAllSessions();
      
      return new Response(JSON.stringify({ sessions }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to get sessions' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  },

  async handleMemoryAPI(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const sessionId = url.pathname.split('/').pop();
    
    if (!sessionId) {
      return new Response('Session ID required', { status: 400 });
    }

    try {
      const memory = new MemoryManager(env.MEMORY_DO);
      const memories = await memory.list(sessionId);
      
      return new Response(JSON.stringify({ memories }), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to get memories' }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  },

  async handleWorkflowsAPI(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const workflow = new WorkflowManager();
      const tasks = workflow.getAllTasks();
      
      return new Response(JSON.stringify({ tasks }), {
        headers: { 'Content-Type': 'application/json' }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to get workflows' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  },

  async handleDebugAPI(request: Request, env: Env): Promise<Response> {
    if (request.method !== 'GET') {
      return new Response('Method not allowed', { status: 405 });
    }

    try {
      const memory = new MemoryManager(env.MEMORY_DO);
      const agent = new AIAgent(env.AI, memory);
      
      const sessions = agent.getAllSessions();
      const debugInfo = {
        sessions: sessions.map(session => ({
          id: session.id,
          userId: session.userId,
          messageCount: session.messages.length,
          lastActivity: session.lastActivity
        })),
        memorySystem: "Durable Objects (persistent)"
      };
      
      return new Response(JSON.stringify(debugInfo), {
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Failed to get debug info', details: error.message }), {
        status: 500,
        headers: { 
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        }
      });
    }
  }
};