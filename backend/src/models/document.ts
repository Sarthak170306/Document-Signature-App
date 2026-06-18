import mongoose, { Schema, Document } from 'mongoose';

export interface IDocument extends Document {
  title: string;
  filePath: string;
  ownerId: string; // Clerk user ID who uploaded it
  status: 'pending' | 'signed' | 'rejected';
  rejectionReason?: string;
  createdAt: Date;
  updatedAt: Date;
}

const DocumentSchema = new Schema<IDocument>(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    filePath: {
      type: String,
      required: true
    },
    ownerId: {
      type: String,
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'signed', 'rejected'],
      default: 'pending'
    },
    rejectionReason: {
      type: String
    }
  },
  {
    timestamps: true
  }
);

export const DocumentModel = mongoose.model<IDocument>('Document', DocumentSchema);
