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
import axios from 'axios';

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

  // Function to get printer configuration including IP and port
  const getProxyConfig = async () => {
    try {
      // Fetch the printer configuration directly from the printer proxy
      // instead of going through the API on Render
      console.log('Fetching printer config from printer proxy:', `${PRINTER_PROXY_URL}/api/printer/config`);
      const response = await fetch(`${PRINTER_PROXY_URL}/api/printer/config`);
      const data = await response.json();
      
      if (data && data.success && data.printer) {
        console.log('Printer config from printer proxy:', data.printer);
        // Return with explicit printer IP and port
        return { 
          ip: data.printer.ipAddress,
          port: data.printer.port,
          skipConnectivityCheck: true // Always skip connectivity check for till operations
        };
      }
      
      // Try to get the printer from the database through the printer proxy
      console.log('Trying to get printer from database through printer proxy');
      try {
        const dbResponse = await fetch(`${PRINTER_PROXY_URL}/api/printer/db-config`);
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
        ip: '192.168.1.14', // Default printer IP - using a more likely network address
        port: 9100,          // Default printer port
        skipConnectivityCheck: true 
      };
    } catch (error) {
      console.error('Error fetching printer config:', error);
      // If there's an error, use default values
      return { 
        ip: '192.168.1.14', // Default printer IP - using a more likely network address
        port: 9100,          // Default printer port
        skipConnectivityCheck: true 
      };
    }
  };

  const handleOpenTillClick = async () => {
    setIsLoading(true);
    try {
      console.log('Opening till - sending open-drawer command to proxy');
      
      // Get proxy configuration (without printer IP/port)
      const proxyConfig = await getProxyConfig();
      
      // Send the open-drawer command to the proxy
      try {
        const response = await axios.post(`${PRINTER_PROXY_URL}/open-drawer`, {
          ...proxyConfig
        });

        if (response.status === 200) {
          console.log('Drawer opened successfully');
        } else {
          console.error('Failed to open drawer:', response.statusText);
        }
      } catch (drawerError) {
        console.error('Error opening cash drawer:', drawerError);
        // Continue with opening the till dialog even if drawer fails
      }

      // Then show the dialog
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

      // Get proxy configuration (without printer IP/port)
      const proxyConfig = await getProxyConfig();

      // Open the drawer only, no receipt printing
      try {
        await axios.post(`${PRINTER_PROXY_URL}/open-drawer`, {
          ...proxyConfig
        });
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
        return;
      }

      // Get proxy configuration (without printer IP/port)
      const proxyConfig = await getProxyConfig();

      const amount = parseFloat(closingAmount);
      const response = await drawerService.closeSession(amount);
      
      if (response) {
        toast.success('Till closed successfully');
        setIsCloseTillModalOpen(false);
        setClosingAmount('');
        
        // Print closing receipt
        try {
          const closingData = {
            closingAmount: amount,
            sessionId: response.id,
            openingAmount: parseFloat(response.openingAmount),
            closedAt: response.closedAt,
            operations: response.operations,
            user: response.user
          };
          
          await axios.post(`${PRINTER_PROXY_URL}/print-only`, {
            type: 'till_close_final',
            data: closingData,
            ...proxyConfig
          });
        } catch (printError) {
          console.error('Error printing closing receipt:', printError);
          // Continue even if printing fails
        }
        
        fetchCurrentSession();
      } else {
        toast.error('Failed to close till. Please try again.');
      }
    } catch (error) {
      console.error('Error closing till:', error);
      let errorMessage = 'Failed to close till';
      
      if (error.response && error.response.data && error.response.data.error) {
        errorMessage = error.response.data.error;
      } else if (error.message) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
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

      console.log('Sending open-drawer command for pay-in');

      // Get proxy configuration (without printer IP/port)
      const proxyConfig = await getProxyConfig();

      // First send open drawer command
      try {
        const response = await axios.post(`${PRINTER_PROXY_URL}/open-drawer`, {
          ...proxyConfig
        });

        if (response.status !== 200) {
          console.error('Failed to open drawer:', response.statusText);
        }
      } catch (printerError) {
        console.error('Error opening cash drawer:', printerError);
        // Continue with the pay-in operation even if drawer fails
      }

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

      console.log('Sending open-drawer command for pay-out');

      // Get proxy configuration (without printer IP/port)
      const proxyConfig = await getProxyConfig();

      // First send open drawer command
      try {
        const response = await axios.post(`${PRINTER_PROXY_URL}/open-drawer`, {
          ...proxyConfig
        });

        if (response.status !== 200) {
          console.error('Failed to open drawer:', response.statusText);
        }
      } catch (printerError) {
        console.error('Error opening cash drawer:', printerError);
        // Continue with the pay-out operation even if drawer fails
      }

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
    if (!currentSession) return { total: 0, payIns: 0, payOuts: 0, sales: 0 };
    
    let payIns = 0;
    let payOuts = 0;
    let sales = 0;
    
    if (transactions && transactions.length > 0) {
      transactions.forEach(tx => {
        const amount = parseFloat(tx.amount) || 0;
        
        if (tx.type === 'ADD' || tx.type === 'ADD_CASH') {
          payIns += amount;
        } else if (tx.type === 'REMOVE' || tx.type === 'REMOVE_CASH') {
          payOuts += amount;
        } else if (tx.type === 'SALE') {
          // Cash sales are incoming cash, so they increase the balance
          sales += amount;
          payIns += amount; // Include sales in total pay ins for balance calculation
        }
      });
    }
    
    const openAmount = parseFloat(currentSession.openingAmount) || 0;
    const total = openAmount + payIns - payOuts;
    
    return { total, payIns, payOuts, openAmount, sales };
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
                    onClick={() => setIsPayInModalOpen(true)}
                    className="flex items-center gap-2 border-green-500 text-green-600 hover:bg-green-50"
                  >
                    <PlusIcon className="h-4 w-4" />
                    Pay In
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={() => setIsPayOutModalOpen(true)}
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
                <div className="text-sm text-muted-foreground mt-2">
                  Expected amount: <span className="font-medium">{formatCurrency(summary.total)}</span>
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
