"use client";

import { useState, useEffect, useRef } from "react";
import { CheckCircle2, Clock, ChefHat, Bell, RotateCw, Maximize2, Minimize2, AlertCircle } from "lucide-react";
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
  | "FINAL_CHECK_QUEUE"
  | "FINAL_CHECK_PROCESSING"
  | "FINAL_CHECK_READY"
  | "COMPLETED";

interface KitchenOrder {
  id: string;
  orderNumber: string;
  items: {
    id: string;
    name: string;
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
  finalCheckStartTime?: string;
  finalCheckEndTime?: string;
  requiresKitchen: boolean;
  requiresDesign: boolean;
  deliveryMethod?: 'PICKUP' | 'DELIVERY';
  pickupDate?: string;
  pickupTimeSlot?: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
  qualityControl?: {
    returnedFromFinalCheck?: boolean;
    returnReason?: string;
    returnedAt?: string;
  };
  parallelProcessing?: {
    kitchenStatus?: KitchenOrderStatus;
  };
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

export default function KitchenDisplay() {
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<CustomSlide[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [teamNotes, setTeamNotes] = useState('');

  // Fetch initial orders
  useEffect(() => {
    fetchOrders();
    // Set up auto-refresh every 5 minutes
    const refreshInterval = setInterval(() => {
      fetchOrders();
    }, 5 * 60 * 1000);
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
      // Subscribe to 'new_order' event from backend
      const unsubscribeNew = wsService.subscribe('new_order', (data) => {
        console.log('Received new order:', data);
        setOrders(prev => {
          // Check if order already exists
          if (prev.some(order => order.id === data.id)) {
            return prev;
          }
          return [data, ...prev];
        });
        toast.custom(() => (
          <div className="bg-white rounded-lg shadow-lg p-4 flex items-center space-x-3">
            <Bell className="w-5 h-5 text-blue-500" />
            <div>
              <p className="font-medium">New Order #{data.orderNumber}</p>
              <p className="text-sm text-gray-500">{data.customerName}</p>
            </div>
          </div>
        ));
      });

      const unsubscribeUpdate = wsService.subscribe('ORDER_STATUS_UPDATE', async (data) => {
        // When we receive an update, refetch the orders to get the latest data
        fetchOrders();
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
          // Include orders in kitchen queue/processing/ready
          (order.status === 'KITCHEN_QUEUE' ||
           order.status === 'KITCHEN_PROCESSING' ||
           order.status === 'KITCHEN_READY') ||
          // Include parallel processing orders
          order.status === 'PARALLEL_PROCESSING' ||
          // Include orders sent back from Final Check
          (order.qualityControl?.returnedFromFinalCheck && order.requiresKitchen)
        );

        const ordersWithImages = kitchenOrders.map((order: any) => ({
          ...order,
          // For parallel processing orders, show as KITCHEN_QUEUE
          status: order.status === 'PARALLEL_PROCESSING' ? 'KITCHEN_QUEUE' : order.status,
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

  // Function to update order status
  const updateOrderStatus = async (orderId: string, newStatus: KitchenOrderStatus, teamNotes?: string) => {
    try {
      console.log('Updating order status:', { orderId, newStatus, teamNotes });
      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: newStatus,
        teamNotes: teamNotes || ''
      });

      if (response.success) {
        // Update local state
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
      } else {
        console.error('Error updating order status:', response.message);
        toast.error(`Failed to update order status: ${response.message}`);
      }
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const handleSendToDesign = async (orderId: string, notes?: string) => {
    await updateOrderStatus(orderId, 'DESIGN_QUEUE', notes);
  };

  const handleSendToFinalCheck = async (orderId: string, notes?: string) => {
    await updateOrderStatus(orderId, 'FINAL_CHECK_QUEUE', notes);
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
      // For kitchen-only orders, send to final check
      await handleSendToFinalCheck(orderId);
    }
  };

  const getOrdersByStatus = (status: KitchenOrderStatus) => {
    return orders
      .filter(order => order.status === status)
      .sort((a, b) => {
        // Get the relevant date for each order (pickup or delivery)
        const getOrderDate = (order: KitchenOrder) => {
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

  const handleStatusUpdate = async (newStatus: KitchenOrderStatus) => {
    if (!selectedOrder) {
      toast.error('No order selected');
      return;
    }

    try {
      if (newStatus === 'DESIGN_QUEUE') {
        await handleSendToDesign(selectedOrder.id, teamNotes);
      } else if (newStatus === 'FINAL_CHECK_QUEUE') {
        await handleSendToFinalCheck(selectedOrder.id, teamNotes);
      } else {
        await updateOrderStatus(selectedOrder.id, newStatus, teamNotes);
      }
      
      // Reset UI state
      setTeamNotes('');
      setShowNotesInput(false);
      setSelectedOrder(null);
    } catch (error) {
      console.error('Error updating status:', error);
      toast.error('Failed to update order status');
    }
  };

  const OrderCard = ({ order }: { order: KitchenOrder }) => {
    const handleImageClick = (images: CustomImage[], index: number) => {
      const slides = images.map(img => ({
        src: img.url,
        comment: img.comment || ''
      }));
      setCurrentImages(slides);
      setLightboxIndex(index);
      setLightboxOpen(true);
    };

    const handleOrderAction = (action: 'process' | 'ready' | 'finalCheck' | 'design') => {
      // Set the selected order for the parent component
      setSelectedOrder(order);
      
      // Check current status to avoid invalid transitions
      console.log('Current order status:', order.status);
      
      if (action === 'process') {
        if (order.status !== 'KITCHEN_PROCESSING') {
          updateOrderStatus(order.id, 'KITCHEN_PROCESSING');
        }
      } else if (action === 'ready') {
        if (order.status !== 'KITCHEN_READY') {
          updateOrderStatus(order.id, 'KITCHEN_READY');
        }
      } else if (action === 'finalCheck') {
        // Only send to final check if not already there
        if (order.status !== 'FINAL_CHECK_QUEUE' && 
            order.status !== 'FINAL_CHECK_PROCESSING' && 
            order.status !== 'FINAL_CHECK_READY') {
          updateOrderStatus(order.id, 'FINAL_CHECK_QUEUE');
        } else {
          toast.info('Order is already in final check');
        }
      } else if (action === 'design') {
        setShowNotesInput(true);
      }
    };

    return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="bg-white rounded-xl shadow-lg p-4 mb-6 border-l-4 overflow-hidden relative"
      style={{
        borderLeftColor: 
          order.qualityControl?.returnedFromFinalCheck ? '#EF4444' : // Red border for returned orders
          order.status === 'KITCHEN_QUEUE' ? '#3B82F6' : 
          order.status === 'KITCHEN_PROCESSING' ? '#F59E0B' : 
          order.status === 'KITCHEN_READY' ? '#10B981' : '#6B7280'
      }}
    >
      {/* Status Badge */}
      <div className="absolute top-3 right-3 z-10">
        <span className={`px-3 py-1 text-xs font-medium rounded-full ${
          order.status === 'KITCHEN_QUEUE' ? 'bg-blue-100 text-blue-800' : 
          order.status === 'KITCHEN_PROCESSING' ? 'bg-yellow-100 text-yellow-800' : 
          'bg-green-100 text-green-800'
        }`}>
          {order.status === 'KITCHEN_QUEUE' ? 'New' : 
           order.status === 'KITCHEN_PROCESSING' ? 'Processing' : 
           'Ready'}
        </span>
      </div>

      {/* Return Badge - Show when order was returned from Final Check */}
      {order.qualityControl?.returnedFromFinalCheck && (
        <div className="absolute top-10 right-3 z-10 mt-2">
        <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center">
          <AlertCircle className="w-3 h-3 mr-1" /> Return from Final Check
        </span>
      </div>
      )}

      {/* Prominent Sent Back Tag - Only show for returned orders */}
      {order.qualityControl?.returnedFromFinalCheck && (
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-1 -left-12 bg-red-500 text-white px-12 py-1 transform rotate-315 shadow-md">
            SENT BACK
          </div>
        </div>
      )}

      <div className="space-y-5">
        {/* Header Section */}
        <div className="flex justify-between items-start pb-3 border-b border-gray-100">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Order #{order.orderNumber}</h3>
            <div className="flex items-center mt-1 space-x-2">
              <p className="text-sm font-medium text-gray-600">Customer: {order.customerName}</p>
              <span className="text-gray-300 text-sm">|</span>
              <p className="text-sm text-gray-500">
                {formatDistanceToNow(new Date(order.createdAt), { addSuffix: true })}
              </p>
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
          <div className="flex-shrink-0 mr-4">
          </div>
        </div>

        {/* Notes Section - With return reason highlighted */}
        <div className="space-y-3">
          {order.qualityControl?.returnedFromFinalCheck && order.qualityControl?.returnReason && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm text-red-700">
                <span className="font-bold flex items-center gap-1">
                  <AlertCircle className="w-4 h-4 mr-1" /> Return Reason:
                </span> 
                {order.qualityControl.returnReason}
              </p>
              {order.qualityControl.returnedAt && (
                <p className="text-xs text-red-500 mt-1">
                  Returned on {format(new Date(order.qualityControl.returnedAt), 'MMM d, h:mm a')}
                </p>
              )}
            </div>
          )}

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
                    {Object.entries(item.variations || {}).length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(item.variations || {}).map(([type, variation]) => (
                          <span key={type} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                            {variation.name}: {variation.value}
                          </span>
                        ))}
                      </div>
                    )}
                    
                    {/* Item specific notes */}
                    {item.kitchenNotes && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-blue-400">
                        <span className="font-medium">Notes:</span> {item.kitchenNotes}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Design Images with improved gallery */}
                {item.customImages && item.customImages.length > 0 && (
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {item.customImages.map((image, index) => (
                      <div 
                        key={index} 
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group cursor-pointer shadow-sm hover:shadow-md transition-all"
                        onClick={() => handleImageClick(item.customImages || [], index)}
                      >
                        <Image
                          src={image.url}
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
              placeholder="Add notes for the next team..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              rows={3}
            />
          </div>
        )}

        {/* Action Buttons Section */}
        <div className="pt-3 border-t border-gray-200">
          {order.status === 'KITCHEN_QUEUE' && (
            <button
              onClick={() => handleOrderAction('process')}
              className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white text-lg font-medium rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm hover:shadow active:bg-blue-800"
            >
              <ChefHat className="w-5 h-5" />
              Start Processing
            </button>
          )}
          {order.status === 'KITCHEN_PROCESSING' && (
            <button
              onClick={() => handleOrderAction('ready')}
              className="w-full py-3 px-4 bg-yellow-500 hover:bg-yellow-600 text-white text-lg font-medium rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm hover:shadow active:bg-yellow-700"
            >
              <CheckCircle2 className="w-5 h-5" />
              Mark as Ready
            </button>
          )}
          {order.status === 'KITCHEN_READY' && (
            <div className="grid grid-cols-1 gap-3">
              {order.requiresDesign && !order.designEndTime ? (
                <>
                  <button
                    onClick={() => setShowNotesInput(!showNotesInput)}
                    className="w-full py-3 px-4 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
                  >
                    {showNotesInput ? 'Cancel Notes' : 'Add Handoff Notes'}
                  </button>
                  <button
                    onClick={() => handleOrderAction('design')}
                    className="w-full py-3 px-4 bg-purple-600 hover:bg-purple-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all"
                  >
                    <Bell className="w-5 h-5" />
                    {showNotesInput ? 'Save Notes & Send to Design' : 'Send to Design'}
                  </button>
                </>
              ) : (
                <button
                  onClick={() => handleOrderAction('finalCheck')}
                  className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Send to Final Check
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </motion.div>
    );
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

  return (
    <div className="min-h-screen bg-gray-100 p-4">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Kitchen Screen</h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <button
            onClick={fetchOrders}
            className="p-2 rounded-lg bg-white hover:bg-gray-50 text-gray-600"
            title="Refresh Orders"
          >
            <RotateCw className="w-5 h-5" />
          </button>
          <button
            onClick={() => {
              if (!document.fullscreenElement) {
                document.documentElement.requestFullscreen();
              } else {
                document.exitFullscreen();
              }
            }}
            className="p-2 rounded-lg bg-white hover:bg-gray-50 text-gray-600"
            title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
          >
            {isFullscreen ? (
              <Minimize2 className="w-5 h-5" />
            ) : (
              <Maximize2 className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Queue Section */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <ChefHat className="w-5 h-5 mr-2" />
            Queue
            {orders.filter(order => 
              order.status === 'KITCHEN_QUEUE' && 
              order.qualityControl?.returnedFromFinalCheck
            ).length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                {orders.filter(order => 
                  order.status === 'KITCHEN_QUEUE' && 
                  order.qualityControl?.returnedFromFinalCheck
                ).length} Returned
              </span>
            )}
          </h2>
          <div className="space-y-4">
            <AnimatePresence>
              {orders
                .filter(order => order.status === 'KITCHEN_QUEUE')
                .map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                  />
                ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Processing Section */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <ChefHat className="w-5 h-5 mr-2" />
            Processing
          </h2>
          <div className="space-y-4">
            <AnimatePresence>
              {orders
                .filter(order => order.status === 'KITCHEN_PROCESSING')
                .map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                  />
                ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Ready Section */}
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="text-lg font-semibold mb-4 flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Ready
          </h2>
          <div className="space-y-4">
            <AnimatePresence>
              {orders
                .filter(order => order.status === 'KITCHEN_READY')
                .map(order => (
                  <OrderCard
                    key={order.id}
                    order={order}
                  />
                ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Lightbox for images */}
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
