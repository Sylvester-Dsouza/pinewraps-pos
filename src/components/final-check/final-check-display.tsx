"use client";

import { useState, useEffect, useCallback } from "react";
import { FileCheck, Bell, RotateCw, Maximize2, Minimize2 } from "lucide-react";
import { AnimatePresence } from "framer-motion";
import OrderCard from "@/components/final-check/order-card";
import { apiMethods } from "@/services/api";
import { wsService } from "@/services/websocket"; // Import wsService instance
import { toast } from "react-hot-toast";
import { useAuth } from "@/providers/auth-provider";
import { useRouter } from "next/navigation";

// Types for order and status
export type FinalCheckOrderStatus = 
  | "FINAL_CHECK_QUEUE"
  | "FINAL_CHECK_PROCESSING"
  | "FINAL_CHECK_COMPLETE"
  | "COMPLETED"
  | "KITCHEN_QUEUE"
  | "DESIGN_QUEUE";

export interface FinalCheckOrder {
  id: string;
  orderNumber: string;
  createdAt: string;
  status: FinalCheckOrderStatus;
  customerName: string;
  items: Array<{
    id: string;
    productName: string;
    quantity: number;
    variations: Record<string, any>;
    kitchenNotes?: string;
    designNotes?: string;
    customImages?: Array<{
      url: string;
      comment?: string;
    }>;
    category?: string;
  }>;
  kitchenNotes?: string;
  designNotes?: string;
  finalCheckNotes?: string;
  finalCheckStartTime?: string;
  finalCheckEndTime?: string;
  deliveryMethod?: 'PICKUP' | 'DELIVERY';
  pickupDate?: string;
  pickupTimeSlot?: string;
  deliveryDate?: string;
  deliveryTimeSlot?: string;
}

export interface UpdateOrderStatusPayload {
  status: FinalCheckOrderStatus;
  notes?: string;
  teamNotes?: string;
}

// This is just a UI placeholder - full functionality will be implemented later
export default function FinalCheckDisplay() {
  const [orders, setOrders] = useState<FinalCheckOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const { user } = useAuth();
  const router = useRouter();

  // Check if user is authenticated and has final check staff access
  useEffect(() => {
    if (!user) {
      // User not authenticated, redirect to login
      router.push('/login');
      return;
    }

    // Check if user has final check staff access
    const checkUserAccess = async () => {
      try {
        // Verify user access with backend
        const token = await user.getIdToken();
        const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ token }),
        });

        const data = await response.json();
        
        if (!response.ok || !data.success) {
          toast.error('Authentication failed');
          router.push('/login');
          return;
        }

        const userData = data.data;
        
        // Check if user has final check staff access or is an admin
        if (!userData.isFinalCheckStaff && userData.role !== 'ADMIN' && userData.role !== 'SUPER_ADMIN') {
          toast.error('You do not have access to the Final Check Display');
          router.push('/pos');
          return;
        }

        // If we reach here, user has access, proceed to fetch orders
        fetchOrders();
        initWebSocket(); // Call initWebSocket
      } catch (error) {
        console.error('Error checking user access:', error);
        toast.error('Failed to verify access permissions');
        router.push('/pos');
      }
    };

    checkUserAccess();
  }, [user, router]);

  // Effect to handle fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Initialize WebSocket connection
  const initWebSocket = useCallback(() => {
    if (!user) return;
    
    // Subscribe to WebSocket events
    const unsubscribeNew = wsService.subscribe('NEW_ORDER', (data) => {
      // Only add orders that are in final check queue
      if (data.order.status === 'FINAL_CHECK_QUEUE') {
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
      }
    });

    const unsubscribeUpdate = wsService.subscribe('ORDER_STATUS_UPDATE', (data) => {
      setOrders(prev => {
        // If the order is now in final check status, add it if not already present
        if (
          ['FINAL_CHECK_QUEUE', 'FINAL_CHECK_PROCESSING', 'FINAL_CHECK_COMPLETE', 'KITCHEN_QUEUE', 'DESIGN_QUEUE'].includes(data.status) &&
          !prev.some(order => order.id === data.id)
        ) {
          // Fetch the full order details
          fetchOrderById(data.id);
          return prev;
        }
        
        // Update existing order
        return prev.map(order => {
          if (order.id === data.id) {
            // Only update the specific fields that changed
            return {
              ...order,
              status: data.status,
              ...(data.finalCheckStartTime && { finalCheckStartTime: data.finalCheckStartTime }),
              ...(data.finalCheckEndTime && { finalCheckEndTime: data.finalCheckEndTime }),
              ...(data.finalCheckNotes && { finalCheckNotes: data.finalCheckNotes })
            };
          }
          return order;
        });
      });
    });

    // Set up auto-refresh every 5 minutes
    const refreshInterval = setInterval(fetchOrders, 5 * 60 * 1000);
    
    // Return cleanup function
    return () => {
      unsubscribeNew();
      unsubscribeUpdate();
      clearInterval(refreshInterval);
    };
  }, [user]);

  const fetchOrderById = async (orderId: string) => {
    try {
      const response = await apiMethods.pos.getOrderById(orderId);
      if (response.success) {
        setOrders(prev => {
          // Check if order already exists
          if (prev.some(order => order.id === response.data.id)) {
            return prev.map(order => order.id === response.data.id ? response.data : order);
          }
          return [response.data, ...prev];
        });
      }
    } catch (error) {
      console.error('Failed to fetch order:', error);
    }
  };

  // Get orders by status
  const getOrdersByStatus = (status: FinalCheckOrderStatus) => {
    return orders
      .filter(order => order.status === status)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  };

  const fetchOrders = async () => {
    try {
      setLoading(true);
      const response = await apiMethods.pos.getOrders();
      if (response.success) {
        // Filter for final check relevant orders only
        const finalCheckOrders = response.data.filter((order: any) => 
          order.status === 'FINAL_CHECK_QUEUE' || 
          order.status === 'FINAL_CHECK_PROCESSING' || 
          order.status === 'FINAL_CHECK_COMPLETE' ||
          order.status === 'KITCHEN_QUEUE' ||
          order.status === 'DESIGN_QUEUE'
        );

        setOrders(finalCheckOrders);
      }
    } catch (error) {
      console.error('Failed to fetch orders:', error);
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: FinalCheckOrderStatus, teamNotes?: string) => {
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
                  finalCheckNotes: teamNotes || order.finalCheckNotes 
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

  const handleRefresh = () => {
    fetchOrders();
    toast.success('Orders refreshed');
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
    <div className="min-h-screen bg-gray-100">
      <div className="p-4">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">Final Check Display</h1>
          <div className="flex items-center gap-4">
            <button
              onClick={handleRefresh}
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

        <div className="grid grid-cols-3 gap-4">
          {/* Queue Column */}
          <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500 mr-2" />
                Final Check Queue
              </h2>
              <span className="text-sm text-gray-500">
                {getOrdersByStatus("FINAL_CHECK_QUEUE").length}
              </span>
            </div>
            <div className="space-y-4">
              <AnimatePresence>
                {getOrdersByStatus("FINAL_CHECK_QUEUE").map(order => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onUpdateStatus={updateOrderStatus}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Processing Column */}
          <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center">
                <div className="w-3 h-3 rounded-full bg-amber-500 mr-2" />
                Processing
              </h2>
              <span className="text-sm text-gray-500">
                {getOrdersByStatus("FINAL_CHECK_PROCESSING").length}
              </span>
            </div>
            <div className="space-y-4">
              <AnimatePresence>
                {getOrdersByStatus("FINAL_CHECK_PROCESSING").map(order => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onUpdateStatus={updateOrderStatus}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>

          {/* Completed Column */}
          <div className="bg-gray-50 rounded-xl p-4 overflow-y-auto max-h-[calc(100vh-120px)]">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-semibold text-lg flex items-center">
                <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                Completed
              </h2>
              <span className="text-sm text-gray-500">
                {getOrdersByStatus("FINAL_CHECK_COMPLETE").length}
              </span>
            </div>
            <div className="space-y-4">
              <AnimatePresence>
                {getOrdersByStatus("FINAL_CHECK_COMPLETE").map(order => (
                  <OrderCard 
                    key={order.id} 
                    order={order} 
                    onUpdateStatus={updateOrderStatus}
                  />
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
