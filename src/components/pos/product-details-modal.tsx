import { Fragment, useState, useEffect, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { X, Minus, Plus, ChevronDown, ChevronUp } from "lucide-react";
import { Product, ProductAddon, AddonOption, ProductAddonSubOption, apiMethods } from "@/services/api";
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
      customText?: string;
    }>;
    notes?: string;
    customImages?: CustomImage[];
    totalPrice: number;
  }) => void;
  // For editing existing cart items
  editMode?: boolean;
  existingItem?: {
    id: string;
    product: Product;
    quantity: number;
    selectedVariations: Array<{
      id: string;
      type: string;
      value: string;
      priceAdjustment: number;
      customText?: string;
    }>;
    notes?: string;
    customImages?: CustomImage[];
    totalPrice: number;
  };
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

interface SelectedSubAddonOption {
  subOptionId: string;
  parentOptionId: string;
  addonId: string;
  customText?: string;
}

interface SelectedAddonOption {
  addonId: string;
  optionId: string;
  customText?: string;
  selectionIndex?: number; // To differentiate between multiple selections of the same addon
  selectedSubOptions?: SelectedSubAddonOption[];
}

export default function ProductDetailsModal({
  product,
  isOpen,
  onClose,
  onAddToOrder,
  editMode = false,
  existingItem,
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
  const [expandedOptions, setExpandedOptions] = useState<Record<string, boolean>>({});
  const [loadingAddons, setLoadingAddons] = useState(false);
  
  // Reset state when product changes or initialize from existing item in edit mode
  useEffect(() => {
    if (editMode && existingItem) {
      // Initialize state from existing cart item
      setQuantity(existingItem.quantity);
      setNotes(existingItem.notes || "");
      setCustomImages(existingItem.customImages || []);
      
      // Handle custom price if needed
      if (product.allowCustomPrice && existingItem.totalPrice / existingItem.quantity !== product.basePrice) {
        setCustomPrice(existingItem.totalPrice / existingItem.quantity);
      } else {
        setCustomPrice(null);
      }
      
      // Initialize selected options based on existing variations
      const optionsToSelect: SelectedOption[] = [];
      
      // Process existing variations to set selected options
      if (existingItem.selectedVariations && existingItem.selectedVariations.length > 0) {
        existingItem.selectedVariations.forEach(variation => {
          // Find matching option and value in the product
          const matchingOption = product.options?.find(option => option.name === variation.type);
          if (matchingOption) {
            const matchingValue = matchingOption.values.find(val => val.value === variation.value);
            if (matchingValue) {
              optionsToSelect.push({
                optionId: matchingOption.id,
                valueId: matchingValue.id
              });
            }
          }
        });
      }
      
      setSelectedOptions(optionsToSelect);
      
      // Find matching variant if applicable
      if (product.variants && product.variants.length > 0 && optionsToSelect.length > 0) {
        const matchingVariant = product.variants.find(variant => {
          const variantValues = variant.values as ProductVariantValue[];
          return optionsToSelect.every(selectedOption => 
            variantValues.some(value => value.valueId === selectedOption.valueId)
          );
        });
        
        if (matchingVariant) {
          setSelectedVariant(matchingVariant);
        }
      }
      
      console.log('Initialized from existing item:', existingItem);
    } else {
      // Reset state for new item
      setQuantity(1);
      setSelectedOptions([]);
      setSelectedVariant(null);
      setCustomPrice(null);
      setNotes("");
      setSelectedAddons([]);
      setAddonCustomTexts({});
      setCustomImages([]);
      setExpandedOptions({});
    }
    
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
            
            // If we're in edit mode and have existing variations, initialize the addon selections
            if (editMode && existingItem && existingItem.selectedVariations) {
              // Extract addon selections from the existing variations
              const addonSelections: SelectedAddonOption[] = [];
              const customTexts: Record<string, string> = {};
              
              existingItem.selectedVariations.forEach(variation => {
                // Find matching addon and option in the fetched addons
                const matchingAddon = response.data.find(addon => 
                  addon.options.some(option => option.name === variation.value)
                );
                
                if (matchingAddon) {
                  const matchingOption = matchingAddon.options.find(option => option.name === variation.value);
                  if (matchingOption) {
                    // Add to selected addons
                    const selectionIndex = addonSelections.filter(s => s.addonId === matchingAddon.id).length;
                    addonSelections.push({
                      addonId: matchingAddon.id,
                      optionId: matchingOption.id,
                      selectionIndex: selectionIndex
                    });
                    
                    // If there's custom text, add it to the custom texts
                    if (variation.customText) {
                      customTexts[`${matchingAddon.id}_${matchingOption.id}_${selectionIndex}`] = variation.customText;
                    }
                  }
                }
              });
              
              // Set the selected addons and custom texts
              if (addonSelections.length > 0) {
                setSelectedAddons(addonSelections);
                setAddonCustomTexts(customTexts);
                console.log('Initialized addon selections:', addonSelections);
                console.log('Initialized custom texts:', customTexts);
              }
            }
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
      console.log('Variant price:', matchingVariant?.price);
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

  // Toggle option expansion for sub-options display
  const toggleOptionExpansion = (addonId: string, optionId: string) => {
    const key = `${addonId}_${optionId}`;
    setExpandedOptions(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  // Check if an option is expanded
  const isOptionExpanded = (addonId: string, optionId: string): boolean => {
    return !!expandedOptions[`${addonId}_${optionId}`];
  };

  // Handle addon option selection for toggle-style selection
  const handleAddonOptionSelect = (addonId: string, optionId: string) => {
    // Find the addon group to get its configuration
    const addonGroup = productAddons.find(addon => addon.id === addonId);
    if (!addonGroup) return;
    
    // Find the selected option to check if it has sub-options
    const selectedOption = addonGroup.options.find(opt => opt.id === optionId);
    const hasSubOptions = selectedOption?.subOptions && selectedOption.subOptions.length > 0;
    
    setSelectedAddons(prev => {
      // Create a copy of the current selections
      let updated = [...prev];
      
      // Find existing selections for this addon group
      const existingSelections = updated.filter(item => item.addonId === addonId);
      
      // Check if this is a single-selection addon (maxSelections = 1)
      if (addonGroup.maxSelections === 1) {
        // For single-selection addons, we replace the existing selection
        const existingSelection = existingSelections.find(item => item.optionId === optionId);
        if (existingSelection) {
          // Don't allow deselection if it would violate minimum selections for required addons
          if (addonGroup.required && existingSelections.length <= addonGroup.minSelections) {
            toast.error(`You must select at least ${addonGroup.minSelections} option(s) for ${addonGroup.name}`);
            return prev;
          }
          // Remove the option (toggle behavior for single-selection addons)
          return updated.filter(item => !(item.addonId === addonId && item.optionId === optionId));
        }
        
        // Remove any existing selection for this addon group
        updated = updated.filter(item => item.addonId !== addonId);
      } else {
        // For multi-selection addons, check if adding would exceed max selections
        if (existingSelections.length >= addonGroup.maxSelections) {
          // If we're at max selections, replace the oldest selection
          const oldestSelection = existingSelections[0];
          updated = updated.filter(item => !(item.addonId === addonId && item.selectionIndex === oldestSelection.selectionIndex));
        }
      }
      
      // Add the new selection with a unique selection index
      // For toggle buttons, we'll use the length of existing selections as the index
      updated.push({ 
        addonId, 
        optionId, 
        selectionIndex: existingSelections.length,
        selectedSubOptions: []
      });
      
      // If the option has sub-options, automatically expand it
      if (hasSubOptions) {
        toggleOptionExpansion(addonId, optionId);
      }
      
      return updated;
    });
  };
  
  // Handle sub-addon option selection
  const handleSubAddonOptionSelect = (addonId: string, parentOptionId: string, subOptionId: string, dropdownIndex?: number) => {
    setSelectedAddons(prev => {
      // Create a copy of the current selections
      const updated = [...prev];
      
      // Find the parent option selection
      // If dropdownIndex is provided, use it to find the exact parent selection
      const parentSelectionIndex = dropdownIndex !== undefined
        ? updated.findIndex(item => 
            item.addonId === addonId && 
            item.optionId === parentOptionId && 
            item.selectionIndex === dropdownIndex
          )
        : updated.findIndex(item => 
            item.addonId === addonId && 
            item.optionId === parentOptionId
          );
      
      if (parentSelectionIndex === -1) return prev; // Parent option not selected
      
      const parentSelection = updated[parentSelectionIndex];
      const selectedSubOptions = parentSelection.selectedSubOptions || [];
      
      // Check if this sub-option is already selected
      const existingSubOptionIndex = selectedSubOptions.findIndex(item => item.subOptionId === subOptionId);
      
      if (existingSubOptionIndex >= 0) {
        // Remove the sub-option if already selected (toggle behavior)
        const updatedSubOptions = selectedSubOptions.filter(item => item.subOptionId !== subOptionId);
        updated[parentSelectionIndex] = {
          ...parentSelection,
          selectedSubOptions: updatedSubOptions
        };
      } else {
        // Add the sub-option
        updated[parentSelectionIndex] = {
          ...parentSelection,
          selectedSubOptions: [
            ...selectedSubOptions,
            { subOptionId, parentOptionId, addonId }
          ]
        };
      }
      
      return updated;
    });
  };
  
  // Handle dropdown selection for addons
  const handleAddonDropdownSelect = (addonId: string, dropdownIndex: number, optionId: string) => {
    // Find the addon group to get its configuration
    const addonGroup = productAddons.find(addon => addon.id === addonId);
    if (!addonGroup) return;
    
    // Find the selected option to check if it has sub-options
    const selectedOption = addonGroup.options.find(opt => opt.id === optionId);
    const hasSubOptions = selectedOption?.subOptions && selectedOption.subOptions.length > 0;
    
    setSelectedAddons(prev => {
      // Create a copy of the current selections
      let updated = [...prev];
      
      // Find existing selections for this addon group
      const existingSelections = updated.filter(item => item.addonId === addonId);
      
      // Find the existing selection at this dropdown index, if any
      const existingSelection = existingSelections.find(item => item.selectionIndex === dropdownIndex);
      let existingCustomText = '';
      let existingSubOptions: SelectedSubAddonOption[] = [];
      
      // If there's an existing selection at this index, preserve its custom text and sub-options if the option is the same
      if (existingSelection && existingSelection.optionId === optionId) {
        existingCustomText = existingSelection.customText || '';
        existingSubOptions = existingSelection.selectedSubOptions || [];
      }
      
      // Remove any existing selection for this dropdown index
      updated = updated.filter(item => !(item.addonId === addonId && item.selectionIndex === dropdownIndex));
      
      // Add the new selection if an option was selected (not empty)
      if (optionId) {
        updated.push({ 
          addonId, 
          optionId, 
          selectionIndex: dropdownIndex,
          customText: existingCustomText,
          selectedSubOptions: existingSubOptions
        });
        
        // If this is a new option with sub-options, automatically expand it
        if (hasSubOptions && (!existingSelection || existingSelection.optionId !== optionId)) {
          toggleOptionExpansion(addonId, optionId);
        }
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
  
  // Count how many times an addon option is selected
  const countAddonOptionSelections = (addonId: string, optionId: string): number => {
    return selectedAddons.filter(item => 
      item.addonId === addonId && item.optionId === optionId
    ).length;
  };
  
  // Check if a sub-addon option is selected
  const isSubAddonOptionSelected = (addonId: string, parentOptionId: string, subOptionId: string, dropdownIndex?: number): boolean => {
    // If dropdown index is provided, find the specific parent selection at that index
    const parentSelection = dropdownIndex !== undefined
      ? selectedAddons.find(item => 
          item.addonId === addonId && 
          item.optionId === parentOptionId && 
          item.selectionIndex === dropdownIndex
        )
      : selectedAddons.find(item => 
          item.addonId === addonId && 
          item.optionId === parentOptionId
        );
    
    if (!parentSelection || !parentSelection.selectedSubOptions) return false;
    
    return parentSelection.selectedSubOptions.some(item => item.subOptionId === subOptionId);
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

    // Define basePrice variable at the top
    let basePrice = product.basePrice;
    
    // If product has options/variations
    if (product.options && product.options.length > 0) {
      // If all options are selected and we have a matching variant, use its price
      if (selectedVariant && selectedOptions.length === product.options.length) {
        console.log('Using exact variant price for total:', selectedVariant.price);
        basePrice = selectedVariant.price;
      } 
      // If not all options are selected but some are, we need to find the best matching variant
      else if (selectedOptions.length > 0) {
        // First try to find a partial matching variant
        const partialMatchingVariants = product.variants?.filter(variant => {
          const variantValues = variant.values as ProductVariantValue[];
          return selectedOptions.every(selectedOption => 
            variantValues.some(value => 
              value.valueId === selectedOption.valueId
            )
          );
        });
        
        if (partialMatchingVariants && partialMatchingVariants.length > 0) {
          // Use the first matching variant's price
          console.log('Using partial matching variant price:', partialMatchingVariants[0].price);
          basePrice = partialMatchingVariants[0].price;
        } else {
          // If no partial match, calculate based on option price adjustments
          const optionPriceAdjustments = selectedOptions.reduce((total, option) => {
            const optionDef = product.options?.find(o => o.id === option.optionId);
            const valueDef = optionDef?.values.find(v => v.id === option.valueId);
            return total + ((valueDef as any)?.price || 0);
          }, 0);
          
          console.log('Using base price + option adjustments:', basePrice, '+', optionPriceAdjustments);
          basePrice += optionPriceAdjustments;
        }
      }
    }
    
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
    
    // Calculate the total price of all selected addon options and their sub-options
    return selectedAddons.reduce((total, selected) => {
      // Find the addon group
      const addonGroup = productAddons.find(addon => addon.id === selected.addonId);
      if (!addonGroup) return total;
      
      // Find the selected option
      const option = addonGroup.options.find(opt => opt.id === selected.optionId);
      if (!option) return total;
      
      // Add the option price to the total
      let optionTotal = option.price || 0;
      
      // Add prices for selected sub-options
      if (selected.selectedSubOptions && selected.selectedSubOptions.length > 0 && option.subOptions) {
        const subOptionsTotal = selected.selectedSubOptions.reduce((subTotal, subSelected) => {
          const subOption = option.subOptions?.find(subOpt => subOpt.id === subSelected.subOptionId);
          return subTotal + (subOption?.price || 0);
        }, 0);
        
        optionTotal += subOptionsTotal;
      }
      
      return total + optionTotal;
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
    let addonVariations = [];
    
    // Process main addon options
    for (const selected of selectedAddons) {
      const addonGroup = productAddons.find(addon => addon.id === selected.addonId);
      const option = addonGroup?.options.find(opt => opt.id === selected.optionId);
      
      // Add the main addon option
      addonVariations.push({
        id: selected.addonId,
        type: addonGroup?.name || 'Addon',
        value: option?.name || '',
        priceAdjustment: option?.price || 0,
        customText: selected.customText
      });
      
      // Add sub-addon options if any are selected
      if (selected.selectedSubOptions && selected.selectedSubOptions.length > 0 && option?.subOptions) {
        for (const subSelected of selected.selectedSubOptions) {
          const subOption = option.subOptions.find(subOpt => subOpt.id === subSelected.subOptionId);
          if (subOption) {
            addonVariations.push({
              id: `${selected.addonId}_${selected.optionId}_${subOption.id}`,
              type: `${addonGroup?.name || 'Addon'} - ${option.name} Sub-option`,
              value: subOption.name,
              priceAdjustment: subOption.price || 0
            });
          }
        }
      }
    }
    
    variations = [...variations, ...addonVariations];

    onAddToOrder({
      product: {
        ...product,
        // If custom price is set, update the base price to the custom price
        // Otherwise, if a variant is selected, update to variant price
        basePrice: product.allowCustomPrice && customPrice !== null 
          ? customPrice 
          : calculateTotalPrice() / quantity - calculateAddonPrice()
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
                                    // Get the current selection for this dropdown index by looking for selections with this exact selectionIndex
                                    const existingSelection = selectedAddons.find(item => 
                                      item.addonId === addon.id && item.selectionIndex === dropdownIndex
                                    );
                                    const currentSelection = existingSelection?.optionId || '';
                                    
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
                                        
                                        {/* Display sub-options if the selected option has them */}
                                        {currentSelection && addon.options.find(opt => opt.id === currentSelection)?.subOptions?.length > 0 && (
                                          <div className="mt-3 mb-3 pl-4 border-l-2 border-gray-200">
                                            <div className="text-sm font-medium mb-2">Select sub-options:</div>
                                            <div className="grid grid-cols-2 gap-2">
                                              {addon.options.find(opt => opt.id === currentSelection)?.subOptions?.map(subOption => {
                                                const isSubSelected = isSubAddonOptionSelected(addon.id, currentSelection, subOption.id, dropdownIndex);
                                                return (
                                                  <button
                                                    key={subOption.id}
                                                    onClick={() => handleSubAddonOptionSelect(addon.id, currentSelection, subOption.id, dropdownIndex)}
                                                    className={`p-2 rounded-lg text-left text-sm transition-all ${isSubSelected 
                                                      ? 'bg-gray-800 text-white' 
                                                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                                                  >
                                                    <div className="flex justify-between items-center">
                                                      <span>{subOption.name}</span>
                                                      {subOption.price > 0 && (
                                                        <span className="text-xs">
                                                          +{subOption.price.toFixed(2)} AED
                                                        </span>
                                                      )}
                                                    </div>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                        
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
                                    const selectionCount = countAddonOptionSelections(addon.id, option.id);
                                    return (
                                      <div key={option.id} className="flex flex-col">
                                        <button
                                          onClick={() => handleAddonOptionSelect(addon.id, option.id)}
                                          className={`p-3 rounded-lg text-left transition-all ${isSelected 
                                            ? 'bg-black text-white' 
                                            : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                                        >
                                          <div className="flex justify-between items-center">
                                            <div className="flex items-center">
                                              <span className="font-medium">{option.name}</span>
                                              {selectionCount > 1 && (
                                                <span className="ml-2 px-2 py-0.5 bg-white text-black text-xs font-bold rounded-full">
                                                  {selectionCount}x
                                                </span>
                                              )}
                                              {option.subOptions && option.subOptions.length > 0 && isSelected && (
                                                <button 
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleOptionExpansion(addon.id, option.id);
                                                  }}
                                                  className="ml-2 p-1 rounded-full hover:bg-gray-200 dark:hover:bg-gray-700"
                                                >
                                                  {isOptionExpanded(addon.id, option.id) ? (
                                                    <ChevronUp className="h-4 w-4" />
                                                  ) : (
                                                    <ChevronDown className="h-4 w-4" />
                                                  )}
                                                </button>
                                              )}
                                            </div>
                                            {option.price > 0 && (
                                              <span className="text-sm">
                                                +{option.price.toFixed(2)} AED
                                              </span>
                                            )}
                                          </div>
                                        </button>
                                        
                                        {/* Sub-options for this addon option */}
                                        {isSelected && option.subOptions && option.subOptions.length > 0 && isOptionExpanded(addon.id, option.id) && (
                                          <div className="mt-2 pl-4 border-l-2 border-gray-200">
                                            <div className="text-sm font-medium mb-2">Select sub-options:</div>
                                            <div className="grid grid-cols-2 gap-2">
                                              {option.subOptions.map(subOption => {
                                                const isSubSelected = isSubAddonOptionSelected(addon.id, option.id, subOption.id);
                                                return (
                                                  <button
                                                    key={subOption.id}
                                                    onClick={() => handleSubAddonOptionSelect(addon.id, option.id, subOption.id)}
                                                    className={`p-2 rounded-lg text-left text-sm transition-all ${isSubSelected 
                                                      ? 'bg-gray-800 text-white' 
                                                      : 'bg-gray-100 text-gray-900 hover:bg-gray-200'}`}
                                                  >
                                                    <div className="flex justify-between items-center">
                                                      <span>{subOption.name}</span>
                                                      {subOption.price > 0 && (
                                                        <span className="text-xs">
                                                          +{subOption.price.toFixed(2)} AED
                                                        </span>
                                                      )}
                                                    </div>
                                                  </button>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        )}
                                        
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
                                <div className="flex flex-col items-center">
                                  <span>{value.value}</span>
                                  {/* Display price adjustment if available */}
                                  {(value as any).price > 0 && (
                                    <span className={`text-sm mt-1 ${isSelected ? 'text-gray-200' : 'text-gray-600'}`}>
                                      +{(value as any).price.toFixed(2)} AED
                                    </span>
                                  )}
                                </div>
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

                    {/* Add to Order / Update Item Button */}
                    <button
                      onClick={handleAddToOrder}
                      disabled={!isReadyToAdd()}
                      className={`w-full text-xl font-semibold py-8 px-4 rounded-2xl shadow-lg transition-all ${
                        isReadyToAdd()
                          ? 'bg-black hover:bg-gray-900 text-white active:transform active:scale-[0.99]'
                          : 'bg-gray-200 text-gray-500 cursor-not-allowed'
                      }`}
                    >
                      {editMode 
                        ? `Update Item - AED ${calculateTotalPrice().toFixed(2)}` 
                        : `Add to Order - AED ${calculateTotalPrice().toFixed(2)}`
                      }
                      {!isReadyToAdd() && (
                        <div className="text-sm mt-1">Please select all required options</div>
                      )}
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
