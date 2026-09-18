import { describe, test, expect, beforeEach, vi } from 'vitest';

// Mock the entire application setup
function createCompleteMockEnv() {
  const conversations = new Map<string, any>();
  const messages = new Map<string, any[]>();
  
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
    get: vi.fn().mockImplementation(async (key: string) => {
      if (key.startsWith('conv:')) {
        const sessionId = key.replace('conv:', '');
        return conversations.get(sessionId) || null;
      }
      return null;
    }),
    put: vi.fn().mockImplementation(async (key: string, value: string) => {
      if (key.startsWith('conv:')) {
        const sessionId = key.replace('conv:', '');
        const conversation = JSON.parse(value);
        conversations.set(sessionId, conversation);
        messages.set(sessionId, conversation.messages);
      }
    }),
    delete: vi.fn().mockImplementation(async (key: string) => {
      if (key.startsWith('conv:')) {
        const sessionId = key.replace('conv:', '');
        conversations.delete(sessionId);
        messages.delete(sessionId);
      }
    }),
    list: vi.fn().mockImplementation(async () => {
      const keys = Array.from(conversations.keys()).map(sessionId => ({
        name: `conv:${sessionId}`,
        expiration: undefined,
        metadata: undefined
      }));
      
      return {
        list_complete: true,
        keys,
        cacheStatus: null
      };
    })
  };

  const mockAI = {
    run: vi.fn().mockImplementation(async (model: string, options: any) => {
      // Simulate AI response based on the last user message
      const lastUserMessage = options.messages[options.messages.length - 1];
      const responseContent = generateAIResponse(lastUserMessage.content);
      
      return {
        choices: [{
          message: {
            content: responseContent
          }
        }]
      };
    })
  };

  // Helper function to generate contextual AI responses
  function generateAIResponse(userMessage: string): string {
    const responses: { [key: string]: string } = {
      'hello': 'Hello! How can I help you today?',
      'how are you': 'I am doing well, thank you for asking! I am ready to assist you.',
      'what can you do': 'I can help you with various tasks including answering questions, providing information, and having conversations.',
      'goodbye': 'Goodbye! It was nice chatting with you. Feel free to come back anytime!',
      'tell me a joke': 'Why don\'t scientists trust atoms? Because they make up everything!',
      'help': 'I am your AI assistant. You can ask me questions, have conversations, or request information on various topics.'
    };
    
    const lowerMessage = userMessage.toLowerCase();
    for (const [key, response] of Object.entries(responses)) {
      if (lowerMessage.includes(key)) {
        return response;
      }
    }
    
    return `That's an interesting point about "${userMessage}". Let me think about that and provide you with a thoughtful response.`;
  }

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
    // Test helpers
    _testHelpers: {
      conversations,
      messages,
      generateAIResponse
    }
  };
}

describe('End-to-End Chat Flow Tests', () => {
  let service: any;
  let env: any;
  let ctx: any;

  beforeEach(() => {
    env = createCompleteMockEnv();
    ctx = { waitUntil: vi.fn().mockResolvedValue(undefined) };
    
    // Import and instantiate the service
    const { default: handler } = await import('../chat-service/index.js');
    service = new handler(ctx, env);
    
    // Reset mocks
    vi.clearAllMocks();
  });

  describe('Complete Chat Conversation Flow', () => {
    test('full conversation from start to end', async () => {
      // 1. Create a new session
      const newSessionRequest = new Request('https://example.com/api/chat/new', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const newSessionResponse = await service.fetch(newSessionRequest, env, ctx);
      expect(newSessionResponse.status).toBe(200);
      
      const { sessionId } = await newSessionResponse.json();
      expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

      // 2. Send first message
      const firstMessageRequest = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Hello, AI!',
          sessionId,
          stream: false
        }),
      });

      const firstMessageResponse = await service.fetch(firstMessageRequest, env, ctx);
      expect(firstMessageResponse.status).toBe(200);
      
      const firstMessageData = await firstMessageResponse.json();
      expect(firstMessageData.response).toContain('Hello');
      expect(firstMessageData.sessionId).toBe(sessionId);

      // 3. Send follow-up message
      const followUpRequest = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'How are you today?',
          sessionId,
          stream: false
        }),
      });

      const followUpResponse = await service.fetch(followUpRequest, env, ctx);
      expect(followUpResponse.status).toBe(200);
      
      const followUpData = await followUpResponse.json();
      expect(followUpData.response).toContain('doing well');

      // 4. Get conversation history
      const historyRequest = new Request(`https://example.com/api/chat/history/${sessionId}`, {
        method: 'GET',
      });

      const historyResponse = await service.fetch(historyRequest, env, ctx);
      expect(historyResponse.status).toBe(200);
      
      const { conversation } = await historyResponse.json();
      expect(conversation.messages).toHaveLength(4); // 2 user + 2 assistant messages
      expect(conversation.messages[0].role).toBe('user');
      expect(conversation.messages[0].content).toBe('Hello, AI!');
      expect(conversation.messages[1].role).toBe('assistant');
      expect(conversation.messages[2].role).toBe('user');
      expect(conversation.messages[2].content).toBe('How are you today?');
      expect(conversation.messages[3].role).toBe('assistant');

      // 5. Verify session info
      const sessionInfoRequest = new Request(`https://example.com/api/sessions/${sessionId}/info`, {
        method: 'GET',
      });

      const sessionInfoResponse = await service.fetch(sessionInfoRequest, env, ctx);
      expect(sessionInfoResponse.status).toBe(200);
      
      const sessionInfo = await sessionInfoResponse.json();
      expect(sessionInfo.exists).toBe(true);
      expect(sessionInfo.messageCount).toBe(4);
    });

    test('streaming conversation flow', async () => {
      // 1. Create session
      const newSessionResponse = await service.fetch(
        new Request('https://example.com/api/chat/new', { method: 'POST' }),
        env,
        ctx
      );
      const { sessionId } = await newSessionResponse.json();

      // 2. Send streaming message
      const streamingRequest = new Request('https://example.com/api/chat/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Tell me something interesting',
          sessionId,
          stream: true
        }),
      });

      const streamingResponse = await service.fetch(streamingRequest, env, ctx);
      expect(streamingResponse.status).toBe(200);
      expect(streamingResponse.headers.get('content-type')).toContain('text/event-stream');

      // 3. Parse streaming response
      const text = await streamingResponse.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      // Should have chunk and complete events
      const events = lines
        .filter(line => line.startsWith('data: '))
        .map(line => JSON.parse(line.slice(6)));

      expect(events.length).toBeGreaterThan(0);
      expect(events.some(event => event.type === 'chunk')).toBe(true);
      expect(events.some(event => event.type === 'complete')).toBe(true);
      
      const completeEvent = events.find(event => event.type === 'complete');
      expect(completeEvent.sessionId).toBe(sessionId);
      expect(completeEvent.conversation).toBeDefined();
    });

    test('multi-session scenario', async () => {
      // Create two different sessions
      const session1Response = await service.fetch(
        new Request('https://example.com/api/chat/new', { method: 'POST' }),
        env,
        ctx
      );
      const { sessionId: session1 } = await session1Response.json();

      const session2Response = await service.fetch(
        new Request('https://example.com/api/chat/new', { method: 'POST' }),
        env,
        ctx
      );
      const { sessionId: session2 } = await session2Response.json();

      expect(session1).not.toBe(session2);

      // Send different messages to each session
      await service.fetch(
        new Request('https://example.com/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Hello from session 1',
            sessionId: session1,
            stream: false
          }),
        }),
        env,
        ctx
      );

      await service.fetch(
        new Request('https://example.com/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Hello from session 2',
            sessionId: session2,
            stream: false
          }),
        }),
        env,
        ctx
      );

      // Verify sessions are independent
      const history1 = await service.fetch(
        new Request(`https://example.com/api/chat/history/${session1}`, { method: 'GET' }),
        env,
        ctx
      );
      const history2 = await service.fetch(
        new Request(`https://example.com/api/chat/history/${session2}`, { method: 'GET' }),
        env,
        ctx
      );

      const conversation1 = await history1.json();
      const conversation2 = await history2.json();

      expect(conversation1.conversation.messages[0].content).toBe('Hello from session 1');
      expect(conversation2.conversation.messages[0].content).toBe('Hello from session 2');
    });
  });

  describe('Session Lifecycle Management', () => {
    test('complete session lifecycle', async () => {
      // Create session
      const createResponse = await service.fetch(
        new Request('https://example.com/api/chat/new', { method: 'POST' }),
        env,
        ctx
      );
      const { sessionId } = await createResponse.json();

      // Send some messages
      await service.fetch(
        new Request('https://example.com/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Test message',
            sessionId,
            stream: false
          }),
        }),
        env,
        ctx
      );

      // Get session stats
      const statsResponse = await service.fetch(
        new Request('https://example.com/api/sessions/stats', { method: 'GET' }),
        env,
        ctx
      );
      const stats = await statsResponse.json();
      expect(stats.activeSessions).toBe(1);
      expect(stats.totalMessages).toBe(2); // 1 user + 1 assistant

      // Extend session
      const extendResponse = await service.fetch(
        new Request(`https://example.com/api/sessions/${sessionId}/extend`, { method: 'POST' }),
        env,
        ctx
      );
      expect(extendResponse.status).toBe(200);

      // Get session info
      const infoResponse = await service.fetch(
        new Request(`https://example.com/api/sessions/${sessionId}/info`, { method: 'GET' }),
        env,
        ctx
      );
      const info = await infoResponse.json();
      expect(info.exists).toBe(true);
      expect(info.messageCount).toBe(2);

      // Delete session
      const deleteResponse = await service.fetch(
        new Request(`https://example.com/api/sessions/${sessionId}`, { method: 'DELETE' }),
        env,
        ctx
      );
      expect(deleteResponse.status).toBe(200);

      // Verify session is deleted
      const deletedInfoResponse = await service.fetch(
        new Request(`https://example.com/api/sessions/${sessionId}/info`, { method: 'GET' }),
        env,
        ctx
      );
      expect(deletedInfoResponse.status).toBe(404);
    });
  });

  describe('Error Flow Testing', () => {
    test('handles invalid session throughout flow', async () => {
      const invalidSessionId = 'invalid-session-id';

      // Try to get history
      const historyResponse = await service.fetch(
        new Request(`https://example.com/api/chat/history/${invalidSessionId}`, { method: 'GET' }),
        env,
        ctx
      );
      expect(historyResponse.status).toBe(404);

      // Try to send message
      const messageResponse = await service.fetch(
        new Request('https://example.com/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Test message',
            sessionId: invalidSessionId,
            stream: false
          }),
        }),
        env,
        ctx
      );
      expect(messageResponse.status).toBe(404);

      // Try to extend session
      const extendResponse = await service.fetch(
        new Request(`https://example.com/api/sessions/${invalidSessionId}/extend`, { method: 'POST' }),
        env,
        ctx
      );
      expect(extendResponse.status).toBe(404);

      // Try to delete session
      const deleteResponse = await service.fetch(
        new Request(`https://example.com/api/sessions/${invalidSessionId}`, { method: 'DELETE' }),
        env,
        ctx
      );
      expect(deleteResponse.status).toBe(404);
    });

    test('handles AI service failure gracefully', async () => {
      // Create session
      const createResponse = await service.fetch(
        new Request('https://example.com/api/chat/new', { method: 'POST' }),
        env,
        ctx
      );
      const { sessionId } = await createResponse.json();

      // Mock AI failure
      env.AI.run.mockRejectedValueOnce(new Error('AI service unavailable'));

      // Try to send message
      const messageResponse = await service.fetch(
        new Request('https://example.com/api/chat/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: 'Test message',
            sessionId,
            stream: false
          }),
        }),
        env,
        ctx
      );

      expect(messageResponse.status).toBe(500);
      const errorData = await messageResponse.json();
      expect(errorData.error).toBe('AI service unavailable');
    });
  });

  describe('Performance and Load Testing', () => {
    test('handles multiple rapid messages', async () => {
      // Create session
      const createResponse = await service.fetch(
        new Request('https://example.com/api/chat/new', { method: 'POST' }),
        env,
        ctx
      );
      const { sessionId } = await createResponse.json();

      // Send multiple messages rapidly
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(
          service.fetch(
            new Request('https://example.com/api/chat/send', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                message: `Message ${i}`,
                sessionId,
                stream: false
              }),
            }),
            env,
            ctx
          )
        );
      }

      const responses = await Promise.all(promises);
      
      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Check final conversation
      const historyResponse = await service.fetch(
        new Request(`https://example.com/api/chat/history/${sessionId}`, { method: 'GET' }),
        env,
        ctx
      );
      const { conversation } = await historyResponse.json();
      expect(conversation.messages).toHaveLength(10); // 5 user + 5 assistant
    });
  });
});