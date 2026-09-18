import { KvCache } from '@liquidmetal-ai/raindrop-framework';
import { ConversationStore } from './conversation-store';

export class SessionManager {
  private conversationStore: ConversationStore;
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000; // 1 hour in milliseconds
  private readonly SESSION_TTL = 24 * 60 * 60; // 24 hours in seconds

  constructor(kv: KvCache) {
    this.conversationStore = new ConversationStore(kv);
  }

  /**
   * Get active session statistics
   */
  async getSessionStats(): Promise<{
    activeSessions: number;
    totalMessages: number;
    averageMessagesPerSession: number;
  }> {
    try {
      const sessionIds = await this.conversationStore.listActiveSessions(100);
      let totalMessages = 0;

      for (const sessionId of sessionIds) {
        const conversation = await this.conversationStore.getConversation(sessionId);
        if (conversation) {
          totalMessages += conversation.messages.length;
        }
      }

      const activeSessions = sessionIds.length;
      const averageMessagesPerSession = activeSessions > 0 ? totalMessages / activeSessions : 0;

      return {
        activeSessions,
        totalMessages,
        averageMessagesPerSession: Math.round(averageMessagesPerSession * 100) / 100
      };
    } catch (error) {
      console.error('Failed to get session stats:', error);
      return {
        activeSessions: 0,
        totalMessages: 0,
        averageMessagesPerSession: 0
      };
    }
  }

  /**
   * Clean up expired sessions (manual cleanup - KV handles automatic expiration)
   */
  async cleanupExpiredSessions(): Promise<{
    deletedSessions: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let deletedSessions = 0;

    try {
      const sessionIds = await this.conversationStore.listActiveSessions(200);
      const now = Date.now();
      const expirationThreshold = now - (this.SESSION_TTL * 1000);

      for (const sessionId of sessionIds) {
        try {
          const conversation = await this.conversationStore.getConversation(sessionId);
          if (conversation && conversation.updatedAt < expirationThreshold) {
            await this.conversationStore.deleteConversation(sessionId);
            deletedSessions++;
          }
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          errors.push(`Failed to cleanup session ${sessionId}: ${errorMessage}`);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      errors.push(`Failed to list sessions for cleanup: ${errorMessage}`);
    }

    return { deletedSessions, errors };
  }

  /**
   * Extend session TTL
   */
  async extendSession(sessionId: string): Promise<boolean> {
    try {
      const conversation = await this.conversationStore.getConversation(sessionId);
      if (!conversation) return false;

      // Update the conversation to refresh TTL
      conversation.updatedAt = Date.now();
      await this.conversationStore.addMessage(sessionId, 'assistant', 'Session refreshed');
      
      // Remove the refresh message
      conversation.messages.pop();
      
      return true;
    } catch (error) {
      console.error('Failed to extend session:', error);
      return false;
    }
  }

  /**
   * Get session info
   */
  async getSessionInfo(sessionId: string): Promise<{
    exists: boolean;
    age: number;
    messageCount: number;
    lastActivity: number;
    expiresAt: number;
  } | null> {
    try {
      const conversation = await this.conversationStore.getConversation(sessionId);
      if (!conversation) return null;

      const now = Date.now();
      const age = now - conversation.createdAt;
      const lastActivity = now - conversation.updatedAt;
      const expiresAt = conversation.updatedAt + (this.SESSION_TTL * 1000);

      return {
        exists: true,
        age,
        messageCount: conversation.messages.length,
        lastActivity,
        expiresAt
      };
    } catch (error) {
      console.error('Failed to get session info:', error);
      return null;
    }
  }
}