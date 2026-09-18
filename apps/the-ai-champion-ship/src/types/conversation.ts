// Conversation and message types for the AI chat application

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  sessionId: string;
}

export interface Conversation {
  id: string;
  sessionId: string;
  messages: Message[];
  createdAt: number;
  updatedAt: number;
  title?: string;
}

export interface ChatRequest {
  message: string;
  sessionId?: string;
  stream?: boolean;
  enableVoice?: boolean;
}

export interface ChatResponse {
  messageId: string;
  sessionId: string;
  response: string;
  conversation: Conversation;
}

export interface NewSessionResponse {
  sessionId: string;
  conversation: Conversation;
}