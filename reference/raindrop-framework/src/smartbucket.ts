import { Bucket } from './bucket.js';

/** Search result from RetrieverAgent */
export interface SearchResult {
  /** Unique identifier for the chunk of text */
  chunkSignature?: string;
  /** The actual text content of the search result */
  text?: string;
  /** Key/filename of the source object/document */
  source?: string;
  /** Unique identifier for the payload associated with this result */
  payloadSignature?: string;
  /** Relevance score indicating how well this result matches the search query (higher is better) */
  score?: number;
  /** Vector embedding representation of the text as a Float32Array */
  embed?: Float32Array;
  /** Type classification of the search result */
  type?: string;
}

/** Pagination information */
export interface PaginationInfo {
  /** Total number of results available across all pages */
  total: number;
  /** Current page number */
  page: number;
  /** Number of results per page */
  pageSize: number;
  /** Total number of pages available */
  totalPages: number;
  /** Whether there are more pages available after the current page */
  hasMore: boolean;
}

/** Input for RAG search */
export interface RagSearchInput {
  /** The search query text to find relevant chunks */
  input: string;
  /** Unique identifier for tracking this search request */
  requestId: string;
  /** Optional partition key to scope the search to a specific data partition */
  partition?: string;
}

/** Output from RAG search */
export interface RagSearchOutput {
  /** Array of search results matching the query, ordered by relevance */
  results: SearchResult[];
}

/** Input for document chat */
export interface DocumentChatInput {
  /** Identifier of the document to query against */
  objectId: string;
  /** The question or prompt to ask about the document */
  input: string;
  /** Unique identifier for tracking this chat request */
  requestId: string;
  /** Optional partition key to scope the query to a specific data partition */
  partition?: string;
}

/** Output from document chat */
export interface DocumentChatOutput {
  /** The generated answer based on the document content and user query */
  answer: string;
}

/** Input for supervisor agent */
export interface SearchInput {
  /** The search query text to execute complex search operations */
  input: string;
  /** Optional unique identifier for tracking this search request */
  requestId?: string;
  /** Optional partition key to scope the search to a specific data partition */
  partition?: string;
}

/** Output from supervisor agent */
export interface SearchOutput {
  /** Array of search results matching the query */
  results: SearchResult[];
  /** Pagination metadata for navigating through result sets */
  pagination: PaginationInfo;
}

/** Input for creating page summary */
export interface CreatePageSummaryInput {
  /** Optional unique identifier for the original search request */
  requestId?: string;
  /** Page number to summarize (1-indexed) */
  page: number;
  /** Number of results per page */
  pageSize: number;
  /** Optional partition key to scope the summary to a specific data partition */
  partition?: string;
}

/** Output from creating page summary */
export interface CreatePageSummaryOutput {
  /** AI-generated summary of the search results on the specified page */
  summary: string;
}

/** Input for getting paginated results */
export interface GetPaginatedResultsInput {
  /** Unique identifier of the original search request to paginate */
  requestId: string;
  /** Optional page number to retrieve (defaults to 1) */
  page?: number;
  /** Optional number of results per page (defaults to previous pageSize) */
  pageSize?: number;
  /** Optional partition key to scope the results to a specific data partition */
  partition?: string;
}

/** Output from getting paginated results */
export interface GetPaginatedResultsOutput {
  /** Array of search results for the requested page */
  results: SearchResult[];
  /** Pagination metadata including current page and total pages */
  pagination: PaginationInfo;
}

/** SmartBucket search methods matching RetrieverAgent */
export interface SmartBucketSearch {
  /**
   * Performs complex search with set operations and pagination (maps to runSupervisorAgent)
   * @param input - The search input
   * @returns Promise resolving to search results with pagination
   */
  search(input: SearchInput): Promise<SearchOutput>;

  /**
   * Performs RAG search for chunks/sections within objects (maps to ragSearch)
   * @param input - The RAG search input
   * @returns Promise resolving to RAG search results
   */
  chunkSearch(input: RagSearchInput): Promise<RagSearchOutput>;

  /**
   * Performs document-based chat/Q&A (maps to documentChat)
   * @param input - The document chat input
   * @returns Promise resolving to chat response
   */
  documentChat(input: DocumentChatInput): Promise<DocumentChatOutput>;

  /**
   * Gets paginated results from a previous search
   * @param input - The pagination input
   * @returns Promise resolving to paginated results
   */
  getPaginatedResults(input: GetPaginatedResultsInput): Promise<GetPaginatedResultsOutput>;
}

/**
 * Interface for smart bucket operations that extends basic bucket functionality.
 *
 * Note: content types supported for indexing are only text/plain,
 * application/pdf and image types. Formats such as markdown should be
 * `put` into the bucket with contentType "text/plain".
 */
export interface SmartBucket extends Bucket, SmartBucketSearch {}
