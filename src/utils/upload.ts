import { v2 as cloudinary } from "cloudinary";
import { ApiError } from "./api-error";
import fs from "fs";
import path from "path";

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
});

/**
 * Upload an image to Cloudinary
 * @param file - The file to upload
 * @returns The secure URL of the uploaded image
 */
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

    console.error("Error uploading image to Cloudinary:", error);
    throw new ApiError(500, "Error uploading file to cloud storage");
  }
};

/**
 * Upload a video to Cloudinary with optimized settings
 * @param file - The video file to upload
 * @returns Object containing video details including URL, duration, and thumbnail
 */
export const uploadVideoToCloudinary = async (
  file: Express.Multer.File
): Promise<{
  url: string;
  public_id: string;
  duration: number;
  thumbnail_url: string;
  format: string;
}> => {
  try {
    console.log("Starting uploadVideoToCloudinary function");
    console.log("File info:", {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
    });

    // Check if file exists
    if (!fs.existsSync(file.path)) {
      throw new Error(`File does not exist at path: ${file.path}`);
    }

    console.log("File exists, size:", fs.statSync(file.path).size);

    // Generate a unique public_id based on timestamp and original filename
    const filename = path.parse(file.originalname).name;
    const timestamp = new Date().getTime();
    const public_id = `course-videos/${filename}-${timestamp}`;

    console.log("Generated public_id:", public_id);

    // Upload the video with simplified settings to avoid format compatibility issues
    console.log("Starting Cloudinary upload...");
    const result: any = await new Promise((resolve, reject) => {
      cloudinary.uploader.upload(
        file.path,
        {
          resource_type: "video" as "video",
          public_id: public_id,
          // Only use basic transformations that work with all formats
          eager: [
            // Create a lower quality version for mobile
            {
              width: 640,
              height: 360,
              crop: "limit",
              format: "mp4",
            },
          ],
          eager_async: true,
          overwrite: true,
        },
        (error, result) => {
          console.log("Upload callback received");

          // Delete the local file after upload
          if (file.path && fs.existsSync(file.path)) {
            console.log("Deleting temporary file:", file.path);
            fs.unlinkSync(file.path);
          }

          if (error) {
            console.error("Cloudinary upload error:", error);
            reject(error);
          } else {
            console.log("Cloudinary upload successful");
            resolve(result);
          }
        }
      );
    });

    console.log("Upload result received:", {
      public_id: result.public_id,
      secure_url: result.secure_url,
      format: result.format,
      duration: result.duration,
    });

    // Generate a thumbnail URL
    let thumbnail_url = "";
    try {
      thumbnail_url = cloudinary.url(result.public_id, {
        resource_type: "video" as "video",
        format: "jpg",
        secure: true,
        transformation: [{ width: 640, crop: "scale" }, { start_offset: "0" }],
      });
      console.log("Generated thumbnail URL:", thumbnail_url);
    } catch (thumbnailError) {
      console.error("Error generating thumbnail:", thumbnailError);
      // Continue without thumbnail if there's an error
    }

    const response = {
      url: result.secure_url,
      public_id: result.public_id,
      duration: result.duration || 0,
      thumbnail_url,
      format: result.format || "mp4",
    };

    console.log("Returning upload result:", response);
    return response;
  } catch (error) {
    console.error("Error in uploadVideoToCloudinary:", error);

    // Delete the local file if upload fails
    if (file.path && fs.existsSync(file.path)) {
      console.log("Deleting temporary file after error:", file.path);
      try {
        fs.unlinkSync(file.path);
      } catch (deleteError) {
        console.error("Error deleting temporary file:", deleteError);
      }
    }

    // Provide more detailed error message
    if (error instanceof Error) {
      console.error("Error message:", error.message);
      console.error("Error stack:", error.stack);

      // Check for specific Cloudinary errors
      if (error.message.includes("streaming profile")) {
        throw new ApiError(
          400,
          "Video format not supported for streaming. Please try a different format like MP4."
        );
      }

      throw new ApiError(
        500,
        `Error uploading video to Cloudinary: ${error.message}`
      );
    }

    throw new ApiError(500, "Error uploading video to cloud storage");
  }
};

/**
 * Delete a file from Cloudinary
 * @param publicId - The public ID of the file to delete
 * @param resourceType - The type of resource (image or video)
 * @returns Result of the deletion operation
 */
export const deleteFromCloudinary = async (
  publicId: string,
  resourceType: "image" | "video" | "raw" | "auto" = "image"
): Promise<any> => {
  try {
    return await cloudinary.uploader.destroy(publicId, {
      resource_type: resourceType,
    });
  } catch (error) {
    console.error(`Error deleting ${resourceType} from Cloudinary:`, error);
    throw new ApiError(
      500,
      `Failed to delete ${resourceType} from cloud storage`
    );
  }
};

/**
 * Extract public ID from Cloudinary URL
 * @param url - Cloudinary URL
 * @returns Public ID or null if not a Cloudinary URL
 */
export const getPublicIdFromUrl = (url: string): string | null => {
  if (!url || !url.includes("cloudinary.com")) {
    return null;
  }

  // Extract the public ID from the URL
  // Format: https://res.cloudinary.com/cloud_name/image|video/upload/v1234567890/folder/public_id.extension
  const regex = /\/v\d+\/(.+?)\.\w+$/;
  const match = url.match(regex);

  return match ? match[1] : null;
};
