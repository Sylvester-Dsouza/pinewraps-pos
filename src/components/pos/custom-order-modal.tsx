'use client';

import { useState, useRef, useEffect } from 'react';
import { X } from 'lucide-react';
import ImageUpload from './design/image-upload';
import { apiMethods } from '@/services/api';
import { toast } from 'react-hot-toast';

interface DesignImage {
  file?: File;
  url?: string;
  comment: string;
  previewUrl?: string;
}

interface CustomProduct {
  id: string;
  name: string;
  price: number;
  isCustom: boolean;
  designImages: Array<{
    url: string;
    comment: string;
  }>;
}

interface CustomProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAdd: (product: {
    id: string;
    name: string;
    price: number;
    productId?: string | null;
    customProductId?: string;
    product: {
      id: string;
      name: string;
      basePrice: number;
      status: string;
      images: Array<{
        url: string;
        comment: string;
      }>;
    };
    quantity: number;
    selectedVariations: never[];
    totalPrice: number;
  }) => void;
}

export default function CustomProductModal({ isOpen, onClose, onAdd }: CustomProductModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [designImages, setDesignImages] = useState<DesignImage[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      // Clean up preview URLs
      designImages.forEach(image => {
        if (image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
    };
  }, [onClose, designImages]);

  const handleSubmit = async () => {
    if (!name || !price) {
      toast.error('Please provide a name and price');
      return;
    }

    try {
      setIsSubmitting(true);

      // Create FormData and append product data
      const formData = new FormData();
      formData.append('data', JSON.stringify({
        name,
        price: parseFloat(price),
        isCustom: true
      }));

      // Append design images if any
      designImages.forEach((image, index) => {
        if (image.file) {
          formData.append(`designImage_${index}`, image.file);
          formData.append(`designImageComment_${index}`, image.comment || '');
        }
      });

      // Create custom product with design images
      const response = await apiMethods.pos.createCustomProduct(formData);

      if (!response.success) {
        throw new Error(response.message || 'Failed to create custom product');
      }

      const customProduct = response.data as CustomProduct;
      
      // Add to order with the proper structure
      console.log('Custom product data:', customProduct);
      onAdd({
        id: customProduct.id,
        name: customProduct.name,
        price: customProduct.price,
        productId: undefined,
        product: {
          id: `custom_${customProduct.id}`, // Prefix with custom_ to identify custom products
          name: customProduct.name,
          basePrice: customProduct.price,
          status: 'ACTIVE',
          images: customProduct.designImages.map(img => ({
            url: img.url,
            comment: img.comment
          }))
        },
        quantity: 1,
        selectedVariations: [],
        totalPrice: customProduct.price
      });

      // Reset form and clean up preview URLs
      designImages.forEach(image => {
        if (image.previewUrl) {
          URL.revokeObjectURL(image.previewUrl);
        }
      });
      setName('');
      setPrice('');
      setDesignImages([]);
      onClose();
    } catch (error: any) {
      console.error('Failed to create custom product:', error);
      toast.error(error.message || 'Failed to create custom product');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 md:p-6">
      <div 
        ref={modalRef} 
        className="w-full md:max-w-lg bg-white rounded-2xl shadow-xl flex flex-col max-h-[90vh]"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-semibold text-gray-900">Create Custom Product</h2>
          <button 
            onClick={onClose} 
            className="p-2 hover:bg-gray-100 rounded-full transition-colors touch-manipulation"
          >
            <X className="h-6 w-6 text-gray-500" />
          </button>
        </div>

        {/* Form */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {/* Name */}
          <div>
            <label className="block text-base font-medium text-gray-900 mb-2">
              Product Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full h-14 px-4 rounded-xl border-2 border-gray-200 focus:border-black focus:ring-0 text-lg transition-colors touch-manipulation"
              placeholder="Enter product name"
            />
          </div>

          {/* Price */}
          <div>
            <label className="block text-base font-medium text-gray-900 mb-2">
              Price (AED)
            </label>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              className="w-full h-14 px-4 rounded-xl border-2 border-gray-200 focus:border-black focus:ring-0 text-lg transition-colors touch-manipulation"
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>

          {/* Design Images */}
          <div>
            <label className="block text-base font-medium text-gray-900 mb-2">
              Upload Images
            </label>
            <ImageUpload onChange={setDesignImages} />
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !name || !price}
            className="w-full h-14 bg-black text-white text-lg font-medium rounded-xl hover:bg-gray-900 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors touch-manipulation"
          >
            {isSubmitting ? 'Creating Product...' : 'Create Custom Product'}
          </button>
        </div>
      </div>
    </div>
  );
}
