import express from "express";
import cors from "cors";
import { connectDB } from "./config/db.js";
import dotenv from "dotenv";
import clientRoutes from "./modules/clients/clients.routes.js";

const app = express();

// ============ MIDDLEWARE ============

// CORS - Allow cross-origin requests
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging in development
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// ============ API ROUTES ============

// Authentication routes
app.use('/api/auth', authRoutes);

// User management routes
app.use('/api/users', userRoutes);

// Client routes
app.use('/api/clients', clientRoutes);

// Product routes
app.use('/api/products', productRoutes);

// Invoice routes
app.use('/api/invoices', invoiceRoutes);

// Invoice document routes
app.use('/api/invoice-documents', invoiceDocumentRoutes);

// Inventory transaction routes
app.use('/api/inventory-transactions', inventoryRoutes);

// Notification routes
app.use('/api/notifications', notificationRoutes);

// ============ HEALTH CHECK ============

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'production',
  });
});

app.use("/api/transfers", transferRoutes);
app.use("/api/clients", clientRoutes);

// initRoutes(app);

export default app;
