'use client';

import Image from 'next/image';
import { useState } from 'react';

// Helper function to sanitize image URLs
const sanitizeImageUrl = (url: string) => {
  if (!url) return '/placeholder.jpg';
  try {
    const urlObject = new URL(url);
    if (urlObject.protocol && urlObject.host) return url;
    return '/placeholder.jpg';
  } catch (error) {
    console.error(`Invalid image URL: ${url}`);
    return '/placeholder.jpg';
  }
};

interface CartItemImagesProps {
  images: Array<{
    url: string;
    comment?: string;
  }>;
  compact?: boolean; 
}

export default function CartItemImages({ images, compact = false }: CartItemImagesProps) {
  const [selectedImage, setSelectedImage] = useState<number | null>(null);

  if (!images?.length) return null;

  if (compact) {
    const firstImage = images[0];
    return (
      <div className="mt-2">
        <div
          className="relative min-w-[40px] w-[40px] h-[40px] cursor-pointer rounded-md overflow-hidden border border-gray-200 hover:border-blue-500 transition-colors"
          onClick={() => setSelectedImage(0)}
        >
          <Image
            src={sanitizeImageUrl(firstImage.url)}
            alt="Design preview"
            fill
            sizes="40px"
            className="object-cover hover:opacity-90 transition-opacity"
            onError={(e) => {
              console.error(`Image load error: ${(e.target as HTMLImageElement).src}`);
              const target = e.target as HTMLImageElement;
              if (target.parentElement) {
                target.parentElement.innerHTML = '<span class="text-[8px] text-center text-gray-400">No image</span>';
              } else {
                target.style.display = 'none';
              }
            }}
          />
          {images.length > 1 && (
            <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 text-center">
              +{images.length - 1}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2">
      <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4">
        {images.map((image, index) => (
          <div
            key={`${image.url}-${index}`}
            className="relative min-w-[60px] w-[60px] h-[60px] cursor-pointer rounded-md overflow-hidden border border-gray-200 hover:border-blue-500 transition-colors"
            onClick={() => setSelectedImage(index)}
          >
            <Image
              src={sanitizeImageUrl(image.url)}
              alt={`Design ${index + 1}`}
              fill
              sizes="60px"
              className="object-cover hover:opacity-90 transition-opacity"
              onError={(e) => {
                console.error(`Image load error: ${(e.target as HTMLImageElement).src}`);
                const target = e.target as HTMLImageElement;
                if (target.parentElement) {
                  target.parentElement.innerHTML = '<span class="text-[8px] text-center text-gray-400">No image</span>';
                } else {
                  target.style.display = 'none';
                }
              }}
            />
            {image.comment && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] px-1 py-0.5 truncate">
                {image.comment}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Preview Modal */}
      {selectedImage !== null && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div 
            className="relative w-full max-w-3xl aspect-square bg-white rounded-lg overflow-hidden shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <Image
              src={sanitizeImageUrl(images[selectedImage].url)}
              alt={`Design ${selectedImage + 1}`}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-contain"
              onError={(e) => {
                console.error(`Image load error: ${(e.target as HTMLImageElement).src}`);
                const target = e.target as HTMLImageElement;
                if (target.parentElement) {
                  target.parentElement.innerHTML = '<div class="flex items-center justify-center h-full text-gray-400">Image not available</div>';
                } else {
                  target.style.display = 'none';
                }
              }}
            />
            {images[selectedImage].comment && (
              <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-sm px-4 py-2">
                {images[selectedImage].comment}
              </div>
            )}
            <button
              className="absolute top-4 right-4 bg-black/50 hover:bg-black/70 text-white w-8 h-8 rounded-full flex items-center justify-center transition-colors"
              onClick={() => setSelectedImage(null)}
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
