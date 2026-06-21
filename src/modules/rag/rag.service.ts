import fs from 'node:fs';
import path from 'node:path';
import { PDFParse } from 'pdf-parse';
import { pipeline } from '@xenova/transformers';
import { env } from '../../config/env.js';
import { DEFAULT_TOP_K } from '../../config/constants.js';
import { logger } from '../../shared/utils/logger.js';
import type { IngestDocumentInput, IngestDocumentResult, RagSearchChunk, RagSearchInput, RagSearchResult } from './rag.types.js';

interface KnowledgeDocument {
  id: string;
  title: string;
  content: string;
  source?: string;
}

interface KnowledgeChunkRecord extends RagSearchChunk {
  docId: string;
  embedding: number[] | null;
}

/**
 * Minimal structural type for the Transformers.js feature-extraction pipeline so we do not
 * depend on the library's exact exported generics (which vary across versions).
 */
type FeatureExtractor = (
  input: string | string[],
  options: { pooling: 'mean'; normalize: boolean }
) => Promise<{ tolist: () => number[][] }>;

function normalizeWord(word: string) {
  return word.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function tokenize(text: string) {
  return text
    .split(/\s+/)
    .map(normalizeWord)
    .filter((term) => term.length > 1);
}

export function chunkText(content: string): string[] {
  return content
    .split(/(?<=[.!?])\s+/)
    .reduce<string[]>((chunks, sentence) => {
      const current = chunks[chunks.length - 1];
      if (!current || `${current} ${sentence}`.length > 400) {
        chunks.push(sentence.trim());
      } else {
        chunks[chunks.length - 1] = `${current} ${sentence}`.trim();
      }
      return chunks;
    }, [])
    .filter(Boolean);
}

function dot(left: number[], right: number[]) {
  return left.reduce((sum, value, index) => sum + value * (right[index] ?? 0), 0);
}

function magnitude(values: number[]) {
  return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function cosineSimilarity(left: number[], right: number[]) {
  const leftMagnitude = magnitude(left);
  const rightMagnitude = magnitude(right);

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot(left, right) / (leftMagnitude * rightMagnitude);
}

/** Lexical overlap normalized to roughly [0, 1] against the number of query terms. */
function lexicalScore(content: string, query: string): number {
  const terms = Array.from(new Set(tokenize(query)));

  if (terms.length === 0) {
    return 0;
  }

  const haystack = content.toLowerCase();
  const hits = terms.reduce((score, term) => {
    if (haystack.includes(term)) {
      return score + 1;
    }
    if (term.endsWith('s') && haystack.includes(term.slice(0, -1))) {
      return score + 0.5;
    }
    return score;
  }, 0);

  return hits / terms.length;
}

function normalizePdfText(content: string) {
  return content.replace(/\s+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

export class RagService {
  private initialized = false;
  private documents: KnowledgeDocument[] = [];
  private chunks: KnowledgeChunkRecord[] = [];
  private extractorPromise: Promise<FeatureExtractor> | null = null;
  /** Flips to false if the embedding model cannot be loaded (e.g. offline); search degrades to lexical-only. */
  private embeddingsAvailable = true;

  private async getExtractor(): Promise<FeatureExtractor | null> {
    if (!this.embeddingsAvailable) {
      return null;
    }

    if (!this.extractorPromise) {
      this.extractorPromise = pipeline('feature-extraction', env.EMBEDDING_MODEL) as unknown as Promise<FeatureExtractor>;
    }

    try {
      return await this.extractorPromise;
    } catch (error) {
      this.embeddingsAvailable = false;
      this.extractorPromise = null;
      logger.warn({ err: error, model: env.EMBEDDING_MODEL }, 'Embedding model unavailable; RAG falls back to lexical search');
      return null;
    }
  }

  private async embedMany(texts: string[]): Promise<Array<number[] | null>> {
    if (texts.length === 0) {
      return [];
    }

    const extractor = await this.getExtractor();

    if (!extractor) {
      return texts.map(() => null);
    }

    try {
      const output = await extractor(texts, { pooling: 'mean', normalize: true });
      return output.tolist();
    } catch (error) {
      this.embeddingsAvailable = false;
      logger.warn({ err: error }, 'Embedding inference failed; RAG falls back to lexical search');
      return texts.map(() => null);
    }
  }

  private async embedOne(text: string): Promise<number[] | null> {
    const [vector] = await this.embedMany([text]);
    return vector ?? null;
  }

  private async registerDocument(input: { title: string; content: string; source?: string }) {
    const content = input.content.trim();

    if (!content) {
      return null;
    }

    const doc: KnowledgeDocument = {
      id: crypto.randomUUID(),
      title: input.title,
      content,
      source: input.source
    };

    this.documents.push(doc);

    const chunkContents = chunkText(content);
    const embeddings = await this.embedMany(chunkContents);

    chunkContents.forEach((chunkContent, index) => {
      this.chunks.push({
        docId: doc.id,
        title: doc.title,
        source: doc.source,
        content: chunkContent,
        score: 0,
        embedding: embeddings[index] ?? null
      });
    });

    return { doc, chunkCount: chunkContents.length };
  }

  private async loadPdfKnowledgeBase() {
    const resolvedPdfPath = path.resolve(process.cwd(), env.KB_PDF_PATH);

    if (!fs.existsSync(resolvedPdfPath)) {
      logger.warn({ kbPdfPath: resolvedPdfPath }, 'Knowledge-base PDF not found; checking markdown fallback files');
      return false;
    }

    const buffer = fs.readFileSync(resolvedPdfPath);
    const parser = new PDFParse({ data: buffer });
    const parsed = await parser.getText();
    await parser.destroy();
    const content = normalizePdfText(parsed.text ?? '');

    await this.registerDocument({
      title: path.basename(resolvedPdfPath),
      content,
      source: resolvedPdfPath
    });

    logger.info({ kbPdfPath: resolvedPdfPath }, 'Loaded PDF knowledge base into memory');
    return true;
  }

  private async loadMarkdownFallback() {
    const docsDir = path.resolve(process.cwd(), '../docs');
    const allowedFallbackFiles = ['knowledge-base-content.md', 'knowledge-base.md'];

    if (!fs.existsSync(docsDir)) {
      return;
    }

    const markdownFiles = allowedFallbackFiles
      .map((fileName) => ({
        fileName,
        fullPath: path.join(docsDir, fileName)
      }))
      .filter((entry) => fs.existsSync(entry.fullPath));

    for (const entry of markdownFiles) {
      const content = fs.readFileSync(entry.fullPath, 'utf8');
      await this.registerDocument({
        title: entry.fileName,
        content,
        source: entry.fullPath
      });
    }

    if (markdownFiles.length > 0) {
      logger.warn(
        { docsDir, files: markdownFiles.map((entry) => entry.fileName) },
        'Using dedicated knowledge-base markdown fallback until a PDF is added'
      );
    }
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    this.documents = [];
    this.chunks = [];

    const loadedPdf = await this.loadPdfKnowledgeBase();

    if (!loadedPdf) {
      await this.loadMarkdownFallback();
    }

    this.initialized = true;
    logger.info(
      { documents: this.documents.length, chunks: this.chunks.length, embeddings: this.embeddingsAvailable },
      'Knowledge base initialized'
    );
  }

  async ingest(input: IngestDocumentInput): Promise<IngestDocumentResult> {
    await this.initialize();
    const registered = await this.registerDocument(input);

    return {
      docId: registered?.doc.id ?? crypto.randomUUID(),
      chunks: registered?.chunkCount ?? 0
    };
  }

  async search(input: RagSearchInput): Promise<RagSearchResult> {
    await this.initialize();

    const topK = input.topK ?? DEFAULT_TOP_K;
    const queryEmbedding = await this.embedOne(input.query);
    const semanticWeight = queryEmbedding ? 0.7 : 0;
    const lexicalWeight = queryEmbedding ? 0.3 : 1;

    const rankedChunks = this.chunks
      .map((chunk) => {
        const lexical = lexicalScore(chunk.content, input.query);
        const titleBoost = chunk.title ? lexicalScore(chunk.title, input.query) : 0;
        const lexicalCombined = Math.min(1, lexical + titleBoost * 0.25);
        const semantic = queryEmbedding && chunk.embedding ? Math.max(0, cosineSimilarity(chunk.embedding, queryEmbedding)) : 0;
        const hybridScore = semantic * semanticWeight + lexicalCombined * lexicalWeight;

        return {
          docId: chunk.docId,
          title: chunk.title,
          source: chunk.source,
          content: chunk.content,
          score: Number(hybridScore.toFixed(6))
        };
      })
      .sort((left, right) => right.score - left.score);

    const uniqueChunks = rankedChunks
      .filter((chunk, index, collection) => collection.findIndex((item) => item.content === chunk.content) === index)
      .filter((chunk) => chunk.score > 0)
      .slice(0, topK);

    return {
      chunks: uniqueChunks
    };
  }
}

export const ragService = new RagService();
