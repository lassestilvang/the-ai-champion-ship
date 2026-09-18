import { describe, test, expect, beforeEach, vi } from 'vitest';
import { SessionManager } from './session-manager';
import { ConversationStore } from './conversation-store';
import { Conversation } from '../types/conversation';

// Mock ConversationStore
function createMockConversationStore() {
  const conversations = new Map<string, Conversation>();
  
  return {
    generateSessionId: vi.fn().mockImplementation(() => crypto.randomUUID()),
    generateMessageId: vi.fn().mockImplementation(() => crypto.randomUUID()),
    createConversation: vi.fn().mockImplementation(async (sessionId: string) => {
      const conversation: Conversation = {
        id: crypto.randomUUID(),
        sessionId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      conversations.set(sessionId, conversation);
      return conversation;
    }),
    getConversation: vi.fn().mockImplementation(async (sessionId: string) => {
      return conversations.get(sessionId) || null;
    }),
    addMessage: vi.fn().mockImplementation(async (sessionId: string, role: string, content: string) => {
      const conversation = conversations.get(sessionId);
      if (!conversation) throw new Error(`Conversation not found for session: ${sessionId}`);
      
      const message = {
        id: crypto.randomUUID(),
        role: role as 'user' | 'assistant',
        content,
        timestamp: Date.now(),
        sessionId
      };
      
      conversation.messages.push(message);
      conversation.updatedAt = Date.now();
      return conversation;
    }),
    deleteConversation: vi.fn().mockImplementation(async (sessionId: string) => {
      conversations.delete(sessionId);
    }),
    listActiveSessions: vi.fn().mockImplementation(async (limit?: number) => {
      const sessions = Array.from(conversations.keys()).slice(0, limit || 50);
      return sessions;
    }),
    sessionExists: vi.fn().mockImplementation(async (sessionId: string) => {
      return conversations.has(sessionId);
    })
  };
}

describe('SessionManager', () => {
  let sessionManager: SessionManager;
  let mockConversationStore: ConversationStore;
  let mockKv: any;

  beforeEach(() => {
    mockKv = {}; // KV is passed to ConversationStore, we mock the store directly
    mockConversationStore = createMockConversationStore() as any;
    sessionManager = new SessionManager(mockKv);
    // Replace the internal store with our mock
    (sessionManager as any).conversationStore = mockConversationStore;
  });

  describe('Session Statistics', () => {
    test('calculates stats for empty sessions', async () => {
      const stats = await sessionManager.getSessionStats();
      
      expect(stats).toEqual({
        activeSessions: 0,
        totalMessages: 0,
        averageMessagesPerSession: 0
      });
    });

    test('calculates stats for active sessions', async () => {
      // Create sessions with different message counts
      const session1 = await mockConversationStore.createConversation('session-1');
      await mockConversationStore.addMessage('session-1', 'user', 'Hello');
      await mockConversationStore.addMessage('session-1', 'assistant', 'Hi there!');
      
      const session2 = await mockConversationStore.createConversation('session-2');
      await mockConversationStore.addMessage('session-2', 'user', 'Question');
      
      const stats = await sessionManager.getSessionStats();
      
      expect(stats.activeSessions).toBe(2);
      expect(stats.totalMessages).toBe(3);
      expect(stats.averageMessagesPerSession).toBe(1.5);
    });

    test('handles errors in stats calculation', async () => {
      mockConversationStore.listActiveSessions.mockRejectedValueOnce(new Error('KV Error'));
      
      const stats = await sessionManager.getSessionStats();
      
      expect(stats).toEqual({
        activeSessions: 0,
        totalMessages: 0,
        averageMessagesPerSession: 0
      });
    });

    test('handles missing conversations gracefully', async () => {
      mockConversationStore.listActiveSessions.mockResolvedValueOnce(['session-1', 'session-2']);
      mockConversationStore.getConversation.mockResolvedValueOnce(null); // session-1 missing
      mockConversationStore.getConversation.mockResolvedValueOnce(null); // session-2 missing
      
      const stats = await sessionManager.getSessionStats();
      
      expect(stats).toEqual({
        activeSessions: 2,
        totalMessages: 0,
        averageMessagesPerSession: 0
      });
    });
  });

  describe('Session Cleanup', () => {
    test('cleans up expired sessions', async () => {
      const now = Date.now();
      const oldTimestamp = now - (25 * 60 * 60 * 1000); // 25 hours ago
      
      // Create old session
      const oldConversation: Conversation = {
        id: 'old-conv',
        sessionId: 'old-session',
        messages: [{ id: '1', role: 'user', content: 'Old message', timestamp: oldTimestamp, sessionId: 'old-session' }],
        createdAt: oldTimestamp,
        updatedAt: oldTimestamp
      };
      
      // Create new session
      const newConversation = await mockConversationStore.createConversation('new-session');
      
      mockConversationStore.listActiveSessions.mockResolvedValueOnce(['old-session', 'new-session']);
      mockConversationStore.getConversation.mockImplementation(async (sessionId: string) => {
        if (sessionId === 'old-session') return oldConversation;
        if (sessionId === 'new-session') return newConversation;
        return null;
      });
      
      const result = await sessionManager.cleanupExpiredSessions();
      
      expect(result.deletedSessions).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockConversationStore.deleteConversation).toHaveBeenCalledWith('old-session');
    });

    test('handles cleanup errors', async () => {
      mockConversationStore.listActiveSessions.mockRejectedValueOnce(new Error('KV Error'));
      
      const result = await sessionManager.cleanupExpiredSessions();
      
      expect(result.deletedSessions).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to list sessions for cleanup');
    });

    test('handles individual session cleanup errors', async () => {
      mockConversationStore.listActiveSessions.mockResolvedValueOnce(['session-1', 'session-2']);
      mockConversationStore.deleteConversation.mockRejectedValueOnce(new Error('Delete Error'));
      
      const result = await sessionManager.cleanupExpiredSessions();
      
      expect(result.deletedSessions).toBe(1); // session-2 succeeded
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Failed to cleanup session session-1');
    });
  });

  describe('Session Extension', () => {
    test('extends existing session', async () => {
      const sessionId = 'test-session';
      await mockConversationStore.createConversation(sessionId);
      
      const success = await sessionManager.extendSession(sessionId);
      
      expect(success).toBe(true);
      expect(mockConversationStore.addMessage).toHaveBeenCalledWith(
        sessionId,
        'assistant',
        'Session refreshed'
      );
    });

    test('fails to extend non-existent session', async () => {
      const success = await sessionManager.extendSession('non-existent');
      
      expect(success).toBe(false);
    });

    test('handles extension errors', async () => {
      mockConversationStore.getConversation.mockRejectedValueOnce(new Error('KV Error'));
      
      const success = await sessionManager.extendSession('test-session');
      
      expect(success).toBe(false);
    });
  });

  describe('Session Info', () => {
    test('returns session information', async () => {
      const sessionId = 'test-session';
      const now = Date.now();
      const createdAt = now - 60000; // 1 minute ago
      const updatedAt = now - 30000; // 30 seconds ago
      
      const conversation: Conversation = {
        id: 'conv-1',
        sessionId,
        messages: [
          { id: 'msg-1', role: 'user', content: 'Hello', timestamp: createdAt + 1000, sessionId },
          { id: 'msg-2', role: 'assistant', content: 'Hi', timestamp: updatedAt + 1000, sessionId }
        ],
        createdAt,
        updatedAt
      };
      
      mockConversationStore.getConversation.mockResolvedValueOnce(conversation);
      
      const sessionInfo = await sessionManager.getSessionInfo(sessionId);
      
      expect(sessionInfo).toBeDefined();
      expect(sessionInfo!.exists).toBe(true);
      expect(sessionInfo!.age).toBeGreaterThan(50000); // ~60 seconds
      expect(sessionInfo!.messageCount).toBe(2);
      expect(sessionInfo!.lastActivity).toBeLessThan(35000); // ~30 seconds
      expect(sessionInfo!.expiresAt).toBeGreaterThan(now);
    });

    test('returns null for non-existent session', async () => {
      mockConversationStore.getConversation.mockResolvedValueOnce(null);
      
      const sessionInfo = await sessionManager.getSessionInfo('non-existent');
      
      expect(sessionInfo).toBeNull();
    });

    test('handles session info errors', async () => {
      mockConversationStore.getConversation.mockRejectedValueOnce(new Error('KV Error'));
      
      const sessionInfo = await sessionManager.getSessionInfo('test-session');
      
      expect(sessionInfo).toBeNull();
    });
  });

  describe('Edge Cases', () => {
    test('handles conversation with no messages', async () => {
      const sessionId = 'empty-session';
      const conversation: Conversation = {
        id: 'conv-1',
        sessionId,
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      
      mockConversationStore.getConversation.mockResolvedValueOnce(conversation);
      
      const sessionInfo = await sessionManager.getSessionInfo(sessionId);
      
      expect(sessionInfo!.messageCount).toBe(0);
    });

    test('handles very old sessions', async () => {
      const veryOldTimestamp = Date.now() - (48 * 60 * 60 * 1000); // 48 hours ago
      
      const oldConversation: Conversation = {
        id: 'old-conv',
        sessionId: 'very-old-session',
        messages: [{ id: '1', role: 'user', content: 'Ancient message', timestamp: veryOldTimestamp, sessionId: 'very-old-session' }],
        createdAt: veryOldTimestamp,
        updatedAt: veryOldTimestamp
      };
      
      mockConversationStore.listActiveSessions.mockResolvedValueOnce(['very-old-session']);
      mockConversationStore.getConversation.mockResolvedValueOnce(oldConversation);
      
      const result = await sessionManager.cleanupExpiredSessions();
      
      expect(result.deletedSessions).toBe(1);
    });

    test('handles session with future timestamp', async () => {
      const futureTimestamp = Date.now() + 60000; // 1 minute in future
      
      const futureConversation: Conversation = {
        id: 'future-conv',
        sessionId: 'future-session',
        messages: [{ id: '1', role: 'user', content: 'Future message', timestamp: futureTimestamp, sessionId: 'future-session' }],
        createdAt: futureTimestamp,
        updatedAt: futureTimestamp
      };
      
      mockConversationStore.listActiveSessions.mockResolvedValueOnce(['future-session']);
      mockConversationStore.getConversation.mockResolvedValueOnce(futureConversation);
      
      const result = await sessionManager.cleanupExpiredSessions();
      
      // Future sessions should not be cleaned up
      expect(result.deletedSessions).toBe(0);
    });
  });
});