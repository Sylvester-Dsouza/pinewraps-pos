'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'react-hot-toast';
import { drawerService } from '@/services/drawer.service';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency } from '@/lib/utils';
import { LockClosedIcon, LockOpenIcon, PlusIcon, MinusIcon, ClockIcon, ReceiptIcon, PlusCircleIcon, MinusCircleIcon } from '@/components/icons';
// Using fetch instead of axios for printer proxy requests for better reliability

// Get printer proxy URL from environment variables with localhost fallback
const PRINTER_PROXY_URL = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
console.log('Using printer proxy URL:', PRINTER_PROXY_URL);

export interface TillManagementProps {
  onSessionChange?: () => void;
}

export function TillManagement({ onSessionChange }: TillManagementProps) {
  const [isOpenTillModalOpen, setIsOpenTillModalOpen] = useState(false);
  const [isCloseTillModalOpen, setIsCloseTillModalOpen] = useState(false);
  const [isPayInModalOpen, setIsPayInModalOpen] = useState(false);
  const [isPayOutModalOpen, setIsPayOutModalOpen] = useState(false);
  const [openingAmount, setOpeningAmount] = useState('');
  const [closingAmount, setClosingAmount] = useState('');
  const [payAmount, setPayAmount] = useState('');
  const [note, setNote] = useState('');
  const [currentSession, setCurrentSession] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingSession, setIsLoadingSession] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch current session on component mount
  useEffect(() => {
    fetchCurrentSession();
  }, []);

  const fetchCurrentSession = async () => {
    setIsLoadingSession(true);
    try {
      console.log('Fetching current drawer session...');
      const session = await drawerService.getCurrentSession();
      console.log('Current session data:', session);
      setCurrentSession(session?.data);
      
      // If we have a session, get the transactions
      if (session?.data) {
        setTransactions(session.data.operations || []);
      }
    } catch (error) {
      console.error('Error fetching drawer session:', error);
    } finally {
      setIsLoadingSession(false);
    }
  };

  // Function to get printer configuration for the printer proxy
  const getProxyConfig = async () => {
    try {
      console.log('Using printer proxy default configuration');
      
      // Return configuration that tells the proxy to use its own database settings
      // This matches how the direct test works - it will use the database configuration
      // The printer proxy will look up the printer in the database
      return { 
        // We don't provide IP and port directly
        // The printer proxy will look up the default printer in the database
        skipConnectivityCheck: true // Skip connectivity check for better reliability
      };
    } catch (error) {
      console.error('Error preparing printer config:', error);
      return { 
        skipConnectivityCheck: true 
      };
    }
  };

  const handleOpenTillClick = async () => {
    setIsLoading(true);
    try {
      console.log('Opening till - sending open-drawer command to proxy');
      
      // Get printer configuration from the proxy
      const printerConfig = await getProxyConfig();
      
      console.log(`Sending open-drawer request to ${PRINTER_PROXY_URL}/open-drawer`);
      
      // Send the open-drawer command to the proxy with retry logic
      let drawerOpened = false;
      let retryCount = 0;
      const maxRetries = 2; // Try up to 3 times (initial + 2 retries)
      let lastError = null;
      
      while (!drawerOpened && retryCount <= maxRetries) {
        try {
          if (retryCount > 0) {
            console.log(`Retry attempt ${retryCount} to open drawer...`);
          }
          
          // Use the exact same implementation as the printer test page with fetch
          const response = await fetch(`${PRINTER_PROXY_URL}/open-drawer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              // Don't include ip and port, let the proxy use its database configuration
              skipConnectivityCheck: true,
              timeout: 5000 // Increase timeout for better reliability
            })
          });
          
          console.log(`Open drawer response status:`, response.status);
          const data = await response.json();
          console.log(`Open drawer response data:`, data);

          if (response.status === 200 && data.success) {
            console.log('Drawer opened successfully');
            drawerOpened = true;
            break;
          } else {
            lastError = data.error || 'Unknown error';
            console.error('Failed to open drawer:', lastError);
            retryCount++;
            
            if (retryCount <= maxRetries) {
              // Wait a bit before retrying
              await new Promise(resolve => setTimeout(resolve, 1000));
            }
          }
        } catch (drawerError) {
          lastError = drawerError.message || 'Error communicating with printer';
          console.error('Error opening cash drawer:', drawerError);
          retryCount++;
          
          if (retryCount <= maxRetries) {
            // Wait a bit before retrying
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      }

      // Show toast based on drawer status
      if (drawerOpened) {
        toast.success('Cash drawer opened successfully');
      } else if (lastError) {
        toast.error(`Could not open cash drawer: ${lastError}`);
      }

      // Then show the dialog regardless of drawer status
      setIsOpenTillModalOpen(true);
    } catch (error) {
      console.error('Error in open till process:', error);
      // Show dialog anyway
      setIsOpenTillModalOpen(true);
      
      let errorMessage = 'Error preparing to open till';
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenTill = async () => {
    setIsLoading(true);
    try {
      if (!openingAmount || isNaN(parseFloat(openingAmount))) {
        toast.error('Please enter a valid opening amount');
        return;
      }

      const amount = parseFloat(openingAmount);
      console.log('Opening till with amount:', amount);
      
      try {
        const sessionResult = await drawerService.openSession(amount);
        console.log('Session open result:', sessionResult);
        toast.success('Till opened successfully');
        setIsOpenTillModalOpen(false);
        setOpeningAmount('');
        fetchCurrentSession();
        if (onSessionChange) onSessionChange();
      } catch (sessionError) {
        console.error('Error from openSession call:', sessionError);
        let errorMessage = 'Failed to open till';
        
        if (sessionError.response && sessionError.response.data && sessionError.response.data.error) {
          errorMessage = sessionError.response.data.error;
        } else if (sessionError.message) {
          errorMessage = sessionError.message;
        }
        
        toast.error(errorMessage);
      }
    } catch (error) {
      console.error('Error in handleOpenTill:', error);
      toast.error('Failed to open till: ' + (error.message || 'Unknown error'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCloseTillClick = async () => {
    try {
      console.log('Closing till - sending open-drawer command to proxy');

      // Get printer configuration from the proxy
      const printerConfig = await getProxyConfig();
      
      // Extract IP and port from the configuration
      // Don't destructure ip and port as they don't exist in the config
      
      console.log(`Sending open-drawer request to ${PRINTER_PROXY_URL}/open-drawer`);

      // Open the drawer only, no receipt printing
      try {
        // Use the exact same implementation as the printer test page with fetch
        const response = await fetch(`${PRINTER_PROXY_URL}/open-drawer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            // Don't include ip and port, let the proxy use its database configuration
            skipConnectivityCheck: true,
            timeout: 5000 // Increase timeout for better reliability
          })
        });
        
        console.log(`Open drawer response status:`, response.status);
        const data = await response.json();
        console.log(`Open drawer response data:`, data);
        
        if (response.status !== 200) {
          console.error('Failed to open drawer:', data.error || 'Unknown error');
        }
      } catch (drawerError) {
        console.error('Error opening cash drawer:', drawerError);
        // Continue with closing the till dialog even if drawer fails
      }

      // Show dialog to enter closing amount
      setIsCloseTillModalOpen(true);
    } catch (error) {
      console.error('Error opening drawer for close:', error);
      toast.error('Failed to open drawer. Please try again.');
      // Show dialog anyway
      setIsCloseTillModalOpen(true);
    }
  };

  const handleSubmitClosingAmount = async () => {
    setIsSubmitting(true);
    try {
      if (!closingAmount || isNaN(parseFloat(closingAmount))) {
        toast.error('Please enter a valid closing amount');
        setIsSubmitting(false);
        return;
      }

      // Get proxy configuration (without printer IP/port)
      const proxyConfig = await getProxyConfig();
      console.log('Printer proxy config:', proxyConfig);

      const amount = parseFloat(closingAmount);
      console.log('Attempting to close session with amount:', amount);
      
      // Close the session
      const response = await drawerService.closeSession(amount);
      console.log('Close session response:', response);
      
      // Always close the modal and reset the amount, even if the response is incomplete
      setIsCloseTillModalOpen(false);
      setClosingAmount('');
      
      if (response) {
        toast.success('Till closed successfully');
        
        // Print closing receipt - do this immediately to ensure it happens
        try {
          console.log('Preparing to print closing receipt...');
          
          // Prepare closing data with safe fallbacks for all fields
          const closingData = {
            closingAmount: amount,
            sessionId: response.id || 'unknown',
            openingAmount: response.openingAmount ? parseFloat(response.openingAmount) : 0,
            openedAt: response.openedAt || response.createdAt || null, // Add openedAt property for the opening date
            closedAt: response.closedAt || new Date().toISOString(),
            operations: response.operations || [],
            user: response.user || { firstName: 'Unknown', lastName: 'User' },
            // Include payment totals from the response
            paymentTotals: response.paymentTotals || {},
            // Include completed orders count
            completedOrders: response.completedOrders || 0
          };
          
          console.log('Payment totals for till closing report:', response.paymentTotals);
          console.log('Completed orders count for till closing report:', response.completedOrders);
          
          console.log('Sending print request to printer proxy with data:', JSON.stringify(closingData, null, 2));
          
          // Use fetch as it's more reliable for printer proxy requests (per memory guidance)
          fetch(`${PRINTER_PROXY_URL}/print-only`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              type: 'till_close', // Use till_close instead of till_close_final to match proxy handler
              data: closingData,
              ...proxyConfig,
              skipConnectivityCheck: true // Add this to skip connectivity check
            })
          })
          .then(response => response.json())
          .then(result => {
            console.log('Print response:', result);
            if (result.success) {
              console.log('Till closing receipt printed successfully');
            } else {
              console.error('Failed to print till closing receipt:', result.error || 'Unknown error');
              toast.error('Till closed but receipt printing failed');
            }
          })
          .catch(printError => {
            console.error('Error printing closing receipt:', printError);
            toast.error('Till closed but receipt printing failed');
          });
        } catch (printError) {
          console.error('Error setting up print request:', printError);
          toast.error('Till closed but receipt printing failed');
          // Continue even if printing fails
        }
        
        fetchCurrentSession();
      } else {
        toast.error('Failed to close till. Please try again.');
      }
    } catch (error) {
      console.error('Error closing till:', error);
      console.error('Full error details:', JSON.stringify(error, null, 2));
      
      // Log the specific error type and structure
      if (error.response) {
        console.error('Response status:', error.response.status);
        console.error('Response data:', JSON.stringify(error.response.data, null, 2));
      }
      
      let errorMessage = 'Failed to close till';
      
      // Handle the specific case where only the user who opened the till can close it
      if (error.response && error.response.status === 403 && 
          error.response.data && error.response.data.error && 
          error.response.data.error.includes('can close this till session')) {
        
        // Extract the name of the user who can close the till
        const match = error.response.data.error.match(/Only (.+?) can close this till session/);
        const userName = match ? match[1] : 'another user';
        
        errorMessage = `Only ${userName} can close this till because they opened it. Please ask them to close it.`;
        
        // Show a more helpful toast message
        toast.error(errorMessage, { duration: 5000 });
      } else if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
        toast.error(errorMessage);
      } else if (error.message) {
        errorMessage = error.message;
        toast.error(errorMessage);
      } else {
        toast.error(errorMessage);
      }
      
      // Close the modal even if there's an error to prevent UI being stuck
      setIsCloseTillModalOpen(false);
      setClosingAmount('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayIn = async () => {
    setIsLoading(true);
    try {
      if (!payAmount || isNaN(parseFloat(payAmount))) {
        toast.error('Please enter a valid pay-in amount');
        return;
      }

      // No need to open the drawer here as it's already opened when the Pay In button is clicked

      const amount = parseFloat(payAmount);
      await drawerService.payIn(amount, note || 'Pay In transaction');
      toast.success('Pay-in successful');
      setIsPayInModalOpen(false);
      setPayAmount('');
      setNote('');
      fetchCurrentSession();
    } catch (error) {
      console.error('Error paying in:', error);
      let errorMessage = 'Failed to pay in';
      
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayOut = async () => {
    setIsLoading(true);
    try {
      if (!payAmount || isNaN(parseFloat(payAmount))) {
        toast.error('Please enter a valid pay-out amount');
        return;
      }

      // No need to open the drawer here as it's already opened when the Pay Out button is clicked

      const amount = parseFloat(payAmount);
      await drawerService.payOut(amount, note || 'Pay Out transaction');
      toast.success('Pay-out successful');
      setIsPayOutModalOpen(false);
      setPayAmount('');
      setNote('');
      fetchCurrentSession();
    } catch (error) {
      console.error('Error paying out:', error);
      let errorMessage = 'Failed to pay out';
      
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // Calculate session summary
  const calculateSessionSummary = () => {
    if (!currentSession) return { total: 0, payIns: 0, payOuts: 0, sales: 0, cashSales: 0 };
    
    let payIns = 0;
    let payOuts = 0;
    let sales = 0;
    let cashSales = 0;
    
    if (transactions && transactions.length > 0) {
      transactions.forEach(tx => {
        const amount = parseFloat(tx.amount) || 0;
        
        // Handle all cash-related transactions
        if (tx.type === 'OPENING_BALANCE') {
          // Opening balance is already included separately, don't double count
        } else if (tx.type === 'ADD' || tx.type === 'ADD_CASH') {
          // Cash added to the drawer
          payIns += amount;
        } else if (tx.type === 'REMOVE' || tx.type === 'REMOVE_CASH' || tx.type === 'TAKE_CASH') {
          // Cash removed from the drawer
          payOuts += amount;
        } else if (tx.type === 'SALE') {
          // Track all sales for reporting
          sales += amount;
          
          // Only cash sales affect the drawer balance
          if (tx.paymentMethod === 'CASH') {
            cashSales += amount;
            // We don't add cash sales to payIns to avoid double counting
            // Cash sales are tracked separately in cashSales
          }
        } else if (tx.type === 'REFUND' && tx.paymentMethod === 'CASH') {
          // Cash refunds reduce the drawer balance
          payOuts += amount;
        }
      });
    }
    
    // Calculate the expected amount in the drawer
    const openAmount = parseFloat(currentSession.openingAmount) || 0;
    const total = openAmount + payIns - payOuts;
    
    return { total, payIns, payOuts, openAmount, sales, cashSales };
  };
  
  const summary = calculateSessionSummary();

  return (
    <div className="space-y-6">
      {isLoadingSession ? (
        <div>Loading...</div>
      ) : (
        <>
          {/* Session Status Card */}
          <Card className="overflow-hidden border-none shadow-md">
            <div className={`p-1 ${currentSession ? 'bg-green-500' : 'bg-amber-500'}`}></div>
            <CardHeader className="pb-2">
              <div className="flex justify-between items-center">
                <div>
                  <CardTitle className="text-2xl font-bold">Cash Drawer</CardTitle>
                  <CardDescription>
                    {currentSession 
                      ? `Session opened ${new Date(currentSession.createdAt).toLocaleString()}`
                      : 'No active session'}
                  </CardDescription>
                </div>
                <div className={`px-4 py-2 rounded-full text-white text-sm font-medium ${currentSession ? 'bg-green-500' : 'bg-amber-500'}`}>
                  {currentSession ? 'OPEN' : 'CLOSED'}
                </div>
              </div>
            </CardHeader>
            
            {currentSession && (
              <CardContent className="pb-3">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-2">
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg min-w-[180px]">
                    <div className="text-sm text-muted-foreground mb-1">Opening Amount</div>
                    <div className="text-lg font-bold truncate">{formatCurrency(summary.openAmount)}</div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg min-w-[180px]">
                    <div className="text-sm text-muted-foreground mb-1">Net Transactions</div>
                    <div className="text-lg font-bold truncate">{formatCurrency(summary.payIns - summary.payOuts)}</div>
                    <div className="text-xs text-muted-foreground mt-1 space-y-1">
                      <div>
                        <span className="text-green-500">+{formatCurrency(summary.payIns - summary.sales)}</span> / 
                        <span className="text-red-500">-{formatCurrency(summary.payOuts)}</span>
                      </div>
                      <div>
                        <span className="text-blue-500">Sales: +{formatCurrency(summary.sales)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="bg-slate-50 dark:bg-slate-800 p-4 rounded-lg min-w-[180px]">
                    <div className="text-sm text-muted-foreground mb-1">Current Balance</div>
                    <div className="text-lg font-bold truncate">{formatCurrency(summary.total)}</div>
                  </div>
                </div>
              </CardContent>
            )}
            
            <CardFooter className="flex flex-wrap gap-2 pt-2">
              {isLoadingSession ? (
                <div>Loading...</div>
              ) : currentSession ? (
                <div className="space-y-2">
                  <Badge variant="outline" className="text-green-600">
                    <LockOpenIcon className="w-4 h-4 mr-1" />
                    Till Open
                  </Badge>
                  <div>
                    <Label>Opening Amount</Label>
                    <div>{formatCurrency(currentSession.openingAmount)}</div>
                  </div>
                  <div>
                    <Label>Opened By</Label>
                    <div>{currentSession.user?.firstName} {currentSession.user?.lastName}</div>
                  </div>
                  <div>
                    <Label>Opened At</Label>
                    <div>{new Date(currentSession.openedAt).toLocaleString()}</div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <Badge variant="outline" className="text-red-600">
                    <LockClosedIcon className="w-4 h-4 mr-1" />
                    Till Closed
                  </Badge>
                </div>
              )}
              {currentSession ? (
                <>
                  <Button 
                    variant="destructive" 
                    onClick={handleCloseTillClick}
                    className="flex items-center gap-2"
                  >
                    <LockClosedIcon className="h-4 w-4" />
                    Close Till
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      // First open the cash drawer with retry logic
                      try {
                        console.log('Opening cash drawer for Pay In');
                        const printerConfig = await getProxyConfig();
                        // Don't destructure ip and port as they don't exist in the config
                        
                        // Send the open-drawer command to the proxy with retry logic
                        let drawerOpened = false;
                        let retryCount = 0;
                        const maxRetries = 2; // Try up to 3 times (initial + 2 retries)
                        
                        while (!drawerOpened && retryCount <= maxRetries) {
                          try {
                            if (retryCount > 0) {
                              console.log(`Retry attempt ${retryCount} to open drawer for Pay In...`);
                            }
                            
                            const response = await fetch(`${PRINTER_PROXY_URL}/open-drawer`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                // Don't include ip and port, let the proxy use its database configuration
                                skipConnectivityCheck: true,
                                timeout: 5000 // Increase timeout for better reliability
                              })
                            });
                            
                            console.log(`Open drawer response status:`, response.status);
                            const data = await response.json();
                            console.log(`Open drawer response data:`, data);
                            
                            if (response.status === 200 && data.success) {
                              console.log('Drawer opened successfully for Pay In');
                              drawerOpened = true;
                              break;
                            } else {
                              console.error('Failed to open drawer:', data.error || 'Unknown error');
                              retryCount++;
                              
                              if (retryCount <= maxRetries) {
                                // Wait a bit before retrying
                                await new Promise(resolve => setTimeout(resolve, 1000));
                              }
                            }
                          } catch (error) {
                            console.error('Error opening cash drawer for Pay In:', error);
                            retryCount++;
                            
                            if (retryCount <= maxRetries) {
                              // Wait a bit before retrying
                              await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                          }
                        }
                        
                        if (!drawerOpened) {
                          console.warn('Could not open drawer after multiple attempts, continuing anyway');
                        }
                      } catch (drawerError) {
                        console.error('Error in drawer opening process for Pay In:', drawerError);
                        // Continue with opening the dialog even if drawer fails
                      }
                      
                      // Then show the dialog
                      setIsPayInModalOpen(true);
                    }}
                    className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Pay In
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={async () => {
                      // First open the cash drawer with retry logic
                      try {
                        console.log('Opening cash drawer for Pay Out');
                        const printerConfig = await getProxyConfig();
                        // Don't destructure ip and port as they don't exist in the config
                        
                        // Send the open-drawer command to the proxy with retry logic
                        let drawerOpened = false;
                        let retryCount = 0;
                        const maxRetries = 2; // Try up to 3 times (initial + 2 retries)
                        
                        while (!drawerOpened && retryCount <= maxRetries) {
                          try {
                            if (retryCount > 0) {
                              console.log(`Retry attempt ${retryCount} to open drawer for Pay Out...`);
                            }
                            
                            const response = await fetch(`${PRINTER_PROXY_URL}/open-drawer`, {
                              method: 'POST',
                              headers: {
                                'Content-Type': 'application/json'
                              },
                              body: JSON.stringify({
                                // Don't include ip and port, let the proxy use its database configuration
                                skipConnectivityCheck: true,
                                timeout: 5000 // Increase timeout for better reliability
                              })
                            });
                            
                            console.log(`Open drawer response status:`, response.status);
                            const data = await response.json();
                            console.log(`Open drawer response data:`, data);
                            
                            if (response.status === 200 && data.success) {
                              console.log('Drawer opened successfully for Pay Out');
                              drawerOpened = true;
                              break;
                            } else {
                              console.error('Failed to open drawer:', data.error || 'Unknown error');
                              retryCount++;
                              
                              if (retryCount <= maxRetries) {
                                // Wait a bit before retrying
                                await new Promise(resolve => setTimeout(resolve, 1000));
                              }
                            }
                          } catch (error) {
                            console.error('Error opening cash drawer for Pay Out:', error);
                            retryCount++;
                            
                            if (retryCount <= maxRetries) {
                              // Wait a bit before retrying
                              await new Promise(resolve => setTimeout(resolve, 1000));
                            }
                          }
                        }
                        
                        if (!drawerOpened) {
                          console.warn('Could not open drawer after multiple attempts, continuing anyway');
                        }
                      } catch (drawerError) {
                        console.error('Error in drawer opening process for Pay Out:', drawerError);
                        // Continue with opening the dialog even if drawer fails
                      }
                      
                      // Then show the dialog
                      setIsPayOutModalOpen(true);
                    }}
                    className="flex items-center gap-2 border-red-500 text-red-600 hover:bg-red-50"
                  >
                    <MinusIcon className="h-4 w-4" />
                    Pay Out
                  </Button>
                </>
              ) : (
                <Button 
                  className="w-full flex items-center gap-2" 
                  onClick={handleOpenTillClick}
                >
                  <LockOpenIcon className="h-4 w-4" />
                  Open Till
                </Button>
              )}
            </CardFooter>
          </Card>

          {/* Transaction History section removed from here and moved to the right panel in page.tsx */}
        </>
      )}
      {/* Open Till Modal */}
      <Dialog open={isOpenTillModalOpen} onOpenChange={setIsOpenTillModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Open Till</DialogTitle>
            <DialogDescription>
              Enter the opening amount for the till.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="openingAmount">Opening Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="openingAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={openingAmount}
                  onChange={(e) => setOpeningAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsOpenTillModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleOpenTill} disabled={isLoading}>
              {isLoading ? 'Opening...' : 'Open Till'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close Till Modal */}
      <Dialog open={isCloseTillModalOpen} onOpenChange={setIsCloseTillModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Close Till</DialogTitle>
            <DialogDescription>
              Enter the closing amount for the till.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="closingAmount">Closing Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="closingAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={closingAmount}
                  onChange={(e) => setClosingAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
              {currentSession && (
                <div className="space-y-1 text-sm mt-2">
                  <div className="text-muted-foreground">
                    <strong>Expected Cash in Drawer:</strong> <span className="font-medium">{formatCurrency(summary.total)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    <div>Opening amount: {formatCurrency(summary.openAmount)}</div>
                    <div>+ Cash added: {formatCurrency(summary.payIns - summary.cashSales)}</div>
                    <div>+ Cash sales: {formatCurrency(summary.cashSales)}</div>
                    <div>- Cash removed: {formatCurrency(summary.payOuts)}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloseTillModalOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleSubmitClosingAmount} disabled={isSubmitting}>
              {isSubmitting ? 'Closing...' : 'Close Till'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay In Modal */}
      <Dialog open={isPayInModalOpen} onOpenChange={setIsPayInModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircleIcon className="h-5 w-5 text-green-500" />
              Pay In
            </DialogTitle>
            <DialogDescription>
              Enter the amount to pay in.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payAmount">Pay In Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="payAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payNote">Note (Optional)</Label>
              <Textarea
                id="payNote"
                placeholder="Add a note about this pay in"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayInModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePayIn} 
              disabled={isLoading}
              className="bg-green-600 hover:bg-green-700"
            >
              {isLoading ? 'Processing...' : 'Pay In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Pay Out Modal */}
      <Dialog open={isPayOutModalOpen} onOpenChange={setIsPayOutModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MinusCircleIcon className="h-5 w-5 text-red-500" />
              Pay Out
            </DialogTitle>
            <DialogDescription>
              Enter the amount to pay out.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="payAmount">Pay Out Amount</Label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  id="payAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="payNote">Note (Optional)</Label>
              <Textarea
                id="payNote"
                placeholder="Add a note about this pay out"
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPayOutModalOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handlePayOut} 
              disabled={isLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {isLoading ? 'Processing...' : 'Pay Out'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}