import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, UploadResult } from 'firebase/storage';
import { CustomImage } from '@/types/cart';
import { nanoid } from 'nanoid';

/**
 * Uploads a custom image to Firebase Storage and returns the download URL
 * @param file The file to upload
 * @param orderId The order ID to use in the storage path
 * @param index The index of the image in the order
 * @param retryCount The number of retries
 * @returns Promise with the download URL
 */
export const uploadCustomImage = async (
  file: File,
  orderId: string,
  index: number = 0,
  retryCount: number = 0
): Promise<string> => {
  try {
    // Validate file
    if (!file) {
      console.warn('Invalid file provided to uploadCustomImage');
      return '';
    }

    // Create a unique file name
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${nanoid()}.${fileExtension}`;
    
    // Create a reference to the storage location
    const storageRef = ref(storage, `orders/${orderId}/images/${fileName}`);
    
    console.log(`Starting upload for file ${fileName} to path orders/${orderId}/images/ (attempt ${retryCount + 1})`);
    
    // Upload the file with a timeout
    const uploadPromise = uploadBytes(storageRef, file);
    
    // Set a timeout to prevent hanging - use a longer timeout for larger files
    const fileSize = file.size;
    const timeoutMs = Math.min(30000, 15000 + Math.floor(fileSize / 100000) * 5000); // Base 15s + 5s per 100KB, max 30s
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(`Upload timed out after ${timeoutMs}ms`)), timeoutMs);
    });
    
    // Race between upload and timeout
    const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as UploadResult;
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`Successfully uploaded image ${index} to Firebase: ${downloadURL}`);
    
    // Verify the URL is valid
    if (!downloadURL || typeof downloadURL !== 'string' || downloadURL.trim() === '') {
      console.error('Invalid download URL received from Firebase');
      throw new Error('Invalid download URL');
    }
    
    return downloadURL;
  } catch (error) {
    console.error(`Error uploading image ${index} to Firebase Storage:`, error);
    
    // Retry logic - attempt up to 3 retries with exponential backoff
    if (retryCount < 3) {
      const backoffTime = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s
      console.log(`Retrying upload for image ${index} after ${backoffTime}ms (attempt ${retryCount + 1}/3)`);
      
      // Wait for backoff period
      await new Promise(resolve => setTimeout(resolve, backoffTime));
      
      // Retry the upload
      return uploadCustomImage(file, orderId, index, retryCount + 1);
    }
    
    // After all retries failed
    console.error(`All ${retryCount + 1} attempts to upload image ${index} failed`);
    return '';
  }
};

/**
 * Uploads multiple custom images to Firebase Storage
 * @param images Array of custom images with files
 * @param orderId The order ID to use in the storage path
 * @returns Promise with updated images array with download URLs
 */
export const uploadCustomImages = async (
  images: CustomImage[],
  orderId: string
): Promise<CustomImage[]> => {
  try {
    // Filter out invalid images
    const validImages = images.filter(img => img !== null && img !== undefined);
    
    if (validImages.length === 0) {
      return images;
    }
    
    console.log(`Starting upload of ${validImages.length} images for order ${orderId}`);
    
    // Process images sequentially to avoid overwhelming Firebase
    const results: CustomImage[] = [];
    
    for (let index = 0; index < validImages.length; index++) {
      const image = validImages[index];
      
      // Skip if no file or already has URL
      if (!image.file || (image.url && image.url.startsWith('http'))) {
        console.log(`Image ${index} already has URL or no file:`, image.url);
        results.push(image);
        continue;
      }
      
      try {
        // Upload the file and get the download URL
        console.log(`Uploading image ${index} for order ${orderId}`);
        const downloadURL = await uploadCustomImage(image.file, orderId, index);
        
        // Verify we got a valid URL
        if (!downloadURL || downloadURL.trim() === '') {
          console.warn(`No valid URL returned for image ${index}, retrying once more`);
          // One more attempt if we didn't get a URL
          const retryURL = await uploadCustomImage(image.file, orderId, index);
          
          if (!retryURL || retryURL.trim() === '') {
            throw new Error(`Failed to get valid URL for image ${index} after retry`);
          }
          
          console.log(`Retry successful for image ${index}, got URL: ${retryURL}`);
          
          // Add the successfully uploaded image to results
          results.push({
            ...image,
            url: retryURL
          });
        } else {
          console.log(`Successfully uploaded image ${index}, got URL: ${downloadURL}`);
          
          // Add the successfully uploaded image to results
          results.push({
            ...image,
            url: downloadURL
          });
        }
      } catch (error) {
        console.error(`Error uploading image at index ${index}:`, error);
        // Add the original image to results if upload fails
        results.push({
          ...image,
          url: image.url || '' // Use empty string instead of null
        });
      }
    }
    
    // Verify all images were processed
    if (results.length !== validImages.length) {
      console.error(`Image count mismatch: expected ${validImages.length}, got ${results.length}`);
    }
    
    // Log successful uploads
    const successfulUploads = results.filter(img => img.url && img.url.startsWith('http')).length;
    console.log(`Successfully uploaded ${successfulUploads}/${validImages.length} images for order ${orderId}`);
    
    return results;
  } catch (error) {
    console.error('Error in uploadCustomImages:', error);
    // Return original images with their existing URLs if the whole process fails
    return images.map(img => ({
      ...img,
      url: img.url || '' // Use empty string instead of null
    }));
  }
};
