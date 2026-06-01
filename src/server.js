import "dotenv/config.js";
import express from "express";
import cors from "cors";
import morgan from "morgan";
import path from "path";
import { fileURLToPath } from "url";

import connectDB from "./config/db.js";
import errorHandler from "./middleware/errorHandler.js";

// Routes
import authRoutes from "./routes/auth.routes.js";
import userRoutes from "./routes/user.routes.js";
// import clientRoutes from './routes/client.routes.js';
// import productRoutes from "./routes/product.routes.js";
// import invoiceRoutes from "./routes/invoice.routes.js";
import invoiceDocumentRoutes from "./routes/invoiceDocument.routes.js";
// import inventoryRoutes from "./routes/inventory.routes.js";
// import notificationRoutes from "./routes/notification.routes.js";

// Get __dirname equivalent in ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============ EXPRESS APP INITIALIZATION ============

const app = express();

// ============ MIDDLEWARE ============

// CORS - Allow cross-origin requests
app.use(cors());

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
if (process.env.NODE_ENV === "development") {
  app.use(morgan("dev"));
}

// Serve uploaded files statically
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// ============ API ROUTES ============

// Authentication routes
app.use("/api/auth", authRoutes);

// User management routes
app.use("/api/users", userRoutes);

// // Client routes
// app.use("/api/clients", clientRoutes);

// // Product routes
// app.use("/api/products", productRoutes);

// // Invoice routes
// app.use("/api/invoices", invoiceRoutes);

// // Invoice document routes
app.use("/api/upload-invoice", invoiceDocumentRoutes);

// // Inventory transaction routes
// app.use("/api/inventory-transactions", inventoryRoutes);

// // Notification routes
// app.use("/api/notifications", notificationRoutes);

// ============ HEALTH CHECK ============

/**
 * @route   GET /api/health
 * @desc    Health check endpoint
 * @access  Public
 */
app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || "production",
  });
});

// ============ 404 HANDLER ============

/**
 * Handle undefined routes
 */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route not found: ${req.originalUrl}`,
    method: req.method,
    timestamp: new Date().toISOString(),
  });
});

// ============ ERROR HANDLER ============

// Global error handling middleware (must be last)
app.use(errorHandler);

// ============ SERVER STARTUP ============

/**
 * Initialize database connection and start server
 */
const startServer = async () => {
  try {
    // Connect to MongoDB
    console.log("📡 Connecting to MongoDB...");
    await connectDB();
    console.log("✅ MongoDB connected successfully");

    // Start listening
    const PORT = process.env.PORT || 3000;
    const NODE_ENV = process.env.MONGO || "development";

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════╗
║     🚀 Server Running Successfully    ║
╠════════════════════════════════════════╣
║ Port:        ${PORT.toString().padEnd(29)} ║
║ Environment: ${NODE_ENV.padEnd(28)} ║
║ URL:         http://localhost:${PORT}${" ".repeat(Math.max(0, PORT.toString().length - 1))}║
╚════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error("❌ Failed to start server:", error.message);
    process.exit(1);
  }
};

// ============ GRACEFUL SHUTDOWN ============

process.on("SIGTERM", () => {
  console.log("\n⚠️  SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("\n⚠️  SIGINT signal received: closing HTTP server");
  process.exit(0);
});

// ============ START SERVER ============

startServer();
