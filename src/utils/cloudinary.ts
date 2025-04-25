import { v2 as cloudinary } from "cloudinary";
import { config } from "dotenv";
import fs from "fs";
import { ApiError } from "./api-error";

// Load environment variables
config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload a video file to Cloudinary
 * @param filePath - Path to the temporary file
 * @param options - Additional upload options
 * @returns Promise with upload result
 */
export const uploadVideo = async (
  filePath: string,
  options: {
    folder?: string;
    resource_type?: "video" | "image" | "raw" | "auto";
    public_id?: string;
    overwrite?: boolean;
    eager?: any[];
    eager_async?: boolean;
    eager_notification_url?: string;
  } = {}
): Promise<any> => {
  try {
    // Set default options
    const uploadOptions = {
      resource_type: "video" as "video",
      folder: "course-videos",
      overwrite: true,
      ...options,
    };

    // Use chunked upload for better performance with large files
    return new Promise((resolve, reject) => {
      cloudinary.uploader.upload_large(
        filePath,
        uploadOptions,
        (error, result) => {
          // Delete the temporary file after upload
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }

          if (error) {
            reject(error);
          } else {
            resolve(result);
          }
        }
      );
    });
  } catch (error) {
    // Delete the temporary file if upload fails
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    console.error("Error uploading to Cloudinary:", error);
    throw new ApiError(500, "Failed to upload video to Cloudinary");
  }
};

/**
 * Delete a video from Cloudinary
 * @param publicId - Public ID of the video to delete
 * @returns Promise with deletion result
 */
export const deleteVideo = async (publicId: string): Promise<any> => {
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: "video" as "video",
    });
  } catch (error) {
    console.error("Error deleting from Cloudinary:", error);
    throw new ApiError(500, "Failed to delete video from Cloudinary");
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param url - Cloudinary URL
 * @returns Public ID
 */
export const getPublicIdFromUrl = (url: string): string | null => {
  if (!url || !url.includes("cloudinary.com")) {
    return null;
  }

  // Extract the public ID from the URL
  // Format: https://res.cloudinary.com/cloud_name/video/upload/v1234567890/folder/public_id.extension
  const regex = /\/v\d+\/(.+?)\.\w+$/;
  const match = url.match(regex);

  return match ? match[1] : null;
};

/**
 * Generate a signed URL for a video with an expiration time
 * @param publicId - Public ID of the video
 * @param expiresAt - Expiration time in seconds from now
 * @returns Signed URL
 */
export const generateSignedUrl = (
  publicId: string,
  expiresAt: number = 3600
): string => {
  const timestamp = Math.floor(Date.now() / 1000) + expiresAt;

  return cloudinary.url(publicId, {
    resource_type: "video" as "video",
    sign_url: true,
    secure: true,
    type: "upload",
    expires_at: timestamp,
  });
};

/**
 * Create a video thumbnail from a Cloudinary video
 * @param publicId - Public ID of the video
 * @returns URL of the generated thumbnail
 */
export const createVideoThumbnail = (publicId: string): string => {
  return cloudinary.url(publicId, {
    resource_type: "video" as "video",
    format: "jpg",
    secure: true,
    transformation: [{ width: 640, crop: "scale" }, { start_offset: "0" }],
  });
};

/**
 * Get video information from Cloudinary
 * @param publicId - Public ID of the video
 * @returns Promise with video information
 */
export const getVideoInfo = async (publicId: string): Promise<any> => {
  try {
    return await cloudinary.api.resource(publicId, {
      resource_type: "video" as "video",
    });
  } catch (error) {
    console.error("Error getting video info from Cloudinary:", error);
    throw new ApiError(500, "Failed to get video information from Cloudinary");
  }
};

export default {
  uploadVideo,
  deleteVideo,
  getPublicIdFromUrl,
  generateSignedUrl,
  createVideoThumbnail,
  getVideoInfo,
};
