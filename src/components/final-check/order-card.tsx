"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileCheck, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Clock, ExternalLink, Gift, Maximize2 } from "lucide-react";
import OrderTimer from "./order-timer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Image from "next/image";
import { toast } from "react-hot-toast";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";

// Types for order and status
type FinalCheckOrderStatus = 
  | "FINAL_CHECK_QUEUE"
  | "FINAL_CHECK_PROCESSING"
  | "FINAL_CHECK_COMPLETE"
  | "COMPLETED"
  | "KITCHEN_QUEUE"
  | "DESIGN_QUEUE";

interface VariationOption {
  type: string;
  value: string;
  name?: string;
  price?: number;
  id?: string;
  priceAdjustment?: number;
  customText?: string; // Custom text for addon options
}

interface FinalCheckOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: FinalCheckOrderStatus;
  customerName: string;
  customerPhone?: string;
  items: Array<{
    id: string;
    name: string;
    quantity: number;
    variations: {
      variationsObj?: Record<string, any>;
      selectedVariations?: VariationOption[];
    } | Record<string, any>;
    selectedVariations?: VariationOption[];
    kitchenNotes?: string;
    designNotes?: string;
    notes?: string;
    customImages?: Array<{
      url: string;
      comment?: string;
    }>;
    images?: Array<{
      url: string;
      comment?: string;
    }>;
    category?: string;
  }>;
  kitchenNotes?: string;
  designNotes?: string;
  finalCheckNotes?: string;
  parallelProcessing?: {
    id: string;
    designStatus: string;
    kitchenStatus: string;
    isParallel: boolean;
  };
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
  finalCheckStartTime?: string;
  finalCheckEndTime?: string;
  deliveryMethod?: 'PICKUP' | 'DELIVERY';
  pickupDate?: string;
  pickupTimeSlot?: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  deliveryInstructions?: string;
  streetAddress?: string;
  apartment?: string;
  emirate?: string;
  city?: string;
  qualityControl?: {
    returnedFromFinalCheck?: boolean;
    returnReason?: string;
    returnDestination?: 'KITCHEN' | 'DESIGN';
    returnedAt?: string;
  };
  giftDetails?: {
    isGift: boolean;
    recipientName?: string;
    recipientPhone?: string;
    message?: string;
    note?: string;
    cashAmount?: string;
    includeCash?: boolean;
  };
}

interface OrderCardProps {
  order: FinalCheckOrder;
  onUpdateStatus?: (orderId: string, newStatus: FinalCheckOrderStatus, teamNotes?: string) => Promise<void>;
}

interface CustomSlide {
  src: string;
  comment?: string;
}

// Order card component for the final check display
export default function OrderCard({ order, onUpdateStatus }: OrderCardProps) {
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teamNotes, setTeamNotes] = useState(order.finalCheckNotes || "");
  const [nextStatus, setNextStatus] = useState<FinalCheckOrderStatus | null>(null);
  const [sendBackTarget, setSendBackTarget] = useState<'KITCHEN' | 'DESIGN' | null>(null);
  const [returnReason, setReturnReason] = useState("");
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<CustomSlide[]>([]);

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const handleStatusUpdate = (newStatus: FinalCheckOrderStatus) => {
    if (newStatus === "COMPLETED") {
      // Open dialog for notes before completing
      setNextStatus(newStatus);
      setSendBackTarget(null);
      setIsDialogOpen(true);
    } else if (newStatus === "FINAL_CHECK_QUEUE" && order.requiresKitchen && order.requiresDesign) {
      // For parallel processing orders, check if both teams are ready
      if (order.parallelProcessing?.kitchenStatus === 'KITCHEN_READY' && 
          order.parallelProcessing?.designStatus === 'DESIGN_READY') {
        // Both teams are ready, proceed to final check
        onUpdateStatus?.(order.id, newStatus);
      } else {
        // Not all teams are ready yet
        toast.error('Cannot proceed to final check until both kitchen and design teams are ready');
      }
    } else {
      // For other statuses, update directly
      onUpdateStatus?.(order.id, newStatus);
    }
  };

  const handleSendBack = (target: 'KITCHEN' | 'DESIGN') => {
    setSendBackTarget(target);
    setNextStatus(target === 'KITCHEN' ? 'KITCHEN_QUEUE' : 'DESIGN_QUEUE');
    setIsDialogOpen(true);
  };

  const confirmStatusUpdate = () => {
    if (nextStatus) {
      if (sendBackTarget) {
        // For send back operations, require a return reason
        if (!returnReason.trim()) {
          toast.error('Please provide a return reason');
          return;
        }
        // Use returnReason as the only reason when sending back
        onUpdateStatus?.(order.id, nextStatus, returnReason);
      } else {
        // For normal status updates, use teamNotes
        onUpdateStatus?.(order.id, nextStatus, teamNotes);
      }
      setIsDialogOpen(false);
      setNextStatus(null);
      setSendBackTarget(null);
      setReturnReason("");
    }
  };

  // Get the status badge color and text
  const getStatusBadge = () => {
    switch (order.status) {
      case "FINAL_CHECK_QUEUE":
        return { color: "bg-amber-100 text-amber-800 border-amber-300", text: "In Queue" };
      case "FINAL_CHECK_PROCESSING":
        return { color: "bg-blue-100 text-blue-800 border-blue-300", text: "Processing" };
      case "FINAL_CHECK_COMPLETE":
        return { color: "bg-green-100 text-green-800 border-green-300", text: "Ready" };
      case "COMPLETED":
        return { color: "bg-green-100 text-green-800 border-green-300", text: "Completed" };
      case "KITCHEN_QUEUE":
        return { color: "bg-orange-100 text-orange-800 border-orange-300", text: "Kitchen Queue" };
      case "DESIGN_QUEUE":
        return { color: "bg-purple-100 text-purple-800 border-purple-300", text: "Design Queue" };
      default:
        return { color: "bg-gray-100 text-gray-800 border-gray-300", text: "Unknown" };
    }
  };

  const getStatusActions = () => {
    switch (order.status) {
      case "FINAL_CHECK_QUEUE":
        return (
          <button
            onClick={() => handleStatusUpdate("FINAL_CHECK_PROCESSING")}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <FileCheck className="w-5 h-5" />
            Start Final Check
          </button>
        );
      case "FINAL_CHECK_PROCESSING":
        return (
          <div className="space-y-3">
            {/* Send Back buttons */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => handleSendBack('KITCHEN')}
                className="py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Clock className="w-5 h-5" />
                Send to Kitchen
              </button>
              <button
                onClick={() => handleSendBack('DESIGN')}
                className="py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                <Clock className="w-5 h-5" />
                Send to Design
              </button>
            </div>
            
            {/* Complete button */}
            <button
              onClick={() => handleStatusUpdate("COMPLETED")}
              className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
            >
              <CheckCircle2 className="w-5 h-5" />
              Complete Order
            </button>
          </div>
        );
      case "FINAL_CHECK_COMPLETE":
        return (
          <button
            onClick={() => handleStatusUpdate("COMPLETED")}
            className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
          >
            <CheckCircle2 className="w-5 h-5" />
            Mark Order Completed
          </button>
        );
      default:
        return null;
    }
  };

  const statusBadge = getStatusBadge();
  const finalCheckStartTime = order.finalCheckStartTime ? new Date(order.finalCheckStartTime) : null;

  const handleImageClick = (images: any[], index: number) => {
    const slides = images.map(img => ({
      src: img.url,
      comment: img.comment || ''
    }));
    setCurrentImages(slides);
    setLightboxIndex(index);
    setLightboxOpen(true);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className={`bg-white rounded-xl shadow-lg p-4 mb-6 border-l-4 overflow-hidden relative ${
        order.status === "FINAL_CHECK_QUEUE" 
          ? "border-l-amber-500" 
          : order.status === "FINAL_CHECK_PROCESSING" 
            ? "border-l-blue-500" 
            : order.status === "FINAL_CHECK_COMPLETE" || order.status === "COMPLETED"
              ? "border-l-green-500"
              : order.status === "KITCHEN_QUEUE"
                ? "border-l-orange-500"
                : "border-l-purple-500"
      }`}
    >
      {/* Status Badge */}
      <div className="absolute top-4 right-4">
        <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${statusBadge.color}`}>
          {statusBadge.text}
        </span>
      </div>

      <div className="space-y-4">
        {/* Header Section */}
        <div className="pb-3 border-b border-gray-100">
          <div className="flex justify-between items-start">
            <div>
              <h3 className="text-lg font-semibold">Order #{order.orderNumber}</h3>
              <p className="text-sm text-gray-500">Customer: {order.customerName}{order.customerPhone && ` • ${order.customerPhone}`}</p>
              
              {/* Parallel Processing Status */}
              {order.requiresKitchen && order.requiresDesign && order.parallelProcessing && (
                <div className="flex flex-wrap gap-2 mt-1">
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    order.parallelProcessing.kitchenStatus === 'KITCHEN_READY' 
                      ? "bg-green-100 text-green-800 border-green-300" 
                      : "bg-amber-100 text-amber-800 border-amber-300"
                  }`}>
                    Kitchen: {order.parallelProcessing.kitchenStatus === 'KITCHEN_READY' ? 'Ready' : 'In Progress'}
                  </span>
                  <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    order.parallelProcessing.designStatus === 'DESIGN_READY' 
                      ? "bg-green-100 text-green-800 border-green-300" 
                      : "bg-purple-100 text-purple-800 border-purple-300"
                  }`}>
                    Design: {order.parallelProcessing.designStatus === 'DESIGN_READY' ? 'Ready' : 'In Progress'}
                  </span>
                  {order.parallelProcessing.kitchenStatus === 'KITCHEN_READY' && 
                   order.parallelProcessing.designStatus === 'DESIGN_READY' && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full border bg-blue-100 text-blue-800 border-blue-300">
                      Ready for Final Check
                    </span>
                  )}
                </div>
              )}
              
              <div className="flex items-center space-x-2 mt-1">
                <OrderTimer createdAt={new Date(order.createdAt)} />
                {finalCheckStartTime && (
                  <span className="text-xs text-gray-500">
                    Final Check Started: {format(finalCheckStartTime, 'MMM d, h:mm a')}
                  </span>
                )}
                {order.giftDetails?.isGift && (
                  <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-pink-100 text-pink-800">
                    <Gift className="w-3 h-3 mr-1" />
                    Gift
                  </span>
                )}
              </div>
            </div>
            <a 
              href={`/orders/${order.id}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded-full hover:bg-blue-50"
            >
              <ExternalLink className="w-5 h-5" />
            </a>
          </div>

          {/* Delivery Information */}
          {order.deliveryMethod && (
            <div className="mt-2 p-2 bg-gray-50 rounded-lg">
              <p className="text-sm">
                <span className="font-medium">{order.deliveryMethod === 'PICKUP' ? 'Pickup' : 'Delivery'}: </span>
                {order.deliveryMethod === 'PICKUP' ? (
                  <span className="text-blue-600">
                    {order.pickupDate && format(new Date(order.pickupDate), 'MMM d, yyyy')}
                    {order.pickupTimeSlot && ` at ${order.pickupTimeSlot}`}
                  </span>
                ) : (
                  <span className="text-green-600">
                    {order.deliveryDate && format(new Date(order.deliveryDate), 'MMM d, yyyy')}
                    {order.deliveryTimeSlot && ` at ${order.deliveryTimeSlot}`}
                  </span>
                )}
              </p>

              {/* Delivery Address and Instructions */}
              {order.deliveryMethod === 'DELIVERY' && (
                <div className="mt-2 space-y-1">
                  {(order.streetAddress || order.apartment || order.emirate || order.city) && (
                    <div className="text-sm">
                      <span className="font-medium">Address: </span>
                      <span className="text-gray-700">
                        {[order.streetAddress, order.apartment, order.city, order.emirate].filter(Boolean).join(', ')}
                      </span>
                    </div>
                  )}
                  {order.deliveryInstructions && (
                    <div className="text-sm">
                      <span className="font-medium">Instructions: </span>
                      <span className="text-gray-700">{order.deliveryInstructions}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="space-y-2">
          {order.kitchenNotes && (
            <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-100">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Kitchen Notes:</span> {order.kitchenNotes}
              </p>
            </div>
          )}
          
          {order.designNotes && (
            <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-100">
              <p className="text-sm text-purple-800">
                <span className="font-medium">Design Notes:</span> {order.designNotes}
              </p>
            </div>
          )}
          
          {/* Gift Information Section */}
          {order.giftDetails?.isGift && (
            <div className="p-2.5 bg-pink-50 rounded-lg border border-pink-100">
              <div className="flex items-start">
                <div className="p-1 bg-pink-100 rounded mr-2">
                  <Gift className="w-4 h-4 text-pink-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-medium text-pink-800">Gift Information</p>
                  
                  {order.giftDetails.recipientName && (
                    <p className="text-sm text-pink-700">
                      <span className="font-medium">Recipient:</span> {order.giftDetails.recipientName}
                      {order.giftDetails.recipientPhone && ` (${order.giftDetails.recipientPhone})`}
                    </p>
                  )}
                  
                  {order.giftDetails.message && (
                    <p className="text-sm text-pink-700">
                      <span className="font-medium">Message:</span> "{order.giftDetails.message}"
                    </p>
                  )}
                  
                  {order.giftDetails.includeCash && order.giftDetails.cashAmount && (
                    <p className="text-sm text-pink-700">
                      <span className="font-medium">Cash Included:</span> {order.giftDetails.cashAmount}
                    </p>
                  )}
                  
                  {order.giftDetails.note && (
                    <p className="text-sm text-pink-700">
                      <span className="font-medium">Additional Note:</span> {order.giftDetails.note}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
          
          {order.finalCheckNotes && (
            <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-100">
              <p className="text-sm text-amber-800">
                <span className="font-medium">Final Check Notes:</span> {order.finalCheckNotes}
              </p>
            </div>
          )}
        </div>

        {/* Items Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-gray-700">Items</h4>
            <button 
              onClick={toggleExpand} 
              className="text-gray-500 hover:text-gray-700 p-1"
            >
              {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          </div>
          
          <div className={`space-y-3 ${expanded ? 'block' : 'max-h-60 overflow-hidden'}`}>
            {order.items.map((item) => (
              <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <span className="bg-gray-200 text-gray-800 text-xs font-medium w-6 h-6 rounded-full flex items-center justify-center mr-2">
                        {item.quantity}
                      </span>
                      <h4 className="font-medium">{item.name}</h4>
                    </div>
                    
                    {/* Variations */}
                    <div className="mt-2 ml-8 space-y-1">
                      {/* Display directly from selectedVariations array if available */}
                      {item.selectedVariations && Array.isArray(item.selectedVariations) && item.selectedVariations.length > 0 && 
                        item.selectedVariations.map((variation, index) => (
                          <p key={`sel-${index}`} className="text-sm text-gray-600">
                            <span className="font-medium">{variation.type}:</span> {variation.value}{variation.customText ? ` (${variation.customText})` : ''}
                          </p>
                        ))
                      }
                      
                      {/* If no direct selectedVariations, try to get them from variations.selectedVariations */}
                      {(!item.selectedVariations || !Array.isArray(item.selectedVariations) || item.selectedVariations.length === 0) && 
                        item.variations && typeof item.variations === 'object' && 
                        item.variations.selectedVariations && Array.isArray(item.variations.selectedVariations) && 
                        item.variations.selectedVariations.length > 0 && 
                        item.variations.selectedVariations.map((variation, index) => (
                          <p key={`var-${index}`} className="text-sm text-gray-600">
                            <span className="font-medium">{variation.type}:</span> {variation.value}{variation.customText ? ` (${variation.customText})` : ''}
                          </p>
                        ))
                      }
                      
                      {/* As a last resort, try to get them from variations.variationsObj or legacy format */}
                      {(!item.selectedVariations || !Array.isArray(item.selectedVariations) || item.selectedVariations.length === 0) &&
                        (!item.variations || !item.variations.selectedVariations || !Array.isArray(item.variations.selectedVariations) || item.variations.selectedVariations.length === 0) &&
                        item.variations && typeof item.variations === 'object' && 
                        (item.variations.variationsObj || Object.keys(item.variations).length > 0) && (
                          item.variations.variationsObj ? 
                            Object.entries(item.variations.variationsObj).map(([type, value], index) => (
                              <p key={`obj-${index}`} className="text-sm text-gray-600">
                                <span className="font-medium">{type}:</span> {typeof value === 'object' ? (value as any).value || JSON.stringify(value) : value}
                              </p>
                            ))
                          :
                            Object.entries(item.variations).map(([type, value], index) => (
                              <p key={`leg-${index}`} className="text-sm text-gray-600">
                                <span className="font-medium">{type}:</span> {typeof value === 'object' ? (value as any).value || JSON.stringify(value) : value}
                              </p>
                            ))
                        )
                      }
                    </div>
                    
                    {/* Item notes */}
                    {item.notes && (
                      <div className="mt-2 ml-8 p-2 bg-gray-50 rounded border border-gray-200">
                        <p className="text-sm text-gray-700">
                          <span className="font-medium">Product Notes:</span> {item.notes}
                        </p>
                      </div>
                    )}
                    
                    {item.kitchenNotes && (
                      <div className="mt-2 ml-8 p-2 bg-blue-50 rounded border border-blue-100">
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">Kitchen Notes:</span> {item.kitchenNotes}
                        </p>
                      </div>
                    )}

                    {item.designNotes && (
                      <div className="mt-2 ml-8 p-2 bg-purple-50 rounded border border-purple-100">
                        <p className="text-sm text-purple-700">
                          <span className="font-medium">Design Notes:</span> {item.designNotes}
                        </p>
                      </div>
                    )}
                  </div>
                  {item.category && (
                    <span className={`text-xs font-medium px-2 py-0.5 rounded ${
                      item.category.toLowerCase().includes('cake') 
                        ? 'bg-blue-100 text-blue-800' 
                        : item.category.toLowerCase().includes('flower')
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-gray-100 text-gray-800'
                    }`}>
                      {item.category}
                    </span>
                  )}
                </div>

                {/* Custom Images */}
                {item.customImages && Array.isArray(item.customImages) && item.customImages.length > 0 && (
                  <div className="mt-3 ml-8">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Custom Images:</h5>
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {item.customImages.filter(image => image && typeof image === 'object').map((image, index) => (
                        <div 
                          key={`custom-${index}`} 
                          className="relative min-w-[80px] h-[80px] rounded-lg overflow-hidden border border-gray-200 group cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                          onClick={() => handleImageClick(item.customImages || [], index)}
                        >
                          <Image
                            src={image.url && typeof image.url === 'string' && image.url.trim() !== '' ? 
                              (image.url.includes('firebasestorage.googleapis.com') ? 
                                `/api/proxy/image?url=${encodeURIComponent(image.url)}` : 
                                image.url) : 
                              '/placeholder.jpg'}
                            alt={`Custom Image ${index + 1}`}
                            fill
                            className="object-cover group-hover:opacity-75 transition-opacity"
                            onError={(e) => {
                              // Handle image loading errors
                              console.error('Error loading custom image:', image);
                              // Try to load placeholder image instead
                              const target = e.target as HTMLImageElement;
                              if (target.src !== '/placeholder.jpg') {
                                target.src = '/placeholder.jpg';
                              } else if (target.parentElement) {
                                // If placeholder also fails, hide the parent div
                                target.parentElement.style.display = 'none';
                              }
                            }}
                          />
                          {image.comment && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1 text-xs truncate">
                              {image.comment}
                            </div>
                          )}
                          <button 
                            className="absolute top-0 right-0 p-1 text-gray-500 hover:text-gray-700"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleImageClick(item.customImages || [], index);
                            }}
                          >
                            <Maximize2 size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Product Images - Only show primary image with error handling */}
                {item.images && Array.isArray(item.images) && item.images.length > 0 && (
                  <div className="mt-3 ml-8">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Product Image:</h5>
                    <div className="flex gap-2">
                      <div 
                        key="product-primary" 
                        className="relative min-w-[80px] h-[80px] rounded-lg overflow-hidden border border-gray-200 group cursor-pointer shadow-sm hover:shadow-md transition-shadow"
                        onClick={(e) => {
                          handleImageClick(item.images || [], 0);
                        }}
                      >
                        <Image
                          src={item.images[0]?.url && typeof item.images[0].url === 'string' && item.images[0].url.trim() !== '' ? 
                            (item.images[0].url.includes('firebasestorage.googleapis.com') ? 
                              `/api/proxy/image?url=${encodeURIComponent(item.images[0].url)}` : 
                              item.images[0].url) : 
                            '/placeholder.jpg'}
                          alt="Product Image"
                          fill
                          className="object-cover group-hover:opacity-75 transition-opacity"
                          onError={(e) => {
                            // Handle image loading errors
                            console.error('Error loading product image:', item.images[0]);
                            // Try to load placeholder image instead
                            const target = e.target as HTMLImageElement;
                            if (target.src !== '/placeholder.jpg') {
                              target.src = '/placeholder.jpg';
                            } else if (target.parentElement) {
                              // If placeholder also fails, hide the parent div
                              target.parentElement.style.display = 'none';
                            }
                          }}
                        />
                        <button 
                          className="absolute top-0 right-0 p-1 text-gray-500 hover:text-gray-700"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleImageClick(item.images || [], 0);
                          }}
                        >
                          <Maximize2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Notes input for final check */}
        {showNotesInput && (
          <div className="mt-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add final check notes..."
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              rows={3}
            />
          </div>
        )}

        {/* Action buttons based on status */}
        <div className="bg-gray-50 p-4 rounded-lg">
          {getStatusActions()}
        </div>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            {sendBackTarget ? (
              <DialogTitle>Send Back to {sendBackTarget}</DialogTitle>
            ) : (
              <DialogTitle>Add Final Check Notes</DialogTitle>
            )}
          </DialogHeader>
          <div className="py-4">
            {sendBackTarget && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Return Reason <span className="text-red-500">*</span>
                </label>
                <textarea
                  placeholder={`Why is this order being returned to ${sendBackTarget}?`}
                  value={returnReason}
                  onChange={(e) => setReturnReason(e.target.value)}
                  rows={4}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>
            )}
            {!sendBackTarget && (
              <textarea
                placeholder="Add any notes about this order (optional)"
                value={teamNotes}
                onChange={(e) => setTeamNotes(e.target.value)}
                rows={4}
                className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={confirmStatusUpdate}>
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Lightbox
        open={lightboxOpen}
        index={lightboxIndex}
        slides={currentImages}
        close={() => setLightboxOpen(false)}
        plugins={[Zoom]}
        zoom={{
          maxZoomPixelRatio: 3,
          zoomInMultiplier: 2,
          doubleClickMaxStops: 3,
          scrollToZoom: true
        }}
      />
    </motion.div>
  );
}
