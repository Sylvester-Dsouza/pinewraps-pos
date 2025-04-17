import { Fragment, useState, useEffect, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Minus, Plus } from "lucide-react";
import { Product, ProductAddon, AddonOption, apiMethods } from "@/services/api";
import { toast } from "react-hot-toast";
import { CustomImage } from "@/types/cart";
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
    customImages?: CustomImage[];
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

interface SelectedAddonOption {
  addonId: string;
  optionId: string;
  customText?: string;
  selectionIndex?: number; // To differentiate between multiple selections of the same addon
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
  const [notes, setNotes] = useState("");
  const [customPrice, setCustomPrice] = useState<number | null>(null);
  const [customImages, setCustomImages] = useState<CustomImage[]>([]);
  
  // Addon state
  const [productAddons, setProductAddons] = useState<ProductAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddonOption[]>([]);
  const [addonCustomTexts, setAddonCustomTexts] = useState<Record<string, string>>({});
  const [loadingAddons, setLoadingAddons] = useState(false);
  
  // Reset state when product changes
  useEffect(() => {
    setQuantity(1);
    setSelectedOptions([]);
    setSelectedVariant(null);
    setCustomPrice(null);
    setNotes("");
    setSelectedAddons([]);
    setAddonCustomTexts({});
    setCustomImages([]);
    
    console.log('Product details:', product);
    console.log('Product allowCustomImages:', product.allowCustomImages);
    
    // Fetch product addons
    if (product?.id) {
      setLoadingAddons(true);
      apiMethods.products.getProductAddons(product.id)
        .then(response => {
          if (response.success && response.data) {
            setProductAddons(response.data);
            console.log('Product addons:', response.data);
          }
        })
        .catch(error => {
          console.error('Error fetching product addons:', error);
          toast.error('Failed to load product options');
        })
        .finally(() => {
          setLoadingAddons(false);
        });
    }
  }, [product]);

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

  // Check if all required addons are selected
  const areRequiredAddonsSelected = useMemo(() => {
    if (!productAddons || productAddons.length === 0) return true;
    
    // Check each required addon group
    return productAddons
      .filter(addon => addon.required)
      .every(addon => {
        // Count how many options are selected for this addon
        const selectedCount = selectedAddons.filter(selected => 
          selected.addonId === addon.id
        ).length;
        
        // Check if the minimum number of selections is met
        return selectedCount >= addon.minSelections;
      });
  }, [productAddons, selectedAddons]);

  // Debug log for addons
  useEffect(() => {
    if (productAddons.length > 0) {
      console.log('Product addons:', productAddons);
      console.log('Selected addons:', selectedAddons);
      console.log('Required addons selected:', areRequiredAddonsSelected);
    }
  }, [productAddons, selectedAddons, areRequiredAddonsSelected]);

  // Handle addon option selection for toggle-style selection
  const handleAddonOptionSelect = (addonId: string, optionId: string) => {
    // Find the addon group to get its configuration
    const addonGroup = productAddons.find(addon => addon.id === addonId);
    if (!addonGroup) return;
    
    setSelectedAddons(prev => {
      // Create a copy of the current selections
      let updated = [...prev];
      
      // Find existing selections for this addon group
      const existingSelections = updated.filter(item => item.addonId === addonId);
      
      // If this option is already selected, remove it (toggle behavior)
      const existingSelection = existingSelections.find(item => item.optionId === optionId);
      if (existingSelection) {
        // Don't allow deselection if it would violate minimum selections for required addons
        if (addonGroup.required && existingSelections.length <= addonGroup.minSelections) {
          toast.error(`You must select at least ${addonGroup.minSelections} option(s) for ${addonGroup.name}`);
          return prev;
        }
        // Remove the option
        return updated.filter(item => !(item.addonId === addonId && item.optionId === optionId));
      }
      
      // Check if adding would exceed max selections
      if (existingSelections.length >= addonGroup.maxSelections) {
        // If we're at max selections, replace the oldest selection
        const oldestSelection = existingSelections[0];
        updated = updated.filter(item => !(item.addonId === addonId && item.optionId === oldestSelection.optionId));
        // Keep all other selections
        for (let i = 1; i < existingSelections.length; i++) {
          if (i < existingSelections.length) {
            // These are already in the updated array, no need to add them back
          }
        }
      }
      
      // Add the new selection with a unique selection index
      // For toggle buttons, we'll use the length of existing selections as the index
      updated.push({ 
        addonId, 
        optionId, 
        selectionIndex: existingSelections.length 
      });
      return updated;
    });
  };
  
  // Handle dropdown selection for addons
  const handleAddonDropdownSelect = (addonId: string, dropdownIndex: number, optionId: string) => {
    // Find the addon group to get its configuration
    const addonGroup = productAddons.find(addon => addon.id === addonId);
    if (!addonGroup) return;
    
    setSelectedAddons(prev => {
      // Create a copy of the current selections
      let updated = [...prev];
      
      // Find existing selections for this addon group
      const existingSelections = updated.filter(item => item.addonId === addonId);
      
      // Find the existing selection at this dropdown index, if any
      const existingSelection = existingSelections.find(item => item.selectionIndex === dropdownIndex);
      let existingCustomText = '';
      
      // If there's an existing selection at this index, preserve its custom text if the option is the same
      if (existingSelection && existingSelection.optionId === optionId) {
        existingCustomText = existingSelection.customText || '';
      }
      
      // Remove any existing selection for this dropdown index
      updated = updated.filter(item => !(item.addonId === addonId && item.selectionIndex === dropdownIndex));
      
      // Add the new selection if an option was selected (not empty)
      if (optionId) {
        updated.push({ 
          addonId, 
          optionId, 
          selectionIndex: dropdownIndex,
          customText: existingCustomText
        });
      }
      
      return updated;
    });
  };
  
  // Check if an addon option is selected
  const isAddonOptionSelected = (addonId: string, optionId: string): boolean => {
    return selectedAddons.some(item => 
      item.addonId === addonId && item.optionId === optionId
    );
  };
  
  // Handle custom text input for addon options
  const handleAddonCustomTextChange = (addonId: string, optionId: string, text: string, selectionIndex: number = 0) => {
    // Update the custom text for this specific addon option selection
    setAddonCustomTexts(prev => ({
      ...prev,
      [`${addonId}_${optionId}_${selectionIndex}`]: text
    }));
    
    // Also update the selectedAddons array with the custom text
    setSelectedAddons(prev => {
      return prev.map((item, index) => {
        // Match by addonId, optionId and either selectionIndex (if provided) or array index
        if (item.addonId === addonId && item.optionId === optionId && 
            (item.selectionIndex === selectionIndex || index === selectionIndex)) {
          return { ...item, customText: text, selectionIndex };
        }
        return item;
      });
    });
  };
  
  // Get custom text for a specific addon option selection
  const getAddonCustomText = (addonId: string, optionId: string, selectionIndex: number = 0): string => {
    return addonCustomTexts[`${addonId}_${optionId}_${selectionIndex}`] || '';
  };

  // Calculate total price based on quantity, custom price, selected variant, and addons
  const calculateTotalPrice = () => {
    if (!product) return 0;

    // If custom price is set, use it
    if (product.allowCustomPrice && customPrice !== null) {
      return customPrice * quantity;
    }

    // Calculate base price (either variant price or product base price)
    let basePrice = selectedVariant ? selectedVariant.price : product.basePrice;
    
    // Add addon prices
    const addonPrice = calculateAddonPrice();
    
    // Return the total price
    return (basePrice + addonPrice) * quantity;
  };

  // Calculate price for selected addons
  const calculateAddonPrice = () => {
    if (!productAddons || productAddons.length === 0 || !selectedAddons || selectedAddons.length === 0) {
      return 0;
    }
    
    // Calculate the total price of all selected addon options
    return selectedAddons.reduce((total, selected) => {
      // Find the addon group
      const addonGroup = productAddons.find(addon => addon.id === selected.addonId);
      if (!addonGroup) return total;
      
      // Find the selected option
      const option = addonGroup.options.find(opt => opt.id === selected.optionId);
      if (!option) return total;
      
      // Add the option price to the total
      return total + (option.price || 0);
    }, 0);
  };

  // Check if all required options and addons are selected
  const isReadyToAdd = () => {
    // Check if all required product options are selected
    const allOptionsSelected = !product.options?.length || product.options.every(option =>
      selectedOptions.some(selected => selected.optionId === option.id)
    );

    // Check if all required addon groups have selections
    return allOptionsSelected && areRequiredAddonsSelected;
  };

  const handleOptionChange = (optionId: string, valueId: string) => {
    setSelectedOptions(prev => {
      let newOptions = [...prev];
      
      // Original behavior for non-Sets products
      newOptions = newOptions.filter(opt => opt.optionId !== optionId);
      newOptions.push({ optionId, valueId });
      
      // Sort by option position to maintain consistent order
      return newOptions.sort((a, b) => {
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

    // Create variations from selected options and addons
    let variations = [];
    
    // Regular product variations
    variations = selectedOptions.map(option => {
      const optionDef = product.options?.find(o => o.id === option.optionId);
      const valueDef = optionDef?.values.find(v => v.id === option.valueId);
      
      // Check if this value has a price adjustment
      const priceAdjustment = (valueDef as any)?.price || 0;
      
      return {
        id: option.optionId,
        type: optionDef?.name || '',
        value: valueDef?.value || '',
        priceAdjustment: priceAdjustment
      };
    });
    
    // Add addon variations
    const addonVariations = selectedAddons.map(selected => {
      const addonGroup = productAddons.find(addon => addon.id === selected.addonId);
      const option = addonGroup?.options.find(opt => opt.id === selected.optionId);
      
      return {
        id: selected.addonId,
        type: addonGroup?.name || 'Addon',
        value: option?.name || '',
        priceAdjustment: option?.price || 0,
        customText: selected.customText
      };
    });
    
    variations = [...variations, ...addonVariations];

    onAddToOrder({
      product: {
        ...product,
        // If custom price is set, update the base price to the custom price
        // Otherwise, if a variant is selected, update to variant price
        basePrice: product.allowCustomPrice && customPrice !== null 
          ? customPrice 
          : selectedVariant 
            ? selectedVariant.price 
            : product.basePrice
      },
      quantity,
      selectedVariations: variations,
      notes,
      customImages,
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
                    <div className="mb-6">
                      <label 
                        htmlFor="notes" 
                        className="block text-xl font-semibold text-gray-900 mb-2"
                      >
                        Notes
                      </label>
                      <textarea
                        id="notes"
                        name="notes"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        className="block w-full p-4 rounded-xl border-2 border-gray-300 focus:border-black focus:ring-0 transition-colors"
                        placeholder="Add special instructions"
                        rows={3}
                      />
                    </div>

                    {/* Custom Images Upload */}
                    {product.allowCustomImages && (
                      <div className="mb-6">
                        <h4 className="block text-xl font-semibold text-gray-900 mb-4">
                          Custom Images
                        </h4>
                        <ImageUpload 
                          value={customImages}
                          onChange={setCustomImages}
                        />
                      </div>
                    )}

                    {/* Product Addon Selection */}
                    {productAddons && productAddons.length > 0 && (
                      <div className="mt-6">
                        <h3 className="text-xl font-semibold text-gray-900 mb-4">
                          Add-ons & Options
                        </h3>
                        <div className="space-y-6">
                          {productAddons.map((addon) => (
                            <div key={addon.id} className="border border-gray-200 rounded-lg p-4">
                              <div className="flex justify-between items-start mb-3">
                                <div>
                                  <h4 className="text-lg font-medium text-gray-900">
                                    {addon.name} 
                                    {addon.required && (
                                      <span className="text-red-500 ml-1">*</span>
                                    )}
                                  </h4>
                                  {addon.description && (
                                    <p className="text-sm text-gray-500">{addon.description}</p>
                                  )}
                                </div>
                                <div className="text-sm text-gray-500">
                                  {addon.required 
                                    ? `Select ${addon.minSelections === addon.maxSelections 
                                        ? addon.minSelections 
                                        : `${addon.minSelections}-${addon.maxSelections}`} option(s)` 
                                    : 'Optional'}
                                </div>
                              </div>
                              
                              {/* For addons with maxSelections > 1, use dropdowns */}
                              {addon.maxSelections > 1 ? (
                                <div className="space-y-4">
                                  {/* Create multiple dropdowns based on maxSelections */}
                                  {Array.from({ length: addon.maxSelections }).map((_, dropdownIndex) => {
                                    // Get the current selection for this dropdown index
                                    const existingSelections = selectedAddons.filter(item => item.addonId === addon.id);
                                    const currentSelection = existingSelections[dropdownIndex]?.optionId || '';
                                    
                                    return (
                                      <div key={`${addon.id}-dropdown-${dropdownIndex}`} className="flex flex-col">
                                        <label className="text-sm font-medium text-gray-700 mb-1">
                                          {addon.name} Option {dropdownIndex + 1}
                                          {addon.required && dropdownIndex < addon.minSelections && (
                                            <span className="text-red-500 ml-1">*</span>
                                          )}
                                        </label>
                                        <select
                                          value={currentSelection}
                                          onChange={(e) => handleAddonDropdownSelect(addon.id, dropdownIndex, e.target.value)}
                                          className={`w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent ${
                                            addon.required && dropdownIndex < addon.minSelections && !currentSelection 
                                              ? 'border-red-300' 
                                              : 'border-gray-200'
                                          }`}
                                          required={addon.required && dropdownIndex < addon.minSelections}
                                        >
                                          <option value="">Select an option</option>
                                          {addon.options.map((option) => (
                                            <option key={option.id} value={option.id}>
                                              {option.name} {option.price > 0 ? `(+${option.price.toFixed(2)} AED)` : ''}
                                            </option>
                                          ))}
                                        </select>
                                        
                                        {/* Custom text input for selected options that allow it */}
                                        {currentSelection && addon.options.find(opt => opt.id === currentSelection)?.allowsCustomText && (
                                          <div className="mt-2">
                                            <input
                                              type="text"
                                              placeholder={addon.options.find(opt => opt.id === currentSelection)?.customTextLabel || "Custom text"}
                                              value={getAddonCustomText(addon.id, currentSelection, dropdownIndex)}
                                              onChange={(e) => handleAddonCustomTextChange(addon.id, currentSelection, e.target.value, dropdownIndex)}
                                              maxLength={addon.options.find(opt => opt.id === currentSelection)?.maxTextLength || 50}
                                              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                            />
                                            {addon.options.find(opt => opt.id === currentSelection)?.maxTextLength && (
                                              <div className="text-xs text-gray-500 mt-1">
                                                {getAddonCustomText(addon.id, currentSelection, dropdownIndex).length}/{addon.options.find(opt => opt.id === currentSelection)?.maxTextLength} characters
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : (
                                /* For addons with maxSelections = 1, use toggle buttons */
                                <div className="grid grid-cols-2 gap-3">
                                  {addon.options.map((option) => {
                                    const isSelected = isAddonOptionSelected(addon.id, option.id);
                                    return (
                                      <div key={option.id} className="flex flex-col">
                                        <button
                                          onClick={() => handleAddonOptionSelect(addon.id, option.id)}
                                          className={`p-3 rounded-lg text-left transition-all ${isSelected 
                                            ? 'bg-black text-white' 
                                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                                        >
                                          <div className="flex justify-between items-center">
                                            <span className="font-medium">{option.name}</span>
                                            {option.price > 0 && (
                                              <span className="text-sm">
                                                +{option.price.toFixed(2)} AED
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                        
                                        {/* Custom text input for selected options that allow it */}
                                        {isSelected && option.allowsCustomText && (
                                          <div className="mt-2">
                                            {/* Find the selection index for this selected option */}
                                            {(() => {
                                              const selection = selectedAddons.find(item => 
                                                item.addonId === addon.id && item.optionId === option.id
                                              );
                                              const selectionIndex = selection?.selectionIndex || 0;
                                              
                                              return (
                                                <>
                                                  <input
                                                    type="text"
                                                    placeholder={option.customTextLabel || "Custom text"}
                                                    value={getAddonCustomText(addon.id, option.id, selectionIndex)}
                                                    onChange={(e) => handleAddonCustomTextChange(addon.id, option.id, e.target.value, selectionIndex)}
                                                    maxLength={option.maxTextLength || 50}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                                                  />
                                                  {option.maxTextLength && (
                                                    <div className="text-xs text-gray-500 mt-1">
                                                      {getAddonCustomText(addon.id, option.id, selectionIndex).length}/{option.maxTextLength} characters
                                                    </div>
                                                  )}
                                                </>
                                              );
                                            })()}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Regular Product Options */}
                    {product.options?.sort((a, b) => a.position - b.position).map((option) => (
                      <div key={option.id} className="mb-6">
                        <h4 className="text-lg font-medium mb-3">
                          {option.name}
                        </h4>
                        <div className="grid grid-cols-4 gap-3">
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
