import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { DocumentModel } from '../models/document';
import fs from 'fs';
import path from 'path';
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import { createAuditLog } from '../utils/logger';

export const uploadDocument = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    // Verified Clerk user ID is resolved by requireUserAuth and attached to req.auth
    const ownerId = req.auth?.userId;

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User authentication credentials not found.',
          status: 401
        }
      });
    }

    const { title } = req.body;
    
    // File details are verified and appended by the uploadSinglePdf middleware
    const file = req.file;
    if (!file) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'Document file is required.',
          status: 400
        }
      });
    }

    // Create and save document in MongoDB
    const document = new DocumentModel({
      title: title || file.originalname,
      filePath: file.path,
      ownerId,
      status: 'pending'
    });

    await document.save();

    await createAuditLog(
      document._id,
      'DOCUMENT_UPLOADED',
      req.user?.email || 'unknown@signflow.com',
      req
    );

    return res.status(201).json({
      success: true,
      message: 'Document uploaded and registered successfully.',
      data: document
    });
  } catch (error) {
    console.error('[Document Controller] uploadDocument error:', error);
    next(error);
  }
};

export const getDocuments = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const ownerId = req.auth?.userId;

    if (!ownerId) {
      return res.status(401).json({
        success: false,
        error: {
          message: 'User authentication credentials not found.',
          status: 401
        }
      });
    }

    const documents = await DocumentModel.find({ ownerId }).sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      data: documents
    });
  } catch (error) {
    console.error('[Document Controller] getDocuments error:', error);
    next(error);
  }
};

export const finalizeDocument = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const ownerId = req.auth?.userId;
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User authentication credentials not found.', status: 401 }
      });
    }

    const { documentId } = req.body;
    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: { message: 'documentId is required.', status: 400 }
      });
    }

    const document = await DocumentModel.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: { message: 'Document not found.', status: 404 }
      });
    }

    const absoluteFilePath = path.resolve(process.cwd(), document.filePath);
    if (!fs.existsSync(absoluteFilePath)) {
      return res.status(404).json({
        success: false,
        error: { message: 'Original document file not found on server.', status: 404 }
      });
    }

    const pdfBuffer = fs.readFileSync(absoluteFilePath);
    const pdfDoc = await PDFDocument.load(pdfBuffer);
    const pages = pdfDoc.getPages();
    const italicFont = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);

    // Determine the stamps/placements to draw
    let placementsToStamp: any[] = [];

    // Check if coordinate payload is provided in request body directly
    if (
      req.body.x !== undefined &&
      req.body.y !== undefined &&
      req.body.width !== undefined &&
      req.body.height !== undefined &&
      req.body.signatureText !== undefined &&
      req.body.pageNumber !== undefined
    ) {
      placementsToStamp.push({
        x: req.body.x,
        y: req.body.y,
        width: req.body.width,
        height: req.body.height,
        signatureText: req.body.signatureText,
        page: req.body.pageNumber
      });
    } else {
      // Fallback: Query saved placements database collection for this document
      const { SignaturePlacementModel } = require('../models/Signature');
      const dbPlacements = await SignaturePlacementModel.find({ documentId });
      placementsToStamp = dbPlacements.map((p: any) => ({
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        signatureText: p.signatureText || 'Signed',
        page: p.page
      }));
    }

    if (placementsToStamp.length === 0) {
      return res.status(400).json({
        success: false,
        error: { message: 'No signature placements found to finalize.', status: 400 }
      });
    }

    // Draw all signature texts onto the PDF pages
    for (const p of placementsToStamp) {
      const pageIdx = p.page - 1;
      if (pageIdx < 0 || pageIdx >= pages.length) {
        console.warn(`[Finalize] Page index ${pageIdx} is out of bounds (0-${pages.length - 1}). Skipping placement.`);
        continue;
      }

      const page = pages[pageIdx];
      const { width: pageWidth, height: pageHeight } = page.getSize();

      // Convert percentage coordinates to absolute PDF layout points
      const finalX = (p.x / 100) * pageWidth;
      const finalY = pageHeight - ((p.y / 100) * pageHeight) - ((p.height / 100) * pageHeight);
      const finalWidth = (p.width / 100) * pageWidth;
      const finalHeight = (p.height / 100) * pageHeight;

      // Stamp dynamic cursive text
      page.drawText(p.signatureText, {
        x: finalX,
        y: finalY + (finalHeight / 4),
        size: finalHeight * 0.6,
        font: italicFont,
        color: rgb(0, 0, 0.7) // Ink-Blue color
      });
    }

    // Write updated pdf data back to disk, overwriting the file
    const updatedPdfBytes = await pdfDoc.save();
    fs.writeFileSync(absoluteFilePath, updatedPdfBytes);

    // Update status to 'signed' in Mongoose collection
    document.status = 'signed';
    await document.save();

    const performedBy = req.auth?.userId?.startsWith('public_')
      ? 'External Signer'
      : (req.user?.email || 'unknown@signflow.com');

    await createAuditLog(
      document._id,
      'DOCUMENT_SIGNED',
      performedBy,
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Document finalized and signed successfully.',
      data: document
    });
  } catch (error) {
    console.error('[Document Controller] finalizeDocument error:', error);
    next(error);
  }
};

export const shareDocument = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const ownerId = req.auth?.userId;
    const ownerName = req.user?.name || 'A SignFlow User';
    
    if (!ownerId) {
      return res.status(401).json({
        success: false,
        error: { message: 'User authentication credentials not found.', status: 401 }
      });
    }

    const { documentId, signerEmail, signerName } = req.body;

    if (!documentId || !signerEmail || !signerName) {
      return res.status(400).json({
        success: false,
        error: { message: 'documentId, signerEmail, and signerName are required.', status: 400 }
      });
    }

    const document = await DocumentModel.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: { message: 'Document not found.', status: 404 }
      });
    }

    // Generate JWT token (48h expiry)
    const token = jwt.sign(
      { documentId, signerEmail },
      process.env.JWT_SECRET || 'super_secret_key_for_public_signatures_sign_flow_9918',
      { expiresIn: '48h' }
    );

    const publicSignLink = `http://localhost:3000/public/sign/${token}`;

    // Setup Nodemailer transporter
    let transporter;
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    } else {
      // Fallback: Nodemailer Mock Transporter
      transporter = {
        sendMail: async (options: any) => {
          console.log('\n============================================');
          console.log('📧 Mock Nodemailer Transporter Triggered');
          console.log(`To: ${options.to}`);
          console.log(`Subject: ${options.subject}`);
          console.log(`Sign Link: ${publicSignLink}`);
          console.log('============================================\n');
          return { messageId: 'mock-id-12345' };
        }
      };
    }

    const htmlContent = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #1e293b; border-radius: 16px; background-color: #0f172a; color: #f1f5f9;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h2 style="color: #8b5cf6; margin: 0; font-size: 24px;">SignFlow Signature Request</h2>
        </div>
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">Hello <strong>${signerName}</strong>,</p>
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6;">
          <strong>${ownerName}</strong> has requested your digital signature on <strong>${document.title}</strong> using SignFlow.
        </p>
        <p style="font-size: 14px; color: #cbd5e1; line-height: 1.6; margin-bottom: 32px;">
          Please click the button below to review, position, and stamp your digital signature. This secure link is active for 48 hours.
        </p>
        <div style="text-align: center; margin-bottom: 32px;">
          <a href="${publicSignLink}" style="background-color: #8b5cf6; color: #ffffff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: bold; font-size: 14px; display: inline-block;">Review & Sign Document</a>
        </div>
        <p style="color: #64748b; font-size: 11px; line-height: 1.4; border-top: 1px solid #334155; padding-top: 16px;">
          If the button above does not work, copy and paste this URL into your browser:<br/>
          <a href="${publicSignLink}" style="color: #a78bfa; word-break: break-all;">${publicSignLink}</a>
        </p>
      </div>
    `;

    await transporter.sendMail({
      from: '"SignFlow Notifications" <noreply@signflow.com>',
      to: signerEmail,
      subject: `Action Required: Signature requested on ${document.title}`,
      html: htmlContent
    });

    await createAuditLog(
      document._id,
      'SIGNATURE_LINK_SHARED',
      signerEmail,
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Signature request link generated and sent successfully.',
      data: { token, link: publicSignLink }
    });
  } catch (error) {
    console.error('[Document Controller] shareDocument error:', error);
    next(error);
  }
};

export const verifyShareToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        error: { message: 'Verification token is required.', status: 400 }
      });
    }

    let decoded: any;
    try {
      decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || 'super_secret_key_for_public_signatures_sign_flow_9918'
      );
    } catch (err) {
      return res.status(401).json({
        success: false,
        error: { message: 'Invalid or expired signature link token.', status: 401 }
      });
    }

    const { documentId, signerEmail } = decoded;

    const document = await DocumentModel.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: { message: 'Document associated with token not found.', status: 404 }
      });
    }

    const { SignaturePlacementModel } = require('../models/Signature');
    const placements = await SignaturePlacementModel.find({ documentId });

    return res.status(200).json({
      success: true,
      data: {
        document,
        placements,
        signerEmail
      }
    });
  } catch (error) {
    console.error('[Document Controller] verifyShareToken error:', error);
    next(error);
  }
};

export const declineDocument = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { documentId, reason, signerEmail } = req.body;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: { message: 'documentId is required.', status: 400 }
      });
    }

    const document = await DocumentModel.findById(documentId);
    if (!document) {
      return res.status(404).json({
        success: false,
        error: { message: 'Document not found.', status: 404 }
      });
    }

    if (document.status !== 'pending') {
      return res.status(400).json({
        success: false,
        error: { message: 'Document is already finalized', status: 400 }
      });
    }

    // Update status and rejection reason
    document.status = 'rejected';
    document.rejectionReason = reason || '';
    await document.save();

    // Determine performer identity
    const performedBy = req.auth?.userId?.startsWith('public_')
      ? (req.user?.email || signerEmail || 'External Signer')
      : (req.user?.email || 'unknown@signflow.com');

    // Write audit log entry
    await createAuditLog(
      documentId,
      'DOCUMENT_REJECTED',
      performedBy,
      req
    );

    return res.status(200).json({
      success: true,
      message: 'Document invitation declined successfully.',
      data: document
    });
  } catch (error) {
    console.error('[Document Controller] declineDocument error:', error);
    next(error);
  }
};
