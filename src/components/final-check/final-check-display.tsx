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
    name: string;
    quantity: number;
    variations: Record<string, any>;
    kitchenNotes?: string;
    designNotes?: string;
    customImages?: Array<{
      url: string;
      comment?: string;
    }>;
    category?: string;
    images?: Array<{
      url: string;
    }>;
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
  giftDetails?: {
    isGift: boolean;
    recipientName?: string;
    recipientPhone?: string;
    message?: string;
    note?: string;
    cashAmount?: string;
    includeCash?: boolean;
  };
  parallelProcessing?: {
    id: string;
    designStatus: string;
    kitchenStatus: string;
    isParallel: boolean;
  };
  requiresKitchen?: boolean;
  requiresDesign?: boolean;
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
  const [activeTab, setActiveTab] = useState('queue');
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
        console.log('User data for final check access:', {
          role: userData.role,
          isPosUser: userData.isPosUser,
          isFinalCheckStaff: userData.isFinalCheckStaff
        });
        
        // Allow access if user has any of these roles/permissions
        const hasAccess = 
          userData.isFinalCheckStaff || 
          userData.isPosUser || 
          userData.role === 'ADMIN' || 
          userData.role === 'SUPER_ADMIN';
        
        if (!hasAccess) {
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
          ['FINAL_CHECK_QUEUE', 'FINAL_CHECK_PROCESSING', 'FINAL_CHECK_COMPLETE', 'COMPLETED', 'KITCHEN_QUEUE', 'DESIGN_QUEUE'].includes(data.status) &&
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
      .filter(order => {
        if (status === "FINAL_CHECK_COMPLETE") {
          // Show both FINAL_CHECK_COMPLETE and COMPLETED orders in the Ready column
          return order.status === "FINAL_CHECK_COMPLETE" || order.status === "COMPLETED";
        }
        return order.status === status;
      })
      .sort((a, b) => {
        // Get the relevant date for each order (pickup or delivery)
        const getOrderDate = (order: FinalCheckOrder) => {
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
            // Try first to match time format like "10:00 AM - 11:00 AM"
            const timeSlotParts = timeStr.split(' - ');
            const startTime = timeSlotParts[0] || '';
            
            if (startTime) {
              // Try to match standard time format (e.g., "10:00 AM")
              const match = startTime.match(/(\d+):(\d+)\s*(AM|PM)/i);
              
              if (match) {
                let hour = parseInt(match[1], 10);
                const minute = parseInt(match[2], 10);
                
                // Convert to 24-hour format
                if (match[3].toUpperCase() === 'PM' && hour < 12) {
                  hour += 12;
                } else if (match[3].toUpperCase() === 'AM' && hour === 12) {
                  hour = 0;
                }
                
                date.setHours(hour, minute, 0, 0);
              } else {
                // Alternative approach for other time formats
                const matches = startTime.match(/\d+/g) || ['0', '0'];
                const hours = matches[0] || '0';
                const minutes = matches[1] || '0';
                const isPM = startTime.toLowerCase().includes('pm');
                
                let hoursNum = parseInt(hours, 10);
                if (isPM && hoursNum < 12) hoursNum += 12;
                if (!isPM && hoursNum === 12) hoursNum = 0;
                
                date.setHours(hoursNum, parseInt(minutes, 10), 0, 0);
              }
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
          order.status === 'COMPLETED' ||
          order.status === 'KITCHEN_QUEUE' ||
          order.status === 'DESIGN_QUEUE'
        );

        // Map orders to include product images
        const ordersWithImages = finalCheckOrders.map((order: any) => ({
          ...order,
          items: order.items.map((item: any) => ({
            ...item,
            customImages: item.customImages?.map((img: any) => ({
              url: img.url,
              comment: img.comment
            })) || [],
            // Add product images if available, ensuring they have valid URLs
            images: item.product?.images?.filter((img: any) => img && img.url) || []
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

  const updateOrderStatus = async (orderId: string, newStatus: FinalCheckOrderStatus, teamNotes?: string) => {
    try {
      console.log('Updating order status:', { orderId, newStatus, teamNotes });
      
      // Check if order is being sent back to Kitchen or Design
      const isReturnToKitchenOrDesign = newStatus === 'KITCHEN_QUEUE' || newStatus === 'DESIGN_QUEUE';
      
      const response = await apiMethods.pos.updateOrderStatus(orderId, {
        status: newStatus,
        teamNotes: teamNotes || '',
        returnToKitchenOrDesign: isReturnToKitchenOrDesign,
      });

      if (response.success) {
        setOrders(prevOrders =>
          prevOrders.map(order =>
            order.id === orderId
              ? { 
                  ...order, 
                  status: newStatus,
                  finalCheckNotes: teamNotes || order.finalCheckNotes,
                }
              : order
          )
        );
        toast.success(isReturnToKitchenOrDesign 
          ? `Order sent back to ${newStatus === 'KITCHEN_QUEUE' ? 'Kitchen' : 'Design'}`
          : 'Order status updated');
      } else {
        console.error('Error updating order status:', response.message);
        toast.error(`Failed to update order status: ${response.message}`);
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
    <div className="min-h-screen bg-gray-100 p-2 sm:p-6">
      <div className="w-full">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 sm:mb-8 gap-2 sm:gap-0">
          <div>
            <h1 className="text-xl sm:text-3xl font-bold text-gray-900">Final Check Display</h1>
            <p className="text-sm sm:text-base text-gray-500 mt-1">Review orders and ensure quality before completion</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3 self-end sm:self-auto">
            <button
              onClick={handleRefresh}
              className="flex items-center px-3 py-2 sm:px-4 sm:py-2.5 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm text-sm sm:text-base"
            >
              <RotateCw className="w-4 h-4 mr-2 text-gray-500" />
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
              className="flex items-center px-3 py-2 sm:px-4 sm:py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-sm text-sm sm:text-base"
            >
              {isFullscreen ? <Minimize2 className="w-4 h-4 mr-2" /> : <Maximize2 className="w-4 h-4 mr-2" />}
              {isFullscreen ? "Exit" : "Fullscreen"}
            </button>
          </div>
        </div>

        {/* Tab navigation for mobile */}
        <div className="block sm:hidden mb-4">
          <div className="flex border-b border-gray-200">
            <button 
              onClick={() => setActiveTab('queue')}
              className={`flex-1 py-2 px-4 text-center font-medium ${activeTab === 'queue' ? 'text-amber-600 border-b-2 border-amber-600' : 'text-gray-500'}`}
            >
              Queue
            </button>
            <button 
              onClick={() => setActiveTab('processing')}
              className={`flex-1 py-2 px-4 text-center font-medium ${activeTab === 'processing' ? 'text-blue-600 border-b-2 border-blue-600' : 'text-gray-500'}`}
            >
              Processing
            </button>
            <button 
              onClick={() => setActiveTab('completed')}
              className={`flex-1 py-2 px-4 text-center font-medium ${activeTab === 'completed' ? 'text-green-600 border-b-2 border-green-600' : 'text-gray-500'}`}
            >
              Ready
            </button>
            <button 
              onClick={() => setActiveTab('returned')}
              className={`flex-1 py-2 px-4 text-center font-medium ${activeTab === 'returned' ? 'text-purple-600 border-b-2 border-purple-600' : 'text-gray-500'}`}
            >
              Returned
            </button>
          </div>
        </div>

        {/* Desktop version - grid layout */}
        <div className="hidden sm:grid sm:grid-cols-1 md:grid-cols-3 gap-4 sm:gap-6">
          {/* Queue Column */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
              <div className="p-4 flex items-center justify-between">
                <h2 className="font-bold text-lg flex items-center text-amber-800">
                  <div className="w-3 h-3 rounded-full bg-amber-500 mr-2" />
                  Final Check Queue
                </h2>
                <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-sm font-medium rounded-full">
                  {getOrdersByStatus("FINAL_CHECK_QUEUE").length}
                </span>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
                <AnimatePresence>
                  {getOrdersByStatus("FINAL_CHECK_QUEUE").length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No orders in queue</p>
                    </div>
                  ) : (
                    getOrdersByStatus("FINAL_CHECK_QUEUE").map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        onUpdateStatus={updateOrderStatus}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Processing Column */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
              <div className="p-4 flex items-center justify-between">
                <h2 className="font-bold text-lg flex items-center text-blue-800">
                  <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                  Processing
                </h2>
                <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                  {getOrdersByStatus("FINAL_CHECK_PROCESSING").length}
                </span>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
                <AnimatePresence>
                  {getOrdersByStatus("FINAL_CHECK_PROCESSING").length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No orders being processed</p>
                    </div>
                  ) : (
                    getOrdersByStatus("FINAL_CHECK_PROCESSING").map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        onUpdateStatus={updateOrderStatus}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>

          {/* Completed Column */}
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
              <div className="p-4 flex items-center justify-between">
                <h2 className="font-bold text-lg flex items-center text-green-800">
                  <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                  Ready
                </h2>
                <span className="px-2.5 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                  {getOrdersByStatus("FINAL_CHECK_COMPLETE").length}
                </span>
              </div>
            </div>
            <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
              <div className="space-y-4">
                <AnimatePresence>
                  {getOrdersByStatus("FINAL_CHECK_COMPLETE").length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      <p>No completed orders</p>
                    </div>
                  ) : (
                    getOrdersByStatus("FINAL_CHECK_COMPLETE").map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        onUpdateStatus={updateOrderStatus}
                      />
                    ))
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Send Back Section - Desktop */}
        <div className="mt-8 bg-white rounded-xl shadow-md overflow-hidden hidden sm:block">
          <div className="border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
            <div className="p-4">
              <h2 className="font-bold text-lg text-purple-800">Returned Items</h2>
              <p className="text-sm text-gray-500">Orders sent back to Kitchen or Design for revision</p>
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
            <div className="space-y-4">
              <AnimatePresence>
                {orders.filter(order => 
                  order.status === "KITCHEN_QUEUE" || 
                  order.status === "DESIGN_QUEUE"
                ).length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <p>No returned orders</p>
                  </div>
                ) : (
                  orders
                    .filter(order => order.status === "KITCHEN_QUEUE" || order.status === "DESIGN_QUEUE")
                    .map(order => (
                      <OrderCard 
                        key={order.id} 
                        order={order} 
                        onUpdateStatus={updateOrderStatus}
                      />
                    ))
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Mobile version - shows only the active tab */}
        <div className="block sm:hidden">
          {/* Queue Tab */}
          {activeTab === 'queue' && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="border-b border-gray-100 bg-gradient-to-r from-amber-50 to-white">
                <div className="p-4 flex items-center justify-between">
                  <h2 className="font-bold text-lg flex items-center text-amber-800">
                    <div className="w-3 h-3 rounded-full bg-amber-500 mr-2" />
                    Final Check Queue
                  </h2>
                  <span className="px-2.5 py-1 bg-amber-100 text-amber-800 text-sm font-medium rounded-full">
                    {getOrdersByStatus("FINAL_CHECK_QUEUE").length}
                  </span>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                <div className="space-y-4">
                  <AnimatePresence>
                    {getOrdersByStatus("FINAL_CHECK_QUEUE").length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No orders in queue</p>
                      </div>
                    ) : (
                      getOrdersByStatus("FINAL_CHECK_QUEUE").map(order => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          onUpdateStatus={updateOrderStatus}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {/* Processing Tab */}
          {activeTab === 'processing' && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="border-b border-gray-100 bg-gradient-to-r from-blue-50 to-white">
                <div className="p-4 flex items-center justify-between">
                  <h2 className="font-bold text-lg flex items-center text-blue-800">
                    <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
                    Processing
                  </h2>
                  <span className="px-2.5 py-1 bg-blue-100 text-blue-800 text-sm font-medium rounded-full">
                    {getOrdersByStatus("FINAL_CHECK_PROCESSING").length}
                  </span>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                <div className="space-y-4">
                  <AnimatePresence>
                    {getOrdersByStatus("FINAL_CHECK_PROCESSING").length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No orders being processed</p>
                      </div>
                    ) : (
                      getOrdersByStatus("FINAL_CHECK_PROCESSING").map(order => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          onUpdateStatus={updateOrderStatus}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {/* Completed Tab */}
          {activeTab === 'completed' && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="border-b border-gray-100 bg-gradient-to-r from-green-50 to-white">
                <div className="p-4 flex items-center justify-between">
                  <h2 className="font-bold text-lg flex items-center text-green-800">
                    <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
                    Ready
                  </h2>
                  <span className="px-2.5 py-1 bg-green-100 text-green-800 text-sm font-medium rounded-full">
                    {getOrdersByStatus("FINAL_CHECK_COMPLETE").length}
                  </span>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                <div className="space-y-4">
                  <AnimatePresence>
                    {getOrdersByStatus("FINAL_CHECK_COMPLETE").length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No completed orders</p>
                      </div>
                    ) : (
                      getOrdersByStatus("FINAL_CHECK_COMPLETE").map(order => (
                        <OrderCard 
                          key={order.id} 
                          order={order} 
                          onUpdateStatus={updateOrderStatus}
                        />
                      ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}

          {/* Returned Tab */}
          {activeTab === 'returned' && (
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
              <div className="border-b border-gray-100 bg-gradient-to-r from-purple-50 to-white">
                <div className="p-4">
                  <h2 className="font-bold text-lg text-purple-800">Returned Items</h2>
                  <p className="text-sm text-gray-500">Orders sent back to Kitchen or Design for revision</p>
                </div>
              </div>
              <div className="p-4 overflow-y-auto max-h-[calc(100vh-200px)]">
                <div className="space-y-4">
                  <AnimatePresence>
                    {orders.filter(order => 
                      order.status === "KITCHEN_QUEUE" || 
                      order.status === "DESIGN_QUEUE"
                    ).length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        <p>No returned orders</p>
                      </div>
                    ) : (
                      orders
                        .filter(order => order.status === "KITCHEN_QUEUE" || order.status === "DESIGN_QUEUE")
                        .map(order => (
                          <OrderCard 
                            key={order.id} 
                            order={order} 
                            onUpdateStatus={updateOrderStatus}
                          />
                        ))
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
