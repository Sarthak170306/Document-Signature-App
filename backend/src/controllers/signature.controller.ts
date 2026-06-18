import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../middlewares/auth';
import { SignaturePlacementModel } from '../models/Signature';

export const savePlacements = async (
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

    // Check if bulk save
    let isBulk = false;
    let placementsList: any[] = [];
    let docId: string | undefined;

    if (Array.isArray(req.body)) {
      isBulk = true;
      placementsList = req.body;
      docId = placementsList[0]?.documentId;
    } else if (req.body.placements && Array.isArray(req.body.placements)) {
      isBulk = true;
      placementsList = req.body.placements;
      docId = req.body.documentId;
    }

    if (isBulk) {
      if (!docId) {
        return res.status(400).json({
          success: false,
          error: { message: 'documentId is required for saving placements.', status: 400 }
        });
      }

      // Clear previous placements for this document
      await SignaturePlacementModel.deleteMany({ documentId: docId });

      // Format new placements to match Mongoose schema
      const placementsToSave = placementsList.map((p: any) => ({
        documentId: docId,
        x: p.x,
        y: p.y,
        width: p.width,
        height: p.height,
        page: p.page,
        type: p.type,
        signatureText: p.signatureText,
        status: p.status || 'pending'
      }));

      // Bulk insert placements
      const savedPlacements = await SignaturePlacementModel.insertMany(placementsToSave);

      return res.status(200).json({
        success: true,
        message: 'Signature anchors saved successfully.',
        data: savedPlacements
      });
    } else {
      // Single placement save/update
      const { _id, id, documentId, x, y, width, height, page, type, signatureText, status } = req.body;

      if (!documentId) {
        return res.status(400).json({
          success: false,
          error: { message: 'documentId is required.', status: 400 }
        });
      }

      const idToFind = _id || id;
      let savedPlacement;

      if (idToFind) {
        savedPlacement = await SignaturePlacementModel.findByIdAndUpdate(
          idToFind,
          { x, y, width, height, page, type, signatureText, status: status || 'pending' },
          { new: true, runValidators: true }
        );
      }

      if (!savedPlacement) {
        savedPlacement = await SignaturePlacementModel.create({
          documentId,
          x,
          y,
          width,
          height,
          page,
          type,
          signatureText,
          status: status || 'pending'
        });
      }

      return res.status(200).json({
        success: true,
        message: 'Signature placement saved successfully.',
        data: savedPlacement
      });
    }
  } catch (error) {
    console.error('[Signature Controller] savePlacements error:', error);
    next(error);
  }
};

export const getPlacements = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { documentId } = req.params;

    if (!documentId) {
      return res.status(400).json({
        success: false,
        error: { message: 'documentId is required.', status: 400 }
      });
    }

    const placements = await SignaturePlacementModel.find({ documentId });

    return res.status(200).json({
      success: true,
      data: placements
    });
  } catch (error) {
    console.error('[Signature Controller] getPlacements error:', error);
    next(error);
  }
};
