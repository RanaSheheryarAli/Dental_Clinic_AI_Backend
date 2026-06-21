import { Router } from 'express';
import { asyncHandler } from '../../shared/middleware/async-handler.js';
import { validate } from '../../shared/middleware/validate.js';
import { ragController } from './rag.controller.js';
import { ingestBodySchema, searchBodySchema } from './rag.schema.js';

const ragRouter = Router();

ragRouter.post('/ingest', validate({ body: ingestBodySchema }), asyncHandler((req, res) => ragController.ingest(req, res)));
ragRouter.post('/search', validate({ body: searchBodySchema }), asyncHandler((req, res) => ragController.search(req, res)));

export { ragRouter };
