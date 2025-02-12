"use client";

import { Fragment, useState, useEffect } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Minus, Plus } from "lucide-react";
import { Product } from "@/services/api";
import { toast } from "react-hot-toast";
import Image from 'next/image';

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
    totalPrice: number;
  }) => void;
}

interface SelectedOption {
  optionId: string;
  valueId: string;
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  onAddToOrder,
}: ProductDetailsModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOption[]>([]);
  const [selectedVariant, setSelectedVariant] = useState<Product['variants'][0] | null>(null);

  // Reset state when product changes
  useEffect(() => {
    if (isOpen) {
      setQuantity(1);
      setSelectedOptions([]);
      setSelectedVariant(null);
    }
  }, [isOpen, product]);

  // Find matching variant when options change
  useEffect(() => {
    if (selectedOptions.length === product.options.length) {
      const matchingVariant = product.variants.find(variant => 
        selectedOptions.every(selectedOption => 
          variant.values.some(value => 
            value.valueId === selectedOption.valueId
          )
        )
      );
      setSelectedVariant(matchingVariant || null);
    } else {
      setSelectedVariant(null);
    }
  }, [selectedOptions, product]);

  // Calculate total price including selected variant
  const totalPrice = () => {
    const price = selectedVariant ? selectedVariant.price : product.basePrice;
    return price * quantity;
  };

  const handleOptionChange = (optionId: string, valueId: string) => {
    setSelectedOptions(prev => {
      const newOptions = prev.filter(opt => opt.optionId !== optionId);
      return [...newOptions, { optionId, valueId }];
    });
  };

  const handleAddToOrder = () => {
    // Validate all required options are selected
    if (product.options.length > 0 && !selectedVariant) {
      toast.error('Please select all options');
      return;
    }

    onAddToOrder({
      product,
      quantity,
      selectedVariations: selectedOptions.map(opt => {
        const option = product.options.find(o => o.id === opt.optionId)!;
        const value = option.values.find(v => v.id === opt.valueId)!;
        return {
          id: opt.valueId,
          type: option.name,
          value: value.value,
          priceAdjustment: 0 // Price is handled by variant
        };
      }),
      totalPrice: totalPrice()
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

                    {/* Price Display */}
                    <div className="text-2xl font-semibold text-gray-900 mb-6">
                      AED {totalPrice().toFixed(2)}
                    </div>

                    {/* Product Options */}
                    {product.options.sort((a, b) => a.position - b.position).map((option) => (
                      <div key={option.id} className="mb-6">
                        <h4 className="text-lg font-medium mb-3">{option.name}</h4>
                        <div className="grid grid-cols-2 gap-3">
                          {option.values.sort((a, b) => a.position - b.position).map((value) => {
                            const isSelected = selectedOptions.some(
                              opt => opt.optionId === option.id && opt.valueId === value.id
                            );
                            const isDisabled = selectedOptions.length === product.options.length && !selectedVariant;
                            
                            return (
                              <button
                                key={value.id}
                                onClick={() => handleOptionChange(option.id, value.id)}
                                disabled={isDisabled}
                                className={`p-4 text-lg rounded-xl border-2 ${
                                  isSelected
                                    ? 'border-blue-500 bg-blue-50'
                                    : isDisabled
                                    ? 'border-gray-200 bg-gray-50 cursor-not-allowed'
                                    : 'border-gray-200 hover:border-gray-300'
                                }`}
                              >
                                <div>{value.value}</div>
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
                      disabled={product.options.length > 0 && !selectedVariant}
                      className={`w-full text-white text-xl font-semibold py-8 px-4 rounded-2xl shadow-lg transition-all ${
                        product.options.length > 0 && !selectedVariant
                          ? 'bg-gray-400 cursor-not-allowed'
                          : 'bg-black hover:bg-gray-900 active:transform active:scale-[0.99]'
                      }`}
                    >
                      Add to Order • AED {totalPrice().toFixed(2)}
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
