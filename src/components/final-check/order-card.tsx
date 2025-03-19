"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { FileCheck, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Clock, ExternalLink } from "lucide-react";
import OrderTimer from "./order-timer";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import Image from "next/image";
import { toast } from "react-hot-toast";

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
  qualityControl?: {
    returnedFromFinalCheck?: boolean;
    returnReason?: string;
    returnDestination?: 'KITCHEN' | 'DESIGN';
    returnedAt?: string;
  };
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
  const [sendBackTarget, setSendBackTarget] = useState<'KITCHEN' | 'DESIGN' | null>(null);
  const [returnReason, setReturnReason] = useState("");

  const toggleExpand = () => {
    setExpanded(!expanded);
  };

  const handleStatusUpdate = (newStatus: FinalCheckOrderStatus) => {
    if (newStatus === "COMPLETED") {
      // Open dialog for notes before completing
      setNextStatus(newStatus);
      setSendBackTarget(null);
      setIsDialogOpen(true);
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
<<<<<<< HEAD
        // For send back operations, still require a reason but store it as teamNotes
=======
        // For send back operations, require a return reason
>>>>>>> 786eb8cd956f3f5a8ddf0a1fd5a9216762af520f
        if (!returnReason.trim()) {
          toast.error('Please provide a return reason');
          return;
        }
<<<<<<< HEAD
        // Use returnReason as teamNotes
        onUpdateStatus?.(order.id, nextStatus, returnReason);
=======
        // Use returnReason as the primary reason
        onUpdateStatus?.(order.id, nextStatus, returnReason || teamNotes);
>>>>>>> 786eb8cd956f3f5a8ddf0a1fd5a9216762af520f
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
              <p className="text-sm text-gray-500">Customer: {order.customerName}</p>
              <div className="flex items-center space-x-2 mt-1">
                <OrderTimer createdAt={new Date(order.createdAt)} />
                {finalCheckStartTime && (
                  <span className="text-xs text-gray-500">
                    Final Check Started: {format(finalCheckStartTime, 'MMM d, h:mm a')}
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
                    {Object.entries(item.variations || {}).length > 0 && (
                      <div className="mt-2 ml-8 space-y-1">
                        {Object.entries(item.variations || {}).map(([type, variation]: [string, any]) => (
                          <p key={type} className="text-sm text-gray-600">
                            <span className="font-medium">{type}:</span> {variation.name || variation.value}
                          </p>
                        ))}
                      </div>
                    )}
                    
                    {/* Item notes */}
                    {item.kitchenNotes && (
                      <div className="mt-2 ml-8 p-2 bg-blue-50 rounded border border-blue-100">
                        <p className="text-sm text-blue-700">
                          <span className="font-medium">Notes:</span> {item.kitchenNotes}
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

                {/* Images */}
                {item.customImages && item.customImages.length > 0 && (
                  <div className="mt-3 flex gap-2 overflow-x-auto pb-2 ml-8">
                    {item.customImages.map((image, index) => (
                      <div 
                        key={index} 
                        className="relative min-w-[80px] h-[80px] rounded-lg overflow-hidden border border-gray-200 group cursor-pointer shadow-sm hover:shadow-md transition-shadow"
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
                  rows={3}
                  className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  required
                />
              </div>
            )}
            <textarea
              placeholder={sendBackTarget ? `Additional notes for ${sendBackTarget} (optional)` : 'Add any notes about this order (optional)'}
              value={teamNotes}
              onChange={(e) => setTeamNotes(e.target.value)}
              rows={4}
              className="w-full p-3 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
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
