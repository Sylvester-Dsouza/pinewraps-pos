"use client";

import { useState, useEffect, useRef } from "react";
import { Timer, CheckCircle2, Clock, ChefHat, Bell, RotateCw, Maximize2, Minimize2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiMethods } from "@/services/api";
import { wsService } from "@/services/websocket";
import { toast } from "react-hot-toast";
import { format, formatDistanceToNow } from "date-fns";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Image from 'next/image';

interface DesignImage {
  url?: string;
  imageUrl?: string;
  comment?: string;
  imageNumber: number;
}

type DesignOrderStatus = 
  | "PENDING"
  | "KITCHEN_QUEUE"
  | "KITCHEN_PROCESSING"
  | "KITCHEN_READY"
  | "DESIGN_QUEUE"
  | "DESIGN_PROCESSING"
  | "DESIGN_READY"
  | "FINAL_CHECK_QUEUE"
  | "FINAL_CHECK_PROCESSING"
  | "FINAL_CHECK_READY"
  | "COMPLETED";

interface UpdateOrderStatusPayload {
  status: DesignOrderStatus;
  notes?: string;
  teamNotes?: string;
}

interface DesignOrder {
  id: string;
  orderNumber: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    variations: any;
    kitchenNotes?: string;
    designNotes?: string;
    designImages?: DesignImage[];
    isCustom?: boolean;
    status: DesignOrderStatus;
  }[];
  status: DesignOrderStatus;
  createdAt: string;
  customerName: string;
  kitchenNotes?: string;
  designNotes?: string;
  expectedReadyTime?: string;
  kitchenStartTime?: string;
  kitchenEndTime?: string;
  designStartTime?: string;
  designEndTime?: string;
  requiresKitchen: boolean;
  requiresDesign: boolean;
  deliveryMethod?: string;
  pickupDate?: string;
  pickupTimeSlot?: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  parallelProcessing?: {
    designStatus: DesignOrderStatus;
  };
}

interface CustomSlide {
  src: string;
  comment?: string;
}

interface VariationValue {
  name?: string;
  value?: string;
  [key: string]: any;
}

interface VariationItem {
  id?: string;
  type?: string;
  value: string;
  priceAdjustment?: number;
}

interface OrderTimerProps {
  startTime: string;
  endTime?: string;
  status: DesignOrderStatus;
}

const OrderTimer = ({ startTime, endTime, status }: OrderTimerProps) => {
  const [elapsed, setElapsed] = useState(0);
  const TARGET_TIME = 15 * 60; // 15 minutes target time
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const initialStartTime = useRef<string>(startTime);

  useEffect(() => {
    // Only update the initial start time when the component first mounts
    // or when a new startTime is provided and the timer hasn't started yet
    if (!initialStartTime.current || !timerRef.current) {
      initialStartTime.current = startTime;
    }

    const updateElapsed = () => {
      const start = new Date(initialStartTime.current).getTime();
      const now = Date.now();
      const elapsedSeconds = Math.floor((now - start) / 1000);
      setElapsed(elapsedSeconds);
    };

    // Clear existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (status === 'KITCHEN_PROCESSING') {
      // Update immediately
      updateElapsed();
      // Set up interval for updates
      timerRef.current = setInterval(updateElapsed, 1000);
    } else if (status === 'KITCHEN_READY' && startTime && endTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      const totalTime = Math.floor((end - start) / 1000);
      setElapsed(totalTime);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [status, endTime, startTime]); // Include startTime to handle new orders correctly

  const formatTimer = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Determine color based on status and time
  const getTimerColor = () => {
    if (status === 'KITCHEN_READY' || status === 'COMPLETED') return 'text-green-600 stroke-green-600';
    if (elapsed > 30 * 60) return 'text-red-600 stroke-red-600'; // Over 30 minutes
    if (elapsed > 15 * 60) return 'text-orange-600 stroke-orange-600'; // Over 15 minutes
    return 'text-yellow-600 stroke-yellow-600'; // Default
  };

  // Calculate progress percentage
  const progress = Math.min((elapsed / TARGET_TIME) * 100, 100);
  const radius = 20;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex items-center space-x-2">
      {/* Circular Progress */}
      <div className="relative w-12 h-12">
        {/* Background circle */}
        <svg className="w-full h-full transform -rotate-90">
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            className="opacity-10"
          />
          {/* Progress circle */}
          <circle
            cx="24"
            cy="24"
            r={radius}
            stroke="currentColor"
            strokeWidth="3"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className={`transition-all duration-500 ${getTimerColor()}`}
          />
        </svg>
        {/* Timer text in the middle */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-xs font-medium ${getTimerColor()}`}>
            {formatTimer(elapsed)}
          </span>
        </div>
      </div>
      {/* Status text completely removed as requested */}
    </div>
  );
};

const OrderTimer2 = ({ createdAt }: { createdAt: Date }) => {
  const [elapsedTime, setElapsedTime] = useState('');
  const [timeClass, setTimeClass] = useState('text-gray-500');

  useEffect(() => {
    const updateTimer = () => {
      const now = new Date();
      const start = new Date(createdAt);
      const diff = now.getTime() - start.getTime();
      
      const minutes = Math.floor(diff / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);
      const hours = Math.floor(minutes / 60);

      // Update color based on elapsed time
      if (minutes >= 30) {
        setTimeClass('text-red-500 font-medium');
      } else if (minutes >= 15) {
        setTimeClass('text-orange-500');
      } else if (minutes >= 5) {
        setTimeClass('text-yellow-600');
      } else {
        setTimeClass('text-gray-500');
      }

      if (hours > 0) {
        setElapsedTime(`${hours}h ${minutes % 60}m ${seconds}s`);
      } else if (minutes > 0) {
        setElapsedTime(`${minutes}m ${seconds}s`);
      } else {
        setElapsedTime(`${seconds}s`);
      }
    };

    // Update immediately and then every second
    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [createdAt]);

  return (
    <div className={`flex items-center gap-1 text-sm mt-1 ${timeClass}`}>
      <Clock className="w-4 h-4" />
      <span>{elapsedTime}</span>
    </div>
  );
};

export default function DesignDisplay() {
  const [orders, setOrders] = useState<DesignOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<CustomSlide[]>([]);

  useEffect(() => {
    // Initial fetch
    fetchOrders();

    // Set up WebSocket subscription
    const unsubscribe = wsService.subscribe('ORDER_STATUS_UPDATE', async (data: any) => {
      if (!data) return;
      // Refetch orders to get the latest data
      fetchOrders();
    });

    // Fullscreen change listener
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    // Auto-refresh orders every 5 minutes
    const refreshInterval = setInterval(fetchOrders, 5 * 60 * 1000);

    return () => {
      unsubscribe();
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      clearInterval(refreshInterval);
    };
  }, []);

  // Fetch initial orders
  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiMethods.pos.getOrders();
      if (response.success) {
        // Filter for design-relevant orders only
        const designOrders = response.data.filter((order: any) => {
          // Include orders in design queue/processing/ready
          if (order.status === 'DESIGN_QUEUE' || 
              order.status === 'DESIGN_PROCESSING' || 
              order.status === 'DESIGN_READY') {
            return true;
          }
          // Include parallel processing orders
          if (order.status === 'PARALLEL_PROCESSING') {
            return true;
          }
          return false;
        });

        const ordersWithImages = designOrders.map((order: any) => ({
          ...order,
          // For parallel processing orders, show as DESIGN_QUEUE
          status: order.status === 'PARALLEL_PROCESSING' ? 'DESIGN_QUEUE' : order.status,
          items: order.items.map((item: any) => ({
            ...item,
            designImages: item.customProduct?.designImages?.map((img: any) => ({
              url: img.imageUrl,
              comment: img.comment
            })) || []
          }))
        }));
        
        // Sort orders by pickup or delivery date (closest dates first)
        const sortedOrders = [...ordersWithImages].sort((a, b) => {
          // Determine the date to use for each order (pickup or delivery)
          const getOrderDate = (order: any) => {
            if (order.deliveryMethod === 'PICKUP' && order.pickupDate) {
              return new Date(order.pickupDate);
            } else if (order.deliveryMethod === 'DELIVERY' && order.deliveryDate) {
              return new Date(order.deliveryDate);
            }
            // If no date is available, use a far future date to put it at the end
            return new Date('2099-12-31');
          };
          
          const dateA = getOrderDate(a);
          const dateB = getOrderDate(b);
          
          // Compare dates
          return dateA.getTime() - dateB.getTime();
        });
        
        // Debug log for sorted orders
        console.log('Design orders sorted by date:', sortedOrders.map(order => ({
          orderNumber: order.orderNumber,
          deliveryMethod: order.deliveryMethod,
          pickupDate: order.pickupDate,
          deliveryDate: order.deliveryDate,
          date: order.deliveryMethod === 'PICKUP' ? order.pickupDate : order.deliveryDate
        })));
        
        setOrders(sortedOrders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: DesignOrderStatus, teamNotes?: string) => {
    try {
      const payload: UpdateOrderStatusPayload = {
        status: newStatus,
        teamNotes: teamNotes || "",
        notes: ""
      };
      
      const response = await apiMethods.pos.updateOrderStatus(orderId, payload);

      if (response.success) {
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId
              ? { 
                  ...order, 
                  status: newStatus,
                  designNotes: teamNotes || order.designNotes 
                }
              : order
          )
        );
        toast.success('Order status updated');
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handleSendToKitchen = async (orderId: string, notes?: string) => {
    await updateOrderStatus(orderId, 'KITCHEN_QUEUE', notes);
  };

  const handleMarkCompleted = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // For orders that require both teams
    if (order.requiresKitchen && order.requiresDesign) {
      if (order.status === 'DESIGN_READY') {
        await handleSendToKitchen(orderId);
      }
    } else {
      // For design-only orders
      await updateOrderStatus(orderId, 'COMPLETED');
    }
  };

  const getOrdersByStatus = (status: DesignOrderStatus) => {
    return orders
      .filter(order => order.status === status)
      .sort((a, b) => {
        // Get the relevant date for each order (pickup or delivery)
        const getOrderDate = (order: DesignOrder) => {
          let dateStr = '';
          let timeStr = '';
          
          // Determine which date and time to use based on delivery method
          if (order.deliveryMethod === 'PICKUP' && order.pickupDate) {
            dateStr = order.pickupDate;
            timeStr = order.pickupTimeSlot || '';
          } else if (order.deliveryMethod === 'DELIVERY' && order.deliveryDate) {
            dateStr = order.deliveryDate;
            timeStr = order.deliveryTimeSlot || '';
          } else {
            // If no pickup or delivery date, use created date
            return new Date(order.createdAt);
          }
          
          // Create a date object from the date string
          const date = new Date(dateStr);
          
          // Extract hour from time slot if available
          if (timeStr) {
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (match) {
              let hour = parseInt(match[1]);
              const minute = parseInt(match[2]);
              
              // Convert to 24-hour format
              if (match[3].toUpperCase() === 'PM' && hour < 12) {
                hour += 12;
              } else if (match[3].toUpperCase() === 'AM' && hour === 12) {
                hour = 0;
              }
              
              date.setHours(hour, minute, 0, 0);
            }
          }
          
          return date;
        };
        
        // Get dates for comparison
        const dateA = getOrderDate(a);
        const dateB = getOrderDate(b);
        
        // Simple chronological sort - earlier dates first
        return dateA.getTime() - dateB.getTime();
      });
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      </div>
    );
  }

  const OrderCard = ({ order }: { order: DesignOrder }) => {
    const [showNotesInput, setShowNotesInput] = useState(false);
    const [teamNotes, setTeamNotes] = useState("");
    const [showLightbox, setShowLightbox] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const handleStatusUpdate = async (newStatus: DesignOrderStatus) => {
      try {
        // Determine the target status based on current state and requested status
        let targetStatus = newStatus;

        // If we're clicking "Mark Ready" in Design Processing, ensure it goes to DESIGN_READY
        if (order.status === 'DESIGN_PROCESSING' && newStatus === 'DESIGN_READY') {
          targetStatus = 'DESIGN_READY';
        }
        
        const payload: UpdateOrderStatusPayload = {
          status: targetStatus,
          teamNotes: "",
          notes: ""
        };
        
        const response = await apiMethods.pos.updateOrderStatus(order.id, payload);

        if (response.success) {
          // Update local state
          setOrders(prevOrders =>
            prevOrders.map(o =>
              o.id === order.id
                ? { ...o, status: targetStatus }
                : o
            )
          );
          toast.success('Order status updated');
          
          // Close notes input if it was open
          setShowNotesInput(false);
        }
      } catch (error) {
        console.error('Error updating order status:', error);
        toast.error('Failed to update order status');
      }
    };

    const handleReadyClick = () => {
      // Send to Final Check when clicking the button in Ready state
      handleStatusUpdate('FINAL_CHECK_QUEUE');
    };

    const allImages = order.items.flatMap(item => 
      item.designImages?.map(img => ({
        src: img.url || img.imageUrl || null,
        comment: img.comment
      })) || []
    );

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white rounded-xl shadow-lg p-4 mb-6 border-l-4 overflow-hidden relative"
        style={{
          borderLeftColor: 
            order.status === 'DESIGN_QUEUE' ? '#8B5CF6' : 
            order.status === 'DESIGN_PROCESSING' ? '#EC4899' : 
            order.status === 'DESIGN_READY' ? '#10B981' : '#6B7280'
        }}
      >
        {/* Status Badge */}
        <div className="absolute top-3 right-3 z-10">
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            order.status === 'DESIGN_QUEUE' ? 'bg-purple-100 text-purple-800' : 
            order.status === 'DESIGN_PROCESSING' ? 'bg-pink-100 text-pink-800' : 
            'bg-green-100 text-green-800'
          }`}>
            {order.status === 'DESIGN_QUEUE' ? 'New' : 
             order.status === 'DESIGN_PROCESSING' ? 'Processing' : 
             'Ready'}
          </span>
        </div>

        <div className="space-y-5">
          {/* Header Section */}
          <div className="flex justify-between items-start pb-3 border-b border-gray-100">
            <div>
              <h3 className="text-xl font-bold">Order #{order.orderNumber}</h3>
              <div className="flex items-center mt-1 space-x-2">
                <p className="text-sm font-medium text-gray-600">Customer: {order.customerName}</p>
                <span className="text-gray-300 text-sm">|</span>
                <OrderTimer2 createdAt={new Date(order.createdAt)} />
              </div>
              
              
              {/* Delivery/Pickup Time - Prominent display with countdown */}
              {order.deliveryMethod && (
                <div className="mt-3 py-2 px-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="flex items-center">
                    <div className="mr-3">
                      <Clock className={`w-5 h-5 ${order.deliveryMethod === 'PICKUP' ? 'text-blue-500' : 'text-green-500'}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700">
                        {order.deliveryMethod === 'PICKUP' ? 'Pickup' : 'Delivery'} Time
                      </p>
                      <p className="text-sm font-bold">
                        {order.deliveryMethod === 'PICKUP' ? (
                          <span className="text-blue-600">
                            {order.pickupDate && format(new Date(order.pickupDate), 'EEE, MMM d')}
                            {order.pickupTimeSlot && ` at ${order.pickupTimeSlot}`}
                          </span>
                        ) : (
                          <span className="text-green-600">
                            {order.deliveryDate && format(new Date(order.deliveryDate), 'EEE, MMM d')}
                            {order.deliveryTimeSlot && ` at ${order.deliveryTimeSlot}`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Timer Display */}
            {/* <div className="flex-shrink-0 mr-4">
              {order.designStartTime && (
                <OrderTimer 
                  startTime={order.designStartTime} 
                  endTime={order.designEndTime} 
                  status={order.status} 
                />
              )}
            </div> */}
          </div>

          {/* Order Notes Section */}
          <div className="space-y-3">
            {/* Kitchen notes with improved styling */}
            {order.kitchenNotes && (
              <div className="p-3 bg-blue-50 rounded-lg border border-blue-100">
                <div className="flex items-start">
                  <div className="p-1 bg-blue-100 rounded mr-2">
                    <ChefHat className="w-4 h-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-blue-800">Kitchen Notes:</p>
                    <p className="text-sm text-blue-700">{order.kitchenNotes}</p>
                  </div>
                </div>
              </div>
            )}

            {/* Design notes if available */}
            {order.designNotes && (
              <div className="p-3 bg-purple-50 rounded-lg border border-purple-100">
                <div className="flex items-start">
                  <div className="p-1 bg-purple-100 rounded mr-2">
                    <span className="w-4 h-4 text-purple-600 flex items-center justify-center">D</span>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-purple-800">Design Notes:</p>
                    <p className="text-sm text-purple-700">{order.designNotes}</p>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Items Section with improved visuals */}
          <div className="space-y-4">
            <h4 className="font-semibold text-gray-700 flex items-center gap-2">
              <span>Order Items</span>
              <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">
                {order.items.reduce((total, item) => total + item.quantity, 0)} items
              </span>
            </h4>
            
            <div className="divide-y divide-gray-100 rounded-lg border border-gray-200 overflow-hidden">
              {order.items.map((item, idx) => (
                <div key={item.id} className="p-3 bg-white hover:bg-gray-50 transition-colors">
                  <div className="flex justify-between items-start gap-4">
                    {/* Item number circle */}
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-gray-100 flex items-center justify-center text-xs font-bold text-gray-600">
                      {idx + 1}
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <div>
                          <h4 className="font-medium text-gray-800">{item.name}</h4>
                          <div className="flex items-center mt-1">
                            <span className="text-sm font-medium text-gray-700 mr-2">Qty: {item.quantity}</span>
                            {item.isCustom && (
                              <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-800 rounded-full">Custom</span>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      {/* Variations displayed as pills */}
                      {item.variations && Object.entries(item.variations).length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1">
                          {Object.entries(item.variations).map(([type, variation]) => (
                            <span key={type} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                              {type}: {typeof variation === 'object' && variation !== null ? 
                                (variation as any).value || JSON.stringify(variation) : 
                                variation}
                            </span>
                          ))}
                        </div>
                      )}
                      
                      {/* Item specific notes */}
                      {item.designNotes && (
                        <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-purple-400">
                          <span className="font-medium">Notes:</span> {item.designNotes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Design Images with improved gallery */}
                  {item.designImages && item.designImages.length > 0 && (
                    <div className="mt-3 grid grid-cols-3 gap-2">
                      {item.designImages.map((image, index) => (
                        <div 
                          key={index} 
                          className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group cursor-pointer shadow-sm hover:shadow-md transition-all"
                          onClick={() => {
                            const slides = item.designImages?.map(img => ({
                              src: img.url || img.imageUrl || null,
                              comment: img.comment
                            })) || [];
                            setCurrentImages(slides);
                            setLightboxIndex(index);
                            setLightboxOpen(true);
                          }}
                        >
                          <Image
                            src={image.url || image.imageUrl || null}
                            alt={`Design ${index + 1}`}
                            fill
                            className="object-cover group-hover:opacity-90 transition-opacity"
                          />
                          <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                            <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          {image.comment && (
                            <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-60 text-white p-1.5 text-xs">
                              {image.comment}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Notes input for team handoff with improved styling */}
          {showNotesInput && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">Add notes for handoff</label>
              <textarea
                value={teamNotes}
                onChange={(e) => setTeamNotes(e.target.value)}
                placeholder="Add notes for the kitchen team..."
                className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                rows={3}
              />
              <div className="mt-2 flex justify-end space-x-2">
                <button
                  onClick={() => setShowNotesInput(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    handleStatusUpdate('KITCHEN_QUEUE');
                  }}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Send to Kitchen
                </button>
              </div>
            </div>
          )}

          {/* Action buttons */}
          {!showNotesInput && (
            <div className="mt-4 space-y-2">
              {order.status === 'DESIGN_QUEUE' && (
                <button
                  onClick={() => handleStatusUpdate('DESIGN_PROCESSING')}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center justify-center"
                >
                  <ChefHat className="w-4 h-4 mr-2" />
                  Start Design
                </button>
              )}
              
              {order.status === 'DESIGN_PROCESSING' && (
                <button
                  onClick={() => handleStatusUpdate('DESIGN_READY')}
                  className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Mark Ready
                </button>
              )}
              
              {order.status === 'DESIGN_READY' && (
                <button
                  onClick={handleReadyClick}
                  className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center"
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Send to Final Check
                </button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Design Display</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={fetchOrders}
              className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              <RotateCw className="w-4 h-4 mr-2" />
              Refresh
            </button>
            <button
              onClick={() => {
                if (!document.fullscreenElement) {
                  document.documentElement.requestFullscreen();
                } else {
                  document.exitFullscreen();
                }
              }}
              className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              <span className="ml-2">Toggle Fullscreen</span>
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-4">
            {/* 1. New - Design Queue Orders */}
            <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center">
                  <div className="w-3 h-3 rounded-full bg-purple-500 mr-2" />
                  New
                </h2>
                <span className="text-sm text-gray-500">{getOrdersByStatus("DESIGN_QUEUE").length}</span>
              </div>
              <AnimatePresence>
                {getOrdersByStatus("DESIGN_QUEUE").map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </AnimatePresence>
            </div>

            {/* Design Processing Column */}
            <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center">
                  <div className="w-3 h-3 rounded-full bg-purple-500 mr-2" />
                  Processing
                </h2>
                <span className="text-sm text-gray-500">{getOrdersByStatus("DESIGN_PROCESSING").length}</span>
              </div>
              <AnimatePresence>
                {getOrdersByStatus("DESIGN_PROCESSING").map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </AnimatePresence>
            </div>

            {/* Design Ready Column */}
            <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
                  Ready
                </h2>
                <span className="text-sm text-gray-500">{getOrdersByStatus("DESIGN_READY").length}</span>
              </div>
              <AnimatePresence>
                {getOrdersByStatus("DESIGN_READY").map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox for design images */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={currentImages}
      />
    </div>
  );
}
