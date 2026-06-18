import { Router } from 'express';
import { syncUser } from '../controllers/auth.controller';

const router = Router();

// Route called by frontend immediately after login to register/update user in Mongo
router.post('/sync', syncUser);

export default router;
