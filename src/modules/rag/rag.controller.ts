import type { Request, Response } from 'express';
import { createSuccessResponse } from '../../shared/types/api-response.js';
import { ragService } from './rag.service.js';
import type { IngestDocumentInput, RagSearchInput } from './rag.types.js';

export class RagController {
  async ingest(req: Request, res: Response) {
    const result = await ragService.ingest(req.body as IngestDocumentInput);
    res.json(createSuccessResponse(result));
  }

  async search(req: Request, res: Response) {
    const result = await ragService.search(req.body as RagSearchInput);
    res.json(createSuccessResponse(result));
  }
}

export const ragController = new RagController();
