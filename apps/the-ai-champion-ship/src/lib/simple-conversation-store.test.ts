import { describe, test, expect, beforeEach, vi } from 'vitest';
import { ConversationStore } from './conversation-store';

describe('ConversationStore - Simple Working Tests', () => {
  let conversationStore: ConversationStore;
  let mockKv: any;

  beforeEach(() => {
    const storage = new Map<string, string>();
    
    mockKv = {
      get: vi.fn().mockImplementation(async (key: string) => storage.get(key) || null),
      put: vi.fn().mockImplementation(async (key: string, value: string) => storage.set(key, value)),
      delete: vi.fn().mockImplementation(async (key: string) => storage.delete(key)),
      list: vi.fn().mockImplementation(async () => ({
        list_complete: true,
        keys: Array.from(storage.keys()).map(name => ({ name })),
        cacheStatus: null
      }))
    };

    conversationStore = new ConversationStore(mockKv);
  });

  test('generates unique session IDs', () => {
    const sessionId1 = conversationStore.createConversation('test-session-1');
    const sessionId2 = conversationStore.createConversation('test-session-2');
    
    expect(sessionId1).resolves.toBeDefined();
    expect(sessionId2).resolves.toBeDefined();
  });

  test('can create and retrieve conversation', async () => {
    const sessionId = 'test-session';
    const conversation = await conversationStore.createConversation(sessionId);
    
    expect(conversation.sessionId).toBe(sessionId);
    expect(conversation.messages).toEqual([]);
    
    const retrieved = await conversationStore.getConversation(sessionId);
    expect(retrieved?.sessionId).toBe(sessionId);
  });

  test('can add messages to conversation', async () => {
    const sessionId = 'test-session';
    await conversationStore.createConversation(sessionId);
    
    const updated = await conversationStore.addMessage(sessionId, 'user', 'Hello AI!');
    expect(updated.messages).toHaveLength(1);
    expect(updated.messages[0].content).toBe('Hello AI!');
    expect(updated.messages[0].role).toBe('user');
  });

  test('handles session existence check', async () => {
    const sessionId = 'test-session';
    
    // Should not exist initially
    let exists = await conversationStore.sessionExists(sessionId);
    expect(exists).toBe(false);
    
    // Create session
    await conversationStore.createConversation(sessionId);
    
    // Should exist now
    exists = await conversationStore.sessionExists(sessionId);
    expect(exists).toBe(true);
  });

  test('can delete conversation', async () => {
    const sessionId = 'test-session';
    await conversationStore.createConversation(sessionId);
    
    // Verify it exists
    let exists = await conversationStore.sessionExists(sessionId);
    expect(exists).toBe(true);
    
    // Delete it
    await conversationStore.deleteConversation(sessionId);
    
    // Verify it's gone
    exists = await conversationStore.sessionExists(sessionId);
    expect(exists).toBe(false);
  });
});