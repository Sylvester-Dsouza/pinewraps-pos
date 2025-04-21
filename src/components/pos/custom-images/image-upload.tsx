'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import Image from 'next/image';
import { CustomImage } from '@/types/cart';
import { nanoid } from 'nanoid';

interface ImageUploadProps {
  onChange: (images: CustomImage[]) => void;
  value?: CustomImage[];
}

export default function ImageUpload({ onChange, value }: ImageUploadProps) {
  const [images, setImages] = useState<CustomImage[]>(value || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Function to convert Firebase Storage URLs to use our proxy
  const getProxiedImageUrl = (url: string): string => {
    if (!url) return '';
    
    // Handle blob URLs
    if (url.startsWith('blob:')) {
      console.log('Found blob URL, replacing with placeholder:', url);
      return '/placeholder.jpg';
    }
    
    // Use our proxy for Firebase Storage URLs
    if (url.includes('firebasestorage.googleapis.com')) {
      console.log('Using proxy for Firebase Storage URL:', url);
      return `/api/proxy/image?url=${encodeURIComponent(url)}`;
    }
    
    // For all other URLs, use them directly
    return url;
  };
  
  // Update images when value prop changes
  useEffect(() => {
    if (value) {
      console.log('ImageUpload received value:', value);
      // Ensure all images have valid URLs
      const processedImages = value.map(img => {
        // Handle blob URLs - they can't be displayed directly when loaded from storage
        const isBlob = img.url?.startsWith('blob:');
        
        return {
          ...img,
          // Make sure URLs are absolute and use proxy for Firebase Storage URLs
          url: getProxiedImageUrl(img.url),
          // Mark blob URLs so we can handle them specially
          isBlobUrl: isBlob
        };
      });
      setImages(processedImages);
    }
  }, [value]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    if (files.length === 0) return;
    
    console.log(`Selected ${files.length} new files for upload`);
    
    // Create preview URLs for new images
    const newImages = files.map(file => ({
      id: nanoid(),
      file,
      previewUrl: URL.createObjectURL(file),
      url: '',
      comment: ''
    }));

    // Update state and notify parent in a single update
    const updatedImages = [...images, ...newImages];
    console.log('Updated images array:', updatedImages);
    setImages(updatedImages);
    onChange(updatedImages);
    
    // Reset the file input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      
      // Revoke the preview URL to free up memory
      if (prev[index].previewUrl) {
        URL.revokeObjectURL(prev[index].previewUrl);
      }
      
      onChange(updated);
      return updated;
    });
  };

  const handleCommentChange = (index: number, comment: string) => {
    setImages(prev => {
      const updated = prev.map((img, i) => 
        i === index ? { ...img, comment } : img
      );
      onChange(updated);
      return updated;
    });
  };

  // Clean up preview URLs when component unmounts
  useEffect(() => {
    return () => {
      images.forEach(image => {
        if (image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    };
  }, [images]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        {images.map((image, index) => (
          <div key={image.id} className="relative">
            <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100">
              {/* Use img tag instead of Image component to avoid Next.js image optimization issues */}
              <img
                src={image.previewUrl || image.url || '/placeholder.jpg'}
                alt={`Custom image ${index + 1}`}
                className="absolute inset-0 w-full h-full object-cover"
                onError={(e) => {
                  // Silently handle image load error without console spam
                  // Just set the fallback image
                  if (e.currentTarget.src !== '/placeholder.jpg') {
                    e.currentTarget.src = '/placeholder.jpg';
                  }
                }}
              />
              <button
                type="button"
                onClick={() => handleRemoveImage(index)}
                className="absolute top-2 right-2 p-1 bg-black bg-opacity-50 rounded-full hover:bg-opacity-75 transition-opacity"
              >
                <X className="h-4 w-4 text-white" />
              </button>
            </div>
            <input
              type="text"
              value={image.comment}
              onChange={(e) => handleCommentChange(index, e.target.value)}
              placeholder="Add a comment..."
              className="mt-2 w-full text-sm rounded-md border-gray-300 shadow-sm focus:border-black focus:ring-0"
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => fileInputRef.current?.click()}
        className="w-full py-4 px-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 hover:bg-gray-100 focus:outline-none focus:border-blue-400 transition-colors"
      >
        <div className="flex flex-col items-center">
          <Upload className="h-8 w-8 text-blue-500" />
          <span className="mt-2 text-sm font-medium text-gray-700">
            Click to upload images
          </span>
          <span className="mt-1 text-xs text-gray-500">
            JPG, PNG, or GIF files accepted
          </span>
        </div>
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
  );
}
