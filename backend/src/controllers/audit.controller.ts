import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { AuditLogModel } from '../models/AuditLog';

export const getAuditLogs = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { docId } = req.params;

    if (!docId) {
      return res.status(400).json({
        success: false,
        error: { message: 'Document ID parameter is required.', status: 400 }
      });
    }

    // Fetch all logs from MongoDB sorted by timestamp: -1 (newest first)
    const logs = await AuditLogModel.find({ documentId: docId }).sort({ timestamp: -1 });

    return res.status(200).json({
      success: true,
      data: logs
    });
  } catch (error) {
    console.error('[Audit Controller] getAuditLogs error:', error);
    next(error);
  }
};
