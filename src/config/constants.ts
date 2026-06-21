export const API_PREFIX = '/api';
export const DEFAULT_TOP_K = 5;
// Higher than a plain chat limit because a single booking turn can add several
// tool_use/tool_result messages that must stay in the window for context.
export const MESSAGE_HISTORY_LIMIT = 20;

/** Minimum hybrid relevance score for a chunk to be treated as a confident match. */
export const RAG_MIN_SCORE = 0.25;
