import { WorkflowTask } from './types';

export class WorkflowManager {
  private tasks: Map<string, WorkflowTask> = new Map();

  async createTask(
    type: WorkflowTask['type'],
    payload: any,
    sessionId: string
  ): Promise<string> {
    const taskId = this.generateTaskId();
    
    const task: WorkflowTask = {
      id: taskId,
      type,
      payload,
      status: 'pending',
      sessionId
    };

    this.tasks.set(taskId, task);
    
    // Start processing the task asynchronously
    this.processTask(taskId);
    
    return taskId;
  }

  private async processTask(taskId: string): Promise<void> {
    const task = this.tasks.get(taskId);
    if (!task) return;

    try {
      task.status = 'running';
      
      switch (task.type) {
        case 'memory_store':
          await this.handleMemoryStore(task);
          break;
        case 'memory_retrieve':
          await this.handleMemoryRetrieve(task);
          break;
        case 'external_api':
          await this.handleExternalAPI(task);
          break;
        case 'data_processing':
          await this.handleDataProcessing(task);
          break;
        default:
          throw new Error(`Unknown task type: ${task.type}`);
      }
      
      task.status = 'completed';
    } catch (error) {
      task.status = 'failed';
      task.error = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Task ${taskId} failed:`, error);
    }
  }

  private async handleMemoryStore(task: WorkflowTask): Promise<void> {
    // Simulate memory storage operation
    await new Promise(resolve => setTimeout(resolve, 100));
    task.result = { success: true, stored: true };
  }

  private async handleMemoryRetrieve(task: WorkflowTask): Promise<void> {
    // Simulate memory retrieval operation
    await new Promise(resolve => setTimeout(resolve, 150));
    task.result = { 
      success: true, 
      memories: [
        { content: 'Sample memory 1', timestamp: Date.now() },
        { content: 'Sample memory 2', timestamp: Date.now() - 1000 }
      ]
    };
  }

  private async handleExternalAPI(task: WorkflowTask): Promise<void> {
    // Simulate external API call
    await new Promise(resolve => setTimeout(resolve, 500));
    task.result = { 
      success: true, 
      data: { 
        api_response: 'External API data',
        timestamp: Date.now()
      }
    };
  }

  private async handleDataProcessing(task: WorkflowTask): Promise<void> {
    // Simulate data processing
    await new Promise(resolve => setTimeout(resolve, 300));
    task.result = { 
      success: true, 
      processed_data: {
        original: task.payload,
        processed: 'Processed data',
        timestamp: Date.now()
      }
    };
  }

  getTask(taskId: string): WorkflowTask | undefined {
    return this.tasks.get(taskId);
  }

  getTasksBySession(sessionId: string): WorkflowTask[] {
    return Array.from(this.tasks.values())
      .filter(task => task.sessionId === sessionId);
  }

  getAllTasks(): WorkflowTask[] {
    return Array.from(this.tasks.values());
  }

  private generateTaskId(): string {
    return `task_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  // Workflow orchestration example
  async runMemoryWorkflow(sessionId: string, userMessage: string): Promise<string[]> {
    const taskIds: string[] = [];
    
    try {
      // Step 1: Store current interaction
      const storeTaskId = await this.createTask('memory_store', {
        sessionId,
        content: userMessage,
        timestamp: Date.now()
      }, sessionId);
      taskIds.push(storeTaskId);

      // Step 2: Retrieve relevant memories
      const retrieveTaskId = await this.createTask('memory_retrieve', {
        sessionId,
        query: userMessage,
        limit: 5
      }, sessionId);
      taskIds.push(retrieveTaskId);

      // Step 3: Process data for context
      const processTaskId = await this.createTask('data_processing', {
        sessionId,
        userMessage,
        context: 'memory_workflow'
      }, sessionId);
      taskIds.push(processTaskId);

      return taskIds;
    } catch (error) {
      console.error('Memory workflow failed:', error);
      return taskIds;
    }
  }
}
