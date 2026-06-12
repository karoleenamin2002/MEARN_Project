import AppError from "../utils/appError.js";
import { catchError } from "../utils/catchError.js";
import cloudinary from "../config/uploadConfig.js";
// import uploadInvoice from "../config/uploadConfig.js";
import streamifier from "streamifier";

export const uploadToCloud = async (req, res, next) => {
  if (!req.file) {
    return next(new AppError("No file uploaded", 400));
  }

  try {
    const file = req.file;

    function streamUpload(fileBuffer) {
      return new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            public_id: file.originalname,
            overwrite: true,
          },
          (error, uploadResult) => {
            if (uploadResult) {
              resolve(uploadResult);
            } else {
              reject(error);
            }
          },
        );

        streamifier.createReadStream(fileBuffer).pipe(stream);
      });
    }

    const uploadedFile = await streamUpload(file.buffer);

   req.cloudInvoice = {
  fileName: file.originalname,
  fileType: uploadedFile.format,
  fileUrl: uploadedFile.secure_url,
  publicId: uploadedFile.public_id,
};
    next();
  } catch (error) {
    next(new AppError(error.message || "Internal server error", 500));
  }
};
