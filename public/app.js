class ChatApp {
    constructor() {
        this.ws = null;
        this.sessionId = this.generateSessionId();
        this.userId = 'user_' + Math.random().toString(36).substr(2, 9);
        this.isConnected = false;
        this.messageQueue = [];
        
        this.initializeElements();
        this.setupEventListeners();
        this.connectWebSocket();
    }

    initializeElements() {
        this.chatMessages = document.getElementById('chatMessages');
        this.chatInput = document.getElementById('chatInput');
        this.sendButton = document.getElementById('sendButton');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.typingIndicator = document.getElementById('typingIndicator');
        
        const welcomeTime = document.getElementById('welcomeTime');
        if (welcomeTime) {
            welcomeTime.textContent = this.formatTime(new Date());
        }
    }

    setupEventListeners() {
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.chatInput.addEventListener('input', () => {
            this.sendTypingIndicator();
        });
    }

    connectWebSocket() {
        try {
            this.updateConnectionStatus('Using HTTP API', false);
            this.isConnected = true;
            this.processMessageQueue();
        } catch (error) {
            console.error('Failed to connect:', error);
            this.updateConnectionStatus('Connection failed', false);
        }
    }

    updateConnectionStatus(message, isConnected) {
        this.connectionStatus.innerHTML = `
            <span class="status-indicator ${isConnected ? 'status-connected' : 'status-disconnected'}"></span>
            ${message}
        `;
        this.isConnected = isConnected;
    }

    async sendMessage() {
        const message = this.chatInput.value.trim();
        if (!message || !this.isConnected) return;

        this.chatInput.value = '';
        this.sendButton.disabled = true;

        this.addMessage(message, 'user');
        this.showTypingIndicator();

        try {
            const workerUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                ? 'http://127.0.0.1:8787' 
                : 'https://cf_ai_cloudflare_agent_chat.sainithingoudk.workers.dev';
            
            console.log('Sending request to:', `${workerUrl}/api/chat`);
            console.log('Request data:', {
                message: message,
                sessionId: this.sessionId,
                userId: this.userId
            });

            const response = await fetch(`${workerUrl}/api/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message,
                    sessionId: this.sessionId,
                    userId: this.userId
                })
            });

            console.log('Response status:', response.status);
            console.log('Response headers:', response.headers);

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            console.log('Response data:', data);

            this.hideTypingIndicator();
            this.addMessage(data.message, 'assistant');

        } catch (error) {
            console.error('Error sending message:', error);
            this.hideTypingIndicator();
            this.addMessage('Sorry, I encountered an error. Please try again.', 'assistant');
        } finally {
            this.sendButton.disabled = false;
        }
    }

    addMessage(content, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const contentDiv = document.createElement('div');
        contentDiv.className = 'message-content';
        contentDiv.textContent = content;
        
        const timeDiv = document.createElement('div');
        timeDiv.className = 'message-time';
        timeDiv.textContent = this.formatTime(new Date());
        
        messageDiv.appendChild(contentDiv);
        messageDiv.appendChild(timeDiv);
        
        this.chatMessages.appendChild(messageDiv);
        this.scrollToBottom();
    }

    showTypingIndicator() {
        this.typingIndicator.style.display = 'block';
        this.scrollToBottom();
    }

    hideTypingIndicator() {
        this.typingIndicator.style.display = 'none';
    }

    sendTypingIndicator() {
        // Typing indicator functionality can be added here if needed
    }

    scrollToBottom() {
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    formatTime(date) {
        return date.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
    }

    generateSessionId() {
        return 'session_' + Math.random().toString(36).substr(2, 9);
    }

    processMessageQueue() {
        while (this.messageQueue.length > 0) {
            const message = this.messageQueue.shift();
            this.sendMessage(message);
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new ChatApp();
});