import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { POSPaymentMethod, POSPaymentStatus, apiMethods } from "@/services/api";
import { toast } from "@/lib/toast-utils";
import { nanoid } from "nanoid";
import { api } from "@/lib/axios";
import axios from 'axios'; // Import axios
import { Order } from "@/types/order";

interface RemainingPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  orderId: string;
  remainingAmount: number;
  onPaymentComplete?: () => void;
}

export default function RemainingPaymentModal({
  isOpen,
  onClose,
  orderId,
  remainingAmount,
  onPaymentComplete
}: RemainingPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState<POSPaymentMethod>(POSPaymentMethod.CASH);
  const [paymentReference, setPaymentReference] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const printAndOpenDrawer = async (order: Order) => {
    try {
      // Get the printer proxy URL from environment variable
      const PRINTER_PROXY_URL = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
      console.log('Using printer proxy at:', PRINTER_PROXY_URL);
      
      // Get printer configuration
      const printerConfig = await getPrinterConfig(PRINTER_PROXY_URL);
      
      // Prepare complete order data for printing
      const requestData = {
        // Include printer configuration
        ip: printerConfig.ip,
        port: printerConfig.port,
        skipConnectivityCheck: true,
        // Include complete order data
        type: 'order',
        orderId: order.id,
        // Include the complete order object
        order: order
      };
      
      console.log('Sending print-and-open request with complete order data');
      
      // Use fetch instead of axios for better reliability
      const fetchResponse = await fetch(`${PRINTER_PROXY_URL}/print-and-open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestData)
      });
      
      console.log(`Print-and-open response status:`, fetchResponse.status);
      const responseData = await fetchResponse.json();
      
      if (responseData?.success) {
        console.log('Receipt printed and drawer opened successfully');
      } else {
        console.error('Failed to print receipt and open drawer:', responseData?.error);
        toast.error('Failed to print receipt and open drawer');
      }
    } catch (error) {
      console.error('Error printing receipt and opening drawer:', error);
      toast.error('Error printing receipt and opening drawer');
    }
  };
  
  // Function to get printer configuration
  const getPrinterConfig = async (proxyUrl: string) => {
    try {
      console.log('Fetching printer config from printer proxy');
      const response = await fetch(`${proxyUrl}/api/printer/config`);
      const data = await response.json();
      
      if (data && data.success && data.printer) {
        console.log('Printer config from printer proxy:', data.printer);
        return { 
          ip: data.printer.ipAddress,
          port: data.printer.port,
          skipConnectivityCheck: true
        };
      }
      
      // Try to get the printer from the database through the printer proxy
      console.log('Trying to get printer from database');
      try {
        const dbResponse = await fetch(`${proxyUrl}/api/printer/db-config`);
        const dbData = await dbResponse.json();
        
        if (dbData && dbData.success && dbData.printer) {
          console.log('Printer config from printer proxy DB:', dbData.printer);
          return { 
            ip: dbData.printer.ipAddress,
            port: dbData.printer.port || 9100,
            skipConnectivityCheck: true 
          };
        }
      } catch (dbError) {
        console.error('Error fetching printer config from DB:', dbError);
      }
      
      // If no printer configuration is found, use default values
      console.warn('No printer configuration found, using default values');
      return { 
        ip: '192.168.1.14', // Default printer IP
        port: 9100,         // Default printer port
        skipConnectivityCheck: true 
      };
    } catch (error) {
      console.error('Error fetching printer config:', error);
      // If there's an error, use default values
      return { 
        ip: '192.168.1.14', // Default printer IP
        port: 9100,         // Default printer port
        skipConnectivityCheck: true 
      };
    }
  };

  const handlePayment = async () => {
    try {
      if ((paymentMethod === POSPaymentMethod.CARD || 
          paymentMethod === POSPaymentMethod.BANK_TRANSFER || 
          paymentMethod === POSPaymentMethod.PBL || 
          paymentMethod === POSPaymentMethod.TALABAT) && !paymentReference.trim()) {
        toast.error("Please enter a payment reference");
        return;
      }

      setIsSubmitting(true);

      // Create the payment data
      const payment = {
        id: nanoid(),
        amount: remainingAmount,
        method: paymentMethod,
        reference: paymentReference || null,
        status: POSPaymentStatus.FULLY_PAID,
        metadata: {
          source: "POS" as const
        }
      };

      // Update the order with the new payment
      const response = await apiMethods.pos.updateOrderPayment(orderId, payment);
      
      // If it's a cash payment, print receipt and open drawer
      if (paymentMethod === POSPaymentMethod.CASH && response.success) {
        await printAndOpenDrawer(response.data as Order);
      }

      toast.success("Payment completed successfully");
      onPaymentComplete?.();
      onClose();
    } catch (error: any) {
      console.error("Payment error:", error);
      toast.error(error.response?.data?.message || "Failed to process payment");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Transition.Root show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-300"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-200"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-gray-500 bg-opacity-75 transition-opacity" />
        </Transition.Child>

        <div className="fixed inset-0 z-10 overflow-y-auto">
          <div className="flex min-h-full items-end justify-center p-4 text-center sm:items-center sm:p-0">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
              enterTo="opacity-100 translate-y-0 sm:scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 translate-y-0 sm:scale-100"
              leaveTo="opacity-0 translate-y-4 sm:translate-y-0 sm:scale-95"
            >
              <Dialog.Panel className="relative transform overflow-hidden rounded-lg bg-white px-4 pb-4 pt-5 text-left shadow-xl transition-all sm:my-8 sm:w-full sm:max-w-lg sm:p-6">
                <div>
                  <div className="mt-3 text-center sm:mt-5">
                    <Dialog.Title
                      as="h3"
                      className="text-lg font-semibold leading-6 text-gray-900"
                    >
                      Complete Remaining Payment
                    </Dialog.Title>
                    <div className="mt-4">
                      <p className="text-sm text-gray-500">
                        Remaining Amount: AED {remainingAmount.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {/* Payment Method Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod(POSPaymentMethod.CASH)}
                          className={`flex-1 px-4 py-2 rounded-md ${
                            paymentMethod === POSPaymentMethod.CASH
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod(POSPaymentMethod.CARD)}
                          className={`flex-1 px-4 py-2 rounded-md ${
                            paymentMethod === POSPaymentMethod.CARD
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Card
                        </button>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod(POSPaymentMethod.BANK_TRANSFER)}
                          className={`flex-1 px-4 py-2 rounded-md ${
                            paymentMethod === POSPaymentMethod.BANK_TRANSFER
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Bank Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod(POSPaymentMethod.PBL)}
                          className={`flex-1 px-4 py-2 rounded-md ${
                            paymentMethod === POSPaymentMethod.PBL
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          PBL
                        </button>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <button
                          type="button"
                          onClick={() => setPaymentMethod(POSPaymentMethod.TALABAT)}
                          className={`flex-1 px-4 py-2 rounded-md ${
                            paymentMethod === POSPaymentMethod.TALABAT
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Talabat
                        </button>
                        <button
                          type="button"
                          onClick={() => setPaymentMethod(POSPaymentMethod.COD)}
                          className={`flex-1 px-4 py-2 rounded-md ${
                            paymentMethod === POSPaymentMethod.COD
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          COD
                        </button>
                      </div>
                    </div>

                    {/* Card Reference Input */}
                    {(paymentMethod === POSPaymentMethod.CARD || 
                      paymentMethod === POSPaymentMethod.BANK_TRANSFER || 
                      paymentMethod === POSPaymentMethod.PBL || 
                      paymentMethod === POSPaymentMethod.TALABAT) && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Reference
                        </label>
                        <input
                          type="text"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          placeholder="Enter payment reference"
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-6 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handlePayment}
                    disabled={isSubmitting}
                    className="px-4 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-900 focus:outline-none disabled:opacity-50"
                  >
                    {isSubmitting ? "Processing..." : "Complete Payment"}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
