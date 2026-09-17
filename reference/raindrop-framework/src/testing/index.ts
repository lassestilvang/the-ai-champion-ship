/**
 * Testing utilities for Raindrop applications
 *
 * This module provides mock implementations and factory functions for all Raindrop bindings
 * for use in tests. Import these in your test files to create isolated
 * test environments without needing real Cloudflare Workers infrastructure.
 *
 * @example
 * ```typescript
 * import { createMockEnv, createMockActorState } from '@liquidmetal-ai/raindrop-framework/testing';
 *
 * test('my handler', async () => {
 *   const env = createMockEnv();
 *   const state = createMockActorState();
 *   const actor = new MyActor(state, env);
 *   // ... test actor methods
 * });
 * ```
 */

import { vi } from 'vitest';
import type {
  ActorId,
  ActorState,
  ActorStorage,
  ExecutionContext,
  KvCache,
  Logger,
  Tracer,
  Bucket,
  Queue,
  Message,
  MessageBatch,
  App,
  LogFields,
  LogLevel,
  LogMessage,
} from '../index.js';

// ============================================================================
// ActorStorage Mock
// ============================================================================

/**
 * In-memory implementation of ActorStorage for testing
 */
export class MockActorStorage implements ActorStorage {
  private data = new Map<string, unknown>();
  private alarm: number | null = null;

  async get<T = unknown>(key: string): Promise<T | undefined>;
  async get<T = unknown>(keys: string[]): Promise<Map<string, T>>;
  async get<T = unknown>(keyOrKeys: string | string[]): Promise<T | undefined | Map<string, T>> {
    if (Array.isArray(keyOrKeys)) {
      const result = new Map<string, T>();
      for (const key of keyOrKeys) {
        const value = this.data.get(key) as T | undefined;
        if (value !== undefined) {
          result.set(key, value);
        }
      }
      return result;
    }
    return this.data.get(keyOrKeys) as T | undefined;
  }

  async list<T = unknown>(options?: {
    start?: string;
    startAfter?: string;
    end?: string;
    prefix?: string;
    reverse?: boolean;
    limit?: number;
  }): Promise<Map<string, T>> {
    const result = new Map<string, T>();
    const entries = Array.from(this.data.entries()) as [string, T][];

    // Sort entries by key
    entries.sort(([a], [b]) => a.localeCompare(b));

    let filteredEntries = entries;

    // Apply filters
    if (options?.prefix) {
      filteredEntries = filteredEntries.filter(([key]) => key.startsWith(options.prefix!));
    }

    if (options?.start) {
      filteredEntries = filteredEntries.filter(([key]) => key >= options.start!);
    }

    if (options?.startAfter) {
      filteredEntries = filteredEntries.filter(([key]) => key > options.startAfter!);
    }

    if (options?.end) {
      filteredEntries = filteredEntries.filter(([key]) => key <= options.end!);
    }

    if (options?.reverse) {
      filteredEntries.reverse();
    }

    if (options?.limit) {
      filteredEntries = filteredEntries.slice(0, options.limit);
    }

    for (const [key, value] of filteredEntries) {
      result.set(key, value);
    }

    return result;
  }

  async put<T>(key: string, value: T): Promise<void>;
  async put<T>(entries: Record<string, T>): Promise<void>;
  async put<T>(keyOrEntries: string | Record<string, T>, value?: T): Promise<void> {
    if (typeof keyOrEntries === 'string') {
      this.data.set(keyOrEntries, value);
    } else {
      for (const [key, val] of Object.entries(keyOrEntries)) {
        this.data.set(key, val);
      }
    }
  }

  async delete(key: string): Promise<boolean>;
  async delete(keys: string[]): Promise<number>;
  async delete(keyOrKeys: string | string[]): Promise<boolean | number> {
    if (Array.isArray(keyOrKeys)) {
      let count = 0;
      for (const key of keyOrKeys) {
        if (this.data.delete(key)) {
          count++;
        }
      }
      return count;
    }
    return this.data.delete(keyOrKeys);
  }

  async deleteAll(): Promise<void> {
    this.data.clear();
  }

  async getAlarm(): Promise<number | null> {
    return this.alarm;
  }

  async setAlarm(scheduledTime: number | Date): Promise<void> {
    this.alarm = typeof scheduledTime === 'number' ? scheduledTime : scheduledTime.getTime();
  }

  async deleteAlarm(): Promise<void> {
    this.alarm = null;
  }

  // Test helpers
  clear(): void {
    this.data.clear();
    this.alarm = null;
  }

  getAllData(): Map<string, unknown> {
    return new Map(this.data);
  }
}

// ============================================================================
// ActorState Mock
// ============================================================================

/**
 * Mock implementation of ActorState for testing
 */
export class MockActorState implements ActorState {
  readonly storage: MockActorStorage;
  readonly id: ActorId;
  private waitUntilPromises: Promise<unknown>[] = [];

  constructor(id?: string, storage?: MockActorStorage) {
    this.storage = storage || new MockActorStorage();
    this.id = {
      toString: () => id || 'mock-actor-id',
      equals: (other: ActorId) => other.toString() === this.id.toString(),
      name: id,
    };
  }

  waitUntil(promise: Promise<unknown>): void {
    this.waitUntilPromises.push(promise);
  }

  async blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T> {
    return callback();
  }

  // Test helper to wait for all waitUntil promises
  async flushWaitUntil(): Promise<void> {
    await Promise.all(this.waitUntilPromises);
    this.waitUntilPromises = [];
  }
}

// ============================================================================
// ExecutionContext Mock
// ============================================================================

/**
 * Mock implementation of ExecutionContext for testing
 */
export class MockExecutionContext implements ExecutionContext {
  private promises: Promise<unknown>[] = [];

  waitUntil(promise: Promise<unknown>): void {
    this.promises.push(promise);
  }

  // Test helper to wait for all waitUntil promises
  async flushWaitUntil(): Promise<void> {
    await Promise.all(this.promises);
    this.promises = [];
  }
}

// ============================================================================
// Mock Factory Functions (using vi.fn())
// ============================================================================

/**
 * Creates a mock KvCache using vitest mocks
 * All methods are vi.fn() which can be customized per test
 */
export function createMockKvCache(): KvCache {
  return {
    get: vi.fn().mockResolvedValue(null),
    getWithMetadata: vi.fn().mockResolvedValue({ value: null, metadata: null, cacheStatus: null }),
    put: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ keys: [], list_complete: true, cacheStatus: null }),
    clear: vi.fn().mockResolvedValue({ deleted: 0, total: 0 }),
  } as unknown as KvCache;
}

/**
 * Creates a mock Logger using vitest mocks
 * All methods are vi.fn() which can be customized per test
 */
export function createMockLogger(): Logger {
  const mockLogger = {
    logs: [] as Array<{ level: string; message: string; fields?: LogFields }>,
    with: vi.fn(),
    log: vi.fn(),
    logAtLevel: vi.fn(),
    message: vi.fn(),
    messageAtLevel: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    withError: vi.fn(),
  };

  // Make with() and withError() return the logger for chaining
  mockLogger.with.mockReturnValue(mockLogger);
  mockLogger.withError.mockReturnValue(mockLogger);

  // Capture logs in the logs array for testing
  mockLogger.log.mockImplementation((message: string, fields?: LogFields) => {
    mockLogger.logs.push({ level: 'log', message, fields });
  });
  mockLogger.logAtLevel.mockImplementation((level: LogLevel, message: string, fields?: LogFields) => {
    mockLogger.logs.push({ level, message, fields });
  });
  mockLogger.debug.mockImplementation((message: string, fields?: LogFields) => {
    mockLogger.logs.push({ level: 'debug', message, fields });
  });
  mockLogger.info.mockImplementation((message: string, fields?: LogFields) => {
    mockLogger.logs.push({ level: 'info', message, fields });
  });
  mockLogger.warn.mockImplementation((message: string, fields?: LogFields) => {
    mockLogger.logs.push({ level: 'warn', message, fields });
  });
  mockLogger.error.mockImplementation((message: string, fields?: LogFields) => {
    mockLogger.logs.push({ level: 'error', message, fields });
  });

  // message() and messageAtLevel() return LogMessage objects
  mockLogger.message.mockImplementation((message: string, fields?: LogFields): LogMessage => ({
    level: 'info' as LogLevel,
    message,
    fields: fields || {},
  }));
  mockLogger.messageAtLevel.mockImplementation((level: LogLevel, message: string, fields?: LogFields): LogMessage => ({
    level,
    message,
    fields: fields || {},
  }));

  return mockLogger as unknown as Logger;
}

/**
 * Creates a mock Tracer using vitest mocks
 */
export function createMockTracer(): Tracer {
  const mockTracer = {
    spans: [] as Array<{ name: string; event: Record<string, unknown> }>,
    span: vi.fn(),
  };

  // Implement span to capture spans and execute the function
  mockTracer.span.mockImplementation(async <T>(
    name: string,
    fn: (event: Record<string, unknown>) => Promise<T>,
  ): Promise<T> => {
    const event: Record<string, unknown> = {};
    mockTracer.spans.push({ name, event });
    return fn(event);
  });

  return mockTracer as unknown as Tracer;
}

/**
 * Creates a mock Bucket using vitest mocks
 */
export function createMockBucket(): Bucket {
  return {
    head: vi.fn().mockResolvedValue(null),
    get: vi.fn().mockResolvedValue(null),
    put: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue(undefined),
    list: vi.fn().mockResolvedValue({ objects: [], truncated: false, delimitedPrefixes: [] }),
  } as unknown as Bucket;
}

/**
 * Creates a mock Queue using vitest mocks
 * Includes helpers for creating mock Message and MessageBatch objects
 */
export function createMockQueue<Body = unknown>(): Queue<Body> & {
  createMockMessage: (body: Body, id?: string) => Message<Body>;
  createMockMessageBatch: (bodies: Body[], queueName?: string) => MessageBatch<Body>;
} {
  const mockQueue = {
    send: vi.fn().mockResolvedValue(undefined),
    sendBatch: vi.fn().mockResolvedValue(undefined),

    // Helper to create mock Message for testing queue consumers
    createMockMessage(body: Body, id?: string): Message<Body> {
      return {
        id: id || `msg-${Date.now()}-${Math.random()}`,
        timestamp: new Date(),
        body,
        attempts: 1,
        retry: vi.fn(),
        ack: vi.fn(),
      };
    },

    // Helper to create mock MessageBatch for testing batch queue consumers
    createMockMessageBatch(bodies: Body[], queueName = 'test-queue'): MessageBatch<Body> {
      const messages = bodies.map((body, i) => mockQueue.createMockMessage(body, `msg-${i}`));
      return {
        messages,
        queue: queueName,
        retryAll: vi.fn(),
        ackAll: vi.fn(),
      };
    },
  };

  return mockQueue as unknown as Queue<Body> & {
    createMockMessage: (body: Body, id?: string) => Message<Body>;
    createMockMessageBatch: (bodies: Body[], queueName?: string) => MessageBatch<Body>;
  };
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Creates a mock Env object with all standard bindings
 *
 * @param overrides Partial Env object to override defaults
 * @returns Mock Env object for testing
 *
 * @example
 * ```typescript
 * const env = createMockEnv({
 *   MY_SMARTBUCKET: createMockBucket(),
 *   MY_CACHE: createMockKvCache(),
 * });
 * ```
 */
export function createMockEnv<T extends Record<string, unknown> = Record<string, unknown>>(
  overrides?: T,
): {
  _raindrop: { app: App };
  logger: Logger;
  tracer: Tracer;
  mem: KvCache;
} & T {
  const baseEnv = {
    _raindrop: {
      app: {
        organizationId: 'test-org',
        applicationName: 'test-app',
        versionId: 'test-version',
        scriptName: 'test-script',
        visibility: 'public',
      },
    },
    logger: createMockLogger(),
    tracer: createMockTracer(),
    mem: createMockKvCache(),
  };

  return { ...baseEnv, ...overrides } as typeof baseEnv & T;
}

/**
 * Creates a mock ActorState for testing Actor handlers
 *
 * @param id Optional actor ID (defaults to 'mock-actor-id')
 * @param storage Optional MockActorStorage instance
 * @returns MockActorState instance
 *
 * @example
 * ```typescript
 * const state = createMockActorState('my-actor-1');
 * const actor = new MyActor(state, env);
 * ```
 */
export function createMockActorState(id?: string, storage?: MockActorStorage): MockActorState {
  return new MockActorState(id, storage);
}

/**
 * Creates a mock ExecutionContext for testing Service and Task handlers
 *
 * @returns MockExecutionContext instance
 *
 * @example
 * ```typescript
 * const ctx = createMockExecutionContext();
 * const service = new MyService(ctx, env);
 * ```
 */
export function createMockExecutionContext(): MockExecutionContext {
  return new MockExecutionContext();
}
