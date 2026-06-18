import { Router } from 'express';
import { uploadDocument, getDocuments, finalizeDocument, shareDocument, verifyShareToken, declineDocument } from '../controllers/document.controller';
import { requireUserAuth } from '../middlewares/auth';
import { uploadSinglePdf } from '../middlewares/upload';

const router = Router();

// Endpoint to list user's uploaded documents
router.get('/', requireUserAuth, getDocuments);

// Endpoint for uploading document PDFs securely
router.post('/upload', requireUserAuth, uploadSinglePdf, uploadDocument);

// Endpoint for signing and finalizing PDFs using pdf-lib coordinates stamping
router.post('/finalize', requireUserAuth, finalizeDocument);

// Endpoint for sharing documents with tokenized public links and email notifications
router.post('/share', requireUserAuth, shareDocument);

// Public endpoint for verifying tokenized sign links
router.post('/verify-token', verifyShareToken);

// Endpoint for declining/rejecting document signature requests
router.post('/decline', requireUserAuth, declineDocument);

export default router;
