import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { clerkMiddleware } from '@clerk/express';
import { connectDB } from './config/db';
import healthRouter from './routes/health';
import authRouter from './routes/auth';
import docsRouter from './routes/document';
import signatureRouter from './routes/signature';
import auditRouter from './routes/audit';
import { errorHandler } from './middlewares/error';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Enable CORS with environment fallback configuration
const allowedOrigins = process.env.FRONTEND_URL
  ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
  : ['http://localhost:3000'];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like mobile apps, postman, or same-origin)
    if (!origin) return callback(null, true);
    
    // In development mode, allow all origins
    if (process.env.NODE_ENV !== 'production') {
      return callback(null, true);
    }
    
    // In production, match against allowed origins list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      return allowedOrigin === origin || allowedOrigin === '*';
    });

    if (isAllowed) {
      return callback(null, true);
    } else {
      return callback(new Error(`CORS policy violation: Origin '${origin}' is not allowed.`));
    }
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Apply Clerk middleware globally
app.use(clerkMiddleware());

// Serve static uploads folder
const uploadsPath = path.join(process.cwd(), 'uploads');
app.use('/uploads', express.static(uploadsPath));

// Health route
app.use('/api/health', healthRouter);

// Auth routes
app.use('/api/auth', authRouter);

// Document routes mapped to /api/docs
app.use('/api/docs', docsRouter);

// Signature placements routes
app.use('/api/signatures', signatureRouter);

// Audit trail routes
app.use('/api/audit', auditRouter);

// Global Error Handler
app.use(errorHandler);

// Connect to Database and start listening
const startServer = async () => {
  try {
    // Ensure the uploads directory exists
    if (!fs.existsSync(uploadsPath)) {
      fs.mkdirSync(uploadsPath, { recursive: true });
      console.log(`[SignFlow Backend] Created upload folder at: ${uploadsPath}`);
    }

    await connectDB();
    app.listen(PORT, () => {
      console.log(`[SignFlow Backend] running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start SignFlow backend:', error);
    process.exit(1);
  }
};

startServer();
