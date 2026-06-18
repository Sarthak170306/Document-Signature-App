import mongoose, { Schema, Document } from 'mongoose';

export interface ISignaturePlacement extends Document {
  documentId: mongoose.Types.ObjectId;
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
  type: 'drag' | 'draw';
  signatureText?: string;
  status?: string;
}

const SignaturePlacementSchema = new Schema<ISignaturePlacement>(
  {
    documentId: { 
      type: Schema.Types.ObjectId, 
      ref: 'Document', 
      required: true,
      index: true 
    },
    x: { type: Number, required: true },
    y: { type: Number, required: true },
    width: { type: Number, required: true },
    height: { type: Number, required: true },
    page: { type: Number, required: true },
    type: { type: String, enum: ['drag', 'draw'], required: true },
    signatureText: { type: String },
    status: { type: String, enum: ['pending', 'signed', 'rejected'], default: 'pending' }
  },
  { 
    timestamps: true 
  }
);

export const SignaturePlacementModel = mongoose.model<ISignaturePlacement>(
  'SignaturePlacement',
  SignaturePlacementSchema
);


