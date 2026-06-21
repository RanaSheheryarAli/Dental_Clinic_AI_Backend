export interface IngestDocumentInput {
  title: string;
  content: string;
  source?: string;
}

export interface IngestDocumentResult {
  docId: string;
  chunks: number;
}

export interface RagSearchInput {
  query: string;
  topK?: number;
}

export interface RagSearchChunk {
  docId?: string;
  title?: string;
  source?: string;
  content: string;
  score: number;
}

export interface RagSearchResult {
  chunks: RagSearchChunk[];
}
