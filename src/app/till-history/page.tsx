'use client';

import { useState, useEffect } from 'react';
import { drawerService, DrawerSession, DrawerOperation, OrderDetail } from '@/services/drawer.service';
import { format } from 'date-fns';
import { Loader2 } from 'lucide-react';
import Link from 'next/link';

// Extended interface to include additional properties from the API
interface ExtendedDrawerSession extends DrawerSession {
  paymentTotals?: Record<string, number>;
  payIns?: number;
  payOuts?: number;
  totalSales?: number;
  expectedAmount?: string;
  discrepancy?: string;
  completedOrders?: number;
  orderDetails?: OrderDetail[];
}

export default function TillHistoryPage() {
  const [sessions, setSessions] = useState<ExtendedDrawerSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedSession, setExpandedSession] = useState<string | null>(null);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);
        // Fetch a larger number of sessions
        const sessionHistory = await drawerService.getSessionHistory(50);
        setSessions(sessionHistory);
        
        // Log the full session data for debugging
        console.log('All Till Sessions Data:', JSON.stringify(sessionHistory, null, 2));
        
        // Add a visible debug section to the UI
        if (sessionHistory.length > 0) {
          console.log('First session payment totals:', sessionHistory[0].paymentTotals);
          console.log('First session operations:', sessionHistory[0].operations);
        }
      } catch (err) {
        console.error('Error fetching session history:', err);
        setError('Failed to load till history. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, []);

  const toggleSessionDetails = (sessionId: string) => {
    if (expandedSession === sessionId) {
      setExpandedSession(null);
    } else {
      setExpandedSession(sessionId);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 2
    }).format(amount);
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-500" />
        <span className="ml-2 text-lg">Loading till history...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-screen flex-col items-center justify-center">
        <p className="text-red-500 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-black text-white rounded-lg"
        >
          Try Again
        </button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Till Session History</h1>
        <Link href="/pos" className="px-4 py-2 bg-black text-white rounded-lg">
          Back to POS
        </Link>
      </div>

      {sessions.length === 0 ? (
        <p className="text-gray-500 text-center py-10">No till sessions found.</p>
      ) : (
        <div className="space-y-6">
          {sessions.map((session) => (
            <div 
              key={session.id} 
              className="border border-gray-200 rounded-xl overflow-hidden shadow-sm"
            >
              <div 
                className="bg-gray-50 p-4 flex justify-between items-center cursor-pointer"
                onClick={() => toggleSessionDetails(session.id)}
              >
                <div>
                  <h2 className="text-lg font-medium">
                    Session #{session.id.slice(-6)}
                  </h2>
                  <p className="text-sm text-gray-500">
                    {session.user ? `${session.user.firstName} ${session.user.lastName}` : 'Unknown User'} • 
                    {session.openedAt && format(new Date(session.openedAt), ' MMM d, yyyy h:mm a')}
                  </p>
                </div>
                <div className="text-right">
                  <p className={`font-medium ${session.status === 'OPEN' ? 'text-green-600' : 'text-gray-700'}`}>
                    {session.status}
                  </p>
                  <p className="text-sm">
                    {session.closedAt ? format(new Date(session.closedAt), 'MMM d, yyyy h:mm a') : 'Still Open'}
                  </p>
                </div>
              </div>
              
              {expandedSession === session.id && (
                <div className="p-4 bg-white">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h3 className="font-medium mb-2">Session Details</h3>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr>
                            <td className="py-1 text-gray-500">Opening Amount:</td>
                            <td className="py-1 text-right">{formatCurrency(Number(session.openingAmount))}</td>
                          </tr>
                          <tr>
                            <td className="py-1 text-gray-500">Closing Amount:</td>
                            <td className="py-1 text-right">
                              {session.closingAmount ? formatCurrency(Number(session.closingAmount)) : 'N/A'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 text-gray-500">Expected Amount:</td>
                            <td className="py-1 text-right">
                              {session.expectedAmount ? formatCurrency(Number(session.expectedAmount)) : 'N/A'}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 text-gray-500">Discrepancy:</td>
                            <td className={`py-1 text-right ${
                              session.discrepancy && Number(session.discrepancy) !== 0 
                                ? Number(session.discrepancy) > 0 
                                  ? 'text-green-600' 
                                  : 'text-red-600'
                                : ''
                            }`}>
                              {session.discrepancy ? formatCurrency(Number(session.discrepancy)) : 'N/A'}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div>
                      <h3 className="font-medium mb-2">Payment Totals</h3>
                      <table className="w-full text-sm">
                        <tbody>
                          <tr>
                            <td className="py-1 text-gray-500 font-medium">Cash Sales:</td>
                            <td className="py-1 text-right font-medium">
                              {session.paymentTotals?.TOTAL_CASH ? formatCurrency(Number(session.paymentTotals.TOTAL_CASH)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400">
                            <td className="py-0 pl-4">- Direct Cash:</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.CASH ? formatCurrency(Number(session.paymentTotals.CASH)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400">
                            <td className="py-0 pl-4">- Split Cash:</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.SPLIT_CASH ? formatCurrency(Number(session.paymentTotals.SPLIT_CASH)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400">
                            <td className="py-0 pl-4">- Partial Cash:</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.PARTIAL_CASH ? formatCurrency(Number(session.paymentTotals.PARTIAL_CASH)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400">
                            <td className="py-0 pl-4">- Remaining Cash:</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.REMAINING_CASH ? formatCurrency(Number(session.paymentTotals.REMAINING_CASH)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400 mb-2">
                            <td className="py-0 pl-4">- Pay Later (Cash):</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.PL_CASH ? formatCurrency(Number(session.paymentTotals.PL_CASH)) : formatCurrency(0)}
                            </td>
                          </tr>
                          
                          <tr className="mt-2">
                            <td className="py-1 text-gray-500 font-medium">Card Sales:</td>
                            <td className="py-1 text-right font-medium">
                              {session.paymentTotals?.TOTAL_CARD ? formatCurrency(Number(session.paymentTotals.TOTAL_CARD)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400">
                            <td className="py-0 pl-4">- Direct Card:</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.CARD ? formatCurrency(Number(session.paymentTotals.CARD)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400">
                            <td className="py-0 pl-4">- Split Card:</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.SPLIT_CARD ? formatCurrency(Number(session.paymentTotals.SPLIT_CARD)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400">
                            <td className="py-0 pl-4">- Partial Card:</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.PARTIAL_CARD ? formatCurrency(Number(session.paymentTotals.PARTIAL_CARD)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400 mb-2">
                            <td className="py-0 pl-4">- Pay Later (Card):</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.PL_CARD ? formatCurrency(Number(session.paymentTotals.PL_CARD)) : formatCurrency(0)}
                            </td>
                          </tr>
                          
                          <tr className="mt-2">
                            <td className="py-1 text-gray-500 font-medium">Bank Transfer:</td>
                            <td className="py-1 text-right font-medium">
                              {session.paymentTotals?.TOTAL_BANK_TRANSFER ? formatCurrency(Number(session.paymentTotals.TOTAL_BANK_TRANSFER)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400">
                            <td className="py-0 pl-4">- Direct Bank Transfer:</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.BANK_TRANSFER ? formatCurrency(Number(session.paymentTotals.BANK_TRANSFER)) : formatCurrency(0)}
                            </td>
                          </tr>
                          
                          <tr className="mt-2">
                            <td className="py-1 text-gray-500 font-medium">Pay by Link:</td>
                            <td className="py-1 text-right font-medium">
                              {session.paymentTotals?.TOTAL_PBL ? formatCurrency(Number(session.paymentTotals.TOTAL_PBL)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr className="text-xs text-gray-400">
                            <td className="py-0 pl-4">- Direct Pay by Link:</td>
                            <td className="py-0 text-right">
                              {session.paymentTotals?.PBL ? formatCurrency(Number(session.paymentTotals.PBL)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 text-gray-500">Talabat:</td>
                            <td className="py-1 text-right">
                              {session.paymentTotals?.TALABAT ? formatCurrency(Number(session.paymentTotals.TALABAT)) : formatCurrency(0)}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 text-gray-500">Cash on Delivery:</td>
                            <td className="py-1 text-right">
                              {session.paymentTotals?.COD ? formatCurrency(Number(session.paymentTotals.COD)) : formatCurrency(0)}
                            </td>
                          </tr>
                          {/* Pay Later removed as it's a payment mode, not a payment method */}
                          {/* Split Payments are now included in the individual payment method totals */}
                          
                          {/* Partial Payments Section */}
                          {(session.paymentTotals?.PARTIAL_CASH > 0 || 
                            session.paymentTotals?.PARTIAL_CARD > 0 || 
                            session.paymentTotals?.PARTIAL_BANK_TRANSFER > 0 || 
                            session.paymentTotals?.PARTIAL_PBL > 0 || 
                            session.paymentTotals?.PARTIAL_TALABAT > 0 || 
                            session.paymentTotals?.PARTIAL_COD > 0) && (
                            <>
                              <tr className="bg-gray-100 border-t border-b border-gray-200">
                                <td className="py-2 text-gray-800 font-medium" colSpan={2}>
                                  <div className="flex items-center">
                                    <span className="mr-2">💸</span>
                                    <span>Partial Payments Breakdown</span>
                                  </div>
                                </td>
                              </tr>
                              
                              {/* Total Partial Payments */}
                              <tr className="bg-gray-50">
                                <td className="py-1 text-gray-700 font-medium">Total Partial Payments:</td>
                                <td className="py-1 text-right font-medium">
                                  {formatCurrency(
                                    (session.paymentTotals?.PARTIAL_CASH || 0) +
                                    (session.paymentTotals?.PARTIAL_CARD || 0) +
                                    (session.paymentTotals?.PARTIAL_BANK_TRANSFER || 0) +
                                    (session.paymentTotals?.PARTIAL_PBL || 0) +
                                    (session.paymentTotals?.PARTIAL_TALABAT || 0) +
                                    (session.paymentTotals?.PARTIAL_COD || 0)
                                  )}
                                </td>
                              </tr>
                            </>
                          )}
                          {session.paymentTotals?.PARTIAL_CASH > 0 && (
                            <tr>
                              <td className="py-1 text-gray-500 pl-4">- Cash (Partial):</td>
                              <td className="py-1 text-right">
                                {formatCurrency(Number(session.paymentTotals.PARTIAL_CASH))}
                              </td>
                            </tr>
                          )}
                          {session.paymentTotals?.PARTIAL_CARD > 0 && (
                            <tr>
                              <td className="py-1 text-gray-500 pl-4">- Card (Partial):</td>
                              <td className="py-1 text-right">
                                {formatCurrency(Number(session.paymentTotals.PARTIAL_CARD))}
                              </td>
                            </tr>
                          )}
                          {session.paymentTotals?.PARTIAL_BANK_TRANSFER > 0 && (
                            <tr>
                              <td className="py-1 text-gray-500 pl-4">- Bank Transfer (Partial):</td>
                              <td className="py-1 text-right">
                                {formatCurrency(Number(session.paymentTotals.PARTIAL_BANK_TRANSFER))}
                              </td>
                            </tr>
                          )}
                          {session.paymentTotals?.PARTIAL_PBL > 0 && (
                            <tr>
                              <td className="py-1 text-gray-500 pl-4">- Pay by Link (Partial):</td>
                              <td className="py-1 text-right">
                                {formatCurrency(Number(session.paymentTotals.PARTIAL_PBL))}
                              </td>
                            </tr>
                          )}
                          {session.paymentTotals?.PARTIAL_TALABAT > 0 && (
                            <tr>
                              <td className="py-1 text-gray-500 pl-4">- Talabat (Partial):</td>
                              <td className="py-1 text-right">
                                {formatCurrency(Number(session.paymentTotals.PARTIAL_TALABAT))}
                              </td>
                            </tr>
                          )}
                          {session.paymentTotals?.PARTIAL_COD > 0 && (
                            <tr>
                              <td className="py-1 text-gray-500 pl-4">- COD (Partial):</td>
                              <td className="py-1 text-right">
                                {formatCurrency(Number(session.paymentTotals.PARTIAL_COD))}
                              </td>
                            </tr>
                          )}
                          <tr className="border-t border-gray-200 mt-2">
                            <td className="py-1 text-gray-500">Pay-ins:</td>
                            <td className="py-1 text-right">
                              {formatCurrency(Number(session.payIns || 0))}
                            </td>
                          </tr>
                          <tr>
                            <td className="py-1 text-gray-500">Pay-outs:</td>
                            <td className="py-1 text-right">
                              {formatCurrency(Number(session.payOuts || 0))}
                            </td>
                          </tr>
                          <tr className="border-t">
                            <td className="py-2 font-medium">Total Sales:</td>
                            <td className="py-2 text-right font-medium">
                              {formatCurrency(Number(session.totalSales || 0))}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Cash Calculation Debug Section */}
                  <div className="mt-6 p-4 bg-gray-50 rounded-lg">
                    <h3 className="font-medium mb-2">Cash Calculation Debug</h3>
                    <pre className="text-xs overflow-x-auto p-2 bg-gray-100 rounded">
                      {JSON.stringify({
                        openingAmount: Number(session.openingAmount || 0),
                        cashSales: Number(session.paymentTotals?.CASH || 0),
                        payIns: Number(session.payIns || 0),
                        payOuts: Number(session.payOuts || 0),
                        expectedAmount: Number(session.expectedAmount || 0),
                        closingAmount: Number(session.closingAmount || 0),
                        discrepancy: Number(session.discrepancy || 0),
                        calculatedExpected: Number(session.openingAmount || 0) + 
                                           Number(session.paymentTotals?.CASH || 0) + 
                                           Number(session.payIns || 0) - 
                                           Number(session.payOuts || 0)
                      }, null, 2)}
                    </pre>
                  </div>

                  {/* Order Details Section */}
                  {session.orderDetails && session.orderDetails.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-medium mb-2">Order Details ({session.orderDetails.length} orders)</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="py-2 px-3 text-left">Order #</th>
                              <th className="py-2 px-3 text-left">Time</th>
                              <th className="py-2 px-3 text-left">Payment Method</th>
                              <th className="py-2 px-3 text-left">Amount</th>
                              <th className="py-2 px-3 text-left">Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.orderDetails.map((order) => (
                              <tr key={order.id} className="border-t hover:bg-gray-50">
                                <td className="py-2 px-3 font-medium">{order.orderNumber}</td>
                                <td className="py-2 px-3">
                                  {order.createdAt && format(new Date(order.createdAt), 'h:mm a')}
                                </td>
                                <td className="py-2 px-3">
                                  {order.payments.map((payment, idx) => (
                                    <div key={payment.id} className={idx > 0 ? 'mt-1' : ''}>
                                      {payment.isSplitPayment ? (
                                        <div>
                                          <span className="px-2 py-1 rounded-full text-xs bg-purple-100 text-purple-800">Split</span>
                                          <div className="text-xs mt-1 ml-2">
                                            {payment.splitFirstMethod && (
                                              <div>{payment.splitFirstMethod}: {formatCurrency(payment.splitFirstAmount || 0)}</div>
                                            )}
                                            {payment.splitSecondMethod && (
                                              <div>{payment.splitSecondMethod}: {formatCurrency(payment.splitSecondAmount || 0)}</div>
                                            )}
                                          </div>
                                        </div>
                                      ) : (
                                        <span className={`px-2 py-1 rounded-full text-xs ${
                                          payment.method === 'CASH' ? 'bg-green-100 text-green-800' : 
                                          payment.method === 'CARD' ? 'bg-blue-100 text-blue-800' : 
                                          payment.method === 'PBL' ? 'bg-indigo-100 text-indigo-800' : 
                                          payment.method === 'BANK_TRANSFER' ? 'bg-yellow-100 text-yellow-800' : 
                                          payment.method === 'PAY_LATER' ? 'bg-orange-100 text-orange-800' : 
                                          'bg-gray-100 text-gray-800'
                                        }`}>
                                          {payment.method}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </td>
                                <td className="py-2 px-3 text-right">{formatCurrency(order.total)}</td>
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    order.paymentStatus === 'FULLY_PAID' ? 'bg-green-100 text-green-800' : 
                                    order.paymentStatus === 'PARTIALLY_PAID' ? 'bg-orange-100 text-orange-800' : 
                                    order.paymentStatus === 'PENDING' ? 'bg-red-100 text-red-800' : 
                                    'bg-gray-100 text-gray-800'
                                  }`}>
                                    {order.paymentStatus}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  
                  {/* Operations Section */}
                  {session.operations && session.operations.length > 0 && (
                    <div className="mt-6">
                      <h3 className="font-medium mb-2">Cash Operations</h3>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="bg-gray-50">
                              <th className="py-2 px-3 text-left">Type</th>
                              <th className="py-2 px-3 text-left">Amount</th>
                              <th className="py-2 px-3 text-left">Time</th>
                              <th className="py-2 px-3 text-left">Notes</th>
                            </tr>
                          </thead>
                          <tbody>
                            {session.operations.map((op) => (
                              <tr key={op.id} className="border-t">
                                <td className="py-2 px-3">
                                  <span className={`px-2 py-1 rounded-full text-xs ${
                                    op.notes?.toLowerCase().includes('opening balance') ? 'bg-blue-100 text-blue-800' :
                                    op.notes?.toLowerCase().includes('closing balance') ? 'bg-purple-100 text-purple-800' :
                                    op.type === 'TAKE_CASH' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                  }`}>
                                    {op.notes?.toLowerCase().includes('opening balance') ? 'Opening Balance' :
                                     op.notes?.toLowerCase().includes('closing balance') ? 'Closing Balance' :
                                     op.type === 'TAKE_CASH' ? 'Pay In' : 'Pay Out'}
                                  </span>
                                </td>
                                <td className="py-2 px-3">{formatCurrency(Number(op.amount))}</td>
                                <td className="py-2 px-3">
                                  {op.createdAt && format(new Date(op.createdAt), 'MMM d, h:mm a')}
                                </td>
                                <td className="py-2 px-3 text-gray-500">{op.notes || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
