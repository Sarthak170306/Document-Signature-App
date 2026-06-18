import { Router } from 'express';
import { savePlacements, getPlacements } from '../controllers/signature.controller';
import { requireUserAuth } from '../middlewares/auth';

const router = Router();

// Endpoint for saving dynamic signature canvas placements
router.post('/', requireUserAuth, savePlacements);

// Endpoint for getting placements for a specific document
router.get('/:documentId', requireUserAuth, getPlacements);

export default router;
