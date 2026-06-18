import { Router } from 'express';
import { getAuditLogs } from '../controllers/audit.controller';
import { requireUserAuth } from '../middlewares/auth';

const router = Router();

// Endpoint for fetching audit logs for a specific document (protected)
router.get('/:docId', requireUserAuth, getAuditLogs);

export default router;
