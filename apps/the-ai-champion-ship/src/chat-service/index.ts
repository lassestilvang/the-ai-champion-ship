import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { streamSSE } from 'hono/streaming';
import { Env } from './raindrop.gen';
import { ConversationStore } from '../lib/conversation-store';
import { SessionManager } from '../lib/session-manager';
import { SmartChatServices } from '../services/smart-services';
import { ChatRequest, ChatResponse, NewSessionResponse, Conversation } from '../types/conversation';

// Web API types that should be available in Cloudflare Workers
// These type aliases ensure compatibility between test and runtime environments
type Headers = globalThis.Headers;
type Blob = globalThis.Blob;
type FormData = globalThis.FormData;
type ReadableStream = globalThis.ReadableStream;

// Create Hono app with middleware
const app = new Hono<{ Bindings: Env }>();

// Add request logging middleware
app.use('*', async (c, next) => {
  const start = Date.now();
  const url = c.req.url;
  const method = c.req.method;
  
  await next();
  
  const duration = Date.now() - start;
  
  // Safely log the request
  try {
    if (c.env?.logger) {
      c.env.logger.info(`${method} ${url}`, { 
        status: c.res.status,
        duration: `${duration}ms`
      });
    }
  } catch (error) {
    // Ignore logging errors to avoid breaking the application
  }
});

// Health check endpoint
app.get('/health', (c) => {
  return c.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Serve the web UI
app.get('/', (c) => {
  return c.html(getWebUI());
});

// === Chat API Endpoints ===

// Create new conversation session
app.post('/api/chat/new', async (c) => {
  try {
    const store = new ConversationStore(c.env.CONVERSATION_STORE);
    const sessionId = store.generateSessionId();
    const conversation = await store.createConversation(sessionId);

    const response: NewSessionResponse = {
      sessionId,
      conversation
    };

    return c.json(response);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to create session', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// Get conversation history
app.get('/api/chat/history/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const store = new ConversationStore(c.env.CONVERSATION_STORE);
    const conversation = await store.getConversation(sessionId);

    if (!conversation) {
      return c.json({ error: 'Conversation not found' }, 404);
    }

    return c.json({ conversation });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to get conversation history', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// === Smart Services Endpoints ===

// Initialize SmartSQL database
app.post('/api/smart/init', async (c) => {
  try {
    const smartServices = new SmartChatServices(c.env);
    await smartServices.initializeDatabase();
    return c.json({ success: true, message: 'Smart services initialized successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to initialize smart services', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// SmartBucket endpoints
app.post('/api/smart/upload', async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file as File;
    const sessionId = body.sessionId as string;
    const filename = body.filename as string || 'uploaded-file';

    if (!file || !sessionId) {
      return c.json({ error: 'file and sessionId are required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    const content = await file.text();
    const result = await smartServices.uploadDocument(sessionId, content, filename);

    return c.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to upload document', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

app.get('/api/smart/search', async (c) => {
  try {
    const sessionId = c.req.query('sessionId') as string;
    const query = c.req.query('q') as string;

    if (!sessionId || !query) {
      return c.json({ error: 'sessionId and q query parameters are required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    const results = await smartServices.searchDocuments(sessionId, query);

    return c.json(results);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to search documents', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

app.post('/api/smart/chat-with-docs', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, message } = body;

    if (!sessionId || !message) {
      return c.json({ error: 'sessionId and message are required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    const response = await smartServices.chatWithDocuments(sessionId, message);

    return c.json({ response });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to chat with documents', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// SmartMemory endpoints
app.post('/api/smart/preference', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, key, value } = body;

    if (!sessionId || !key) {
      return c.json({ error: 'sessionId and key are required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    await smartServices.rememberUserPreference(sessionId, key, value);

    return c.json({ success: true, message: 'Preference stored successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to store preference', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

app.get('/api/smart/preference', async (c) => {
  try {
    const sessionId = c.req.query('sessionId') as string;
    const key = c.req.query('key') as string;

    if (!sessionId || !key) {
      return c.json({ error: 'sessionId and key are required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    const value = await smartServices.getUserPreference(sessionId, key);

    return c.json({ key, value });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to retrieve preference', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

app.post('/api/smart/learn', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, userMessage, aiResponse, feedback } = body;

    if (!sessionId || !userMessage || !aiResponse || !feedback) {
      return c.json({ error: 'sessionId, userMessage, aiResponse, and feedback are required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    await smartServices.learnFromFeedback(sessionId, userMessage, aiResponse, feedback);

    return c.json({ success: true, message: 'Feedback processed successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to process feedback', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// SmartSQL endpoints
app.post('/api/smart/user-profile', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, preferences } = body;

    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    await smartServices.createUserProfile(sessionId, preferences);

    return c.json({ success: true, message: 'User profile created/updated' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to create user profile', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

app.post('/api/smart/query', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, naturalQuery } = body;

    if (!sessionId || !naturalQuery) {
      return c.json({ error: 'sessionId and naturalQuery are required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    const result = await smartServices.queryConversations(sessionId, naturalQuery);

    return c.json(result);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to query conversations', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

app.get('/api/smart/insights/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');

    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    const insights = await smartServices.getConversationInsights(sessionId);

    return c.json(insights);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to get conversation insights', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

app.post('/api/smart/analytics', async (c) => {
  try {
    const body = await c.req.json();
    const { sessionId, messageCount, duration } = body;

    if (!sessionId) {
      return c.json({ error: 'sessionId is required' }, 400);
    }

    const smartServices = new SmartChatServices(c.env);
    await smartServices.storeConversationAnalytics(sessionId, messageCount, duration);

    return c.json({ success: true, message: 'Analytics stored successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to store analytics', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// === Voice API Endpoints ===

// Voice-to-Text endpoint (using Web Speech API simulation)
app.post('/api/speech-to-text', async (c) => {
  try {
    const body = await c.req.parseBody();
    const audioFile = body.audio as File;

    if (!audioFile) {
      return c.json({ error: 'No audio file provided' }, 400);
    }

    // For now, return a placeholder since browser-based Speech Recognition is better
    // In a real implementation, you'd use a speech-to-text service here
    return c.json({
      text: "Voice transcription would be processed here",
      confidence: 0.95,
      note: "Use browser-based Speech Recognition API for better results"
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to process speech', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// Voice commands endpoint
app.post('/api/voice-command', async (c) => {
  try {
    const body = await c.req.json();
    const { command, sessionId } = body;

    const commandHandlers = {
      'new chat': 'Creating a new conversation',
      'clear chat': 'Clearing conversation history',
      'help': 'Available commands: new chat, clear chat, help, toggle voice, stop speaking',
      'toggle voice': 'Toggling voice responses',
      'stop speaking': 'Stopping speech synthesis',
      'start voice': 'Starting voice input',
      'send message': 'Sending current message'
    };

    const response = commandHandlers[command.toLowerCase() as keyof typeof commandHandlers] || `Unknown command: ${command}`;

    return c.json({
      command,
      response,
      executed: command.toLowerCase() in commandHandlers
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to process voice command', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// Send message and get AI response (streaming)
app.post('/api/chat/send', async (c) => {
  try {
    const body = await c.req.json() as ChatRequest;
    const { message, sessionId, stream = true, enableVoice = false } = body;

    if (!message?.trim()) {
      return c.json({ error: 'Message cannot be empty' }, 400);
    }

    const store = new ConversationStore(c.env.CONVERSATION_STORE);
    let conversation: Conversation;

    // Get or create conversation
    if (sessionId) {
      const conv = await store.getConversation(sessionId);
      if (!conv) {
        return c.json({ error: 'Session not found' }, 404);
      }
      conversation = conv;
    } else {
      const newSessionId = store.generateSessionId();
      conversation = await store.createConversation(newSessionId);
    }

    // Add user message
    conversation = await store.addMessage(conversation.sessionId, 'user', message);

    // Prepare messages for AI
    const aiMessages = conversation.messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    if (stream) {
      // For now, use non-streaming but simulate streaming for UI compatibility
      const aiResponse = await c.env.AI.run('llama-3.1-8b-external', {
        model: 'llama-3.1-8b-instruct',
        messages: aiMessages,
        stream: false
      });

      const responseText = (aiResponse as any).choices?.[0]?.message?.content || '';
      await store.addMessage(conversation.sessionId, 'assistant', responseText);
      const updatedConversation = await store.getConversation(conversation.sessionId);

      return streamSSE(c, async (stream) => {
        // Simulate streaming by sending chunks
        const words = responseText.split(' ');
        
        for (const word of words) {
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'chunk',
              content: word + ' ',
              messageId: store.generateMessageId()
            })
          });
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        await stream.writeSSE({
          data: JSON.stringify({
            type: 'complete',
            sessionId: conversation.sessionId,
            conversation: updatedConversation,
            enableVoice
          })
        });
      });
    } else {
      // Non-streaming response
      const aiResponse = await c.env.AI.run('llama-3.1-8b-external', {
        model: 'llama-3.1-8b-instruct',
        messages: aiMessages,
        stream: false
      });

      const responseText = (aiResponse as any).choices?.[0]?.message?.content || '';
      conversation = await store.addMessage(conversation.sessionId, 'assistant', responseText);

      const response: ChatResponse = {
        messageId: store.generateMessageId(),
        sessionId: conversation.sessionId,
        response: responseText,
        conversation
      };

      return c.json(response);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: errorMessage }, 500);
  }
});

    const store = new ConversationStore(c.env.CONVERSATION_STORE);
    let conversation: Conversation;

    // Get or create conversation
    if (sessionId) {
      const conv = await store.getConversation(sessionId);
      if (!conv) {
        return c.json({ error: 'Session not found' }, 404);
      }
      conversation = conv;
    } else {
      const newSessionId = store.generateSessionId();
      conversation = await store.createConversation(newSessionId);
    }

    // Add user message
    conversation = await store.addMessage(conversation.sessionId, 'user', message);

    // Prepare messages for AI
    const aiMessages = conversation.messages.map((msg: any) => ({
      role: msg.role,
      content: msg.content
    }));

    if (stream) {
      // For now, use non-streaming but simulate streaming for UI compatibility
      const aiResponse = await c.env.AI.run('llama-3.1-8b-external', {
        model: 'llama-3.1-8b-instruct',
        messages: aiMessages,
        stream: false
      });

      const responseText = (aiResponse as any).choices?.[0]?.message?.content || '';
      await store.addMessage(conversation.sessionId, 'assistant', responseText);
      const updatedConversation = await store.getConversation(conversation.sessionId);

      return streamSSE(c, async (stream) => {
        // Simulate streaming by sending chunks
        const words = responseText.split(' ');
        
        for (const word of words) {
          await stream.writeSSE({
            data: JSON.stringify({
              type: 'chunk',
              content: word + ' ',
              messageId: store.generateMessageId()
            })
          });
          // Small delay to simulate streaming
          await new Promise(resolve => setTimeout(resolve, 50));
        }

        await stream.writeSSE({
          data: JSON.stringify({
            type: 'complete',
            sessionId: conversation.sessionId,
            conversation: updatedConversation,
            enableVoice
          })
        });
      });
    } else {
      // Non-streaming response
      const aiResponse = await c.env.AI.run('llama-3.1-8b-external', {
        model: 'llama-3.1-8b-instruct',
        messages: aiMessages,
        stream: false
      });

      const responseText = (aiResponse as any).choices?.[0]?.message?.content || '';
      conversation = await store.addMessage(conversation.sessionId, 'assistant', responseText);

      const response: ChatResponse = {
        messageId: store.generateMessageId(),
        sessionId: conversation.sessionId,
        response: responseText,
        conversation
      };

      return c.json(response);
    }

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to send message', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// === Session Management Endpoints ===

// Get session statistics
app.get('/api/sessions/stats', async (c) => {
  try {
    const sessionManager = new SessionManager(c.env.CONVERSATION_STORE);
    const stats = await sessionManager.getSessionStats();
    return c.json(stats);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to get session stats', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// Get session info
app.get('/api/sessions/:sessionId/info', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const sessionManager = new SessionManager(c.env.CONVERSATION_STORE);
    const sessionInfo = await sessionManager.getSessionInfo(sessionId);

    if (!sessionInfo) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json(sessionInfo);
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to get session info', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// Extend session TTL
app.post('/api/sessions/:sessionId/extend', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const sessionManager = new SessionManager(c.env.CONVERSATION_STORE);
    const success = await sessionManager.extendSession(sessionId);

    if (!success) {
      return c.json({ error: 'Session not found' }, 404);
    }

    return c.json({ success: true, message: 'Session extended successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to extend session', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// Delete session
app.delete('/api/sessions/:sessionId', async (c) => {
  try {
    const sessionId = c.req.param('sessionId');
    const store = new ConversationStore(c.env.CONVERSATION_STORE);
    const exists = await store.sessionExists(sessionId);

    if (!exists) {
      return c.json({ error: 'Session not found' }, 404);
    }

    await store.deleteConversation(sessionId);
    return c.json({ success: true, message: 'Session deleted successfully' });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    c.env.logger.error('Failed to delete session', { error: errorMessage });
    return c.json({ error: errorMessage }, 500);
  }
});

// === Service Handler ===

export default class extends Service<Env> {
  async fetch(request: Request, env: Env, ctx: any): Promise<Response> {
    return app.fetch(request, env, ctx);
  }
}

// === Web UI ===

function getWebUI(): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Championship - Chat</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }

        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #f5f5f5;
            height: 100vh;
            display: flex;
            flex-direction: column;
        }

        .header {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 1rem 2rem;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }

        .header h1 {
            font-size: 1.5rem;
            font-weight: 600;
        }

        .chat-container {
            flex: 1;
            display: flex;
            flex-direction: column;
            max-width: 800px;
            margin: 0 auto;
            width: 100%;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }

        .messages {
            flex: 1;
            overflow-y: auto;
            padding: 2rem;
            display: flex;
            flex-direction: column;
            gap: 1rem;
        }

        .message {
            max-width: 70%;
            padding: 1rem;
            border-radius: 12px;
            word-wrap: break-word;
        }

        .message.user {
            background: #007bff;
            color: white;
            align-self: flex-end;
            margin-left: auto;
        }

        .message.assistant {
            background: #e9ecef;
            color: #333;
            align-self: flex-start;
        }

        .message-content {
            white-space: pre-wrap;
            line-height: 1.5;
        }

        .message-time {
            font-size: 0.75rem;
            opacity: 0.7;
            margin-top: 0.5rem;
        }

        .input-container {
            padding: 1.5rem;
            border-top: 1px solid #e9ecef;
            background: white;
        }

        .input-form {
            display: flex;
            gap: 1rem;
        }

        .input-field {
            flex: 1;
            padding: 0.75rem;
            border: 2px solid #e9ecef;
            border-radius: 8px;
            font-size: 1rem;
            transition: border-color 0.2s;
        }

        .input-field:focus {
            outline: none;
            border-color: #007bff;
        }

        .send-button {
            padding: 0.75rem 1.5rem;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 1rem;
            cursor: pointer;
            transition: background-color 0.2s;
        }

        .send-button:hover:not(:disabled) {
            background: #0056b3;
        }

        .send-button:disabled {
            background: #6c757d;
            cursor: not-allowed;
        }

        .typing-indicator {
            display: none;
            align-self: flex-start;
            background: #e9ecef;
            padding: 1rem;
            border-radius: 12px;
            margin-bottom: 1rem;
        }

        .typing-dots {
            display: flex;
            gap: 0.25rem;
        }

        .typing-dot {
            width: 8px;
            height: 8px;
            background: #6c757d;
            border-radius: 50%;
            animation: typing 1.4s infinite ease-in-out;
        }

        .typing-dot:nth-child(1) { animation-delay: -0.32s; }
        .typing-dot:nth-child(2) { animation-delay: -0.16s; }

        @keyframes typing {
            0%, 80%, 100% { transform: scale(0); }
            40% { transform: scale(1); }
        }

        .error-message {
            background: #dc3545;
            color: white;
            padding: 1rem;
            margin: 1rem 0;
            border-radius: 8px;
        }

        @media (max-width: 768px) {
            .header {
                padding: 1rem;
            }
            
            .messages {
                padding: 1rem;
            }
            
            .message {
                max-width: 85%;
            }
            
            .input-container {
                padding: 1rem;
            }
        }
    </style>
</head>
<body>
    <header class="header">
        <h1>🏆 AI Championship Chat</h1>
    </header>

    <div class="chat-container">
        <div class="messages" id="messages">
            <!-- Messages will be added here -->
        </div>

        <div class="typing-indicator" id="typingIndicator">
            <div class="typing-dots">
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
                <div class="typing-dot"></div>
            </div>
        </div>

        <div class="input-container">
            <form class="input-form" id="chatForm">
                <input 
                    type="text" 
                    class="input-field" 
                    id="messageInput" 
                    placeholder="Type your message..." 
                    autofocus
                    required
                >
                <button type="submit" class="send-button" id="sendButton">Send</button>
            </form>
        </div>
    </div>

    <script>
        class ChatApp {
            constructor() {
                this.sessionId = null;
                this.conversation = null;
                this.isTyping = false;
                this.eventSource = null;
                
                this.init();
            }

            init() {
                this.setupEventListeners();
                this.createNewSession();
            }

            setupEventListeners() {
                const form = document.getElementById('chatForm');
                const input = document.getElementById('messageInput');
                
                form.addEventListener('submit', (e) => {
                    e.preventDefault();
                    this.sendMessage();
                });

                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        this.sendMessage();
                    }
                });
            }

            async createNewSession() {
                try {
                    const response = await fetch('/api/chat/new', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' }
                    });

                    if (!response.ok) {
                        throw new Error('Failed to create session');
                    }

                    const data = await response.json();
                    this.sessionId = data.sessionId;
                    this.conversation = data.conversation;
                    
                    this.addMessage('assistant', 'Hello! I\'m your AI assistant. How can I help you today?');
                } catch (error) {
                    console.error('Failed to create session:', error);
                    this.showError('Failed to start chat session. Please refresh the page.');
                }
            }

            async sendMessage() {
                const input = document.getElementById('messageInput');
                const message = input.value.trim();
                
                if (!message || this.isTyping) return;

                // Add user message to UI
                this.addMessage('user', message);
                input.value = '';
                
                // Show typing indicator
                this.setTyping(true);

                try {
                    await this.sendStreamingMessage(message);
                } catch (error) {
                    console.error('Failed to send message:', error);
                    this.showError('Failed to send message. Please try again.');
                } finally {
                    this.setTyping(false);
                }
            }

            async sendStreamingMessage(message) {
                const response = await fetch('/api/chat/send', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message,
                        sessionId: this.sessionId,
                        stream: true
                    })
                });

                if (!response.ok) {
                    throw new Error('Failed to send message');
                }

                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let assistantMessage = '';
                let messageElement = null;

                try {
                    while (true) {
                        const { done, value } = await reader.read();
                        if (done) break;

                        const chunk = decoder.decode(value);
                        const lines = chunk.split('\\n');

                        for (const line of lines) {
                            if (line.startsWith('data: ')) {
                                try {
                                    const data = JSON.parse(line.slice(6));
                                    
                                    if (data.type === 'chunk') {
                                        assistantMessage += data.content;
                                        
                                        if (!messageElement) {
                                            messageElement = this.addMessage('assistant', '', true);
                                        }
                                        
                                        this.updateMessage(messageElement, assistantMessage);
                                    } else if (data.type === 'complete') {
                                        this.conversation = data.conversation;
                                    } else if (data.type === 'error') {
                                        throw new Error(data.error);
                                    }
                                } catch (e) {
                                    // Skip invalid JSON
                                }
                            }
                        }
                    }
                } finally {
                    if (messageElement) {
                        this.finalizeMessage(messageElement);
                    }
                }
            }

            addMessage(role, content, isStreaming = false) {
                const messagesContainer = document.getElementById('messages');
                const messageDiv = document.createElement('div');
                messageDiv.className = \`message \${role}\`;
                
                const contentDiv = document.createElement('div');
                contentDiv.className = 'message-content';
                contentDiv.textContent = content;
                
                const timeDiv = document.createElement('div');
                timeDiv.className = 'message-time';
                timeDiv.textContent = new Date().toLocaleTimeString();
                
                messageDiv.appendChild(contentDiv);
                messageDiv.appendChild(timeDiv);
                
                if (isStreaming) {
                    contentDiv.id = 'streaming-message';
                }
                
                messagesContainer.appendChild(messageDiv);
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
                
                return messageDiv;
            }

            updateMessage(messageElement, content) {
                const contentDiv = messageElement.querySelector('.message-content');
                contentDiv.textContent = content;
                
                const messagesContainer = document.getElementById('messages');
                messagesContainer.scrollTop = messagesContainer.scrollHeight;
            }

            finalizeMessage(messageElement) {
                const contentDiv = messageElement.querySelector('.message-content');
                if (contentDiv.id === 'streaming-message') {
                    contentDiv.id = '';
                }
            }

            setTyping(isTyping) {
                this.isTyping = isTyping;
                const indicator = document.getElementById('typingIndicator');
                const sendButton = document.getElementById('sendButton');
                
                if (isTyping) {
                    indicator.style.display = 'block';
                    sendButton.disabled = true;
                } else {
                    indicator.style.display = 'none';
                    sendButton.disabled = false;
                }
            }

            showError(message) {
                const messagesContainer = document.getElementById('messages');
                const errorDiv = document.createElement('div');
                errorDiv.className = 'error-message';
                errorDiv.textContent = message;
                messagesContainer.appendChild(errorDiv);
                
                setTimeout(() => {
                    errorDiv.remove();
                }, 5000);
            }
        }

        // Initialize the chat app when the page loads
        document.addEventListener('DOMContentLoaded', () => {
            new ChatApp();
        });
    </script>
</body>
</html>`;
}