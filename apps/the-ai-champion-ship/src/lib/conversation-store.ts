import { KvCache } from '@liquidmetal-ai/raindrop-framework';
import { Conversation, Message } from '../types/conversation';

export class ConversationStore {
  private kv: KvCache;
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds
  private readonly CONVERSATION_PREFIX = 'conv:';
  private readonly SESSION_PREFIX = 'session:';

  constructor(kv: KvCache) {
    this.kv = kv;
  }

  /**
   * Generate a unique session ID
   */
  generateSessionId(): string {
    return crypto.randomUUID();
  }

  /**
   * Generate a unique message ID
   */
  generateMessageId(): string {
    return crypto.randomUUID();
  }

  /**
   * Create a new conversation session
   */
  async createConversation(sessionId: string): Promise<Conversation> {
    const now = Date.now();
    const conversation: Conversation = {
      id: this.generateSessionId(),
      sessionId,
      messages: [],
      createdAt: now,
      updatedAt: now
    };

    await this.kv.put(
      `${this.CONVERSATION_PREFIX}${sessionId}`,
      JSON.stringify(conversation),
      { expirationTtl: this.SESSION_TTL }
    );

    return conversation;
  }

  /**
   * Get conversation by session ID
   */
  async getConversation(sessionId: string): Promise<Conversation | null> {
    try {
      const result = await this.kv.get(`${this.CONVERSATION_PREFIX}${sessionId}`);
      if (!result) return null;

      return JSON.parse(result) as Conversation;
    } catch (error) {
      console.error('Failed to get conversation:', error);
      return null;
    }
  }

  /**
   * Add a message to a conversation
   */
  async addMessage(
    sessionId: string,
    role: 'user' | 'assistant',
    content: string
  ): Promise<Conversation> {
    const conversation = await this.getConversation(sessionId);
    if (!conversation) {
      throw new Error(`Conversation not found for session: ${sessionId}`);
    }

    const message: Message = {
      id: this.generateMessageId(),
      role,
      content,
      timestamp: Date.now(),
      sessionId
    };

    conversation.messages.push(message);
    conversation.updatedAt = Date.now();

    // Generate title from first user message if not set
    if (!conversation.title && role === 'user' && conversation.messages.length === 1) {
      conversation.title = content.slice(0, 50) + (content.length > 50 ? '...' : '');
    }

    await this.kv.put(
      `${this.CONVERSATION_PREFIX}${sessionId}`,
      JSON.stringify(conversation),
      { expirationTtl: this.SESSION_TTL }
    );

    return conversation;
  }

  /**
   * Delete a conversation
   */
  async deleteConversation(sessionId: string): Promise<void> {
    await this.kv.delete(`${this.CONVERSATION_PREFIX}${sessionId}`);
  }

  /**
   * List all active sessions (limited to recent ones for performance)
   */
  async listActiveSessions(limit: number = 50): Promise<string[]> {
    try {
      const list = await this.kv.list({ prefix: this.CONVERSATION_PREFIX, limit });
      return list.keys
        .map(key => key.name.replace(this.CONVERSATION_PREFIX, ''))
        .filter(Boolean);
    } catch (error) {
      console.error('Failed to list sessions:', error);
      return [];
    }
  }

  /**
   * Check if a session exists
   */
  async sessionExists(sessionId: string): Promise<boolean> {
    const result = await this.kv.get(`${this.CONVERSATION_PREFIX}${sessionId}`);
    return result !== null;
  }
}