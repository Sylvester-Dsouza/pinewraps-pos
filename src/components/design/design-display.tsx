"use client";

import { useState, useEffect, useRef } from "react";
import { Timer, CheckCircle2, Clock, ChefHat, Bell, RotateCw, Maximize2, Minimize2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiMethods } from "@/services/api";
import wsService from "@/services/websocket";
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
    productName: string;
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
    const unsubscribe = wsService.subscribe('pos-order-update', (data: any) => {
      if (!data) return;

      // Update order in state
      setOrders(prevOrders => {
        return prevOrders.map(order => {
          if (order.id === data.orderId) {
            return {
              ...order,
              status: data.status,
              ...(data.kitchenStartTime && { kitchenStartTime: data.kitchenStartTime }),
              ...(data.kitchenEndTime && { kitchenEndTime: data.kitchenEndTime }),
              ...(data.designStartTime && { designStartTime: data.designStartTime }),
              ...(data.designEndTime && { designEndTime: data.designEndTime }),
              ...(data.kitchenNotes && { kitchenNotes: data.kitchenNotes }),
              ...(data.designNotes && { designNotes: data.designNotes })
            };
          }
          return order;
        });
      });

      // Show toast notification
      if (data.status) {
        toast.success(`Order #${data.orderNumber} status updated to ${data.status}`);
      }
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
          // Include orders that:
          // 1. Are in design queue or processing
          if (order.status === 'DESIGN_QUEUE' || order.status === 'DESIGN_PROCESSING') {
            return true;
          }
          // 2. Require design and haven't been completed
          if (order.requiresDesign && order.status !== 'COMPLETED') {
            return true;
          }
          return false;
        });

        const ordersWithImages = designOrders.map((order: any) => ({
          ...order,
          items: order.items.map((item: any) => ({
            ...item,
            designImages: item.customProduct?.designImages?.map((img: any) => ({
              url: img.imageUrl,
              comment: img.comment,
              imageNumber: img.imageNumber
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

  const OrderCard = ({ order }: { order: DesignOrder }) => {
    const [showNotesInput, setShowNotesInput] = useState(false);
    const [teamNotes, setTeamNotes] = useState("");
    const [showLightbox, setShowLightbox] = useState(false);
    const [currentImageIndex, setCurrentImageIndex] = useState(0);

    const handleStatusUpdate = async (newStatus: DesignOrderStatus) => {
      try {
        const payload: UpdateOrderStatusPayload = {
          status: newStatus,
          teamNotes: "",
          notes: ""
        };
        
        const response = await apiMethods.pos.updateOrderStatus(order.id, payload);

        if (response.success) {
          // Update local state
          setOrders(prevOrders =>
            prevOrders.map(o =>
              o.id === order.id
                ? { ...o, status: newStatus }
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
      if (order.requiresKitchen && !order.kitchenEndTime) {
        // If kitchen work is still needed, show notes input
        setShowNotesInput(true);
      } else {
        // Otherwise, just mark as completed
        handleStatusUpdate('COMPLETED');
      }
    };

    const allImages = order.items.flatMap(item => 
      item.designImages?.map(img => ({
        src: img.url || img.imageUrl || '',
        comment: img.comment
      })) || []
    );

    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className="bg-white rounded-xl shadow-sm mb-4 overflow-hidden"
      >
        <div className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">#{order.orderNumber}</h3>
              <p className="text-sm text-gray-500">{order.customerName}</p>
            </div>
            <div className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
              order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
              order.status === 'DESIGN_READY' ? 'bg-yellow-100 text-yellow-800' :
              order.status === 'DESIGN_PROCESSING' ? 'bg-purple-100 text-purple-800' :
              order.status === 'DESIGN_QUEUE' ? 'bg-purple-100 text-purple-800' :
              order.status === 'KITCHEN_QUEUE' ? 'bg-blue-100 text-blue-800' :
              order.status === 'KITCHEN_PROCESSING' ? 'bg-blue-100 text-blue-800' :
              order.status === 'KITCHEN_READY' ? 'bg-blue-100 text-blue-800' :
              'bg-gray-100 text-gray-800'
            }`}>
              {order.status === 'COMPLETED' ? (
                <>
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Completed</span>
                </>
              ) : order.status === 'DESIGN_READY' ? (
                <>
                  <Clock className="w-3 h-3" />
                  <span>Design Ready</span>
                </>
              ) : order.status === 'DESIGN_PROCESSING' ? (
                <>
                  <ChefHat className="w-3 h-3" />
                  <span>Design Processing</span>
                </>
              ) : order.status === 'DESIGN_QUEUE' ? (
                <>
                  <Timer className="w-3 h-3" />
                  <span>Design Queue</span>
                </>
              ) : order.status === 'KITCHEN_QUEUE' ? (
                <>
                  <Timer className="w-3 h-3" />
                  <span>Kitchen Queue</span>
                </>
              ) : order.status === 'KITCHEN_PROCESSING' ? (
                <>
                  <ChefHat className="w-3 h-3" />
                  <span>Kitchen Processing</span>
                </>
              ) : order.status === 'KITCHEN_READY' ? (
                <>
                  <Clock className="w-3 h-3" />
                  <span>Kitchen Ready</span>
                </>
              ) : (
                <>
                  <Timer className="w-3 h-3" />
                  <span>Pending</span>
                </>
              )}
            </div>
          </div>

          {/* Show kitchen notes if available */}
          {order.kitchenNotes && (
            <div className="mt-2 p-2 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-800">
                <span className="font-medium">Kitchen Notes:</span> {order.kitchenNotes}
              </p>
            </div>
          )}

          {/* Show design notes if available */}
          {order.designNotes && (
            <div className="mt-2 p-2 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-800">
                <span className="font-medium">Design Notes:</span> {order.designNotes}
              </p>
            </div>
          )}

          {/* Notes input for team handoff */}
          {showNotesInput && (
            <div className="mt-4">
              <textarea
                value={teamNotes}
                onChange={(e) => setTeamNotes(e.target.value)}
                placeholder="Add notes for the kitchen team..."
                className="w-full p-2 border rounded-lg"
                rows={3}
              />
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
                    </div>
                  </div>

                  {/* Design Images */}
                  {item.designImages && item.designImages.length > 0 && (
                    <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                      {item.designImages.map((image, index) => (
                        <div 
                          key={index} 
                          className="relative min-w-[120px] h-[120px] rounded-lg overflow-hidden border border-gray-200 group cursor-pointer"
                          onClick={() => {
                            const slides = item.designImages?.map(img => ({
                              src: img.url || img.imageUrl || '',
                              comment: img.comment
                            })) || [];
                            setCurrentImages(slides);
                            setLightboxIndex(index);
                            setLightboxOpen(true);
                          }}
                        >
                          <Image
                            src={image.url || image.imageUrl || ''}
                            alt={`Design ${index + 1}`}
                            fill
                            className="object-cover"
                          />
                          {image.comment && (
                            <div className="absolute inset-0 bg-black bg-opacity-50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center p-2">
                              <p className="text-white text-sm text-center">{image.comment}</p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Variations */}
                  {item.variations && (
                    Array.isArray(item.variations) ? 
                      item.variations.length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-sm font-medium text-gray-700">Variations:</h4>
                          <ul className="mt-1 space-y-1">
                            {item.variations.map((variation, index) => {
                              let displayValue: string;
                              if (typeof variation === 'object') {
                                const variationItem = variation as VariationItem;
                                displayValue = variationItem.value;
                                if (variationItem.type) {
                                  displayValue = `${variationItem.type}: ${displayValue}`;
                                }
                                if (variationItem.priceAdjustment) {
                                  displayValue += ` (${variationItem.priceAdjustment > 0 ? '+' : ''}${variationItem.priceAdjustment})`;
                                }
                              } else {
                                displayValue = String(variation);
                              }
                              
                              return (
                                <li key={index} className="text-sm text-gray-600">
                                  {displayValue}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )
                    : Object.keys(item.variations).length > 0 && (
                        <div className="mt-2">
                          <h4 className="text-sm font-medium text-gray-700">Variations:</h4>
                          <ul className="mt-1 space-y-1">
                            {Object.entries(item.variations).map(([key, value]) => {
                              let displayValue: string;
                              if (value && typeof value === 'object') {
                                const variationValue = value as VariationValue;
                                displayValue = variationValue.name || variationValue.value || JSON.stringify(value);
                              } else {
                                displayValue = String(value);
                              }
                              
                              return (
                                <li key={key} className="text-sm text-gray-600">
                                  <span className="font-medium">{key}:</span> {displayValue}
                                </li>
                              );
                            })}
                          </ul>
                        </div>
                      )
                  )}
                
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-gray-50 border-t">
          {order.status === 'DESIGN_QUEUE' && (
            <button
              onClick={() => handleStatusUpdate('DESIGN_PROCESSING')}
              className="w-full py-4 px-4 bg-purple-500 hover:bg-purple-600 text-white text-lg font-medium rounded-lg flex items-center justify-center gap-2 transition-colors active:bg-purple-700 touch-manipulation"
            >
              <ChefHat className="w-6 h-6" />
              Start Design
            </button>
          )}
          {order.status === 'DESIGN_PROCESSING' && (
            <button
              onClick={() => handleStatusUpdate('DESIGN_READY')}
              className="w-full py-4 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-lg font-medium flex items-center justify-center gap-2 transition-colors active:bg-yellow-700 touch-manipulation"
            >
              <Bell className="w-6 h-6" />
              Mark Ready
            </button>
          )}
          {order.status === 'DESIGN_READY' && (
            <div className="grid grid-cols-1 gap-2 p-2">
              {order.requiresKitchen && !order.kitchenEndTime ? (
                <>
                  <button
                    onClick={() => setShowNotesInput(true)}
                    className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
                  >
                    <Bell className="w-5 h-5" />
                    Send to Kitchen
                  </button>
                  {showNotesInput && (
                    <button
                      onClick={() => handleStatusUpdate('KITCHEN_QUEUE')}
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
          <div className="grid grid-cols-4 gap-4">
            {/* Design Queue Column */}
            <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center">
                  <div className="w-3 h-3 rounded-full bg-purple-500 mr-2" />
                  Design Queue
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

            {/* Kitchen Queue Column */}
            <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-lg flex items-center">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                  Kitchen Queue
                </h2>
                <span className="text-sm text-gray-500">{getOrdersByStatus("KITCHEN_QUEUE").length}</span>
              </div>
              <AnimatePresence>
                {getOrdersByStatus("KITCHEN_QUEUE").map(order => (
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
