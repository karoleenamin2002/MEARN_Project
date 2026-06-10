import mongoose from 'mongoose';

/**
 * Connect to MongoDB Database
 * @returns {Promise<void>}
 * @throws {Error} If connection fails
 *
 * Environment Variables Required:
 * - MONGO_URI: MongoDB connection string
 *
 * Connection Options:
 * - useNewUrlParser: true
 * - useUnifiedTopology: true
 * - maxPoolSize: 10 (connection pool)
 * - serverSelectionTimeoutMS: 5000
 */
const connectDB = async () => {
  try {
    // Validate MONGO_URI is provided
    if (!process.env.MONGO_URI) {
      throw new Error(
        'MONGO_URI environment variable is not defined. Please set it in your .env file.'
      );
    }

    console.log('📡 Attempting to connect to MongoDB...');
    console.log(`   URI: ${process.env.MONGO_URI.substring(0, 50)}...`); // Hide full URI for security

    // Connect to MongoDB with options
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 5000,
    });

    console.log(`
╔════════════════════════════════════════╗
║   ✅ MongoDB Connected Successfully   ║
╠════════════════════════════════════════╣
║ Host:     ${conn.connection.host.padEnd(28)} ║
║ Database: ${(conn.connection.name || 'default').padEnd(28)} ║
║ Port:     ${conn.connection.port.toString().padEnd(28)} ║
╚════════════════════════════════════════╝
    `);

    return conn;
  } catch (error) {
    console.error(`
╔════════════════════════════════════════╗
║      ❌ MongoDB Connection Failed     ║
╠════════════════════════════════════════╣
║ Error: ${error.message.substring(0, 31).padEnd(31)} ║
║                                        ║
║ Please verify:                         ║
║ • MongoDB server is running            ║
║ • MONGO_URI is correct in .env         ║
║ • Network connection is available      ║
╚════════════════════════════════════════╝
    `);

    // Exit with error code
    process.exit(1);
  }
};

/**
 * Get Mongoose connection status
 * @returns {boolean} True if connected, false otherwise
 */
export const isConnected = () => {
  return mongoose.connection.readyState === 1;
};

/**
 * Disconnect from MongoDB
 * @returns {Promise<void>}
 */
export const disconnectDB = async () => {
  try {
    await mongoose.disconnect();
    console.log('✅ MongoDB disconnected successfully');
  } catch (error) {
    console.error(`❌ Error disconnecting from MongoDB: ${error.message}`);
    throw error;
  }
};

// ============ EXPORT ============

export default connectDB;
