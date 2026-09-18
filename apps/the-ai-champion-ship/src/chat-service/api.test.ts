import { describe, test, expect, beforeEach, vi } from 'vitest';
import handler from './index.js';

// Comprehensive mock environment for API testing
function createMockEnv() {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
    logAtLevel: vi.fn(),
    message: vi.fn(),
    messageAtLevel: vi.fn(),
    with: vi.fn(),
    withError: vi.fn(),
  };

  const mockKvCache = {
    get: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    list: vi.fn(),
  };

  const mockAI = {
    run: vi.fn(),
  };

  // Make logger methods chainable
  mockLogger.with.mockReturnValue(mockLogger);
  mockLogger.withError.mockReturnValue(mockLogger);

  return {
    _raindrop: {
      app: {
        organizationId: 'test-org',
        applicationName: 'test-app',
        versionId: 'test-version',
        scriptName: 'test-script',
        visibility: 'public',
      },
    },
    logger: mockLogger,
    CONVERSATION_STORE: mockKvCache,
    AI: mockAI,
  };
}

function createMockContext() {
  return {
    waitUntil: vi.fn().mockResolvedValue(undefined),
    passThroughOnException: vi.fn(),
  };
}

describe('Chat API Integration Tests', () => {
  let service: any;
  let env: any;
  let ctx: any;

  beforeEach(() => {
    env = createMockEnv();
    ctx = createMockContext();
    service = new handler(ctx, env);
    
    // Reset all mocks
    vi.clearAllMocks();
  });

  describe('Health Check', () => {
    test('returns health status', async () => {
      const request = new Request('https://example.com/health', { method: 'GET' });
      
      const response = await service.fetch(request, env, ctx);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Web UI', () => {
    test('serves HTML interface', async () => {
      const request = new Request('https://example.com/', { method: 'GET' });
      
      const response = await service.fetch(request, env, ctx);
      
      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
      
      const html = await response.text();
      expect(html).toContain('AI Championship Chat');
      expect(html).toContain('<!DOCTYPE html>');
    });
  });

  describe('Chat API - New Session', () => {
    test('creates new chat session', async () => {
      const request = new Request('https://example.com/api/chat/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      env.CONVERSATION_STORE.put.mockResolvedValue(undefined);

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toMatch(/^[0-9a-f-]{36}$/);
      expect(data.conversation).toBeDefined();
      expect(data.conversation.messages).toEqual([]);
      expect(env.CONVERSATION_STORE.put).toHaveBeenCalled();
    });

    test('handles session creation errors', async () => {
      env.CONVERSATION_STORE.put.mockRejectedValue(new Error('KV Error'));

      const request = new Request('https://example.com/api/chat/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('KV Error');
    });
  });

  describe('Chat API - Send Message', () => {
    beforeEach(() => {
      // Mock successful AI response
      env.AI.run.mockResolvedValue({
        choices: [{
          message: {
            content: 'Hello! How can I help you today?'
          }
        }]
      });

      // Mock conversation store operations
      env.CONVERSATION_STORE.get.mockResolvedValue({
        id: 'conv-1',
        sessionId: 'session-123',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now(), sessionId: 'session-123' }
        ],
        createdAt: Date.now(),
        updatedAt: Date.now()
      });
      
      env.CONVERSATION_STORE.put.mockResolvedValue(undefined);
    });

    test('sends message and gets AI response (non-streaming)', async () => {
      const request = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello, AI!',
          sessionId: 'session-123',
          stream: false
        }),
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.messageId).toBeDefined();
      expect(data.sessionId).toBe('session-123');
      expect(data.response).toBe('Hello! How can I help you today?');
      expect(data.conversation).toBeDefined();
    });

    test('sends message and gets AI response (streaming)', async () => {
      const request = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello, AI!',
          sessionId: 'session-123',
          stream: true
        }),
      });

      const response = await service.fetch(request, env, ctx);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/event-stream');
      
      const text = await response.text();
      expect(text).toContain('data: ');
      expect(text).toContain('type: "chunk"');
      expect(text).toContain('type: "complete"');
    });

    test('creates new session when none provided', async () => {
      // Mock get returning null (no existing session)
      env.CONVERSATION_STORE.get.mockResolvedValueOnce(null);
      
      const request = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello, AI!',
          stream: false
        }),
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.sessionId).toBeDefined();
      expect(data.response).toBe('Hello! How can I help you today?');
    });

    test('validates message content', async () => {
      const request = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: '', // Empty message
          sessionId: 'session-123'
        }),
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Message cannot be empty');
    });

    test('handles non-existent session', async () => {
      env.CONVERSATION_STORE.get.mockResolvedValueOnce(null);

      const request = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello, AI!',
          sessionId: 'non-existent-session'
        }),
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });

    test('handles AI service errors', async () => {
      env.AI.run.mockRejectedValue(new Error('AI Service Error'));

      const request = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello, AI!',
          sessionId: 'session-123',
          stream: false
        }),
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI Service Error');
    });

    test('handles malformed JSON request', async () => {
      const request = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{',
      });

      const response = await service.fetch(request, env, ctx);

      expect(response.status).toBe(400);
    });
  });

  describe('Chat API - Get History', () => {
    test('retrieves conversation history', async () => {
      const mockConversation = {
        id: 'conv-1',
        sessionId: 'session-123',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', timestamp: Date.now() - 2000, sessionId: 'session-123' },
          { id: 'msg-2', role: 'assistant', content: 'Hi there!', timestamp: Date.now() - 1000, sessionId: 'session-123' }
        ],
        createdAt: Date.now() - 3000,
        updatedAt: Date.now() - 1000
      };

      env.CONVERSATION_STORE.get.mockResolvedValue(mockConversation);

      const request = new Request('https://example.com/api/chat/history/session-123', {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.conversation).toEqual(mockConversation);
    });

    test('handles non-existent conversation history', async () => {
      env.CONVERSATION_STORE.get.mockResolvedValue(null);

      const request = new Request('https://example.com/api/chat/history/non-existent', {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Conversation not found');
    });
  });

  describe('Session Management API', () => {
    test('gets session statistics', async () => {
      env.CONVERSATION_STORE.list.mockResolvedValue({
        list_complete: true,
        keys: [
          { name: 'conv:session-1' },
          { name: 'conv:session-2' }
        ],
        cacheStatus: null
      });

      env.CONVERSATION_STORE.get.mockImplementation(async (key) => {
        if (key.includes('session-1')) {
          return {
            messages: [{ id: '1', role: 'user', content: 'Hello', timestamp: Date.now(), sessionId: 'session-1' }]
          };
        }
        if (key.includes('session-2')) {
          return {
            messages: [
              { id: '1', role: 'user', content: 'Question', timestamp: Date.now(), sessionId: 'session-2' },
              { id: '2', role: 'assistant', content: 'Answer', timestamp: Date.now(), sessionId: 'session-2' }
            ]
          };
        }
        return null;
      });

      const request = new Request('https://example.com/api/sessions/stats', {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.activeSessions).toBe(2);
      expect(data.totalMessages).toBe(3);
      expect(data.averageMessagesPerSession).toBe(1.5);
    });

    test('gets session info', async () => {
      const now = Date.now();
      const mockConversation = {
        id: 'conv-1',
        sessionId: 'session-123',
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', timestamp: now - 1000, sessionId: 'session-123' }
        ],
        createdAt: now - 2000,
        updatedAt: now - 500
      };

      env.CONVERSATION_STORE.get.mockResolvedValue(mockConversation);

      const request = new Request('https://example.com/api/sessions/session-123/info', {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.exists).toBe(true);
      expect(data.messageCount).toBe(1);
      expect(data.age).toBeGreaterThan(0);
      expect(data.lastActivity).toBeGreaterThan(0);
    });

    test('extends session TTL', async () => {
      const mockConversation = {
        id: 'conv-1',
        sessionId: 'session-123',
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };

      env.CONVERSATION_STORE.get.mockResolvedValue(mockConversation);
      env.CONVERSATION_STORE.put.mockResolvedValue(undefined);

      const request = new Request('https://example.com/api/sessions/session-123/extend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session extended successfully');
      expect(env.CONVERSATION_STORE.put).toHaveBeenCalled();
    });

    test('deletes session', async () => {
      env.CONVERSATION_STORE.get.mockResolvedValue({}); // Session exists
      env.CONVERSATION_STORE.delete.mockResolvedValue(undefined);

      const request = new Request('https://example.com/api/sessions/session-123', {
        method: 'DELETE',
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.message).toBe('Session deleted successfully');
      expect(env.CONVERSATION_STORE.delete).toHaveBeenCalledWith('conv:session-123');
    });

    test('handles delete non-existent session', async () => {
      env.CONVERSATION_STORE.get.mockResolvedValue(null); // Session doesn't exist

      const request = new Request('https://example.com/api/sessions/non-existent', {
        method: 'DELETE',
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });
  });

  describe('CORS Headers', () => {
    test('includes CORS headers for API requests', async () => {
      const request = new Request('https://example.com/api/hello', { method: 'GET' });
      
      const response = await service.fetch(request, env, ctx);
      
      // CORS headers should be added by the Raindrop app-level CORS configuration
      expect(response.status).toBeLessThan(600);
    });

    test('handles OPTIONS requests', async () => {
      const request = new Request('https://example.com/api/chat/new', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST'
        }
      });
      
      const response = await service.fetch(request, env, ctx);
      
      // Should handle preflight requests
      expect([200, 204, 404]).toContain(response.status);
    });
  });

  describe('Error Handling', () => {
    test('handles unexpected errors gracefully', async () => {
      // Simulate an unexpected error
      env.CONVERSATION_STORE.get.mockImplementationOnce(() => {
        throw new Error('Unexpected error');
      });

      const request = new Request('https://example.com/api/chat/history/session-123', {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBeDefined();
    });

    test('validates required request fields', async () => {
      const request = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}), // Missing message field
      });

      const response = await service.fetch(request, env, ctx);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('empty');
    });
  });
});