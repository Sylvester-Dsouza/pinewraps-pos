"use client";

import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Minus, Plus } from "lucide-react";
import { Product } from "@/services/api";
import { toast } from "react-hot-toast";
import ImageUpload from "./custom-images/image-upload";

interface ProductDetailsModalProps {
  product: Product;
  isOpen: boolean;
  onClose: () => void;
  onAddToOrder: (orderItem: {
    product: Product;
    quantity: number;
    selectedVariations: Array<{
      id: string;
      type: string;
      value: string;
      priceAdjustment: number;
    }>;
    notes?: string;
    designImages?: Array<{
      file?: File;
      url?: string;
      comment: string;
    }>;
    totalPrice: number;
  }) => void;
}

interface SelectedOption {
  optionId: string;
  valueId: string;
}

interface ProductVariantValue {
  id: string;
  valueId: string;
  value: {
    id: string;
    value: string;
    position: number;
    optionId: string;
  };
}

interface ProductVariant {
  id: string;
  sku: string;
  price: number;
  stock: number;
  values: ProductVariantValue[];
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  onAddToOrder,
}: ProductDetailsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<ProductVariant | null>(null);
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [designImages, setCustomImages] = useState<Array<{
    file?: File;
    url?: string;
    comment: string;
  }>>([]);

  // Reset state when product changes
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setSelectedOptions([]);
      setSelectedVariant(null);
      setCustomPrice(null);
      setNotes("");
      setCustomImages([]);
    }
  }, [isOpen, product]);

  // Find matching variant when options change
  useEffect(() => {
    if (selectedOptions.length === (product.options?.length || 0)) {
      // Sort options by ID to ensure consistent matching
      const sortedSelectedOptions = [...selectedOptions].sort((a, b) => a.optionId.localeCompare(b.optionId));
      
      // Find variant that matches all selected options
      const matchingVariant = product.variants?.find(variant => {
        // Sort variant values by optionId for consistent comparison
        const variantValues = (variant.values as ProductVariantValue[])?.sort((a, b) => 
          a.value.optionId.localeCompare(b.value.optionId)
        );
        
        // Check if variant has exact match for all selected options
        return sortedSelectedOptions.every((selectedOption, index) => {
          const variantValue = variantValues?.[index];
          return variantValue?.valueId === selectedOption.valueId;
        });
      }) as ProductVariant | undefined;
      
      console.log('Selected options:', sortedSelectedOptions);
      console.log('Found variant:', matchingVariant);
      setSelectedVariant(matchingVariant || null);
    } else {
      setSelectedVariant(null);
    }
  }, [selectedOptions, product]);

  // Calculate total price based on quantity, custom price, and selected variant
  const calculateTotalPrice = () => {
    if (!product) return 0;

    // If custom price is set, use it
    if (product.allowCustomPrice && customPrice !== null) {
      return customPrice * quantity;
    }

    // If variant is selected, use variant price
    if (selectedVariant) {
      return selectedVariant.price * quantity;
    }

    // Otherwise use base product price
    return product.basePrice * quantity;
  };

  // Check if all required options are selected
  const isReadyToAdd = () => {
    // If no options, always ready
    if (!product.options?.length) return true;

    // Check if all options have been selected
    const allOptionsSelected = product.options.every(option =>
      selectedOptions.some(selected => selected.optionId === option.id)
    );

    return allOptionsSelected;
  };

  const handleOptionChange = (optionId: string, valueId: string) => {
    setSelectedOptions(prev => {
      // Remove any existing selection for this option
      const newOptions = prev.filter(opt => opt.optionId !== optionId);
      // Add new selection
      const updatedOptions = [...newOptions, { optionId, valueId }];
      
      // Sort by option position to maintain consistent order
      return updatedOptions.sort((a, b) => {
        const optionA = product.options?.find(o => o.id === a.optionId);
        const optionB = product.options?.find(o => o.id === b.optionId);
        return (optionA?.position || 0) - (optionB?.position || 0);
      });
    });
  };

  const handleAddToOrder = () => {
    if (!product) return;

    // Check if all required options are selected
    if (!isReadyToAdd()) {
      toast.error('Please select all required options');
      return;
    }

    // Validate custom price if product allows it
    if (product.allowCustomPrice && customPrice === null) {
      toast.error('Please enter a custom price');
      return;
    }

    const variations = selectedOptions.map(option => {
      const optionDef = product.options?.find(o => o.id === option.optionId);
      const valueDef = optionDef?.values.find(v => v.id === option.valueId);
      
      return {
        id: option.optionId,
        type: optionDef?.name || '',
        value: valueDef?.value || '',
        priceAdjustment: 0
      };
    });

    onAddToOrder({
      product,
      quantity,
      selectedVariations: variations,
      notes,
      designImages,
      totalPrice: calculateTotalPrice(),
    });

    onClose();
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black bg-opacity-25" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-2xl transform overflow-hidden rounded-2xl bg-white p-6 shadow-xl transition-all">
                <div className="relative">
                  <button
                    onClick={onClose}
                    className="absolute right-0 top-0 p-4 text-gray-400 hover:text-gray-500"
                  >
                    <X className="h-8 w-8" />
                  </button>

                  <div className="mt-8">
                    <Dialog.Title as="h3" className="text-3xl font-bold text-gray-900 mb-4">
                      {product.name}
                    </Dialog.Title>

                    {/* Custom Price Input */}
                    {product.allowCustomPrice && (
                      <div className="mb-8">
                        <label 
                          htmlFor="custom-price" 
                          className="block text-xl font-semibold text-gray-900 mb-2"
                        >
                          Custom Price (AED)
                        </label>
                        <input
                          type="number"
                          id="custom-price"
                          name="custom-price"
                          min="0"
                          step="0.01"
                          value={customPrice || ''}
                          onChange={(e) => setCustomPrice(parseFloat(e.target.value) || null)}
                          className="block w-full text-2xl p-4 rounded-xl border-2 border-gray-300 focus:border-black focus:ring-0 transition-colors"
                          placeholder="Enter price"
                        />
                      </div>
                    )}

                    {/* Price Display */}
                    {!product.allowCustomPrice && (
                      <div className="text-2xl font-semibold text-gray-900 mb-6">
                        AED {calculateTotalPrice().toFixed(2)}
                      </div>
                    )}

                    {/* Notes */}
                    <div className="mt-4">
                      <label
                        htmlFor="notes"
                        className="block text-sm font-medium text-gray-700"
                      >
                        Notes
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        rows={3}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Add any special instructions..."
                      />
                    </div>

                    {/* Design Images - Only show for products that require design and allow design images */}
                    {product.requiresDesign && product.allowCustomImages && (
                      <div className="mt-6">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-lg font-medium text-gray-900">
                            Design Images
                          </label>
                          <span className="text-sm text-gray-500">
                            Upload reference images for your custom design
                          </span>
                        </div>
                        <ImageUpload 
                          onChange={(images) => setCustomImages(images)}
                        />
                        {designImages.length > 0 && (
                          <div className="mt-2 text-sm text-gray-500">
                            {designImages.length} image{designImages.length !== 1 ? 's' : ''} added
                          </div>
                        )}
                      </div>
                    )}

                    {/* Product Options */}
                    {product.options?.sort((a, b) => a.position - b.position).map((option) => (
                      <div key={option.id} className="mb-6">
                        <h4 className="text-lg font-medium mb-3">{option.name}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {option.values?.sort((a, b) => a.position - b.position).map((value) => {
                            const isSelected = selectedOptions.some(
                              opt => opt.optionId === option.id && opt.valueId === value.id
                            );
                            return (
                              <button
                                key={value.id}
                                onClick={() => handleOptionChange(option.id, value.id)}
                                className={`p-4 rounded-xl text-lg font-medium transition-all ${
                                  isSelected
                                    ? 'bg-black text-white'
                                    : 'bg-gray-100 text-gray-900 hover:bg-gray-200'
                                }`}
                              >
                                {value.value}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}

                    {/* Quantity Selector */}
                    <div className="flex items-center gap-4 mb-8">
                      <span className="text-lg font-medium">Quantity:</span>
                      <div className="flex items-center gap-4">
                        <button
                          onClick={() => setQuantity(Math.max(1, quantity - 1))}
                          className="bg-gray-100 hover:bg-gray-200 p-4 rounded-full"
                        >
                          <Minus className="h-6 w-6" />
                        </button>
                        <span className="text-2xl font-semibold min-w-[3rem] text-center">
                          {quantity}
                        </span>
                        <button
                          onClick={() => setQuantity(quantity + 1)}
                          className="bg-gray-100 hover:bg-gray-200 p-4 rounded-full"
                        >
                          <Plus className="h-6 w-6" />
                        </button>
                      </div>
                    </div>

                    {/* Add to Order Button */}
                    <button
                      onClick={handleAddToOrder}
                      disabled={!isReadyToAdd()}
                      className={`w-full text-xl font-semibold py-8 px-4 rounded-2xl shadow-lg transition-all ${
                        isReadyToAdd()
                          ? 'bg-black hover:bg-gray-900 text-white active:transform active:scale-[0.99]'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {isReadyToAdd() 
                        ? `Add to Order - AED ${calculateTotalPrice().toFixed(2)}`
                        : 'Please select all required options'}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
