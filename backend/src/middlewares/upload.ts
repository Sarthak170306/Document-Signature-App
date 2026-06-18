import { Request, Response, NextFunction } from 'express';
import multer from 'multer';

// Configure storage destination and filename mapping
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    // Escape whitespace and avoid collisions with timestamp + random seed prefix
    const sanitizedOriginalName = file.originalname.replace(/\s+/g, '_');
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${sanitizedOriginalName}`);
  }
});

// Filter file types (Allow application/pdf only)
const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only PDF documents are allowed.'));
  }
};

// Initialize Multer upload client
const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // Limit size to 10MB
  }
});

// Wrapper middleware to execute Multer and format upload exceptions as 400 Bad Request
export const uploadSinglePdf = (req: Request, res: Response, next: NextFunction) => {
  const singleUpload = upload.single('file');

  singleUpload(req, res, (error: any) => {
    if (error) {
      return res.status(400).json({
        success: false,
        error: {
          message: error.message,
          status: 400
        }
      });
    }
    
    // Check if file is provided in the request
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: {
          message: 'No file uploaded. Please upload a PDF document under the field name "file".',
          status: 400
        }
      });
    }
    
    next();
  });
};
