import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState, useEffect } from "react";
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
  
  // Split payment state
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [splitMethod1, setSplitMethod1] = useState<POSPaymentMethod>(POSPaymentMethod.CASH);
  const [splitMethod2, setSplitMethod2] = useState<POSPaymentMethod>(POSPaymentMethod.CARD);
  const [splitAmount1, setSplitAmount1] = useState('');
  const [splitAmount2, setSplitAmount2] = useState('');
  const [splitReference1, setSplitReference1] = useState('');
  const [splitReference2, setSplitReference2] = useState('');

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
          const portNumber = dbData.printer.port || 9100;
          return { 
            ip: dbData.printer.ipAddress,
            port: portNumber,
            // Also include printerIp and printerPort for compatibility
            printerIp: dbData.printer.ipAddress,
            printerPort: portNumber,
            skipConnectivityCheck: true 
          };
        }
      } catch (dbError) {
        console.error('Error fetching printer config from DB:', dbError);
      }
      
      // If no printer configuration is found, don't include IP and port
      // This will make the printer proxy use its own configuration from the database
      console.warn('No printer configuration found, using proxy default configuration');
      return { 
        skipConnectivityCheck: true 
      };
    } catch (error) {
      console.error('Error fetching printer config:', error);
      // If there's an error, don't include IP and port
      // This will make the printer proxy use its own configuration from the database
      return { 
        skipConnectivityCheck: true 
      };
    }
  };

  // Initialize split payment amounts when the modal opens
  useEffect(() => {
    if (isOpen && remainingAmount > 0) {
      // Reset split amounts when modal opens
      const halfAmount = (remainingAmount / 2).toFixed(2);
      setSplitAmount1(halfAmount);
      setSplitAmount2(halfAmount);
    }
  }, [isOpen, remainingAmount]);
  
  // Update split amount 2 when amount 1 changes
  useEffect(() => {
    if (isSplitPayment && splitAmount1) {
      const amount1 = parseFloat(splitAmount1) || 0;
      const calculatedAmount2 = remainingAmount - amount1;
      // Only update if it's a valid positive number
      if (!isNaN(calculatedAmount2) && calculatedAmount2 >= 0) {
        setSplitAmount2(calculatedAmount2.toFixed(2));
      }
    }
  }, [splitAmount1, remainingAmount, isSplitPayment]);
  
  // Reset second payment method if it's the same as the first
  useEffect(() => {
    if (splitMethod1 === splitMethod2) {
      // Find the first available payment method that's not the same as splitMethod1
      const methods = [
        POSPaymentMethod.CASH,
        POSPaymentMethod.CARD,
        POSPaymentMethod.BANK_TRANSFER,
        POSPaymentMethod.TALABAT,
        POSPaymentMethod.PBL
      ];
      
      const availableMethod = methods.find(method => method !== splitMethod1);
      if (availableMethod) {
        setSplitMethod2(availableMethod);
      }
    }
  }, [splitMethod1, splitMethod2]);

  const handlePayment = async () => {
    try {
      // Validate payment method and reference
      const requiresReference = !isSplitPayment && (
        paymentMethod === POSPaymentMethod.CARD || 
        paymentMethod === POSPaymentMethod.BANK_TRANSFER || 
        paymentMethod === POSPaymentMethod.PBL || 
        paymentMethod === POSPaymentMethod.TALABAT
      );
      
      if (requiresReference && !paymentReference.trim()) {
        toast.error(`Please enter a ${paymentMethod.toLowerCase()} reference`);
        return;
      }
      
      if (isSplitPayment) {
        // Validate split payment
        const amount1 = parseFloat(splitAmount1) || 0;
        const amount2 = parseFloat(splitAmount2) || 0;
        
        if (amount1 <= 0 || amount2 <= 0) {
          toast.error("Both split amounts must be greater than zero");
          return;
        }
        
        if (Math.abs((amount1 + amount2) - remainingAmount) > 0.01) {
          toast.error("Split amounts must add up to the total remaining amount");
          return;
        }
        
        // Validate references for payment methods that require them
        const requiresReference1 = splitMethod1 === POSPaymentMethod.CARD || 
                                splitMethod1 === POSPaymentMethod.BANK_TRANSFER || 
                                splitMethod1 === POSPaymentMethod.PBL || 
                                splitMethod1 === POSPaymentMethod.TALABAT;
                                
        const requiresReference2 = splitMethod2 === POSPaymentMethod.CARD || 
                                splitMethod2 === POSPaymentMethod.BANK_TRANSFER || 
                                splitMethod2 === POSPaymentMethod.PBL || 
                                splitMethod2 === POSPaymentMethod.TALABAT;
        
        if ((requiresReference1 && !splitReference1.trim()) ||
            (requiresReference2 && !splitReference2.trim())) {
          toast.error("Please enter a reference for payment methods that require it");
          return;
        }
      }

      setIsSubmitting(true);
      console.log(`Processing payment for order ${orderId}, remaining amount: ${remainingAmount}`);

      // Create the payment data
      let payment;
      
      if (isSplitPayment) {
        const amount1 = parseFloat(splitAmount1) || 0;
        const amount2 = parseFloat(splitAmount2) || 0;
        
        payment = {
          id: nanoid(),
          amount: remainingAmount,
          method: POSPaymentMethod.SPLIT,
          reference: splitMethod2 === POSPaymentMethod.CARD ? splitReference2 : null,
          status: POSPaymentStatus.FULLY_PAID,
          isSplitPayment: true,
          splitMethod1: splitMethod1,
          splitMethod2: splitMethod2,
          splitAmount1: amount1,
          splitAmount2: amount2,
          splitReference1: splitReference1 || null,
          splitReference2: splitReference2 || null,
          cashPortion: splitMethod1 === POSPaymentMethod.CASH ? amount1 : 
                      (splitMethod2 === POSPaymentMethod.CASH ? amount2 : 0),
          cardPortion: splitMethod1 === POSPaymentMethod.CARD ? amount1 : 
                      (splitMethod2 === POSPaymentMethod.CARD ? amount2 : 0),
          cardReference: splitMethod1 === POSPaymentMethod.CARD ? splitReference1 : 
                        (splitMethod2 === POSPaymentMethod.CARD ? splitReference2 : null),
          metadata: {
            source: "POS" as const
          }
        };
      } else {
        // For Pay Later, ensure we set the correct status
        const paymentStatus = paymentMethod === POSPaymentMethod.PAY_LATER ? 
          POSPaymentStatus.PENDING : POSPaymentStatus.FULLY_PAID;
          
        console.log(`Payment method: ${paymentMethod}, status: ${paymentStatus}`);
        
        // If this is a payment for a pending order, add a flag to indicate this
        const isPayingPendingOrder = paymentMethod !== POSPaymentMethod.PAY_LATER;
        
        payment = {
          id: nanoid(),
          amount: remainingAmount,
          method: paymentMethod,
          reference: paymentReference || null,
          status: paymentStatus,
          metadata: {
            source: "POS" as const,
            isPendingPayment: paymentMethod === POSPaymentMethod.PAY_LATER,
            isPayingPendingOrder: isPayingPendingOrder
          }
        };
      }

      // Update the order with the new payment
      console.log('Sending payment data:', payment);
      const response = await apiMethods.pos.updateOrderPayment(orderId, payment);
      console.log('Payment response:', response);
      
      // If it's a cash payment or has a cash portion, print receipt and open drawer
      if ((paymentMethod === POSPaymentMethod.CASH || 
          (isSplitPayment && (splitMethod1 === POSPaymentMethod.CASH || splitMethod2 === POSPaymentMethod.CASH))) && 
          response.success) {
        await printAndOpenDrawer(response.data as Order);
      }
      
      // Don't show success message for Pay Later
      if (paymentMethod === POSPaymentMethod.PAY_LATER) {
        toast.success("Order marked as Pay Later");
      } else {
        toast.success("Payment completed successfully");
      }

      onPaymentComplete?.();
      onClose();
    } catch (error: any) {
      console.error("Payment error:", error);
      const errorMessage = error.response?.data?.message || "Failed to process payment";
      console.error("Error details:", errorMessage);
      toast.error(errorMessage);
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
                      <p className="text-sm font-medium text-gray-700">
                        Remaining Amount: <span className="text-lg">AED {remainingAmount.toFixed(2)}</span>
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 space-y-4">
                    {/* Payment Method Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method
                      </label>
                      <div className="flex gap-2 mb-4 flex-wrap">
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod(POSPaymentMethod.CASH);
                            setIsSplitPayment(false);
                          }}
                          className={`flex-1 px-3 py-2 rounded-md mb-1 ${
                            paymentMethod === POSPaymentMethod.CASH && !isSplitPayment
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Cash
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod(POSPaymentMethod.CARD);
                            setIsSplitPayment(false);
                          }}
                          className={`flex-1 px-3 py-2 rounded-md mb-1 ${
                            paymentMethod === POSPaymentMethod.CARD && !isSplitPayment
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Card
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod(POSPaymentMethod.BANK_TRANSFER);
                            setIsSplitPayment(false);
                          }}
                          className={`flex-1 px-3 py-2 rounded-md mb-1 ${
                            paymentMethod === POSPaymentMethod.BANK_TRANSFER && !isSplitPayment
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Bank Transfer
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod(POSPaymentMethod.TALABAT);
                            setIsSplitPayment(false);
                          }}
                          className={`flex-1 px-3 py-2 rounded-md mb-1 ${
                            paymentMethod === POSPaymentMethod.TALABAT && !isSplitPayment
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Talabat
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPaymentMethod(POSPaymentMethod.PBL);
                            setIsSplitPayment(false);
                          }}
                          className={`flex-1 px-3 py-2 rounded-md mb-1 ${
                            paymentMethod === POSPaymentMethod.PBL && !isSplitPayment
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          PBL
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsSplitPayment(true);
                            // Set initial split amounts when split is selected
                            const halfAmount = (remainingAmount / 2).toFixed(2);
                            setSplitAmount1(halfAmount);
                            setSplitAmount2(halfAmount);
                          }}
                          className={`flex-1 px-3 py-2 rounded-md mb-1 ${
                            isSplitPayment
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          Split
                        </button>
                      </div>
                      {/* Pay Later option removed from payment popup */}
                    </div>

                    {/* Reference input for payment methods that require it */}
                    {!isSplitPayment && (paymentMethod === POSPaymentMethod.CARD || 
                      paymentMethod === POSPaymentMethod.BANK_TRANSFER || 
                      paymentMethod === POSPaymentMethod.PBL || 
                      paymentMethod === POSPaymentMethod.TALABAT) && (
                      <div className="mb-4">
                        <label
                          htmlFor="paymentReference"
                          className="block text-sm font-medium text-gray-700 mb-1"
                        >
                          {paymentMethod === POSPaymentMethod.CARD ? 'Card Reference' :
                           paymentMethod === POSPaymentMethod.BANK_TRANSFER ? 'Bank Transfer Reference' :
                           paymentMethod === POSPaymentMethod.TALABAT ? 'Talabat Reference' :
                           'PBL Reference'}
                        </label>
                        <input
                          type="text"
                          id="paymentReference"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                          placeholder={`Enter ${paymentMethod.toLowerCase()} reference`}
                        />
                      </div>
                    )}
                    
                    {/* Split Payment Options */}
                    {isSplitPayment && (
                      <div className="space-y-4 border border-gray-200 rounded-md p-4 bg-gray-50">
                        <h4 className="font-medium text-gray-800">Split Payment</h4>
                        
                        {/* First Payment Method */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              First Payment Method
                            </label>
                            <input
                              type="text"
                              value={splitAmount1}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                                  setSplitAmount1(value);
                                }
                              }}
                              placeholder="Amount"
                              className="w-24 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                            />
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.CASH)}
                              disabled={splitMethod2 === POSPaymentMethod.CASH}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.CASH
                                  ? "bg-black text-white"
                                  : splitMethod2 === POSPaymentMethod.CASH
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Cash
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.CARD)}
                              disabled={splitMethod2 === POSPaymentMethod.CARD}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.CARD
                                  ? "bg-black text-white"
                                  : splitMethod2 === POSPaymentMethod.CARD
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Card
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.BANK_TRANSFER)}
                              disabled={splitMethod2 === POSPaymentMethod.BANK_TRANSFER}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.BANK_TRANSFER
                                  ? "bg-black text-white"
                                  : splitMethod2 === POSPaymentMethod.BANK_TRANSFER
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Bank Transfer
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.TALABAT)}
                              disabled={splitMethod2 === POSPaymentMethod.TALABAT}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.TALABAT
                                  ? "bg-black text-white"
                                  : splitMethod2 === POSPaymentMethod.TALABAT
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Talabat
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.PBL)}
                              disabled={splitMethod2 === POSPaymentMethod.PBL}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.PBL
                                  ? "bg-black text-white"
                                  : splitMethod2 === POSPaymentMethod.PBL
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              PBL
                            </button>
                          </div>
                          
                          {/* Reference for first payment if needed */}
                          {(splitMethod1 === POSPaymentMethod.CARD || 
                            splitMethod1 === POSPaymentMethod.BANK_TRANSFER || 
                            splitMethod1 === POSPaymentMethod.PBL || 
                            splitMethod1 === POSPaymentMethod.TALABAT) && (
                            <div className="mt-2">
                              <input
                                type="text"
                                value={splitReference1}
                                onChange={(e) => setSplitReference1(e.target.value)}
                                placeholder="Card Reference"
                                className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                              />
                            </div>
                          )}
                        </div>
                        
                        {/* Second Payment Method */}
                        <div>
                          <div className="flex justify-between items-center mb-2">
                            <label className="block text-sm font-medium text-gray-700">
                              Second Payment Method
                            </label>
                            <input
                              type="text"
                              value={splitAmount2}
                              onChange={(e) => {
                                const value = e.target.value;
                                if (value === '' || /^\d*\.?\d{0,2}$/.test(value)) {
                                  setSplitAmount2(value);
                                  
                                  // Update amount1 to maintain total
                                  const amount2 = parseFloat(value) || 0;
                                  const calculatedAmount1 = remainingAmount - amount2;
                                  if (!isNaN(calculatedAmount1) && calculatedAmount1 >= 0) {
                                    setSplitAmount1(calculatedAmount1.toFixed(2));
                                  }
                                }
                              }}
                              placeholder="Amount"
                              className="w-24 px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                            />
                          </div>
                          <div className="flex gap-2 flex-wrap">
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.CASH)}
                              disabled={splitMethod1 === POSPaymentMethod.CASH}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.CASH
                                  ? "bg-black text-white"
                                  : splitMethod1 === POSPaymentMethod.CASH
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Cash
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.CARD)}
                              disabled={splitMethod1 === POSPaymentMethod.CARD}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.CARD
                                  ? "bg-black text-white"
                                  : splitMethod1 === POSPaymentMethod.CARD
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Card
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.BANK_TRANSFER)}
                              disabled={splitMethod1 === POSPaymentMethod.BANK_TRANSFER}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.BANK_TRANSFER
                                  ? "bg-black text-white"
                                  : splitMethod1 === POSPaymentMethod.BANK_TRANSFER
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Bank Transfer
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.TALABAT)}
                              disabled={splitMethod1 === POSPaymentMethod.TALABAT}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.TALABAT
                                  ? "bg-black text-white"
                                  : splitMethod1 === POSPaymentMethod.TALABAT
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Talabat
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.PBL)}
                              disabled={splitMethod1 === POSPaymentMethod.PBL}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.PBL
                                  ? "bg-black text-white"
                                  : splitMethod1 === POSPaymentMethod.PBL
                                    ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                                    : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              PBL
                            </button>
                          </div>
                          
                          {/* Reference for second payment if needed */}
                          {(splitMethod2 === POSPaymentMethod.CARD || 
                            splitMethod2 === POSPaymentMethod.BANK_TRANSFER || 
                            splitMethod2 === POSPaymentMethod.PBL || 
                            splitMethod2 === POSPaymentMethod.TALABAT) && (
                            <div className="mt-2">
                              <input
                                type="text"
                                value={splitReference2}
                                onChange={(e) => setSplitReference2(e.target.value)}
                                placeholder="Card Reference"
                                className="w-full px-3 py-1 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-black"
                              />
                            </div>
                          )}
                        </div>
                        
                        <div className="text-sm text-gray-500">
                          Total: AED {remainingAmount.toFixed(2)}
                        </div>
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
