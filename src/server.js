require('dotenv').config();
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

const connectDB = require('./config/db');
const errorHandler = require('./middleware/errorHandler');

// Routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const clientRoutes = require('./routes/client.routes');
const productRoutes = require('./routes/product.routes');
const invoiceRoutes = require('./routes/invoice.routes');
const invoiceDocumentRoutes = require('./routes/invoiceDocument.routes');
const inventoryRoutes = require('./routes/inventory.routes');
const notificationRoutes = require('./routes/notification.routes');

// Connect to DB
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
if (process.env.NODE_ENV === 'development') app.use(morgan('dev'));

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/products', productRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/invoice-documents', invoiceDocumentRoutes);
app.use('/api/inventory-transactions', inventoryRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => res.json({ status: 'OK', timestamp: new Date() }));

// 404
app.use((req, res) => res.status(404).json({ success: false, message: 'Route not found' }));

// Error handler
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT} [${process.env.NODE_ENV}]`));
