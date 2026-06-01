import { v2 as cloudinary } from "cloudinary";
import multer from "multer";
import dotenv from "dotenv";

/**
 * cloudinary configuration
 */
cloudinary.config({
  cloud_name: process.env.CLOUD_NAME,
  api_key: process.env.CLOUD_API_KEY,
  api_secret: process.env.CLOUD_API_SECRET,
});

export default cloudinary;

/**
 * Multer setup
 */
const storage = multer.memoryStorage();

export const uplaodInvoice = multer({ storage, limits: { fileSize: 6291456 } }).single(
  "invoice",
);
