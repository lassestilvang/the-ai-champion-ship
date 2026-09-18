import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ConversationStore } from './conversation-store';
import { Conversation, Message } from '../types/conversation';

// Mock KV Cache
function createMockKvCache() {
  const storage = new Map<string, any>();
  
  return {
    get: vi.fn().mockImplementation(async (key: string) => {
      return storage.get(key) || null;
    }),
    put: vi.fn().mockImplementation(async (key: string, value: string, options?: any) => {
      storage.set(key, value);
      // Simulate TTL by not storing it (just for testing)
      if (options?.expirationTtl) {
        // In real implementation, KV handles TTL automatically
        console.log(`Setting TTL of ${options.expirationTtl}s for key: ${key}`);
      }
    }),
    delete: vi.fn().mockImplementation(async (key: string) => {
      storage.delete(key);
    }),
    list: vi.fn().mockImplementation(async (options?: any) => {
      const prefix = options?.prefix || '';
      const limit = options?.limit || 50;
      
      const keys = Array.from(storage.keys())
        .filter(key => key.startsWith(prefix))
        .slice(0, limit)
        .map(name => ({
          name,
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
}

describe('ConversationStore', () => {
  let conversationStore: ConversationStore;
  let mockKv: any;

  beforeEach(() => {
    mockKv = createMockKvCache();
    conversationStore = new ConversationStore(mockKv);
  });

  describe('Session Management', () => {
    test('generates unique session IDs', () => {
      const sessionId1 = conversationStore.generateSessionId();
      const sessionId2 = conversationStore.generateSessionId();
      
      expect(sessionId1).not.toBe(sessionId2);
      expect(sessionId1).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });

    test('generates unique message IDs', () => {
      const messageId1 = conversationStore.generateMessageId();
      const messageId2 = conversationStore.generateMessageId();
      
      expect(messageId1).not.toBe(messageId2);
      expect(messageId1).toMatch(/^[0-9a-f-]{36}$/); // UUID format
    });
  });

  describe('Conversation Creation', () => {
    test('creates a new conversation', async () => {
      const sessionId = 'test-session-123';
      const conversation = await conversationStore.createConversation(sessionId);
      
      expect(conversation).toBeDefined();
      expect(conversation.sessionId).toBe(sessionId);
      expect(conversation.messages).toEqual([]);
      expect(conversation.createdAt).toBeGreaterThan(0);
      expect(conversation.updatedAt).toBeGreaterThan(0);
      expect(mockKv.put).toHaveBeenCalledWith(
        expect.stringContaining(sessionId),
        expect.any(String),
        expect.objectContaining({ expirationTtl: 24 * 60 * 60 })
      );
    });

    test('stores conversation with correct prefix', async () => {
      const sessionId = 'test-session';
      await conversationStore.createConversation(sessionId);
      
      expect(mockKv.put).toHaveBeenCalledWith(
        `conv:${sessionId}`,
        expect.any(String),
        expect.any(Object)
      );
    });
  });

  describe('Conversation Retrieval', () => {
    test('retrieves existing conversation', async () => {
      const sessionId = 'test-session';
      const originalConversation = await conversationStore.createConversation(sessionId);
      
      const retrievedConversation = await conversationStore.getConversation(sessionId);
      
      expect(retrievedConversation).toEqual(originalConversation);
    });

    test('returns null for non-existent conversation', async () => {
      const conversation = await conversationStore.getConversation('non-existent');
      expect(conversation).toBeNull();
    });

    test('handles corrupted data gracefully', async () => {
      mockKv.get.mockResolvedValueOnce('invalid-json');
      
      const conversation = await conversationStore.getConversation('test-session');
      expect(conversation).toBeNull();
    });
  });

  describe('Message Management', () => {
    test('adds user message to conversation', async () => {
      const sessionId = 'test-session';
      const initialConversation = await conversationStore.createConversation(sessionId);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 1));
      
      const updatedConversation = await conversationStore.addMessage(
        sessionId,
        'user',
        'Hello, AI!'
      );
      
      expect(updatedConversation.messages).toHaveLength(1);
      expect(updatedConversation.messages[0]).toMatchObject({
        role: 'user',
        content: 'Hello, AI!',
        sessionId
      });
      expect(updatedConversation.updatedAt).toBeGreaterThanOrEqual(updatedConversation.createdAt);
    });

    test('adds assistant message to conversation', async () => {
      const sessionId = 'test-session';
      await conversationStore.createConversation(sessionId);
      await conversationStore.addMessage(sessionId, 'user', 'Hello');
      
      const updatedConversation = await conversationStore.addMessage(
        sessionId,
        'assistant',
        'Hello! How can I help you?'
      );
      
      expect(updatedConversation.messages).toHaveLength(2);
      expect(updatedConversation.messages[1]).toMatchObject({
        role: 'assistant',
        content: 'Hello! How can I help you?',
        sessionId
      });
    });

    test('generates title from first user message', async () => {
      const sessionId = 'test-session';
      await conversationStore.createConversation(sessionId);
      
      const longMessage = 'This is a very long first message that should be truncated for the title';
      await conversationStore.addMessage(sessionId, 'user', longMessage);
      
      const conversation = await conversationStore.getConversation(sessionId);
      expect(conversation?.title).toBe('This is a very long first message that should be trun...');
    });

    test('throws error when adding to non-existent conversation', async () => {
      await expect(
        conversationStore.addMessage('non-existent', 'user', 'Hello')
      ).rejects.toThrow('Conversation not found for session: non-existent');
    });
  });

  describe('Session Existence Check', () => {
    test('returns true for existing session', async () => {
      const sessionId = 'test-session';
      await conversationStore.createConversation(sessionId);
      
      const exists = await conversationStore.sessionExists(sessionId);
      expect(exists).toBe(true);
    });

    test('returns false for non-existent session', async () => {
      const exists = await conversationStore.sessionExists('non-existent');
      expect(exists).toBe(false);
    });
  });

  describe('Conversation Deletion', () => {
    test('deletes existing conversation', async () => {
      const sessionId = 'test-session';
      await conversationStore.createConversation(sessionId);
      
      await conversationStore.deleteConversation(sessionId);
      
      const exists = await conversationStore.sessionExists(sessionId);
      expect(exists).toBe(false);
      expect(mockKv.delete).toHaveBeenCalledWith(`conv:${sessionId}`);
    });
  });

  describe('Session Listing', () => {
    test('lists active sessions', async () => {
      // Create multiple conversations
      await conversationStore.createConversation('session-1');
      await conversationStore.createConversation('session-2');
      await conversationStore.createConversation('session-3');
      
      const sessionIds = await conversationStore.listActiveSessions();
      
      expect(sessionIds).toHaveLength(3);
      expect(sessionIds).toContain('session-1');
      expect(sessionIds).toContain('session-2');
      expect(sessionIds).toContain('session-3');
    });

    test('respects limit parameter', async () => {
      // Create more conversations than limit
      for (let i = 0; i < 10; i++) {
        await conversationStore.createConversation(`session-${i}`);
      }
      
      const sessionIds = await conversationStore.listActiveSessions(5);
      expect(sessionIds).toHaveLength(5);
    });

    test('handles empty storage gracefully', async () => {
      const sessionIds = await conversationStore.listActiveSessions();
      expect(sessionIds).toEqual([]);
    });

    test('handles list errors gracefully', async () => {
      mockKv.list.mockRejectedValueOnce(new Error('KV Error'));
      
      const sessionIds = await conversationStore.listActiveSessions();
      expect(sessionIds).toEqual([]);
    });
  });

  describe('Error Handling', () => {
    test('handles KV get errors', async () => {
      mockKv.get.mockRejectedValueOnce(new Error('KV Error'));
      
      const conversation = await conversationStore.getConversation('test-session');
      expect(conversation).toBeNull();
    });

    test('handles KV put errors during create', async () => {
      mockKv.put.mockRejectedValueOnce(new Error('KV Error'));
      
      await expect(
        conversationStore.createConversation('test-session')
      ).rejects.toThrow('KV Error');
    });

    test('handles KV put errors during addMessage', async () => {
      const sessionId = 'test-session';
      await conversationStore.createConversation(sessionId);
      
      mockKv.put.mockRejectedValueOnce(new Error('KV Error'));
      
      await expect(
        conversationStore.addMessage(sessionId, 'user', 'Hello')
      ).rejects.toThrow('KV Error');
    });

    test('handles KV delete errors', async () => {
      mockKv.delete.mockRejectedValueOnce(new Error('KV Error'));
      
      await expect(
        conversationStore.deleteConversation('test-session')
      ).rejects.toThrow('KV Error');
    });
  });

  describe('Data Integrity', () => {
    test('maintains message order', async () => {
      const sessionId = 'test-session';
      await conversationStore.createConversation(sessionId);
      
      // Add multiple messages
      await conversationStore.addMessage(sessionId, 'user', 'First');
      await conversationStore.addMessage(sessionId, 'assistant', 'Response 1');
      await conversationStore.addMessage(sessionId, 'user', 'Second');
      await conversationStore.addMessage(sessionId, 'assistant', 'Response 2');
      
      const conversation = await conversationStore.getConversation(sessionId);
      
      expect(conversation?.messages).toHaveLength(4);
      expect(conversation?.messages[0].content).toBe('First');
      expect(conversation?.messages[1].content).toBe('Response 1');
      expect(conversation?.messages[2].content).toBe('Second');
      expect(conversation?.messages[3].content).toBe('Response 2');
    });

    test('updates timestamps correctly', async () => {
      const sessionId = 'test-session';
      const initialConversation = await conversationStore.createConversation(sessionId);
      
      // Wait a bit to ensure different timestamps
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const updatedConversation = await conversationStore.addMessage(
        sessionId,
        'user',
        'Test message'
      );
      
      expect(updatedConversation.updatedAt).toBeGreaterThan(initialConversation.updatedAt);
      expect(updatedConversation.createdAt).toBe(initialConversation.createdAt);
    });
  });
});