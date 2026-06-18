import mongoose, { Schema, Document } from 'mongoose';

export interface IAuditLog extends Document {
  documentId: mongoose.Types.ObjectId;
  action: string;
  performedBy: string;
  ipAddress?: string;
  userAgent?: string;
  timestamp: Date;
}

const AuditLogSchema = new Schema<IAuditLog>({
  documentId: {
    type: Schema.Types.ObjectId,
    ref: 'Document',
    required: true,
    index: true
  },
  action: {
    type: String,
    required: true
  },
  performedBy: {
    type: String,
    required: true
  },
  ipAddress: {
    type: String
  },
  userAgent: {
    type: String
  },
  timestamp: {
    type: Date,
    default: Date.now
  }
});

export const AuditLogModel = mongoose.model<IAuditLog>('AuditLog', AuditLogSchema);
