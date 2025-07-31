'use client';

import React, { useState, useEffect, useRef } from 'react';
import { X, Upload, Trash2, Plus, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { toast } from 'react-hot-toast';
import { nanoid } from 'nanoid';
import { apiMethods } from '@/services/api';

interface CustomImage {
  id: string;
  url: string;
  comment: string;
  file?: File;
  previewUrl?: string;
}

interface CustomImageManagerProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  orderItem: any;
  itemIndex: number;
  onImagesUpdated: (orderId: string, itemIndex: number, images: CustomImage[]) => void;
}

export default function CustomImageManager({
  isOpen,
  onClose,
  orderId,
  orderItem,
  itemIndex,
  onImagesUpdated
}: CustomImageManagerProps) {
  const [images, setImages] = useState<CustomImage[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize images from order item
  useEffect(() => {
    if (isOpen && orderItem) {
      const existingImages = orderItem.customImages || [];
      setImages(existingImages.map((img: any) => ({
        id: img.id || nanoid(),
        url: img.url,
        comment: img.comment || '',
      })));
    }
  }, [isOpen, orderItem]);

  const processImageUrl = (url: string): string => {
    if (!url) return '/placeholder.jpg';
    
    // Handle blob URLs
    if (url.startsWith('blob:')) {
      return '/placeholder.jpg';
    }
    
    // Use proxy for Firebase Storage URLs
    if (url.includes('firebasestorage.googleapis.com')) {
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
    
    return url;
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    // Create preview URLs for new images
    const newImages = files.map(file => ({
      id: nanoid(),
      file,
      previewUrl: URL.createObjectURL(file),
      url: '',
      comment: ''
    }));

    setImages(prev => [...prev, ...newImages]);
    
    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = async (imageId: string) => {
    const imageToRemove = images.find(img => img.id === imageId);

    if (!imageToRemove) return;

    // If it's a new image (has file property), just remove from state
    if (imageToRemove.file) {
      setImages(prev => prev.filter(img => img.id !== imageId));
      return;
    }

    // If it's an existing image, delete from backend
    try {
      const response = await apiMethods.pos.deleteCustomImage(imageId);

      if (response.success) {
        setImages(prev => prev.filter(img => img.id !== imageId));
        toast.success('Image deleted successfully');
      } else {
        toast.error('Failed to delete image');
      }
    } catch (error) {
      console.error('Error deleting image:', error);
      toast.error('Failed to delete image');
    }
  };

  const handleCommentChange = (imageId: string, comment: string) => {
    setImages(prev => prev.map(img => 
      img.id === imageId ? { ...img, comment } : img
    ));
  };

  const handleSave = async () => {
    try {
      setUploading(true);
      
      // Separate existing images from new uploads
      const existingImages = images.filter(img => !img.file);
      const newImages = images.filter(img => img.file);
      
      // Upload new images if any
      let uploadedImages: CustomImage[] = [];
      if (newImages.length > 0) {
        // Here we would call the upload API
        // For now, we'll simulate the upload
        uploadedImages = await uploadNewImages(newImages);
      }
      
      // Combine existing and newly uploaded images
      const allImages = [...existingImages, ...uploadedImages];
      
      // Update the parent component
      onImagesUpdated(orderId, itemIndex, allImages);
      
      toast.success('Custom images updated successfully');
      onClose();
    } catch (error) {
      console.error('Error saving images:', error);
      toast.error('Failed to save images');
    } finally {
      setUploading(false);
    }
  };

  const uploadNewImages = async (newImages: CustomImage[]): Promise<CustomImage[]> => {
    try {
      // Prepare images for upload
      const imagesToUpload = newImages
        .filter(img => img.file)
        .map(img => ({
          file: img.file!,
          comment: img.comment || ''
        }));

      if (imagesToUpload.length === 0) {
        return [];
      }

      // Upload images using the API
      const response = await apiMethods.pos.uploadCustomImages(
        orderItem.id, // Use the order item ID
        imagesToUpload
      );

      if (response.success) {
        // Return the uploaded images with proper structure
        return response.data.map((uploadedImg: any) => ({
          id: uploadedImg.id,
          url: uploadedImg.url,
          comment: uploadedImg.comment || ''
        }));
      } else {
        throw new Error(response.message || 'Failed to upload images');
      }
    } catch (error) {
      console.error('Error uploading images:', error);
      throw error;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Manage Custom Images</h2>
            <p className="text-sm text-gray-600 mt-1">
              Order #{orderId} - {orderItem?.productName || 'Product'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Upload Button */}
          <div className="mb-6">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              <Plus className="h-4 w-4" />
              Add Images
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Images Grid */}
          {images.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {images.map((image) => (
                <div key={image.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="relative mb-3">
                    <Image
                      src={image.previewUrl || processImageUrl(image.url)}
                      alt="Custom image"
                      width={200}
                      height={150}
                      className="w-full h-32 object-cover rounded"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (target.src !== '/placeholder.jpg') {
                          target.src = '/placeholder.jpg';
                        }
                      }}
                    />
                    <button
                      onClick={() => handleRemoveImage(image.id)}
                      className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Comment
                    </label>
                    <textarea
                      value={image.comment}
                      onChange={(e) => handleCommentChange(image.id, e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm resize-none"
                      rows={2}
                      placeholder="Add a comment..."
                    />
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No custom images added</p>
              <p className="text-sm text-gray-400 mt-1">Click "Add Images" to upload custom images</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            disabled={uploading}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={uploading}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}
