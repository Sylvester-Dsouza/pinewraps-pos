"use client";

import React, { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useRouter } from "next/navigation";
import Cookies from "js-cookie";
import { 
  CheckCircle2, 
  Clock, 
  ChefHat, 
  Bell, 
  RotateCw, 
  Maximize2, 
  Minimize2, 
  AlertCircle, 
  AlertTriangle,
  Edit3,
  LogOut,
  User,
  Palette,
  ShoppingCart
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { apiMethods } from "@/services/api";
import { wsService } from "@/services/websocket";
import { toast } from "@/lib/toast";
import { toast as sonnerToast } from "sonner";
import { format, formatDistanceToNow } from "date-fns";
import Lightbox from "yet-another-react-lightbox";
import Zoom from "yet-another-react-lightbox/plugins/zoom";
import "yet-another-react-lightbox/styles.css";
import Image from 'next/image';
import { CustomImage } from '@/types/cart';

interface VariationOption {
  name?: string;
  value: string;
  type?: string;
  price?: number;
  id?: string;
  priceAdjustment?: number;
  customText?: string;
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
  | "PARALLEL_PROCESSING"
  | "FINAL_CHECK_PROCESSING"
  | "COMPLETED"
  | "PARALLEL_PROCESSING";

interface KitchenOrder {
  id: string;
  orderNumber: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    variations: {
      variationsObj?: Record<string, VariationOption>;
      selectedVariations?: VariationOption[];
    };
    selectedVariations?: VariationOption[];
    kitchenNotes?: string;
    designNotes?: string;
    notes?: string;
    customImages?: CustomImage[];
    images?: any[]; 
    isCustom?: boolean;
    status: KitchenOrderStatus;
  }[];
  status: KitchenOrderStatus;
  createdAt: string;
  customerName: string;
  kitchenNotes?: string;
  designNotes?: string;
  finalCheckNotes?: string;
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
  parallelProcessing?: {
    kitchenStatus?: KitchenOrderStatus;
    designStatus?: KitchenOrderStatus;
  };
  isSentBack?: boolean;
  kitchenById?: string;
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

interface CustomSlide {
  src: string;
  comment?: string;
}

interface KitchenDisplayProps {
  staffRoles?: {
    isKitchenStaff: boolean;
    isDesignStaff: boolean;
    isFinalCheckStaff: boolean;
    isCashierStaff: boolean;
  };
  router?: any;
}

export default function KitchenDisplay({ staffRoles, router: externalRouter }: KitchenDisplayProps = {}) {
  const { user, logout, loading: userLoading } = useAuth();
  const internalRouter = useRouter();
  const router = externalRouter || internalRouter;
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [onlineOrders, setOnlineOrders] = useState<KitchenOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [currentImages, setCurrentImages] = useState<CustomSlide[]>([]);
  const zoomRef = useRef<any>(null);
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [teamNotes, setTeamNotes] = useState('');
  // Initialize activeTab from localStorage if available, otherwise default to 'queue'
  const [activeTab, setActiveTab] = useState(() => {
    // Only run in browser environment
    if (typeof window !== 'undefined') {
      const savedTab = localStorage.getItem('kitchenActiveTab');
      return savedTab || 'queue';
    }
    return 'queue';
  });
  const [actionType, setActionType] = useState<'SEND_TO_DESIGN' | 'SEND_TO_FINAL_CHECK' | 'UPDATE_STATUS' | ''>('');

  // Fetch initial orders
  // Re-fetch orders when user info is loaded
  useEffect(() => {
    if (!userLoading) {
      fetchOrders();
    }
  }, [userLoading, user]);

  useEffect(() => {
    // Initial fetch only if user is already loaded
    if (!userLoading) {
      fetchOrders();
    }

    // Set up WebSocket subscription-refresh every 5 minutes
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
        
        // Only add the order if it's in KITCHEN_QUEUE or if it's in KITCHEN_PROCESSING/KITCHEN_READY and assigned to this user
        if (data.status === 'KITCHEN_PROCESSING' || data.status === 'KITCHEN_READY') {
          // If user is not loaded yet, show all processing/ready orders
          if (!userLoading && user) {
            // If kitchenById is set and doesn't match current user, skip this order
            if (data.kitchenById && data.kitchenById !== user.id) {
              return; // Skip this order if it's being processed by another user
            }
          }
        }
        
        // For orders sent back from final check to KITCHEN_QUEUE, only show to the original staff member
        if (data.status === 'KITCHEN_QUEUE' && data.isSentBack) {
          // If user is not loaded yet, show all sent back orders
          if (!userLoading && user) {
            // If kitchenById is set and doesn't match current user, skip this order
            if (data.kitchenById && data.kitchenById !== user.id) {
              return; // Skip this order if it's assigned to another user
            }
          }
        }
        
        setOrders(prev => {
          // Check if order already exists
          if (prev.some(order => order.id === data.id)) {
            return prev;
          }
          return [data, ...prev];
        });
        sonnerToast(
          <div className="flex items-center space-x-3">
            <Bell className="w-5 h-5 text-blue-500" />
            <div>
              <p className="font-medium">New Order</p>
              <p className="text-sm text-gray-500">Order #{data.orderNumber} has been added to Kitchen</p>
            </div>
          </div>
        );
      });

      const unsubscribeUpdate = wsService.subscribe('ORDER_STATUS_UPDATE', async (data) => {
        // Instead of refetching all orders, update the specific order in state
        if (data && data.id) {
          setOrders(prevOrders => {
            // Check if the order exists in our current state
            const orderIndex = prevOrders.findIndex(order => order.id === data.id);
            
            if (orderIndex === -1) {
              // If the order doesn't exist in our state but should be visible to this user, add it
              if (shouldShowOrder(data)) {
                return [...prevOrders, data];
              }
              return prevOrders;
            }
            
            // If the order exists but should no longer be visible, remove it
            if (!shouldShowOrder(data)) {
              return prevOrders.filter(order => order.id !== data.id);
            }
            
            // Otherwise, update the order
            const updatedOrders = [...prevOrders];
            updatedOrders[orderIndex] = data;
            return updatedOrders;
          });
        }
      });

      return () => {
        unsubscribeNew();
        unsubscribeUpdate();
      };
    }
  }, []);

  // Helper function to determine if an order should be shown to the current user
  const shouldShowOrder = (order: KitchenOrder) => {
    // Check if the order contains sets products - these should always go to both kitchen and design
    // We can detect this by checking if the order is in PARALLEL_PROCESSING status
    if (order.status === 'PARALLEL_PROCESSING') {
      console.log('Found parallel processing order:', order.orderNumber);
      return true; // Always show parallel processing orders in kitchen screen
    }

    // Always show orders in KITCHEN_QUEUE unless they're sent back and assigned to someone else
    if (order.status === 'KITCHEN_QUEUE') {
      // For orders sent back from final check, only show to the original staff member
      if (order.isSentBack) {
        // If user is not loaded yet, show all sent back orders
        if (userLoading || !user) {
          return true;
        }
        // If kitchenById is set and doesn't match current user, don't show this order
        if (order.kitchenById && order.kitchenById !== user.id) {
          return false;
        }
      }
      return true;
    }
    
    // For KITCHEN_PROCESSING and KITCHEN_READY orders, only show if assigned to current user
    if (order.status === 'KITCHEN_PROCESSING' || order.status === 'KITCHEN_READY') {
      // If user is not loaded yet, show all processing/ready orders
      if (userLoading || !user) {
        return true;
      }
      
      // If kitchenById is null or undefined, show the order (might be legacy data)
      if (!order.kitchenById) {
        return true;
      }
      
      // Only show if assigned to current user
      return order.kitchenById === user?.id;
    }
    
    // Don't show orders in other statuses
    return false;
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      // Request all orders for KDS (no pagination)
      const response = await apiMethods.pos.getOrders({ limit: 'all' });
      if (response.success) {
        // Log orders for debugging
        console.log('Current user ID:', user?.id);
        
        // Filter for kitchen-relevant orders only using our shouldShowOrder helper
        const kitchenOrders = response.data.filter((order: any) => shouldShowOrder(order));
        
        const ordersWithImages = kitchenOrders.map((order: any) => {
          return {
            ...order,
            // For parallel processing orders, use the kitchen status from parallelProcessing if available
            status: order.status === 'PARALLEL_PROCESSING' ? 
              (order.parallelProcessing?.kitchenStatus || 'KITCHEN_QUEUE') : 
              order.status,
            items: order.items.map((item: any) => ({
              ...item,
              customImages: item.customImages?.map((img: any) => ({
                url: img.url,
                comment: img.comment
              })) || [],
              // Add product images if available, ensuring they have valid URLs
              images: item.product?.images?.filter((img: any) => img && img.url) || [],
              // Ensure selectedVariations is properly mapped
              selectedVariations: (() => {
                // First check if selectedVariations is already an array
                if (Array.isArray(item.selectedVariations)) {
                  return item.selectedVariations.map((variation: any) => ({
                    ...variation,
                    // Ensure customText is preserved
                    customText: variation.customText || ''
                  }));
                }
                
                // Check if it's a string that needs to be parsed
                if (typeof item.selectedVariations === 'string') {
                  try {
                    const parsedVariations = JSON.parse(item.selectedVariations);
                    if (Array.isArray(parsedVariations)) {
                      return parsedVariations.map((variation: any) => ({
                        ...variation,
                        customText: variation.customText || ''
                      }));
                    }
                  } catch (error) {
                    console.error('Error parsing selectedVariations:', error);
                  }
                }
                
                // Check if variations object contains selectedVariations
                if (item.variations && typeof item.variations === 'object') {
                  // Check if variations has selectedVariations array
                  if (Array.isArray(item.variations.selectedVariations)) {
                    return item.variations.selectedVariations.map((variation: any) => ({
                      ...variation,
                      customText: variation.customText || ''
                    }));
                  }
                  
                  // Check if variations has variationsObj
                  if (item.variations.variationsObj && typeof item.variations.variationsObj === 'object') {
                    return Object.entries(item.variations.variationsObj).map(([type, value]) => {
                      let displayValue = '';
                      let customText = '';
                      
                      if (typeof value === 'object' && value !== null) {
                        displayValue = (value as any).value || JSON.stringify(value);
                        customText = (value as any).customText || '';
                      } else if (typeof value === 'string') {
                        const match = String(value).match(/^(.+?)\s*\((.+?)\)$/);
                        if (match) {
                          displayValue = match[1];
                          customText = match[2];
                        } else {
                          displayValue = value;
                        }
                      } else {
                        displayValue = String(value);
                      }
                      
                      return {
                        type,
                        value: displayValue,
                        customText
                      };
                    });
                  }
                  
                  // As a last resort, try to extract from variations directly
                  if (Object.keys(item.variations).length > 0 && 
                      !('selectedVariations' in item.variations) && 
                      !('variationsObj' in item.variations)) {
                    return Object.entries(item.variations).map(([type, value]) => {
                      let displayValue = '';
                      let customText = '';
                      
                      if (typeof value === 'object' && value !== null) {
                        displayValue = (value as any).value || JSON.stringify(value);
                        customText = (value as any).customText || '';
                      } else if (typeof value === 'string') {
                        const match = String(value).match(/^(.+?)\s*\((.+?)\)$/);
                        if (match) {
                          displayValue = match[1];
                          customText = match[2];
                        } else {
                          displayValue = value;
                        }
                      } else {
                        displayValue = String(value);
                      }
                      
                      return {
                        type,
                        value: displayValue,
                        customText
                      };
                    });
                  }
                }
                
                // If all else fails, return empty array
                return [];
              })()
            }))
          };
        });
        
        // Sort orders by pickup or delivery date AND time (closest dates and earlier times first)
        const sortedOrders = [...ordersWithImages].sort((a, b) => {
          // Determine the date and time to use for each order (pickup or delivery)
          const getOrderDateTime = (order: any) => {
            let dateStr = '';
            let timeSlot = '';
            
            if (order.deliveryMethod === 'PICKUP' && order.pickupDate) {
              dateStr = order.pickupDate;
              timeSlot = order.pickupTimeSlot || '';
            } else if (order.deliveryMethod === 'DELIVERY' && order.deliveryDate) {
              dateStr = order.deliveryDate;
              timeSlot = order.deliveryTimeSlot || '';
            } else {
              // If no date is available, use a far future date to put it at the end
              return new Date('2099-12-31');
            }
            
            // Extract the time from the time slot (e.g., "10:00 AM - 11:00 AM" -> "10:00 AM")
            const startTime = timeSlot.split(' - ')[0] || '';
            
            // Create a date object with both date and time
            if (startTime) {
              // Combine date and time for accurate sorting
              const matches = startTime.match(/\d+/g) || ['0', '0'];
              const hours = matches[0] || '0';
              const minutes = matches[1] || '0';
              const isPM = startTime.toLowerCase().includes('pm');
              
              // Create a new date object
              const dateTime = new Date(dateStr);
              
              // Set hours (convert to 24-hour format if PM)
              let hoursNum = parseInt(hours, 10);
              if (isPM && hoursNum < 12) hoursNum += 12;
              if (!isPM && hoursNum === 12) hoursNum = 0;
              
              dateTime.setHours(hoursNum, parseInt(minutes, 10), 0, 0);
              return dateTime;
            }
            
            // If no time slot, just use the date
            return new Date(dateStr);
          };
          
          const dateTimeA = getOrderDateTime(a);
          const dateTimeB = getOrderDateTime(b);
          
          // Compare date and time together
          return dateTimeA.getTime() - dateTimeB.getTime();
        });
        
        // Debug log for sorted orders
        console.log('Orders sorted by date:', sortedOrders.map(order => ({
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

  // Function to update order status
  const updateOrderStatus = async (orderId: string, newStatus: KitchenOrderStatus, teamNotes?: string) => {
    try {
      // Find the current order to check its status
      const currentOrder = orders.find(o => o.id === orderId);
      if (!currentOrder) {
        toast.error('Order not found');
        return;
      }
      
      // Check if we're trying to move an order from final check back to kitchen
      const isReturnFromFinalCheck = currentOrder && 
        (currentOrder.status === 'FINAL_CHECK_QUEUE' || currentOrder.status === 'FINAL_CHECK_PROCESSING') && 
        (newStatus === 'KITCHEN_QUEUE' || newStatus === 'KITCHEN_PROCESSING');
      
      console.log('Updating order status:', { 
        orderId, 
        newStatus, 
        teamNotes, 
        currentStatus: currentOrder?.status,
        isReturnFromFinalCheck,
        currentUserId: user?.id
      });
      
      // Create a new order object with the updated status
      const updatedOrder = { 
        ...currentOrder, 
        status: newStatus,
        // Only update kitchenNotes if teamNotes is provided
        ...(teamNotes !== undefined ? { kitchenNotes: teamNotes } : {}),
        // When moving to processing, assign the current user
        // When moving to ready, maintain the same assignment
        kitchenById: newStatus === 'KITCHEN_PROCESSING' ? user?.id : currentOrder.kitchenById
      };
      
      // Update the UI immediately for a responsive experience
      // This creates a smoother user experience without waiting for the API
      setOrders(prevOrders => {
        return prevOrders.map(order => 
          order.id === orderId ? updatedOrder : order
        );
      });
      
      // Now make the API call to update the backend
      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: newStatus,
        ...(teamNotes !== undefined ? { teamNotes } : {}),
        returnToKitchenOrDesign: isReturnFromFinalCheck
      });

      // Log the response to see what's coming back from the API
      console.log('API response for updateOrderStatus:', response);
      
      if (response.success) {
        // If the API call was successful, show a success message
        toast.success('Order status updated');
        
        // If the API returned updated data, use that to update our state
        if (response.data) {
          const serverUpdatedOrder = {
            ...updatedOrder,
            ...response.data
          };
          
          // Update with the server data to ensure consistency
          setOrders(prevOrders => {
            return prevOrders.map(order => 
              order.id === orderId ? serverUpdatedOrder : order
            );
          });
        }
      } else {
        // If the API call failed, revert our optimistic update
        setOrders(prevOrders => {
          return prevOrders.map(order => 
            order.id === orderId ? currentOrder : order
          );
        });
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
    const order = orders.find(o => o.id === orderId);
    if (!order) return;

    // For parallel orders, we should only set the kitchen status to KITCHEN_READY
    // The backend will handle moving it to FINAL_CHECK_QUEUE when both kitchen and design are ready
    const isParallelOrder = order.requiresKitchen && order.requiresDesign;
    
    if (isParallelOrder) {
      // For parallel orders, use the parallel processing function
      await updateParallelOrderStatus(orderId, 'KITCHEN_READY', notes);
    } else {
      // For kitchen-only orders, we can directly send to final check
      await updateOrderStatus(orderId, 'FINAL_CHECK_QUEUE', notes);
    }
  };

  // Function to handle parallel processing status updates
  const updateParallelOrderStatus = async (orderId: string, kitchenStatus: KitchenOrderStatus, teamNotes?: string) => {
    try {
      const order = orders.find(o => o.id === orderId);
      if (!order) {
        toast.error('Order not found');
        return;
      }

      // Create an optimistically updated order object
      const updatedOrder = { 
        ...order,
        // Only update kitchenNotes if teamNotes is provided
        ...(teamNotes !== undefined ? { kitchenNotes: teamNotes } : {}),
        // Update the parallelProcessing object
        parallelProcessing: {
          ...order.parallelProcessing,
          kitchenStatus: kitchenStatus
        },
        // Also update the main status for UI display
        status: kitchenStatus
      };
      
      // Update the UI immediately for a responsive experience
      setOrders(prevOrders => {
        return prevOrders.map(o => o.id === orderId ? updatedOrder : o);
      });
      
      // Prepare payload for API call
      const payload = {
        parallelProcessing: {
          kitchenStatus: kitchenStatus,
          ...(teamNotes !== undefined ? { teamNotes } : {})
        }
      };
      
      // Make the API call
      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: 'PARALLEL_PROCESSING', // Explicitly set status to PARALLEL_PROCESSING
        ...(teamNotes !== undefined ? { teamNotes } : {}),
        parallelProcessing: {
          kitchenStatus: kitchenStatus
          // Deliberately not including designStatus to ensure it remains unchanged
        }
      });

      if (response.success) {
        // If the API call was successful and returned updated data
        if (response.data) {
          const serverUpdatedOrder = {
            ...updatedOrder
          };
          
          // If the response includes a new status, update that too
          if (response.data.status) {
            serverUpdatedOrder.status = response.data.status;
          }
          
          // Update with the server data to ensure consistency
          setOrders(prevOrders => {
            return prevOrders.map(o => o.id === orderId ? serverUpdatedOrder : o);
          });
          
          // Show appropriate success message
          if (response.data.status === 'FINAL_CHECK_QUEUE') {
            toast.success('Both teams ready! Order sent to Final Check');
          } else {
            toast.success('Kitchen marked ready! Waiting for Design team...');
          }
        } else {
          toast.success('Order status updated');
        }
      } else {
        // If the API call failed, revert our optimistic update
        setOrders(prevOrders => {
          return prevOrders.map(o => o.id === orderId ? order : o);
        });
        console.error('Error updating parallel order status:', response.message);
        toast.error(`Failed to update order status: ${response.message}`);
      }
    } catch (error) {
      // Revert optimistic update on error
      const originalOrder = orders.find(o => o.id === orderId);
      if (originalOrder) {
        setOrders(prevOrders => {
          return prevOrders.map(o => o.id === orderId ? originalOrder : o);
        });
      }
      console.error('Error updating parallel order status:', error);
      toast.error('Failed to update order status');
    }
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

  // Helper function to check if an order should be in a specific status section
  const isOrderInStatus = (order: KitchenOrder, status: KitchenOrderStatus) => {
    // For normal orders, just check the status directly
    if (order.status === status) {
      return true;
    }
    
    // For parallel processing orders, check the parallelProcessing.kitchenStatus
    if (order.parallelProcessing && order.status === 'PARALLEL_PROCESSING') {
      return order.parallelProcessing.kitchenStatus === status;
    }
    
    return false;
  };

  const getOrdersByStatus = (status: KitchenOrderStatus) => {
    return orders
      .filter(order => isOrderInStatus(order, status))
      .sort((a, b) => {
        // Get the relevant date for each order (pickup or delivery)
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
  };

  const handleSubmitNotes = async () => {
    if (!selectedOrder) {
      toast.error('No order selected');
      return;
    }

    try {
      if (actionType === 'SEND_TO_DESIGN') {
        await handleSendToDesign(selectedOrder.id, teamNotes);
        toast.success('Order sent to design with notes');
      } else if (actionType === 'SEND_TO_FINAL_CHECK') {
        await handleSendToFinalCheck(selectedOrder.id, teamNotes);
        toast.success('Order sent to final check with notes');
      } else if (actionType === 'UPDATE_STATUS') {
        await updateOrderStatus(selectedOrder.id, selectedOrder.status, teamNotes);
        toast.success('Notes added to order');
      }

      // Reset the notes and hide the input
      setTeamNotes('');
      setShowNotesInput(false);
      setActionType('');
    } catch (error) {
      console.error('Error processing notes:', error);
      toast.error('Failed to process notes');
    }
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
        // Check if this is a parallel order that requires both kitchen and design
        if (selectedOrder.requiresKitchen && selectedOrder.requiresDesign) {
          // Update the kitchen status to ready in the parallel processing object
          await updateParallelOrderStatus(selectedOrder.id, 'KITCHEN_READY', teamNotes);
        } else {
          // For kitchen-only orders, proceed directly to final check
          await handleSendToFinalCheck(selectedOrder.id, teamNotes);
        }
      } else {
        await updateOrderStatus(selectedOrder.id, newStatus, teamNotes);
      }
      
      // Reset the notes and hide the input
      setTeamNotes('');
      setShowNotesInput(false);
      setSelectedOrder(null);
      
      toast.success(`Order status updated to ${newStatus.replace('_', ' ')}`);
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Failed to update order status');
    }
  };

  const OrderCard = ({ order }: { order: KitchenOrder }) => {
    // Local state for this specific order's notes
    const [showOrderNotes, setShowOrderNotes] = useState(false);
    const [orderNotes, setOrderNotes] = useState('');
    
    // Animation variants for smooth transitions
    const cardVariants = {
      initial: { opacity: 0, scale: 0.98 },
      animate: { opacity: 1, scale: 1, transition: { duration: 0.2 } },
      exit: { opacity: 0, scale: 0.98, transition: { duration: 0.1 } }
    };
    const openLightbox = (images: Array<{ url: string; comment?: string }>, index: number) => {
      const slides = images.map(img => ({
        src: img.url,
        comment: img.comment,
        width: 1200, // Add width for zoom plugin
        height: 800  // Add height for zoom plugin
      }));
      setCurrentImages(slides);
      setLightboxIndex(index);
      setLightboxOpen(true);
    };

    const handleImageClick = (images: any[], index: number) => {
      const slides = images.map(img => ({
        src: img.url,
        comment: img.comment || '',
        width: 1200, // Add width for zoom plugin
        height: 800  // Add height for zoom plugin
      }));
      setCurrentImages(slides);
      setLightboxIndex(index);
      setLightboxOpen(true);
    };

    const handleOrderAction = (action: 'process' | 'ready' | 'finalCheck' | 'design' | 'editNotes') => {
      // Check current status to avoid invalid transitions
      console.log('Current order status:', order.status);
      
      if (action === 'process') {
        // Allow processing orders from any state, including FINAL_CHECK_QUEUE
        // The returnToKitchenOrDesign flag will be set in updateOrderStatus
        updateOrderStatus(order.id, 'KITCHEN_PROCESSING');
      } else if (action === 'ready') {
        if (order.status !== 'KITCHEN_READY') {
          updateOrderStatus(order.id, 'KITCHEN_READY');
        }
      } else if (action === 'finalCheck') {
        // Send directly to final check without requiring notes
        if (order.status === 'KITCHEN_READY') {
          handleSendToFinalCheck(order.id, '');
        } else {
          // If not in KITCHEN_READY status, show error
          toast.error('Order must be marked as Ready before sending to Final Check');
        }
      } else if (action === 'design') {
        // Toggle notes input for this specific order
        setShowOrderNotes(!showOrderNotes);
      } else if (action === 'editNotes') {
        // Pre-populate with existing notes when editing
        setOrderNotes(order.kitchenNotes || '');
        setShowOrderNotes(true);
      }
    };
    
    // Handle submitting notes for this specific order
    const handleSubmitNotes = async () => {
      try {
        if (order.status === 'KITCHEN_READY' && !order.requiresDesign) {
          // Send to final check with notes
          await handleSendToFinalCheck(order.id, orderNotes);
          toast.success('Order sent to final check');
        } else if (order.status === 'KITCHEN_READY' && order.requiresDesign) {
          // Send to design with notes
          await handleSendToDesign(order.id, orderNotes);
          toast.success('Order sent to design');
        } else {
          // Just update the kitchen notes without changing status
          await updateOrderStatus(order.id, order.status, orderNotes);
          toast.success('Kitchen notes updated');
        }
        
        // Reset the notes and hide the input
        setOrderNotes('');
        setShowOrderNotes(false);
      } catch (error) {
        console.error('Error processing notes:', error);
        toast.error('Failed to process notes');
      }
    };

    return (
    <motion.div
      layout
      initial="initial"
      animate="animate"
      exit="exit"
      variants={cardVariants}
      className="bg-white rounded-xl shadow-lg p-4 mb-6 border-l-4 overflow-hidden relative"
      style={{
        borderLeftColor: 
          order.status === 'KITCHEN_QUEUE' ? '#3B82F6' : 
          order.status === 'KITCHEN_PROCESSING' ? '#F59E0B' : 
          order.status === 'KITCHEN_READY' ? '#10B981' : '#6B7280'
      }}
    >
      {/* Status Badge */}
      <div className="absolute top-3 right-3 z-10 flex flex-col gap-2">
        {order.isSentBack ? (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800 flex items-center justify-center">
            <AlertCircle className="w-3 h-3 mr-1" />
            Sent Back
          </span>
        ) : (
          <span className={`px-3 py-1 text-xs font-medium rounded-full ${
            order.status === 'KITCHEN_QUEUE' ? 'bg-blue-100 text-blue-800' : 
            order.status === 'KITCHEN_PROCESSING' ? 'bg-yellow-100 text-yellow-800' : 
            'bg-green-100 text-green-800'
          }`}>
            {order.status === 'KITCHEN_QUEUE' ? 'New' : 
             order.status === 'KITCHEN_PROCESSING' ? 'Processing' : 
             'Ready'}
          </span>
        )}
        
        {/* Show waiting for design badge if kitchen is ready but order is still being processed */}
        {order.requiresKitchen && order.requiresDesign && 
         order.parallelProcessing?.kitchenStatus === 'KITCHEN_READY' && 
         order.status !== 'FINAL_CHECK_QUEUE' && 
         order.status !== 'FINAL_CHECK_PROCESSING' && (
          <span className="px-3 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 flex items-center justify-center">
            <Clock className="w-3 h-3 mr-1" />
            Waiting for Design
          </span>
        )}
      </div>

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

        {/* Notes Section */}
        <div className="space-y-3">
          {/* Show Final Check Notes if the order was sent back */}
          {order.isSentBack && order.finalCheckNotes && (
            <div className="p-3 bg-red-50 rounded-lg border border-red-100">
              <div className="flex items-start">
                <div className="p-1 bg-red-100 rounded mr-2">
                  <AlertTriangle className="w-4 h-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-red-800">Final Check Notes:</p>
                  <p className="text-sm text-red-700">{order.finalCheckNotes}</p>
                </div>
              </div>
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
                    <div className="mt-2 flex flex-wrap gap-1">
                      {/* Display directly from selectedVariations array if available - this is the most reliable source */}
                      {item.selectedVariations && Array.isArray(item.selectedVariations) && item.selectedVariations.length > 0 && 
                        item.selectedVariations.map((variation, index) => (
                          <span key={`sel-${index}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {variation.type}: {variation.value}{variation.customText ? ` (${variation.customText})` : ''}
                          </span>
                        ))
                      }
                      
                      {/* If no direct selectedVariations, try to get them from variations.selectedVariations */}
                      {(!item.selectedVariations || !Array.isArray(item.selectedVariations) || item.selectedVariations.length === 0) && 
                        item.variations && typeof item.variations === 'object' && 
                        item.variations.selectedVariations && Array.isArray(item.variations.selectedVariations) && 
                        item.variations.selectedVariations.length > 0 && 
                        item.variations.selectedVariations.map((variation, index) => (
                          <span key={`var-${index}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {variation.type}: {variation.value}{variation.customText ? ` (${variation.customText})` : ''}
                          </span>
                        ))
                      }
                      
                      {/* As a last resort, try to get them from variations.variationsObj */}
                      {(!item.selectedVariations || !Array.isArray(item.selectedVariations) || item.selectedVariations.length === 0) &&
                        (!item.variations || !item.variations.selectedVariations || !Array.isArray(item.variations.selectedVariations) || item.variations.selectedVariations.length === 0) &&
                        item.variations && typeof item.variations === 'object' && 
                        (item.variations.variationsObj || Object.keys(item.variations).length > 0) && (
                          item.variations.variationsObj ? 
                            Object.entries(item.variations.variationsObj).map(([type, value], index) => {
                              // Extract value and customText from the value object
                              let displayValue = '';
                              let customText = '';
                              
                              if (typeof value === 'object' && value !== null) {
                                displayValue = (value as any).value || JSON.stringify(value);
                                customText = (value as any).customText || '';
                              } else if (typeof value === 'string') {
                                // Check if value contains custom text in parentheses
                                const match = String(value).match(/^(.+?)\s*\((.+?)\)$/);
                                if (match) {
                                  displayValue = match[1];
                                  customText = match[2];
                                } else {
                                  displayValue = value;
                                }
                              } else {
                                displayValue = String(value);
                              }
                              
                              return (
                                <span key={`obj-${index}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {type}: {displayValue}{customText ? ` (${customText})` : ''}
                                </span>
                              );
                            })
                          :
                            Object.entries(item.variations).map(([type, value], index) => {
                              // Extract value and customText from the value object
                              let displayValue = '';
                              let customText = '';
                              
                              if (typeof value === 'object' && value !== null) {
                                displayValue = (value as any).value || JSON.stringify(value);
                                customText = (value as any).customText || '';
                              } else if (typeof value === 'string') {
                                // Check if value contains custom text in parentheses
                                const match = String(value).match(/^(.+?)\s*\((.+?)\)$/);
                                if (match) {
                                  displayValue = match[1];
                                  customText = match[2];
                                } else {
                                  displayValue = value;
                                }
                              } else {
                                displayValue = String(value);
                              }
                              
                              return (
                                <span key={`leg-${index}`} className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  {type}: {displayValue}{customText ? ` (${customText})` : ''}
                                </span>
                              );
                            })
                        )
                      }
                    </div>
                    
                    {/* Item specific notes */}
                    {(item.notes || item.kitchenNotes) && (
                      <div className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded border-l-2 border-blue-400">
                        <span className="font-medium">Notes:</span> {item.notes || item.kitchenNotes}
                      </div>
                    )}
                  </div>
                </div>
                
                {/* Custom Images with improved gallery and error handling */}
                {item.customImages && item.customImages.length > 0 && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Custom Images:</h5>
                    <div className="grid grid-cols-3 gap-2">
                      {item.customImages
                        .filter(image => image && image.url && image.url.trim() !== '')
                        .map((image, index) => (
                        <div 
                          key={`custom-${index}`} 
                          className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group cursor-pointer shadow-sm hover:shadow-md transition-all"
                          onClick={() => {
                            const validImages = item.customImages?.filter(img => img && img.url && img.url.trim() !== '') || [];
                            handleImageClick(validImages, index);
                          }}
                        >
                          {image.url && image.url.trim() !== '' ? (
                            <Image
                              src={image.url}
                              alt={`Custom ${index + 1}`}
                              fill
                              className="object-cover group-hover:opacity-90 transition-opacity"
                              onError={(e) => {
                                // Handle image loading errors
                                console.error('Error loading custom image:', { imageUrl: image.url, image });
                                // Hide the parent div on error
                                const target = e.target as HTMLImageElement;
                                if (target.parentElement) {
                                  target.parentElement.style.display = 'none';
                                }
                              }}
                            />
                          ) : (
                            <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                              <span className="text-gray-500 text-xs">No Image</span>
                            </div>
                          )}
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
                  </div>
                )}
                
                {/* Product Images - Only show primary image with error handling */}
                {item.images && item.images.length > 0 && item.images[0]?.url && (
                  <div className="mt-3">
                    <h5 className="text-sm font-medium text-gray-700 mb-2">Product Image:</h5>
                    <div className="grid grid-cols-3 gap-2">
                      <div 
                        key="product-primary" 
                        className="relative aspect-square rounded-lg overflow-hidden border border-gray-200 group cursor-pointer shadow-sm hover:shadow-md transition-all"
                        onClick={() => {
                          if (item.images[0]?.url && item.images[0].url.trim() !== '') {
                            handleImageClick([item.images[0]], 0);
                          }
                        }}
                      >
                        {item.images[0].url && item.images[0].url.trim() !== '' ? (
                          <Image
                            src={item.images[0].url}
                            alt="Product Image"
                            fill
                            className="object-cover group-hover:opacity-90 transition-opacity"
                            onError={(e) => {
                              // Handle image loading errors
                              console.error('Error loading product image:', { imageUrl: item.images[0].url, image: item.images[0] });
                              // Hide the parent div on error
                              const target = e.target as HTMLImageElement;
                              if (target.parentElement) {
                                target.parentElement.style.display = 'none';
                              }
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                            <span className="text-gray-500 text-xs">No Image</span>
                          </div>
                        )}
                        <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-10 transition-all flex items-center justify-center">
                          <Maximize2 className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Display existing kitchen notes if any */}
        {order.kitchenNotes && !showOrderNotes && (
          <div className="mt-4 bg-gray-50 p-3 rounded-lg border border-gray-200">
            <div className="flex justify-between items-start mb-2">
              <h5 className="text-sm font-medium text-gray-700">Kitchen Notes:</h5>
              <button 
                onClick={() => handleOrderAction('editNotes')}
                className="text-blue-600 hover:text-blue-800 text-sm flex items-center gap-1"
              >
                <Edit3 className="w-3.5 h-3.5" />
                Edit
              </button>
            </div>
            <p className="text-sm text-gray-600 whitespace-pre-wrap">{order.kitchenNotes}</p>
          </div>
        )}

        {/* Notes input for team handoff with improved styling */}
        {showOrderNotes && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Kitchen Notes</label>
            <textarea
              value={orderNotes}
              onChange={(e) => setOrderNotes(e.target.value)}
              placeholder="Add notes for the kitchen team..."
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
              rows={3}
            />
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setShowOrderNotes(false);
                  setOrderNotes('');
                }}
                className="flex-1 py-2 px-4 bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitNotes}
                className="flex-1 py-2 px-4 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 transition-colors"
              >
                Save Notes
              </button>
            </div>
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
              {/* For parallel processing orders, don't show any buttons as they automatically go to final check */}
              {(order.status as KitchenOrderStatus) === 'PARALLEL_PROCESSING' ? (
                <button
                  disabled
                  className="w-full py-3 px-4 bg-gray-500 text-white font-medium rounded-lg flex items-center justify-center gap-2 cursor-default"
                >
                  <Clock className="w-5 h-5" />
                  {order.parallelProcessing && order.parallelProcessing.designStatus === 'DESIGN_READY' ? 
                    'Processing...' : 
                    'Waiting for Design Team...'}
                </button>
              ) : (
                // For regular orders
                order.requiresDesign && !order.designEndTime ? (
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
                  // Only show the Send to Final Check button for non-sets orders and non-parallel orders
                  // Parallel orders will automatically go to final check when both teams mark as ready
                  !order.requiresDesign && !order.parallelProcessing && (
                    <button
                      onClick={() => handleOrderAction('finalCheck')}
                      className="w-full py-3 px-4 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg flex items-center justify-center gap-2 shadow-sm hover:shadow transition-all"
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      Send to Final Check
                    </button>
                  )
                )
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
    <div className="min-h-screen bg-gray-100 p-2 sm:p-4">
      {/* Header */}
      <div className="mb-4 sm:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          <h1 className="text-xl sm:text-2xl font-bold text-gray-800">Kitchen Screen</h1>
          
          {/* User name display */}
          <div className="flex items-center bg-white px-3 py-2 rounded-lg shadow-sm">
            <User className="w-4 h-4 text-gray-500 mr-2" />
            <span className="text-sm font-medium text-gray-700">
              {user?.name ? user.name : user?.email || 'Staff'}
            </span>
          </div>
          
          {/* Navigation buttons for staff with multiple roles */}
          {staffRoles && (staffRoles.isDesignStaff || staffRoles.isFinalCheckStaff || staffRoles.isCashierStaff) && (
            <div className="flex items-center gap-2">
              {staffRoles.isDesignStaff && (
                <button
                  onClick={() => router.push('/design')}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-600 transition-colors"
                >
                  <Palette className="w-4 h-4" />
                  <span className="text-sm font-medium">Design</span>
                </button>
              )}
              {staffRoles.isFinalCheckStaff && (
                <button
                  onClick={() => router.push('/final-check')}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-600 transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span className="text-sm font-medium">Final Check</span>
                </button>
              )}
              {staffRoles.isCashierStaff && (
                <button
                  onClick={() => router.push('/pos')}
                  className="flex items-center gap-1 px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-600 transition-colors"
                >
                  <ShoppingCart className="w-4 h-4" />
                  <span className="text-sm font-medium">POS</span>
                </button>
              )}
            </div>
          )}
          
          {/* Logout button with text */}
          <a
            href="/login?logout=true"
            onClick={(e) => {
              e.preventDefault();
              // Clear all auth data
              Cookies.remove('firebase-token');
              localStorage.clear();
              sessionStorage.clear();
              
              // Use window.open to force a new window/tab which bypasses service worker cache
              const newWindow = window.open('/login?logout=true', '_self');
              if (newWindow) {
                newWindow.opener = null;
              }
            }}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-600 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Logout</span>
          </a>
        </div>
        
        {/* Control buttons */}
        <div className="flex items-center space-x-4 self-end sm:self-auto">
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

      {/* Tab navigation for mobile */}
      <div className="block sm:hidden mb-4">
        <div className="flex border-b border-gray-200">
          <button 
            onClick={() => {
              setActiveTab('queue');
              localStorage.setItem('kitchenActiveTab', 'queue');
            }}
            className={`flex-1 py-2 px-4 text-center font-medium ${activeTab === 'queue' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Queue
          </button>
          <button 
            onClick={() => {
              setActiveTab('processing');
              localStorage.setItem('kitchenActiveTab', 'processing');
            }}
            className={`flex-1 py-2 px-4 text-center font-medium ${activeTab === 'processing' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Processing
          </button>
          <button 
            onClick={() => {
              setActiveTab('ready');
              localStorage.setItem('kitchenActiveTab', 'ready');
            }}
            className={`flex-1 py-2 px-4 text-center font-medium ${activeTab === 'ready' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
          >
            Ready
          </button>
        </div>
      </div>

      {/* Orders Grid - Desktop version */}
      <div className="hidden sm:grid sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Queue Section */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <h2 className="text-lg font-semibold mb-3 sm:mb-4 flex items-center">
            <ChefHat className="w-5 h-5 mr-2" />
            Queue
          </h2>
          <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
            <AnimatePresence mode="sync">
              {orders
                .filter(order => isOrderInStatus(order, 'KITCHEN_QUEUE'))
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
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <h2 className="text-lg font-semibold mb-3 sm:mb-4 flex items-center">
            <ChefHat className="w-5 h-5 mr-2" />
            Processing
          </h2>
          <div className="text-xs text-gray-500 mb-2 italic">
            Only orders you have accepted will appear here
          </div>
          <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
            <AnimatePresence mode="sync">
              {orders
                .filter(order => isOrderInStatus(order, 'KITCHEN_PROCESSING'))
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
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <h2 className="text-lg font-semibold mb-3 sm:mb-4 flex items-center">
            <CheckCircle2 className="w-5 h-5 mr-2" />
            Ready
          </h2>
          <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
            <AnimatePresence mode="sync">
              {orders
                .filter(order => isOrderInStatus(order, 'KITCHEN_READY'))
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

      {/* Mobile version - shows only the active tab */}
      <div className="block sm:hidden">
        {activeTab === 'queue' && (
          <div className="bg-white rounded-lg shadow p-3">
            <h2 className="text-lg font-semibold mb-3 flex items-center">
              <ChefHat className="w-5 h-5 mr-2" />
              Queue
            </h2>
            <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
              <AnimatePresence mode="sync">
                {orders
                  .filter(order => isOrderInStatus(order, 'KITCHEN_QUEUE'))
                  .map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                    />
                  ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {activeTab === 'processing' && (
          <div className="bg-white rounded-lg shadow p-3">
            <h2 className="text-lg font-semibold mb-3 flex items-center">
              <ChefHat className="w-5 h-5 mr-2" />
              Processing
            </h2>
            <div className="text-xs text-gray-500 mb-2 italic">
              Only orders you have accepted will appear here
            </div>
            <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
              <AnimatePresence mode="sync">
                {orders
                  .filter(order => isOrderInStatus(order, 'KITCHEN_PROCESSING'))
                  .map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                    />
                  ))}
              </AnimatePresence>
            </div>
          </div>
        )}

        {activeTab === 'ready' && (
          <div className="bg-white rounded-lg shadow p-3">
            <h2 className="text-lg font-semibold mb-3 flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Ready
            </h2>
            <div className="space-y-4 max-h-[calc(100vh-180px)] overflow-y-auto">
              <AnimatePresence mode="sync">
                {orders
                  .filter(order => isOrderInStatus(order, 'KITCHEN_READY'))
                  .map(order => (
                    <OrderCard
                      key={order.id}
                      order={order}
                    />
                  ))}
              </AnimatePresence>
            </div>
          </div>
        )}
      </div>

      {/* Lightbox for images */}
      <Lightbox
        open={lightboxOpen}
        close={() => setLightboxOpen(false)}
        index={lightboxIndex}
        slides={currentImages}
        plugins={[Zoom]}
        zoom={{
          ref: zoomRef,
          maxZoomPixelRatio: 5,
          zoomInMultiplier: 1.5,
          doubleClickMaxStops: 3,
          scrollToZoom: true,
          wheelZoomDistanceFactor: 100,
          doubleClickDelay: 300,
          pinchZoomDistanceFactor: 100
        }}
        carousel={{
          finite: true
        }}
        controller={{
          touchAction: "none",
          closeOnBackdropClick: true
        }}
        render={{
          slide: ({ slide }) => {
            const customSlide = slide as CustomSlide;
            return (
              <div className="flex flex-col items-center justify-center h-full">
                <div className="relative max-w-full max-h-[80vh] flex items-center justify-center">
                  <img
                    src={customSlide.src}
                    alt="Custom image"
                    className="max-w-full max-h-full object-contain"
                    style={{ maxHeight: '80vh', touchAction: 'none' }}
                    draggable={false}
                  />
                </div>
                {customSlide.comment && (
                  <div className="mt-4 max-w-2xl text-center">
                    <div className="bg-black bg-opacity-75 text-white px-4 py-2 rounded-lg">
                      <p className="text-lg">{customSlide.comment}</p>
                    </div>
                  </div>
                )}
              </div>
            );
          }
        }}
      />
    </div>
  );
}
