import { storage } from '@/lib/firebase';
import { ref, uploadBytes, getDownloadURL, UploadResult } from 'firebase/storage';
import { CustomImage } from '@/types/cart';
import { nanoid } from 'nanoid';

/**
 * Uploads a custom image to Firebase Storage and returns the download URL
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
  try {
    // Skip invalid files
    if (!file || !(file instanceof File)) {
      console.warn('Invalid file provided to uploadCustomImage');
      return '';
    }

    // Create a unique file name
    const fileExtension = file.name.split('.').pop() || 'jpg';
    const fileName = `${nanoid()}.${fileExtension}`;
    
    // Create a reference to the storage location
    const storageRef = ref(storage, `orders/${orderId}/images/${fileName}`);
    
    console.log(`Starting upload for file ${fileName} to path orders/${orderId}/images/`);
    
    // Upload the file with a timeout
    const uploadPromise = uploadBytes(storageRef, file);
    
    // Set a timeout to prevent hanging
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Upload timed out')), 15000); // Increased timeout
    });
    
    // Race between upload and timeout
    const snapshot = await Promise.race([uploadPromise, timeoutPromise]) as UploadResult;
    
    // Get the download URL
    const downloadURL = await getDownloadURL(snapshot.ref);
    
    console.log(`Successfully uploaded image to Firebase: ${downloadURL}`);
    
    // Verify the URL is valid
    if (!downloadURL || typeof downloadURL !== 'string' || downloadURL.trim() === '') {
      console.error('Invalid download URL received from Firebase');
      throw new Error('Invalid download URL');
    }
    
    return downloadURL;
  } catch (error) {
    console.error('Error uploading image to Firebase Storage:', error);
    // Return empty string instead of throwing to prevent the whole process from failing
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
    
    const uploadPromises = validImages.map(async (image, index) => {
      // Skip if no file or already has URL
      if (!image.file || (image.url && image.url.startsWith('http'))) {
        console.log(`Image ${index} already has URL or no file:`, image.url);
        return image;
      }
      
      try {
        // Upload the file and get the download URL with a timeout
        console.log(`Uploading image ${index} for order ${orderId}`);
        const downloadURL = await uploadCustomImage(image.file, orderId, index);
        
        console.log(`Successfully uploaded image ${index}, got URL: ${downloadURL}`);
        
        // Return updated image object with URL
        const updatedImage = {
          ...image,
          url: downloadURL || '' // Ensure we always have at least an empty string
        };
        
        console.log(`Returning updated image object:`, {
          id: updatedImage.id,
          url: updatedImage.url
        });
        
        return updatedImage;
      } catch (error) {
        console.error(`Error uploading image at index ${index}:`, error);
        // Return the original image if upload fails
        return {
          ...image,
          url: image.url || '' // Use empty string instead of null
        };
      }
    });
    
    // Wait for all uploads to complete with a global timeout
    const timeoutPromise = new Promise<CustomImage[]>((_, reject) => {
      setTimeout(() => reject(new Error('All image uploads timed out')), 30000); // Increased timeout
    });
    
    const uploadedImages = await Promise.race<CustomImage[]>([
      Promise.all(uploadPromises),
      timeoutPromise
    ]);
    
    console.log(`Completed uploading ${uploadedImages.length} images:`, 
      uploadedImages.map(img => ({ id: img.id, url: img.url }))
    );
    
    return uploadedImages;
  } catch (error) {
    console.error('Error uploading images to Firebase Storage:', error);
    // Return original images with empty URLs if the whole process fails
    return images.map(img => ({
      ...img,
      url: img.url || '' // Use empty string instead of null
    }));
  }
};
