import { Request, Response, NextFunction } from 'express';
import { UserModel } from '../models/User';

export const syncUser = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<any> => {
  try {
    const { clerkId, email, name, profileImageUrl } = req.body;

    if (!clerkId || !email) {
      return res.status(400).json({
        success: false,
        message: 'clerkId and email are required for user synchronization.'
      });
    }

    // Upsert user details in the MongoDB collection
    const user = await UserModel.findOneAndUpdate(
      { clerkId },
      {
        email,
        name,
        profileImageUrl,
      },
      {
        new: true,       // Return the updated document
        upsert: true,    // Create a new document if it doesn't exist
        runValidators: true // Run schema validations on insert/update
      }
    );

    return res.status(200).json({
      success: true,
      message: 'User synchronized successfully',
      data: user
    });
  } catch (error) {
    console.error('[Auth Controller] syncUser error:', error);
    next(error);
  }
};
