import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, UploadResult } from 'firebase/storage';
import { CustomImage } from '@/types/cart';
import { nanoid } from 'nanoid';

// Enhanced upload configuration
const UPLOAD_CONFIG = {
  MAX_RETRIES: 3,
  TIMEOUT_MS: 30000, // 30 seconds per upload
  MAX_CONCURRENT: 2, // Limit concurrent uploads to prevent Firebase quota issues
  MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_TYPES: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
};

// Semaphore for controlling concurrent uploads
class UploadSemaphore {
  private permits: number;
  private waitQueue: Array<() => void> = [];

  constructor(permits: number) {
    this.permits = permits;
  }

  async acquire(): Promise<() => void> {
    return new Promise((resolve) => {
      if (this.permits > 0) {
        this.permits--;
        resolve(() => this.release());
      } else {
        this.waitQueue.push(() => {
          this.permits--;
          resolve(() => this.release());
        });
      }
    });
  }

  private release(): void {
    this.permits++;
    if (this.waitQueue.length > 0) {
      const next = this.waitQueue.shift();
      next?.();
    }
  }
}

// Global semaphore to control concurrent uploads
const uploadSemaphore = new UploadSemaphore(UPLOAD_CONFIG.MAX_CONCURRENT);

/**
 * Validate image file before upload
 */
function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!file || !(file instanceof File)) {
    return { valid: false, error: 'Invalid file object' };
  }

  if (file.size > UPLOAD_CONFIG.MAX_FILE_SIZE) {
    return { 
      valid: false, 
      error: `File too large (${(file.size / 1024 / 1024).toFixed(1)}MB). Maximum size is ${UPLOAD_CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB` 
    };
  }

  if (!UPLOAD_CONFIG.ALLOWED_TYPES.includes(file.type.toLowerCase())) {
    return { 
      valid: false, 
      error: `Unsupported file type (${file.type}). Allowed types: ${UPLOAD_CONFIG.ALLOWED_TYPES.join(', ')}` 
    };
  }

  return { valid: true };
}

/**
 * Sleep utility for retry delays
 */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Uploads a custom image to Firebase Storage and returns the download URL
 * Enhanced with retry logic, validation, and concurrency control
 * @param file The file to upload
 * @param orderId The order ID to use in the storage path
 * @param index The index of the image in the order
 * @returns Promise with the download URL
 */
export const uploadCustomImage = async (
  file: File,
  orderId: string,
  index: number
): Promise<string> => {
  // Validate file first
  const validation = validateImageFile(file);
  if (!validation.valid) {
    console.warn(`File validation failed: ${validation.error}`);
    return '';
  }

  // Acquire semaphore to control concurrency
  const release = await uploadSemaphore.acquire();
  
  try {
    let lastError: Error | null = null;
    
    // Retry logic with exponential backoff
    for (let attempt = 1; attempt <= UPLOAD_CONFIG.MAX_RETRIES; attempt++) {
      try {
        console.log(`Upload attempt ${attempt}/${UPLOAD_CONFIG.MAX_RETRIES} for image ${index}`);
        
        // Create a unique file name
        const fileExtension = file.name.split('.').pop() || 'jpg';
        const fileName = `${nanoid()}.${fileExtension}`;
        
        // Create a reference to the storage location
        const storageRef = ref(storage, `orders/${orderId}/images/${fileName}`);
        
        console.log(`Starting upload for file ${fileName} to path orders/${orderId}/images/`);
        
        // Upload the file with a timeout
        const uploadPromise = uploadBytes(storageRef, file);
        
        // Set a timeout to prevent hanging
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error('Upload timed out')), UPLOAD_CONFIG.TIMEOUT_MS);
        });
        
        // Race between upload and timeout
        const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as UploadResult;
        
        // Get the download URL
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        // Verify the URL is valid
        if (!downloadURL || typeof downloadURL !== 'string' || downloadURL.trim() === '') {
          throw new Error('Invalid download URL received from Firebase');
        }
        
        console.log(`Successfully uploaded image ${index} to Firebase: ${downloadURL}`);
        return downloadURL;
        
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        console.warn(`Upload attempt ${attempt} failed for image ${index}:`, lastError.message);
        
        // Don't wait on the last attempt
        if (attempt < UPLOAD_CONFIG.MAX_RETRIES) {
          // Exponential backoff: 1s, 2s, 4s
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          console.log(`Waiting ${delayMs}ms before retry...`);
          await sleep(delayMs);
        }
      }
    }
    
    // All attempts failed
    console.error(`All ${UPLOAD_CONFIG.MAX_RETRIES} upload attempts failed for image ${index}:`, lastError?.message);
    return '';
    
  } finally {
    // Always release the semaphore
    release();
  }
};

/**
 * Uploads multiple custom images to Firebase Storage
 * Enhanced with better error handling, progress tracking, and reliability
 * @param images Array of custom images with files
 * @param orderId The order ID to use in the storage path
 * @param onProgress Optional callback for progress updates
 * @returns Promise with updated images array with download URLs and upload statistics
 */
export const uploadCustomImages = async (
  images: CustomImage[],
  orderId: string,
  onProgress?: (progress: { completed: number; total: number; failed: number; currentImage?: string }) => void
): Promise<CustomImage[]> => {
  // Filter out invalid images
  const validImages = images.filter(img => img !== null && img !== undefined);
  
  if (validImages.length === 0) {
    console.log('No images to upload');
    return images;
  }
  
  console.log(`Starting enhanced upload of ${validImages.length} images for order ${orderId}`);
  
  // Separate images that need uploading from those that don't
  const imagesToUpload = validImages.filter(img => 
    img.file && (!img.url || !img.url.startsWith('http'))
  );
  const alreadyUploadedImages = validImages.filter(img => 
    !img.file || (img.url && img.url.startsWith('http'))
  );
  
  console.log(`${imagesToUpload.length} images need uploading, ${alreadyUploadedImages.length} already have URLs`);
  
  if (imagesToUpload.length === 0) {
    return validImages;
  }
  
  const results: CustomImage[] = [...alreadyUploadedImages];
  let completedCount = alreadyUploadedImages.length;
  let failedCount = 0;
  
  // Update initial progress
  onProgress?.({
    completed: completedCount,
    total: validImages.length,
    failed: failedCount
  });
  
  try {
    // Process images sequentially to avoid overwhelming Firebase
    for (let i = 0; i < imagesToUpload.length; i++) {
      const image = imagesToUpload[i];
      const imageIndex = i;
      
      try {
        // Update progress with current image
        onProgress?.({
          completed: completedCount,
          total: validImages.length,
          failed: failedCount,
          currentImage: `Uploading image ${imageIndex + 1}/${imagesToUpload.length}...`
        });
        
        console.log(`Processing image ${imageIndex + 1}/${imagesToUpload.length}`);
        
        // Validate image before upload
        if (image.file) {
          const validation = validateImageFile(image.file);
          if (!validation.valid) {
            console.warn(`Image ${imageIndex + 1} validation failed: ${validation.error}`);
            results.push({ ...image, url: '/placeholder.jpg' });
            failedCount++;
            continue;
          }
        }
        
        // Upload the image
        const downloadURL = await uploadCustomImage(image.file!, orderId, imageIndex);
        
        if (downloadURL && downloadURL.startsWith('http')) {
          // Success
          results.push({ ...image, url: downloadURL });
          completedCount++;
          console.log(`Successfully uploaded image ${imageIndex + 1}: ${downloadURL}`);
        } else {
          // Upload failed but didn't throw
          console.warn(`Upload failed for image ${imageIndex + 1}, using placeholder`);
          results.push({ ...image, url: '/placeholder.jpg' });
          failedCount++;
        }
        
      } catch (error) {
        console.error(`Error processing image ${imageIndex + 1}:`, error);
        results.push({ ...image, url: '/placeholder.jpg' });
        failedCount++;
      }
      
      // Update progress after each image
      onProgress?.({
        completed: completedCount,
        total: validImages.length,
        failed: failedCount
      });
    }
    
    // Final progress update
    onProgress?.({
      completed: completedCount,
      total: validImages.length,
      failed: failedCount,
      currentImage: undefined
    });
    
    console.log(`Upload batch complete: ${completedCount}/${validImages.length} successful, ${failedCount} failed`);
    
    return results;
    
  } catch (error) {
    console.error('Critical error in uploadCustomImages:', error);
    
    // Return images with placeholders for failed uploads
    return images.map(img => ({
      ...img,
      url: img.url || '/placeholder.jpg'
    }));
  }
};

/**
 * Get upload statistics for a batch of images
 */
export function getUploadStats(images: CustomImage[]): {
  total: number;
  needsUpload: number;
  hasUrls: number;
  hasPlaceholders: number;
} {
  const total = images.length;
  const needsUpload = images.filter(img => 
    img.file && (!img.url || !img.url.startsWith('http'))
  ).length;
  const hasUrls = images.filter(img => 
    img.url && img.url.startsWith('http')
  ).length;
  const hasPlaceholders = images.filter(img => 
    img.url === '/placeholder.jpg'
  ).length;
  
  return { total, needsUpload, hasUrls, hasPlaceholders };
}
