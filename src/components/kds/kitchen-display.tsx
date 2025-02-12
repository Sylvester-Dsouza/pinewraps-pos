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

interface KitchenOrder {
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
    status: "PENDING" | "KITCHEN_PROCESSING" | "KITCHEN_READY" | "COMPLETED";
  }[];
  status: "PENDING" | "KITCHEN_PROCESSING" | "KITCHEN_READY" | "COMPLETED";
  createdAt: string;
  customerName: string;
  kitchenNotes?: string;
  expectedReadyTime?: string;
  kitchenStartTime?: string;
  kitchenEndTime?: string;
}

interface OrderTimerProps {
  startTime: string;
  endTime?: string;
  status: KitchenOrder["status"];
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
              ...(data.kitchenEndTime && { kitchenEndTime: data.kitchenEndTime })
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
        const ordersWithImages = response.data.map((order: any) => ({
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
        console.log('Orders with images:', ordersWithImages);
        setOrders(ordersWithImages);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: KitchenOrder["status"]) => {
    try {
      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: newStatus,
        notes: ""
      });

      if (response.success) {
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId
              ? { ...order, status: newStatus }
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

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };


  const getOrdersByStatus = (status: KitchenOrder["status"]) => {
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

  const OrderCard = ({ order }: { order: KitchenOrder }) => (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.2 }}
      layoutId={order.id}
      className="bg-white rounded-xl shadow-sm overflow-hidden border border-gray-200 mb-4"
    >
      <div className="p-4 border-b bg-gray-50">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-bold text-lg">#{order.orderNumber}</h3>
            <p className="text-sm text-gray-500">{order.customerName}</p>
            <OrderTimer2 createdAt={new Date(order.createdAt)} />
          </div>
          <div className={`px-2 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1 ${
            order.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
            order.status === 'KITCHEN_READY' ? 'bg-yellow-100 text-yellow-800' :
            order.status === 'KITCHEN_PROCESSING' ? 'bg-blue-100 text-blue-800' :
            'bg-gray-100 text-gray-800'
          }`}>
            {order.status === 'COMPLETED' ? (
              <>
                <CheckCircle2 className="w-3 h-3" />
                <span>Completed</span>
              </>
            ) : order.status === 'KITCHEN_READY' ? (
              <>
                <Clock className="w-3 h-3" />
                <span>Ready</span>
              </>
            ) : order.status === 'KITCHEN_PROCESSING' ? (
              <>
                <ChefHat className="w-3 h-3" />
                <span>Processing</span>
              </>
            ) : (
              <>
                <Timer className="w-3 h-3" />
                <span>Pending</span>
              </>
            )}
          </div>
        </div>
        <div className="flex items-center justify-between text-sm text-gray-500 mt-2">
          {order.status === 'KITCHEN_PROCESSING' && order.kitchenStartTime ? (
            <div className="flex items-center">
              <Timer className="w-4 h-4 mr-1" />
              <OrderTimer 
                startTime={order.kitchenStartTime}
                endTime={order.kitchenEndTime}
                status={order.status}
              />
            </div>
          ) : (
            <div className="flex items-center">
              <Clock className="w-4 h-4 mr-1" />
              <span>{formatDistanceToNow(new Date(order.createdAt))} ago</span>
            </div>
          )}
        </div>
      </div>

      <div className="p-4">
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
                
                {/* Notes */}
                {(item.kitchenNotes || item.designNotes) && (
                  <div className="mt-2">
                    {item.kitchenNotes && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Kitchen Notes:</h4>
                        <p className="mt-1 text-sm text-orange-600">{item.kitchenNotes}</p>
                      </div>
                    )}
                    {item.designNotes && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">Design Notes:</h4>
                        <p className="mt-1 text-sm text-blue-600">{item.designNotes}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="bg-gray-50 border-t">
        {order.status === 'PENDING' && (
          <button
            onClick={() => updateOrderStatus(order.id, 'KITCHEN_PROCESSING')}
            className="w-full py-4 px-4 bg-blue-500 hover:bg-blue-600 text-white text-lg font-medium rounded-lg flex items-center justify-center gap-2 transition-colors active:bg-blue-700 touch-manipulation"
          >
            <ChefHat className="w-6 h-6" />
            Accept Order
          </button>
        )}
        {order.status === 'KITCHEN_PROCESSING' && (
          <button
            onClick={() => updateOrderStatus(order.id, 'KITCHEN_READY')}
            className="w-full py-4 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-lg font-medium flex items-center justify-center gap-2 transition-colors active:bg-yellow-700 touch-manipulation"
          >
            <Bell className="w-6 h-6" />
            Mark Ready
          </button>
        )}
        {order.status === 'KITCHEN_READY' && (
          <button
            onClick={() => updateOrderStatus(order.id, 'COMPLETED')}
            className="w-full py-4 px-4 bg-green-500 hover:bg-green-600 text-white text-lg font-medium flex items-center justify-center gap-2 transition-colors active:bg-green-700 touch-manipulation"
          >
            <CheckCircle2 className="w-6 h-6" />
            Complete Order
          </button>
        )}
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white shadow-sm sticky top-0 z-50">
        <div className="max-w-[98%] mx-auto px-4 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center">
                <ChefHat className="w-8 h-8 mr-2" />
                Kitchen Display
              </h1>
              <p className="text-sm text-gray-500 mt-1">
                {format(new Date(), 'EEEE, MMMM d, yyyy h:mm a')}
              </p>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchOrders}
                className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                <RotateCw className="w-4 h-4 mr-2" />
                Refresh
              </button>
              <button
                onClick={toggleFullscreen}
                className="flex items-center px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Kanban Board */}
      <div className="max-w-[98%] mx-auto px-4 py-6">
        <div className="grid grid-cols-4 gap-6 h-[calc(100vh-130px)]">
          {/* Pending Column */}
          <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center">
                <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                New Orders
              </h2>
              <span className="text-sm text-gray-500">{getOrdersByStatus("PENDING").length}</span>
            </div>
            <AnimatePresence>
              {getOrdersByStatus("PENDING").map(order => (
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
      </div>

      {/* Lightbox */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={currentImages}
        render={{
          slide: ({ slide }) => {
            const customSlide = slide as CustomSlide;
            return (
              <div className="relative">
                <img src={customSlide.src} alt="Design" className="max-h-[80vh] w-auto" />
                {customSlide.comment && (
                  <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 p-4">
                    <p className="text-white text-sm text-center">{customSlide.comment}</p>
                  </div>
                )}
              </div>
            );
          },
        }}
      />
    </div>
  );
}
