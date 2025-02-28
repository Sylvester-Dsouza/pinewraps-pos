"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileCheck, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Clock, ExternalLink } from "lucide-react";
import OrderTimer from "./order-timer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Image from "next/image";

// Types for order and status
type FinalCheckOrderStatus = 
  | "FINAL_CHECK_QUEUE"
  | "FINAL_CHECK_PROCESSING"
  | "FINAL_CHECK_COMPLETE"
  | "COMPLETED"
  | "KITCHEN_QUEUE"
  | "DESIGN_QUEUE";

interface FinalCheckOrder {
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

interface OrderCardProps {
  order: FinalCheckOrder;
  onUpdateStatus?: (orderId: string, newStatus: FinalCheckOrderStatus, teamNotes?: string) => Promise<void>;
}

// Order card component for the final check display
export default function OrderCard({ order, onUpdateStatus }: OrderCardProps) {
  const [showNotesInput, setShowNotesInput] = useState(false);
  const [notes, setNotes] = useState("");
  const [expanded, setExpanded] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [teamNotes, setTeamNotes] = useState(order.finalCheckNotes || "");
  const [nextStatus, setNextStatus] = useState<FinalCheckOrderStatus | null>(null);

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const handleStatusUpdate = (newStatus: FinalCheckOrderStatus) => {
    if (newStatus === "FINAL_CHECK_COMPLETE" || newStatus === "COMPLETED") {
      // Open dialog for notes before completing
      setNextStatus(newStatus);
      setIsDialogOpen(true);
    } else {
      // For other statuses, update directly
      onUpdateStatus?.(order.id, newStatus);
    }
  };

  const confirmStatusUpdate = () => {
    if (nextStatus) {
      onUpdateStatus?.(order.id, nextStatus, teamNotes);
      setIsDialogOpen(false);
      setNextStatus(null);
    }
  };

  const getStatusActions = () => {
    switch (order.status) {
      case "FINAL_CHECK_QUEUE":
        return (
          <button
            onClick={() => handleStatusUpdate("FINAL_CHECK_PROCESSING")}
            className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
          >
            <FileCheck className="w-5 h-5" />
            Start Final Check
          </button>
        );
      case "FINAL_CHECK_PROCESSING":
        // Check if the order has cake items (requires kitchen)
        const hasCakeItems = order.items.some(item => 
          item.productName.toLowerCase().includes('cake') || 
          (item.category && item.category.toLowerCase().includes('cake'))
        );
        
        // Check if the order has flower items (requires design)
        const hasFlowerItems = order.items.some(item => 
          item.productName.toLowerCase().includes('flower') || 
          (item.category && item.category.toLowerCase().includes('flower'))
        );
        
        // Check if the order has sets items (requires both kitchen and design)
        const hasSetsItems = order.items.some(item => 
          item.productName.toLowerCase().includes('set') || 
          (item.category && item.category.toLowerCase().includes('set'))
        );
        
        return (
          <div className="space-y-3">
            {/* Kitchen button */}
            {(hasCakeItems || hasSetsItems) && (
              <button
                onClick={() => handleStatusUpdate("KITCHEN_QUEUE")}
                className="w-full py-3 px-4 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                Send to Kitchen
              </button>
            )}
            
            {/* Design button */}
            {(hasFlowerItems || hasSetsItems) && (
              <button
                onClick={() => handleStatusUpdate("DESIGN_QUEUE")}
                className="w-full py-3 px-4 bg-purple-500 hover:bg-purple-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
              >
                <Clock className="w-5 h-5" />
                Send to Design
              </button>
            )}
            
            {/* Complete button */}
            <button
              onClick={() => handleStatusUpdate("FINAL_CHECK_COMPLETE")}
              className="w-full py-3 px-4 bg-amber-500 hover:bg-amber-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
            >
              <CheckCircle2 className="w-5 h-5" />
              Mark Complete
            </button>
          </div>
        );
      case "FINAL_CHECK_COMPLETE":
        return (
          <button
            onClick={() => handleStatusUpdate("COMPLETED")}
            className="w-full py-3 px-4 bg-green-500 hover:bg-green-600 text-white font-medium rounded-lg flex items-center justify-center gap-2"
          >
            <CheckCircle2 className="w-5 h-5" />
            Mark Order Completed
          </button>
        );
      default:
        return null;
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
            <OrderTimer createdAt={new Date(order.createdAt)} />
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
          <a 
            href={`/orders/${order.id}`} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 transition-colors"
          >
            <ExternalLink className="w-5 h-5" />
          </a>
        </div>

        {/* Notes */}
        {order.kitchenNotes && (
          <div className="mt-2 p-2 bg-blue-50 rounded-lg">
            <p className="text-sm text-blue-800">
              <span className="font-medium">Kitchen Notes:</span> {order.kitchenNotes}
            </p>
          </div>
        )}
        
        {order.designNotes && (
          <div className="mt-2 p-2 bg-purple-50 rounded-lg">
            <p className="text-sm text-purple-800">
              <span className="font-medium">Design Notes:</span> {order.designNotes}
            </p>
          </div>
        )}

        {/* Item list */}
        <div className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-start pb-2 border-b border-gray-100 last:border-0">
              <div className="flex-1 space-y-2">
                <div>
                  <h4 className="font-medium">{item.productName}</h4>
                  <p className="text-sm text-gray-500">Quantity: {item.quantity}</p>
                  
                  {/* Variations */}
                  {Object.entries(item.variations || {}).map(([type, variation]: [string, any]) => (
                    <p key={type} className="text-sm text-gray-500">
                      {variation.name} - {variation.value}
                    </p>
                  ))}
                  
                  {/* Item notes */}
                  {item.kitchenNotes && (
                    <p className="text-sm text-gray-600 mt-2">
                      Notes: {item.kitchenNotes}
                    </p>
                  )}
                </div>

                {/* Images */}
                {item.customImages && item.customImages.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2">
                    {item.customImages.map((image, index) => (
                      <div 
                        key={index} 
                        className="relative min-w-[80px] h-[80px] rounded-lg overflow-hidden border border-gray-200 group cursor-pointer"
                      >
                        <Image
                          src={image.url}
                          alt={`Image ${index + 1}`}
                          fill
                          className="object-cover group-hover:opacity-75 transition-opacity"
                        />
                        {image.comment && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black bg-opacity-50 text-white p-1 text-xs truncate">
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

        {/* Notes input for final check */}
        {showNotesInput && (
          <div className="mt-4">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add final check notes..."
              className="w-full p-2 border rounded-lg"
              rows={3}
            />
          </div>
        )}

        {/* Action buttons based on status */}
        <div className="bg-gray-50 p-3 rounded-lg">
          {getStatusActions()}
        </div>
      </div>
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Final Check Notes</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <textarea
              placeholder="Add any notes about this order (optional)"
              value={teamNotes}
              onChange={(e) => setTeamNotes(e.target.value)}
              rows={4}
              className="w-full p-2 border rounded-lg"
            />
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
    </motion.div>
  );
}
