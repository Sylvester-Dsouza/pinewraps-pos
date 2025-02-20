'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload } from 'lucide-react';
import Image from 'next/image';
import { CustomImage } from '@/services/api';

interface ImageUploadProps {
  onChange: (images: CustomImage[]) => void;
  value?: CustomImage[];
}

export default function ImageUpload({ onChange, value }: ImageUploadProps) {
  const [images, setImages] = useState<CustomImage[]>(value || []);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Update images when value prop changes
  useEffect(() => {
    if (value) {
      setImages(value);
    }
  }, [value]);

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
          <div key={index} className="relative">
            <div className="aspect-square relative rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={image.previewUrl || image.url || ''}
                alt={`Custom image ${index + 1}`}
                fill
                className="object-cover"
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
        className="w-full py-3 px-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-gray-400 focus:outline-none focus:border-gray-400 transition-colors"
      >
        <div className="flex flex-col items-center">
          <Upload className="h-6 w-6 text-gray-400" />
          <span className="mt-2 text-sm font-medium text-gray-600">
            Click to upload design images
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
