import { Request } from 'express';
import mongoose from 'mongoose';
import { AuditLogModel } from '../models/AuditLog';

export const createAuditLog = async (
  documentId: string | mongoose.Types.ObjectId,
  action: string,
  performedBy: string,
  req?: Request
): Promise<void> => {
  try {
    let ipAddress = '';
    let userAgent = '';

    if (req) {
      // Resolve client IP dynamically, checking headers first for proxy configurations
      const forwardedFor = req.headers['x-forwarded-for'];
      if (Array.isArray(forwardedFor)) {
        ipAddress = forwardedFor[0];
      } else if (typeof forwardedFor === 'string') {
        ipAddress = forwardedFor.split(',')[0].trim();
      } else {
        ipAddress = req.ip || req.socket.remoteAddress || '';
      }

      // Resolve Browser user-agent information
      userAgent = req.headers['user-agent'] || '';
    }

    const logEntry = new AuditLogModel({
      documentId,
      action,
      performedBy,
      ipAddress,
      userAgent
    });

    await logEntry.save();
    console.log(`[AuditLog] Recorded action "${action}" for document ${documentId} by performer "${performedBy}"`);
  } catch (error) {
    console.error('[AuditLog Error] Failed to write audit log entry to MongoDB:', error);
  }
};
