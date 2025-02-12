"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, Pencil, CheckCircle2, Image as ImageIcon, Upload, Download } from "lucide-react";

interface DesignOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  designRequirements: {
    cakeType: string;
    size: string;
    theme: string;
    colors: string[];
    specialInstructions?: string;
    referenceImages?: string[];
  };
  status: "pending" | "in-design" | "design-complete" | "in-production";
  dueDate: Date;
  designNotes?: string;
  designFiles?: string[];
  timestamp: Date;
}

export default function DesignDisplay() {
  const [orders, setOrders] = useState<DesignOrder[]>([
    {
      id: "1",
      orderNumber: "#45",
      customerName: "John Doe",
      designRequirements: {
        cakeType: "Wedding Cake",
        size: "3 Tier",
        theme: "Rustic Floral",
        colors: ["White", "Dusty Rose", "Gold"],
        specialInstructions: "Include sugar flowers matching bride's bouquet",
        referenceImages: ["/sample-cake-1.jpg"],
      },
      status: "pending",
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      timestamp: new Date(),
    },
    // Add more sample orders as needed
  ]);

  const [selectedOrder, setSelectedOrder] = useState<DesignOrder | null>(null);
  const [designNotes, setDesignNotes] = useState<string>("");

  const updateOrderStatus = (orderId: string, newStatus: DesignOrder["status"], notes?: string) => {
    setOrders((prevOrders) =>
      prevOrders.map((order) =>
        order.id === orderId
          ? {
              ...order,
              status: newStatus,
              designNotes: notes || order.designNotes,
            }
          : order
      )
    );
  };

  const getDaysUntilDue = (dueDate: Date) => {
    const now = new Date();
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getStatusColor = (status: DesignOrder["status"]) => {
    switch (status) {
      case "pending":
        return "bg-yellow-500";
      case "in-design":
        return "bg-blue-500";
      case "design-complete":
        return "bg-green-500";
      case "in-production":
        return "bg-purple-500";
      default:
        return "bg-gray-500";
    }
  };

  const handleFileUpload = (orderId: string) => {
    // Implement file upload functionality
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.multiple = true;
    input.onchange = (e) => {
      const files = (e.target as HTMLInputElement).files;
      if (files) {
        // Handle file upload logic here
        console.log("Files selected:", files);
      }
    };
    input.click();
  };

  return (
    <div className="h-full bg-gray-100 p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2">Design Team Dashboard</h1>
        <div className="flex space-x-4">
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-yellow-500 mr-2" />
            <span className="text-sm">Pending Design</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2" />
            <span className="text-sm">In Design</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-green-500 mr-2" />
            <span className="text-sm">Design Complete</span>
          </div>
          <div className="flex items-center">
            <div className="w-3 h-3 rounded-full bg-purple-500 mr-2" />
            <span className="text-sm">In Production</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence>
          {orders.map((order) => (
            <motion.div
              key={order.id}
              layout
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white rounded-xl shadow-sm"
            >
              {/* Order Header */}
              <div className="p-4 border-b">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <span className="font-bold text-lg">Order {order.orderNumber}</span>
                    <span className="ml-2 text-sm text-gray-500">{order.customerName}</span>
                  </div>
                  <div className={`px-3 py-1 rounded-full ${getStatusColor(order.status)} text-white text-sm`}>
                    {order.status.replace("-", " ")}
                  </div>
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                  <div className="flex items-center">
                    <Clock className="h-4 w-4 mr-1" />
                    <span>Due in {getDaysUntilDue(order.dueDate)} days</span>
                  </div>
                </div>
              </div>

              {/* Design Requirements */}
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="font-medium mb-2">Design Requirements</h3>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Cake Type:</span>
                      <span>{order.designRequirements.cakeType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Size:</span>
                      <span>{order.designRequirements.size}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Theme:</span>
                      <span>{order.designRequirements.theme}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Colors:</span>
                      <span>{order.designRequirements.colors.join(", ")}</span>
                    </div>
                  </div>
                </div>

                {order.designRequirements.specialInstructions && (
                  <div>
                    <h3 className="font-medium mb-2">Special Instructions</h3>
                    <p className="text-sm text-gray-600">
                      {order.designRequirements.specialInstructions}
                    </p>
                  </div>
                )}

                {/* Reference Images */}
                {order.designRequirements.referenceImages && (
                  <div>
                    <h3 className="font-medium mb-2">Reference Images</h3>
                    <div className="grid grid-cols-2 gap-2">
                      {order.designRequirements.referenceImages.map((image, index) => (
                        <div
                          key={index}
                          className="aspect-square bg-gray-100 rounded-lg flex items-center justify-center"
                        >
                          <ImageIcon className="h-6 w-6 text-gray-400" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Design Notes */}
                {order.status !== "pending" && (
                  <div>
                    <h3 className="font-medium mb-2">Design Notes</h3>
                    <textarea
                      className="w-full px-3 py-2 border rounded-lg text-sm"
                      rows={3}
                      placeholder="Add design notes..."
                      value={order.designNotes || ""}
                      onChange={(e) =>
                        updateOrderStatus(order.id, order.status, e.target.value)
                      }
                    />
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="p-4 bg-gray-50 rounded-b-xl">
                <div className="grid grid-cols-2 gap-2">
                  {order.status === "pending" && (
                    <button
                      onClick={() => updateOrderStatus(order.id, "in-design")}
                      className="flex items-center justify-center px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      <Pencil className="h-4 w-4 mr-2" />
                      Start Design
                    </button>
                  )}
                  {order.status === "in-design" && (
                    <>
                      <button
                        onClick={() => handleFileUpload(order.id)}
                        className="flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                      >
                        <Upload className="h-4 w-4 mr-2" />
                        Upload Files
                      </button>
                      <button
                        onClick={() => updateOrderStatus(order.id, "design-complete")}
                        className="flex items-center justify-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Complete Design
                      </button>
                    </>
                  )}
                  {order.status === "design-complete" && (
                    <button
                      onClick={() => updateOrderStatus(order.id, "in-production")}
                      className="flex items-center justify-center px-4 py-2 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors col-span-2"
                    >
                      Send to Production
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
