import { Request, Response, NextFunction } from 'express';
import { getAuth } from '@clerk/express';
import { UserModel } from '../models/User';

export interface AuthenticatedRequest extends Request {
  auth?: ReturnType<typeof getAuth>;
  user?: any; // MongoDB User document
}

export const requireUserAuth = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  try {
    const authHeader = req.headers.authorization;
    
    // Development mode bypass check for headless QA automation scripts
    if (
      process.env.NODE_ENV === 'development' &&
      authHeader === 'Bearer mock-development-bypass-token'
    ) {
      const testClerkId = 'user_test_clerk_id_9999';
      req.auth = { userId: testClerkId } as any;
      
      let dbUser = await UserModel.findOne({ clerkId: testClerkId });
      if (!dbUser) {
        dbUser = await UserModel.create({
          clerkId: testClerkId,
          email: 'test-uploader@signflow.com',
          name: 'Test QA Uploader',
          profileImageUrl: 'https://images.clerk.dev/test-avatar.png'
        });
      }
      req.user = dbUser;
      return next();
    }

    // Check if it's a tokenized shared sign link (JWT)
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(
          token,
          process.env.JWT_SECRET || 'super_secret_key_for_public_signatures_sign_flow_9918'
        );
        if (decoded && decoded.documentId) {
          // Authorized external public signer session
          req.auth = { userId: `public_${decoded.signerEmail}` } as any;
          req.user = { name: 'External Signer', email: decoded.signerEmail };
          return next();
        }
      } catch (err) {
        // Token verification failed or not a JWT; fall through to Clerk
      }
    }

    const authState = getAuth(req);

    if (!authState || !authState.userId) {
      return res.status(401).json({ error: 'Unauthorized access' });
    }

    // Attach Clerk auth object to request
    req.auth = authState;

    // Retrieve database user and attach to request
    const dbUser = await UserModel.findOne({ clerkId: authState.userId });
    if (dbUser) {
      req.user = dbUser;
    }

    next();
  } catch (error) {
    console.error('[Auth Middleware] Verification error:', error);
    return res.status(401).json({ error: 'Unauthorized access' });
  }
};
