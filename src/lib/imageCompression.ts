import imageCompression from "browser-image-compression";

export interface CompressionOptions {
  maxSizeMB?: number;
  maxWidthOrHeight?: number;
  useWebWorker?: boolean;
  fileType?: string;
  initialQuality?: number;
}

const DEFAULT_OPTIONS: CompressionOptions = {
  maxSizeMB: 1.0, // Target size ~1MB
  maxWidthOrHeight: 1920, // Max dimension 1920px suitable for mobile delivery evidence
  useWebWorker: true, // Non-blocking off-thread processing
  fileType: "image/webp", // Efficient modern format
  initialQuality: 0.85
};

/**
 * Compresses an image file in the browser before upload.
 * Resizes dimensions down to ~1920px and compresses to ~1MB WebP
 * using a Web Worker to avoid freezing the UI thread on mobile devices.
 */
export async function compressDeliveryImage(
  file: File,
  customOptions?: CompressionOptions
): Promise<File> {
  // If the file is not an image, return original
  if (!file.type.startsWith("image/")) {
    return file;
  }

  // Already tiny images (< 300KB) don't need aggressive compression
  if (file.size <= 300 * 1024) {
    return file;
  }

  const options = {
    ...DEFAULT_OPTIONS,
    ...customOptions
  };

  try {
    const compressedBlob = await imageCompression(file, options);
    
    // Create a new File from the compressed Blob to retain name and metadata
    const extension = options.fileType === "image/webp" ? "webp" : file.name.split(".").pop() || "jpg";
    const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || file.name;
    const newFileName = `${baseName}.${extension}`;

    return new File([compressedBlob], newFileName, {
      type: compressedBlob.type || options.fileType || "image/webp",
      lastModified: Date.now()
    });
  } catch (err) {
    console.warn("browser-image-compression fallback to original file:", err);
    return file;
  }
}
