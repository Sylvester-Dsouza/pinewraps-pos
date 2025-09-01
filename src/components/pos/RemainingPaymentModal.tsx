import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState, useEffect } from "react";
import { POSPaymentMethod, POSPaymentStatus, apiMethods } from "@/services/api";
import { toast } from "@/lib/toast";
import { nanoid } from "nanoid";
import { api } from "@/lib/axios";
import { Order } from "@/types/order";
import { orderDrawerService } from '@/services/order-drawer.service';

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

  // Function to check if payment reference is required and missing
  const isPaymentReferenceRequired = () => {
    // Payment methods that require payment reference
    const methodsRequiringReference = [
      POSPaymentMethod.CARD,
      POSPaymentMethod.BANK_TRANSFER,
      POSPaymentMethod.PBL,
      POSPaymentMethod.TALABAT
    ];

    // Check current payment method
    if (!isSplitPayment && methodsRequiringReference.includes(paymentMethod)) {
      return !paymentReference?.trim();
    }

    // Check split payment methods
    if (isSplitPayment) {
      const method1RequiresRef = methodsRequiringReference.includes(splitMethod1);
      const method2RequiresRef = methodsRequiringReference.includes(splitMethod2);

      if (method1RequiresRef && !splitReference1?.trim()) {
        return true;
      }
      if (method2RequiresRef && !splitReference2?.trim()) {
        return true;
      }
    }

    return false;
  };

  // Allow same payment methods for split payments in remaining payment modal
  // This is useful when customer wants to pay remaining amount using same method
  // but with different references (e.g., two different cards, two different bank transfers)

  const handlePayment = async () => {
    try {
      // Validate payment method and reference - mandatory for CARD, BANK_TRANSFER, PBL, and TALABAT
      const requiresReference = !isSplitPayment && (
        paymentMethod === POSPaymentMethod.CARD ||
        paymentMethod === POSPaymentMethod.BANK_TRANSFER ||
        paymentMethod === POSPaymentMethod.PBL ||
        paymentMethod === POSPaymentMethod.TALABAT
      );

      if (requiresReference && !paymentReference.trim()) {
        let methodName = '';
        if (paymentMethod === POSPaymentMethod.CARD) methodName = 'card';
        else if (paymentMethod === POSPaymentMethod.BANK_TRANSFER) methodName = 'bank transfer';
        else if (paymentMethod === POSPaymentMethod.PBL) methodName = 'pay by link';
        else if (paymentMethod === POSPaymentMethod.TALABAT) methodName = 'talabat';

        toast.error(`Please enter a ${methodName} reference`);
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
        
        // Validate references for payment methods that require them - CARD, BANK_TRANSFER, PBL, and TALABAT
        const requiresReference1 = splitMethod1 === POSPaymentMethod.CARD ||
                                splitMethod1 === POSPaymentMethod.BANK_TRANSFER ||
                                splitMethod1 === POSPaymentMethod.PBL ||
                                splitMethod1 === POSPaymentMethod.TALABAT;

        const requiresReference2 = splitMethod2 === POSPaymentMethod.CARD ||
                                splitMethod2 === POSPaymentMethod.BANK_TRANSFER ||
                                splitMethod2 === POSPaymentMethod.PBL ||
                                splitMethod2 === POSPaymentMethod.TALABAT;

        if (requiresReference1 && !splitReference1.trim()) {
          let methodName1 = '';
          if (splitMethod1 === POSPaymentMethod.CARD) methodName1 = 'card';
          else if (splitMethod1 === POSPaymentMethod.BANK_TRANSFER) methodName1 = 'bank transfer';
          else if (splitMethod1 === POSPaymentMethod.PBL) methodName1 = 'pay by link';
          else if (splitMethod1 === POSPaymentMethod.TALABAT) methodName1 = 'talabat';

          toast.error(`Please enter a ${methodName1} reference for the first payment`);
          return;
        }

        if (requiresReference2 && !splitReference2.trim()) {
          let methodName2 = '';
          if (splitMethod2 === POSPaymentMethod.CARD) methodName2 = 'card';
          else if (splitMethod2 === POSPaymentMethod.BANK_TRANSFER) methodName2 = 'bank transfer';
          else if (splitMethod2 === POSPaymentMethod.PBL) methodName2 = 'pay by link';
          else if (splitMethod2 === POSPaymentMethod.TALABAT) methodName2 = 'talabat';

          toast.error(`Please enter a ${methodName2} reference for the second payment`);
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
        const totalAmount = amount1 + amount2;
        
        // Create a single payment record for the split payment with the correct amounts
        payment = {
          id: nanoid(),
          amount: totalAmount,
          method: POSPaymentMethod.SPLIT,
          reference: null,
          status: POSPaymentStatus.FULLY_PAID,
          isSplitPayment: true,
          splitFirstMethod: splitMethod1,
          splitSecondMethod: splitMethod2,
          splitFirstAmount: amount1,
          splitSecondAmount: amount2,
          splitFirstReference: splitReference1 || null,
          splitSecondReference: splitReference2 || null,
          // For backward compatibility
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
      
      // Handle receipt printing and cash drawer
      if (response.success) {
        const hasCashPayment = paymentMethod === POSPaymentMethod.CASH || 
          (isSplitPayment && (splitMethod1 === POSPaymentMethod.CASH || splitMethod2 === POSPaymentMethod.CASH));

        try {
          // Create payment object for drawer service
          const paymentObj = {
            id: payment.id,
            amount: payment.amount,
            method: payment.method,
            reference: payment.reference,
            status: payment.status,
            metadata: payment.metadata
          };

          // Use orderDrawerService to handle cash drawer and receipt printing
          if (hasCashPayment) {
            console.log('Processing cash payment with orderDrawerService');

            // First, record the cash transaction in the till
            try {
              // Calculate total cash amount from the payment (SIMPLIFIED APPROACH)
              // Only record actual cash amounts to ensure till calculation accuracy
              let totalCashAmount = 0;
              if (paymentMethod === POSPaymentMethod.CASH) {
                totalCashAmount = payment.amount;
              } else if (isSplitPayment) {
                // Handle split payments - only count cash portions
                if (splitMethod1 === POSPaymentMethod.CASH && splitAmount1) {
                  totalCashAmount += parseFloat(splitAmount1.toString());
                }
                if (splitMethod2 === POSPaymentMethod.CASH && splitAmount2) {
                  totalCashAmount += parseFloat(splitAmount2.toString());
                }
              }

              if (totalCashAmount > 0) {
                console.log('Recording cash sale in till for amount:', totalCashAmount);
                const recordResult = await orderDrawerService.recordCashSale(
                  totalCashAmount,
                  response.data?.orderNumber,
                  orderId // Pass order ID for duplicate prevention
                );

                if (recordResult) {
                  console.log('Successfully recorded cash sale in till');
                } else {
                  console.error('Failed to record cash sale in till');
                }
              }
            } catch (recordError) {
              console.error('Error recording cash sale in till:', recordError);
            }

            // Then handle receipt printing and drawer opening
            const success = await orderDrawerService.handleOrderCashDrawer(
              [paymentObj],
              response.data?.orderNumber,
              orderId,
              response.data // complete order data
            );
            if (!success) {
              console.error('Failed to print receipt and open drawer');
              toast.error('Failed to print receipt and open drawer');
            }
          } else {
            // For non-cash payments, only print receipt
            console.log('Processing non-cash payment with orderDrawerService');
            const success = await orderDrawerService.handleOrderCardPayment(
              [paymentObj],
              undefined, // orderNumber
              orderId,
              response.data // complete order data
            );
            if (!success) {
              console.error('Failed to print receipt');
              toast.error('Failed to print receipt');
            }
          }
        } catch (error) {
          console.error('Error with printer operation:', error);
          toast.error('Error with printer operation');
        }
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
                            setPaymentMethod(POSPaymentMethod.COD);
                            setIsSplitPayment(false);
                          }}
                          className={`flex-1 px-3 py-2 rounded-md mb-1 ${
                            paymentMethod === POSPaymentMethod.COD && !isSplitPayment
                              ? "bg-black text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          COD
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
                          <span className="text-red-500 ml-1">*</span>
                        </label>
                        <input
                          type="text"
                          id="paymentReference"
                          value={paymentReference}
                          onChange={(e) => setPaymentReference(e.target.value)}
                          className={`w-full px-3 py-2 border rounded-md focus:outline-none focus:ring-1 focus:ring-black ${
                            !paymentReference.trim() ? 'border-red-300' : 'border-gray-300'
                          }`}
                          placeholder={
                            paymentMethod === POSPaymentMethod.CARD ? 'Enter card reference (required)' :
                            paymentMethod === POSPaymentMethod.BANK_TRANSFER ? 'Enter bank transfer reference (required)' :
                            paymentMethod === POSPaymentMethod.PBL ? 'Enter pay by link reference (required)' :
                            paymentMethod === POSPaymentMethod.TALABAT ? 'Enter talabat reference (required)' :
                            'Enter payment reference (required)'
                          }
                          required
                        />
                        {!paymentReference.trim() && (
                          <p className="text-red-500 text-sm mt-1">
                            {paymentMethod === POSPaymentMethod.CARD ? 'Card' :
                             paymentMethod === POSPaymentMethod.BANK_TRANSFER ? 'Bank transfer' :
                             paymentMethod === POSPaymentMethod.PBL ? 'Pay by link' :
                             paymentMethod === POSPaymentMethod.TALABAT ? 'Talabat' :
                             'Payment'} reference is required
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Split Payment Options */}
                    {isSplitPayment && (
                      <div className="space-y-4 border border-gray-200 rounded-md p-4 bg-gray-50">
                        <div className="flex justify-between items-center">
                          <h4 className="font-medium text-gray-800">Split Payment</h4>
                          {splitMethod1 === splitMethod2 && (
                            <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                              Same payment method selected
                            </span>
                          )}
                        </div>
                        
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
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.CASH
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Cash
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.CARD)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.CARD
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Card
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.BANK_TRANSFER)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.BANK_TRANSFER
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Bank Transfer
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.TALABAT)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.TALABAT
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Talabat
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.PBL)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.PBL
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              PBL
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod1(POSPaymentMethod.COD)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod1 === POSPaymentMethod.COD
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              COD
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
                                placeholder={
                                  splitMethod1 === POSPaymentMethod.CARD ? 'Card reference (required)' :
                                  splitMethod1 === POSPaymentMethod.BANK_TRANSFER ? 'Bank transfer reference (required)' :
                                  splitMethod1 === POSPaymentMethod.PBL ? 'Pay by link reference (required)' :
                                  splitMethod1 === POSPaymentMethod.TALABAT ? 'Talabat reference (required)' :
                                  'Payment reference (required)'
                                }
                                className={`w-full px-3 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-black ${
                                  !splitReference1.trim() ? 'border-red-300' : 'border-gray-300'
                                }`}
                                required
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
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.CASH
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Cash
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.CARD)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.CARD
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Card
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.BANK_TRANSFER)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.BANK_TRANSFER
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Bank Transfer
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.TALABAT)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.TALABAT
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              Talabat
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.PBL)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.PBL
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              PBL
                            </button>
                            <button
                              type="button"
                              onClick={() => setSplitMethod2(POSPaymentMethod.COD)}
                              className={`flex-1 px-3 py-1 text-sm rounded-md mb-1 ${
                                splitMethod2 === POSPaymentMethod.COD
                                  ? "bg-black text-white"
                                  : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              COD
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
                                placeholder={
                                  splitMethod2 === POSPaymentMethod.CARD ? 'Card reference (required)' :
                                  splitMethod2 === POSPaymentMethod.BANK_TRANSFER ? 'Bank transfer reference (required)' :
                                  splitMethod2 === POSPaymentMethod.PBL ? 'Pay by link reference (required)' :
                                  splitMethod2 === POSPaymentMethod.TALABAT ? 'Talabat reference (required)' :
                                  'Payment reference (required)'
                                }
                                className={`w-full px-3 py-1 border rounded-md focus:outline-none focus:ring-1 focus:ring-black ${
                                  !splitReference2.trim() ? 'border-red-300' : 'border-gray-300'
                                }`}
                                required
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
                    disabled={isSubmitting || isPaymentReferenceRequired()}
                    className="px-4 py-2 text-sm font-medium text-white bg-black rounded-md hover:bg-gray-900 focus:outline-none disabled:opacity-50"
                  >
                    {isSubmitting ? "Processing..." : "Complete Payment"}
                  </button>
                </div>

                {/* Payment Reference Required Message */}
                {isPaymentReferenceRequired() && (
                  <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <p className="text-sm text-red-600 font-medium">
                      Payment reference is required to complete the payment
                    </p>
                  </div>
                )}
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition.Root>
  );
}
