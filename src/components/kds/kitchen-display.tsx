"use client";

import { useState, useEffect, useRef } from "react";
import { Timer, CheckCircle2, Clock, ChefHat, Bell, RotateCw, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiMethods } from "@/services/api";
import { wsService } from "@/services/websocket";
import { toast } from "react-hot-toast";
import { format, formatDistanceToNow } from "date-fns";
import Lightbox from "yet-another-react-lightbox";
import "yet-another-react-lightbox/styles.css";
import Image from 'next/image';
import { CustomImage } from '@/types/cart';

interface VariationOption {
  name: string;
  value: string;
}

type KitchenOrderStatus = 
  | "PENDING"
  | "KITCHEN_QUEUE"
  | "KITCHEN_PROCESSING"
  | "KITCHEN_READY"
  | "DESIGN_QUEUE"
  | "DESIGN_PROCESSING"
  | "DESIGN_READY"
  | "COMPLETED";

interface KitchenOrder {
  id: string;
  orderNumber: string;
  items: {
    id: string;
    productName: string;
    quantity: number;
    variations: Record<string, VariationOption>;
    kitchenNotes?: string;
    designNotes?: string;
    customImages?: CustomImage[];
    isCustom?: boolean;
    status: KitchenOrderStatus;
  }[];
  status: KitchenOrderStatus;
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
  deliveryMethod?: 'PICKUP' | 'DELIVERY';
  pickupDate?: string;
  pickupTimeSlot?: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
}

interface OrderTimerProps {
  startTime: string;
  endTime?: string;
  status: KitchenOrderStatus;
}

interface UpdateOrderStatusPayload {
  status: KitchenOrderStatus;
  notes?: string;
  teamNotes?: string;
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
      {/* Status text */}
      <div className={`flex flex-col ${getTimerColor()}`}>
        <span className="text-sm">Prep Time</span>
        {endTime && <span className="text-xs">(Final)</span>}
      </div>
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

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<CustomSlide[]>([]);

  // Fetch initial orders
  useEffect(() => {
    fetchOrders();
    // Set up auto-refresh every 5 minutes
    const refreshInterval = setInterval(fetchOrders, 5 * 60 * 1000);
    return () => clearInterval(refreshInterval);
  }, []);

  // Fullscreen effect
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Subscribe to WebSocket updates
  useEffect(() => {
    if (wsService) {
      const unsubscribeNew = wsService.subscribe('NEW_ORDER', (data) => {
        setOrders(prev => {
          // Check if order already exists
          if (prev.some(order => order.id === data.order.id)) {
            return prev;
          }
          return [data.order, ...prev];
        });
        toast.custom(() => (
          <div className="bg-white rounded-lg shadow-lg p-4 flex items-center space-x-3">
            <Bell className="w-5 h-5 text-blue-500" />
            <div>
              <p className="font-medium">New Order #{data.order.orderNumber}</p>
              <p className="text-sm text-gray-500">{data.order.customerName}</p>
            </div>
          </div>
        ));
      });

      const unsubscribeUpdate = wsService.subscribe('ORDER_STATUS_UPDATE', (data) => {
        setOrders(prev => prev.map(order => {
          if (order.id === data.id) {
            // Only update the specific fields that changed
            return {
              ...order,
              status: data.status,
              ...(data.kitchenStartTime && { kitchenStartTime: data.kitchenStartTime }),
              ...(data.kitchenEndTime && { kitchenEndTime: data.kitchenEndTime }),
              ...(data.designStartTime && { designStartTime: data.designStartTime }),
              ...(data.designEndTime && { designEndTime: data.designEndTime })
            };
          }
          return order;
        }));
      });

      return () => {
        unsubscribeNew();
        unsubscribeUpdate();
      };
    }
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiMethods.pos.getOrders();
      if (response.success) {
        // Filter for kitchen-relevant orders only
        const kitchenOrders = response.data.filter((order: any) => 
          order.requiresKitchen || // Orders that need kitchen work
          order.status === 'PENDING' || // Include pending orders
          (order.requiresDesign && order.status === 'DESIGN_READY') // Design-ready orders waiting for kitchen
        );

        const ordersWithImages = kitchenOrders.map((order: any) => ({
          ...order,
          items: order.items.map((item: any) => ({
            ...item,
            customImages: item.customImages?.map((img: any) => ({
              url: img.url,
              comment: img.comment
            })) || []
          }))
        }));
        setOrders(ordersWithImages);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: KitchenOrderStatus, teamNotes?: string) => {
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
                  kitchenNotes: teamNotes || order.kitchenNotes 
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

  const handleSendToDesign = async (orderId: string, notes?: string) => {
    await updateOrderStatus(orderId, 'DESIGN_QUEUE', notes);
  };

  const handleMarkCompleted = async (orderId: string) => {
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // For orders that require both teams
    if (order.requiresDesign && order.requiresKitchen) {
      if (order.status === 'KITCHEN_READY') {
        await handleSendToDesign(orderId);
      }
    } else {
      // For kitchen-only orders
      await updateOrderStatus(orderId, 'COMPLETED');
    }
  };

  const getOrdersByStatus = (status: KitchenOrderStatus) => {
    return orders
      .filter(order => order.status === status)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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

  const OrderCard = ({ order }: { order: KitchenOrder }) => {
    const [showNotesInput, setShowNotesInput] = useState(false);
    const [teamNotes, setTeamNotes] = useState('');

    const handleImageClick = (images: CustomImage[], index: number) => {
      const slides = images.map(img => ({
        src: img.url,
        comment: img.comment || ''
      }));
      setCurrentImages(slides);
      setLightboxIndex(index);
      setLightboxOpen(true);
    };

    const handleStatusUpdate = async (newStatus: KitchenOrderStatus) => {
      if (showNotesInput) {
        await updateOrderStatus(order.id, newStatus, teamNotes);
        setShowNotesInput(false);
        setTeamNotes("");
      } else {
        await updateOrderStatus(order.id, newStatus);
      }
    };

    const handleReadyClick = () => {
      if (order.requiresDesign && !order.designEndTime) {
        // If design work is still needed, show notes input
        setShowNotesInput(true);
      } else {
        // Otherwise, just mark as completed
        handleStatusUpdate('COMPLETED');
      }
    };

    return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-lg shadow-md p-4 mb-4"
    >
      <div className="space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-semibold">Order #{order.orderNumber}</h3>
            <p className="text-sm text-gray-500">Customer: {order.customerName}</p>
            <OrderTimer2 createdAt={new Date(order.createdAt)} />
            {order.deliveryMethod && (
              <div className="mt-2 text-sm">
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
              </div>
            )}
          </div>
        </div>

        {/* Show design notes if available */}
        {order.designNotes && (
          <div className="mt-2 p-2 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-800">
              <span className="font-medium">Design Notes:</span> {order.designNotes}
            </p>
          </div>
        )}

        {/* Show kitchen notes if available */}
        {order.kitchenNotes && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Kitchen Notes:</span> {order.kitchenNotes}
            </p>
          </div>
        )}

        {/* Rest of the order card content */}
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-start pb-2 border-b border-gray-100 last:border-0">
              <div className="flex-1 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{item.productName}</h4>
                    <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                    {/* Show variations */}
                    {Object.entries(item.variations || {}).map(([type, variation]) => (
                      <p key={type} className="text-sm text-gray-500">
                        {variation.name} - {variation.value}
                      </p>
                    ))}
                    {/* Show notes */}
                    {item.kitchenNotes && (
                      <p className="text-sm text-gray-600 mt-2">
                        Notes: {item.kitchenNotes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Design Images */}
                {item.customImages && item.customImages.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {item.customImages.map((image, index) => (
                      <div 
                        key={index} 
                        className="relative min-w-[120px] h-[120px] rounded-lg overflow-hidden border border-gray-200 group cursor-pointer"
                        onClick={() => handleImageClick(item.customImages || [], index)}
                      >
                        <Image
                          src={image.url}
                          alt={`Design ${index + 1}`}
                          fill
                          className="object-cover group-hover:opacity-75 transition-opacity"
                        />
                        {image.comment && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1 text-xs">
                            {image.comment}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Notes input for team handoff */}
        {showNotesInput && (
          <div className="mt-4">
            <textarea
              value={teamNotes}
              onChange={(e) => setTeamNotes(e.target.value)}
              placeholder="Add notes for the design team..."
              className="w-full p-2 border rounded-lg"
              rows={3}
            />
          </div>
        )}

        <div className="bg-gray-50 border-t">
          {order.status === 'PENDING' && (
            <button
              onClick={() => handleStatusUpdate('KITCHEN_PROCESSING')}
              className="w-full py-4 px-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium rounded-lg flex items-center justify-center gap-2 transition-colors active:bg-blue-700 touch-manipulation"
            >
              <ChefHat className="w-6 h-6" />
              Accept Order
            </button>
          )}
          {order.status === 'KITCHEN_QUEUE' && (
            <button
              onClick={() => handleStatusUpdate('KITCHEN_PROCESSING')}
              className="w-full py-4 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-lg font-medium flex items-center justify-center gap-2 transition-colors active:bg-yellow-700 touch-manipulation"
            >
              <Bell className="w-6 h-6" />
              Start Processing
            </button>
          )}
          {order.status === 'KITCHEN_PROCESSING' && (
            <button
              onClick={() => handleStatusUpdate('KITCHEN_READY')}
              className="w-full py-4 px-4 bg-green-500 hover:bg-green-600 text-white text-lg font-medium flex items-center justify-center gap-2 transition-colors active:bg-green-700 touch-manipulation"
            >
              <CheckCircle2 className="w-6 h-6" />
              Mark Ready
            </button>
          )}
          {order.status === 'KITCHEN_READY' && (
            <div className="grid grid-cols-1 gap-2 p-2">
              {order.requiresDesign && !order.designEndTime ? (
                <>
                  <button
                    onClick={() => setShowNotesInput(true)}
                    className="w-full py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                  >
                    <Bell className="w-5 h-5" />
                    Send to Design
                  </button>
                  {showNotesInput && (
                    <button
                      onClick={() => handleStatusUpdate('DESIGN_QUEUE')}
                      className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Confirm & Send
                    </button>
                  )}
                </>
              ) : (
                <button
                  onClick={() => handleStatusUpdate('COMPLETED')}
                  className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Mark Completed
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Kitchen Display</h1>
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
          <div className="grid grid-cols-4 gap-4">
            {/* New Orders & Kitchen Queue Column */}
            <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                  New & Kitchen Queue
                </h2>
                <span className="text-sm text-gray-500">
                  {getOrdersByStatus("PENDING").length + getOrdersByStatus("KITCHEN_QUEUE").length}
                </span>
              </div>
              <AnimatePresence>
                {[...getOrdersByStatus("PENDING"), ...getOrdersByStatus("KITCHEN_QUEUE")].map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </AnimatePresence>
            </div>

            {/* Processing Column */}
            <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center">
                  <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
                  Processing
                </h2>
                <span className="text-sm text-gray-500">{getOrdersByStatus("KITCHEN_PROCESSING").length}</span>
              </div>
              <AnimatePresence>
                {getOrdersByStatus("KITCHEN_PROCESSING").map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </AnimatePresence>
            </div>

            {/* Ready Column */}
            <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                  Ready
                </h2>
                <span className="text-sm text-gray-500">{getOrdersByStatus("KITCHEN_READY").length}</span>
              </div>
              <AnimatePresence>
                {getOrdersByStatus("KITCHEN_READY").map(order => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </AnimatePresence>
            </div>

            {/* Completed Column */}
            <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center">
                  <div className="w-3 h-3 rounded-full bg-gray-500 mr-2" />
                  Completed
                </h2>
                <span className="text-sm text-gray-500">{getOrdersByStatus("COMPLETED").length}</span>
              </div>
              <AnimatePresence>
                {getOrdersByStatus("COMPLETED").map(order => (
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

interface CustomSlide {
  src: string;
  comment?: string;
}
