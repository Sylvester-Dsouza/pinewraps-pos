'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import Image from 'next/image';

interface DesignImage {
  file?: File;
  url?: string;
  previewUrl?: string;
  comment: string;
}

interface ImageUploadProps {
  onChange: (images: DesignImage[]) => void;
}

export default function ImageUpload({ onChange }: ImageUploadProps) {
  const [images, setImages] = useState<DesignImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    
    // Create preview URLs for new images
    const newImages = files.map(file => ({
      file,
      previewUrl: URL.createObjectURL(file),
      comment: ''
    }));

    // Update state and notify parent in a single update
    const updatedImages = [...images, ...newImages];
    setImages(updatedImages);
    onChange(updatedImages);
  };

  const handleRemoveImage = (index: number) => {
    setImages(prev => {
      const updated = prev.filter((_, i) => i !== index);
      
      // Revoke the preview URL to free up memory
      if (prev[index].previewUrl) {
        URL.revokeObjectURL(prev[index].previewUrl);
      }
      
      // Notify parent component of the change
      onChange(updated);
      return updated;
    });
  };

  const handleCommentChange = (index: number, comment: string) => {
    setImages(prev => {
      const updated = prev.map((img, i) => 
        i === index ? { ...img, comment } : img
      );
      
      // Notify parent component of the change
      onChange(updated);
      return updated;
    });
  };

  // Cleanup preview URLs when component unmounts
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
      {/* Upload Button */}
      <div 
        className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-blue-500 transition-colors"
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileSelect}
          className="hidden"
          multiple
          accept="image/*"
        />
        <div className="flex flex-col items-center space-y-2">
          <Upload className="h-8 w-8 text-gray-400" />
          <div className="text-sm text-gray-600">
            <span className="font-medium text-blue-600">Click to upload</span> or drag and drop
          </div>
          <p className="text-xs text-gray-500">PNG, JPG, GIF up to 5MB</p>
        </div>
      </div>

      {/* Image Previews */}
      {images.length > 0 && (
        <div className="grid grid-cols-2 gap-4">
          {images.map((image, index) => (
            <div key={index} className="relative border rounded-lg p-3 space-y-2">
              {/* Preview Image */}
              <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-gray-100">
                <Image
                  src={image.previewUrl || image.url || ''}
                  alt={`Design preview ${index + 1}`}
                  className="object-contain"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                />
                {/* Remove Button */}
                <button
                  onClick={() => handleRemoveImage(index)}
                  className="absolute top-2 right-2 p-1 bg-white rounded-full shadow-md hover:bg-gray-100"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Comment Input */}
              <textarea
                value={image.comment}
                onChange={(e) => handleCommentChange(index, e.target.value)}
                placeholder="Add a comment..."
                className="w-full p-2 text-sm border rounded resize-none focus:ring-1 focus:ring-blue-500"
                rows={2}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
