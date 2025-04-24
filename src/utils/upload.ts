import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "./api-error";
import fs from "fs";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const uploadToCloudinary = async (
  file: Express.Multer.File
): Promise<string> => {
  try {
    // Upload the file to Cloudinary
    const result = await cloudinary.uploader.upload(file.path, {
      folder: "user_profiles",
      use_filename: true,
      unique_filename: true,
    });

    // Delete the local file after upload
    fs.unlinkSync(file.path);

    // Return the secure URL of the uploaded image
    return result.secure_url;
  } catch (error) {
    // Delete the local file if upload fails
    if (file.path && fs.existsSync(file.path)) {
      fs.unlinkSync(file.path);
    }

    throw new ApiError(500, "Error uploading file to cloud storage");
  }
};
