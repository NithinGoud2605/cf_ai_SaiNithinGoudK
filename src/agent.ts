import { Ai } from '@cloudflare/ai';
import { MemoryManager } from './memory';
import { ChatMessage, AgentResponse, ChatSession } from './types';

export class AIAgent {
  private ai: Ai;
  private memory: MemoryManager;
  private sessions: Map<string, ChatSession> = new Map();
  private simpleMemory: Map<string, any> = new Map();

  constructor(ai: Ai, memory: MemoryManager) {
    this.ai = ai;
    this.memory = memory;
  }

  async processMessage(
    message: string, 
    sessionId: string, 
    userId: string = 'anonymous'
  ): Promise<AgentResponse> {
    try {
      let session = this.sessions.get(sessionId);
      if (!session) {
        session = {
          id: sessionId,
          userId,
          messages: [],
          createdAt: Date.now(),
          lastActivity: Date.now()
        };
        this.sessions.set(sessionId, session);
      }

      const userMessage: ChatMessage = {
        id: this.generateId(),
        role: 'user',
        content: message,
        timestamp: Date.now(),
        sessionId
      };
      session.messages.push(userMessage);
      session.lastActivity = Date.now();

      const memories = await this.memory.search(sessionId, message, 10);
      
      const context = this.buildContext(session, memories);
      const response = await this.generateResponse(message, session, memories);
      
      const assistantMessage: ChatMessage = {
        id: this.generateId(),
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
        sessionId
      };
      session.messages.push(assistantMessage);

      await this.storeImportantInfo(sessionId, message, response);

      return {
        message: response,
        sessionId,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Error processing message:', error);
      return {
        message: "I apologize, but I encountered an error processing your message. Please try again.",
        sessionId,
        timestamp: Date.now()
      };
    }
  }

  private async generateResponse(message: string, session: ChatSession, memories: any[]): Promise<string> {
    try {
      const models = [
        '@cf/meta/llama-3.1-8b-instruct',
        '@cf/meta/llama-3.1-70b-instruct', 
        '@cf/meta/llama-2-7b-chat-fp16',
        '@cf/meta/llama-2-13b-chat-fp16'
      ];
      
      const context = this.buildContext(session, memories);
      
      for (const model of models) {
        try {
          const response = await this.ai.run(model, {
            prompt: `${context}User: ${message}
Assistant:`
          });
          return response.response || "I'm not sure how to respond to that.";
        } catch (modelError) {
          console.log(`Model ${model} not available, trying next...`);
          continue;
        }
      }
      
      throw new Error('No AI models available');
    } catch (error) {
      console.error('Error generating response:', error);
      return "I'm having trouble connecting to my AI model right now. Please try again in a moment.";
    }
  }

  private buildContext(session: ChatSession, memories: any[]): string {
    let context = '';
    
    // Use stored memories for conversation history
    if (memories.length > 0) {
      memories.forEach(memory => {
        context += `${memory.content}\n`;
      });
    }

    // Add current session messages
    const recentMessages = session.messages.slice(-4);
    if (recentMessages.length > 0) {
      recentMessages.forEach(msg => {
        context += `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}\n`;
      });
    }

    return context;
  }

  private async storeImportantInfo(sessionId: string, userMessage: string, assistantResponse: string): Promise<void> {
    try {
      const importantInfo = this.extractImportantInfo(userMessage, assistantResponse);
      
      if (importantInfo.length > 0) {
        console.log('Storing important info:', importantInfo);
        for (const info of importantInfo) {
          await this.memory.upsert(sessionId, info.key, info.content);
          console.log('Stored memory:', info);
        }
      }
    } catch (error) {
      console.error('Error storing important info:', error);
    }
  }

  private extractImportantInfo(userMessage: string, assistantResponse: string): Array<{key: string, content: string}> {
    const importantInfo: Array<{key: string, content: string}> = [];
    
    // Let the AI decide what's important by storing the raw conversation
    // The AI model will naturally understand and use this information
    importantInfo.push({
      key: 'conversation',
      content: userMessage
    });

    return importantInfo;
  }

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  getSession(sessionId: string): ChatSession | undefined {
    return this.sessions.get(sessionId);
  }

  getAllSessions(): ChatSession[] {
    return Array.from(this.sessions.values());
  }
}