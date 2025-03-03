'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/components/ui/use-toast";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow 
} from "@/components/ui/table";
import { HardwareService, Port, CashDrawer, Printer } from '@/services/hardware.service';
import { drawerService, DrawerSession, DrawerOperation, DrawerLog } from '@/services/drawer.service';
import { RefreshCcw, Search, PlusCircle } from 'react-feather';

// Create hardwareService instance properly
const hardwareServiceInstance = HardwareService.getInstance();

export default function DrawerPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user: authUser, loading: authLoading } = useAuth();
  const [user, setUser] = useState<any>(null);

  const [activeTab, setActiveTab] = useState<string>('hardware');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isDrawerOpening, setIsDrawerOpening] = useState<boolean>(false);
  const [scanningPrinters, setScanningPrinters] = useState<boolean>(false);
  
  const [ports, setPorts] = useState<Port[]>([]);
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [selectedDrawer, setSelectedDrawer] = useState<CashDrawer | null>(null);
  const [usbPrinters, setUsbPrinters] = useState<Printer[]>([]);
  const [networkPrinters, setNetworkPrinters] = useState<Printer[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>("");
  const [currentSession, setCurrentSession] = useState<DrawerSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<DrawerSession[]>([]);
  const [drawerLogs, setDrawerLogs] = useState<DrawerLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [printerTab, setPrinterTab] = useState<string>('usb');

  useEffect(() => {
    if (!authLoading && !authUser) {
      router.push('/login');
    } else if (authUser) {
      setUser(authUser);
      loadDrawers();
      loadDrawerLogs();
      loadPorts();
      loadPrinters();
      loadCurrentSession();
      loadSessionHistory();
      scanNetworkPrinters();
    }
  }, [authLoading, authUser, router]);

  useEffect(() => {
    // This will reload printers when navigating back from the printer page
    const handleFocus = () => {
      console.log('Window focused - reloading printers');
      loadPrinters();
    };

    // Add event listener for window focus
    window.addEventListener('focus', handleFocus);
    
    // Immediate load on component mount
    loadPrinters();
    
    // Cleanup the event listener when component unmounts
    return () => {
      window.removeEventListener('focus', handleFocus);
    };
  }, []);

  const loadPorts = async () => {
    try {
      setIsLoading(true);
      const portsList = await hardwareServiceInstance.listPorts();
      console.log('Available ports:', portsList);
      setPorts(portsList);
      
      // If no ports are available, show a message but don't treat it as an error
      if (portsList.length === 0) {
        console.log('No serial ports detected. Network drawers can still be used.');
      }
      
      setErrorMessage(null);
    } catch (error) {
      console.error('Error loading ports:', error);
      setErrorMessage('Failed to load available ports. Network drawers can still be used.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadCurrentSession = async () => {
    try {
      const session = await drawerService.getCurrentSession();
      setCurrentSession(session);
      
      // If there's a session with a cash drawer, check if we can find it in the drawers list
      if (session?.drawerId) {
        const drawersList = await hardwareServiceInstance.listCashDrawers();
        const drawer = drawersList.find(d => d.id === session.drawerId);
        if (drawer) {
          setSelectedDrawer(drawer);
        }
      }
    } catch (error) {
      console.error('Error loading current session:', error);
    }
  };

  const loadDrawers = async () => {
    try {
      const drawersList = await hardwareServiceInstance.listCashDrawers();
      setDrawers(drawersList);
    } catch (error) {
      console.error('Error loading drawers:', error);
    }
  };
  
  const loadSessionHistory = async () => {
    try {
      const history = await drawerService.getSessionHistory();
      setSessionHistory(history);
    } catch (error) {
      console.error('Error loading session history:', error);
    }
  };

  const loadDrawerLogs = async (drawerId?: string) => {
    try {
      setLogsLoading(true);
      const response = await drawerService.getDrawerLogs(drawerId);
      setDrawerLogs(response.logs || []);
    } catch (error) {
      console.error('Error loading drawer logs:', error);
      toast({
        title: 'Error',
        description: 'Failed to load drawer logs',
        variant: 'destructive',
      });
    } finally {
      setLogsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'logs' && selectedDrawer) {
      loadDrawerLogs(selectedDrawer.id);
    } else if (activeTab === 'logs') {
      loadDrawerLogs();
    }
  }, [activeTab, selectedDrawer]);

  const handleBackToPos = () => {
    router.push('/pos');
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // If a drawer is selected, connect to it
      if (selectedDrawer) {
        const result = await hardwareServiceInstance.connectDrawer(selectedDrawer.id);
        
        if (result.success) {
          toast({
            title: 'Success',
            description: `Connected to ${selectedDrawer.name}`,
          });
        } else {
          const errorMsg = result.error || `Failed to connect to ${selectedDrawer.name}`;
          setErrorMessage(errorMsg);
          toast({
            title: 'Connection Error',
            description: errorMsg,
            variant: 'destructive',
          });
        }
        setIsLoading(false);
        return;
      }
      
      // Otherwise connect to the selected port
      if (!selectedPort) {
        toast({
          title: 'Error',
          description: 'Please select a port or a drawer',
          variant: 'destructive',
        });
        setIsLoading(false);
        return;
      }

      const result = await hardwareServiceInstance.connectDrawer(selectedPort);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Connected to drawer',
        });
      } else {
        const errorMsg = result.error || 'Failed to connect to drawer';
        setErrorMessage(errorMsg);
        toast({
          title: 'Connection Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Unexpected error during connection:', err);
      const errorMsg = err.message || 'An unexpected error occurred';
      setErrorMessage(errorMsg);
      toast({
        title: 'Connection Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectUsbDrawer = async () => {
    if (!selectedPort) {
      toast({
        title: "Error",
        description: "Please select a port to connect",
        variant: "destructive"
      });
      return;
    }

    try {
      setIsLoading(true);
      const result = await hardwareServiceInstance.connectDrawer(selectedPort);
      
      if (result.success) {
        toast({
          title: "Success",
          description: "Connected to drawer on port " + selectedPort,
        });
        loadDrawers();
      } else {
        toast({
          title: "Error",
          description: result.error || "Failed to connect to drawer",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error('Error connecting drawer:', error);
      toast({
        title: "Error",
        description: "Failed to connect to drawer",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDrawer = async () => {
    if (!selectedDrawer) {
      toast({
        title: "Error",
        description: "No drawer selected",
        variant: "destructive"
      });
      return;
    }
    
    try {
      setIsDrawerOpening(true);
      const response = await hardwareServiceInstance.openCashDrawer(selectedDrawer.id);
      
      if (response.success) {
        toast({
          title: "Success",
          description: "Cash drawer opened successfully",
        });
      } else {
        // Show error notification with details if available
        toast({
          title: "Error",
          description: response.details || "Failed to open cash drawer",
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Error opening cash drawer:", error);
      
      // Get detailed error message if available
      let errorMessage = "Failed to open cash drawer";
      if (error.response && error.response.data) {
        errorMessage = error.response.data.details || error.response.data.error || errorMessage;
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setIsDrawerOpening(false);
    }
  };

  const handleOpenSession = async () => {
    if (!amount) {
      toast({
        title: 'Error',
        description: 'Please enter an opening amount',
        variant: 'destructive',
      });
      return;
    }

    if (!selectedDrawer) {
      toast({
        title: 'Error',
        description: 'Please select a cash drawer',
        variant: 'destructive',
      });
      return;
    }

    try {
      const session = await drawerService.openSession(parseFloat(amount), selectedDrawer.id);
      if (session) {
        setCurrentSession(session);
        setAmount('');
        setNotes('');
        toast({
          title: 'Success',
          description: 'Drawer session opened successfully',
        });
        
        // Refresh the session history
        loadSessionHistory();
      }
    } catch (error) {
      console.error('Error opening session:', error);
      toast({
        title: 'Error',
        description: 'Failed to open drawer session',
        variant: 'destructive',
      });
    }
  };

  const handleCloseSession = async () => {
    if (!amount) {
      toast({
        title: 'Error',
        description: 'Please enter a closing amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      const session = await drawerService.closeSession(parseFloat(amount));
      if (session) {
        setCurrentSession(null);
        setAmount('');
        setNotes('');
        toast({
          title: 'Success',
          description: 'Drawer session closed successfully',
        });
        
        // Refresh the session history
        loadSessionHistory();
      }
    } catch (error) {
      console.error('Error closing session:', error);
      toast({
        title: 'Error',
        description: 'Failed to close drawer session',
        variant: 'destructive',
      });
    }
  };

  const handleAddCash = async () => {
    if (!amount) {
      toast({
        title: 'Error',
        description: 'Please enter an amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      const operation = await drawerService.addCash(parseFloat(amount), notes);
      if (operation) {
        setAmount('');
        setNotes('');
        toast({
          title: 'Success',
          description: 'Cash added successfully',
        });
        
        // Refresh the current session
        loadCurrentSession();
      }
    } catch (error) {
      console.error('Error adding cash:', error);
      toast({
        title: 'Error',
        description: 'Failed to add cash',
        variant: 'destructive',
      });
    }
  };

  const handleRemoveCash = async () => {
    if (!amount) {
      toast({
        title: 'Error',
        description: 'Please enter an amount',
        variant: 'destructive',
      });
      return;
    }

    try {
      const operation = await drawerService.removeCash(parseFloat(amount), notes);
      if (operation) {
        setAmount('');
        setNotes('');
        toast({
          title: 'Success',
          description: 'Cash removed successfully',
        });
        
        // Refresh the current session
        loadCurrentSession();
      }
    } catch (error) {
      console.error('Error removing cash:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove cash',
        variant: 'destructive',
      });
    }
  };

  const loadPrinters = async () => {
    try {
      console.log('Loading printers...');
      const printers = await hardwareServiceInstance.listPrinters();
      
      // Log the received printers for debugging
      console.log('Received printers:', printers);
      
      if (!printers || printers.length === 0) {
        console.log('No printers found');
        setUsbPrinters([]);
        setNetworkPrinters([]);
        return;
      }
      
      // Separate USB and Network printers
      const usbDevices = printers.filter(p => p.connectionType === 'USB');
      const networkDevices = printers.filter(p => p.connectionType === 'NETWORK');
      
      console.log('USB printers:', usbDevices);
      console.log('Network printers:', networkDevices);
      
      setUsbPrinters(usbDevices);
      setNetworkPrinters(networkDevices);
    } catch (error) {
      console.error('Error loading printers:', error);
      toast({
        title: "Error",
        description: "Failed to load printers. Please try again.",
        variant: "destructive"
      });
    }
  };

  const scanNetworkPrinters = async () => {
    try {
      setScanningPrinters(true);
      const printers = await hardwareServiceInstance.scanForNetworkPrinters();
      setNetworkPrinters(printers);
      
      toast({
        title: "Network Scan Complete",
        description: `Found ${printers.length} network printer${printers.length === 1 ? '' : 's'}.`,
      });
    } catch (error) {
      console.error('Error scanning for network printers:', error);
      toast({
        title: "Scan Failed",
        description: "Could not scan for network printers. Please check your connection.",
        variant: "destructive"
      });
    } finally {
      setScanningPrinters(false);
    }
  };

  const renderHardwareTab = () => {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Cash Drawer Connection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {selectedDrawer ? (
                <div className="mb-4">
                  <h3 className="text-lg font-medium">Selected Drawer: {selectedDrawer.name}</h3>
                  <p className="text-sm text-gray-500">
                    Connection Type: {selectedDrawer.connectionType}
                    {selectedDrawer.connectionType === 'NETWORK' && selectedDrawer.ipAddress && (
                      <span> - {selectedDrawer.ipAddress}:{selectedDrawer.port}</span>
                    )}
                    {selectedDrawer.connectionType === 'PRINTER' && selectedDrawer.printer?.name && (
                      <span> - Connected to {selectedDrawer.printer.name}</span>
                    )}
                  </p>
                </div>
              ) : (
                <div className="mb-4">
                  <p>No drawer selected. Please select a drawer from the list below.</p>
                </div>
              )}
              
              <div className="grid gap-4">
                <div>
                  <Label htmlFor="drawer">Cash Drawer</Label>
                  <Select value={selectedDrawer?.id || ''} onValueChange={(value) => {
                    const drawer = drawers.find(d => d.id === value);
                    setSelectedDrawer(drawer || null);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a cash drawer" />
                    </SelectTrigger>
                    <SelectContent>
                      {drawers.map((drawer) => (
                        <SelectItem key={drawer.id} value={drawer.id}>
                          {drawer.name} ({drawer.connectionType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-center space-x-2">
                  <Button 
                    onClick={handleConnect} 
                    disabled={isLoading || !selectedDrawer}
                    className="w-full md:w-auto"
                  >
                    {isLoading ? 'Connecting...' : 'Connect'}
                  </Button>
                  
                  <Button 
                    onClick={handleOpenDrawer} 
                    disabled={isLoading || isDrawerOpening || !selectedDrawer}
                    variant="secondary"
                    className="w-full md:w-auto"
                  >
                    {isDrawerOpening ? (
                      <>
                        <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Opening...
                      </>
                    ) : (
                      'Open Drawer'
                    )}
                  </Button>
                </div>
                
                {errorMessage && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded text-red-600 text-sm">
                    <p className="font-medium">Connection Error</p>
                    <p>{errorMessage}</p>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Available Drawers</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Connection Details</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawers.length > 0 ? (
                    drawers.map((drawer) => (
                      <TableRow key={drawer.id}>
                        <TableCell>{drawer.name}</TableCell>
                        <TableCell>{drawer.connectionType}</TableCell>
                        <TableCell>
                          {drawer.connectionType === 'NETWORK' && drawer.ipAddress && (
                            <span>{drawer.ipAddress}:{drawer.port}</span>
                          )}
                          {drawer.connectionType === 'PRINTER' && drawer.printer?.name && (
                            <div>
                              <p>Printer: {drawer.printer.name}</p>
                              {drawer.printer.connectionType === 'NETWORK' && drawer.printer.ipAddress && (
                                <p className="text-xs text-green-600">WiFi: {drawer.printer.ipAddress}:{drawer.printer.port || 9100}</p>
                              )}
                              {drawer.printer.connectionType === 'USB' && (
                                <p className="text-xs">USB Connection</p>
                              )}
                            </div>
                          )}
                          {drawer.connectionType === 'SERIAL' && drawer.serialPath && (
                            <span>{drawer.serialPath}</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              onClick={() => setSelectedDrawer(drawer)}
                            >
                              Select
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center">
                        No cash drawers configured. Add one from the Printer page.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader>
            <CardTitle>Network Printer Detection</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <p className="text-sm">
                Scan for configured network printers that can be used with cash drawers.
              </p>
              
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-medium">Network Printers</h4>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    onClick={loadPrinters}
                    size="sm"
                  >
                    <RefreshCcw className="h-4 w-4 mr-1" />
                    Refresh List
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={scanNetworkPrinters}
                    disabled={isLoading || scanningPrinters}
                    size="sm"
                  >
                    {scanningPrinters ? (
                      <>
                        <svg className="mr-2 h-4 w-4 animate-spin" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Scanning...
                      </>
                    ) : (
                      <>
                        <Search className="h-4 w-4 mr-1" />
                        Scan Network
                      </>
                    )}
                  </Button>
                  <Button 
                    variant="secondary" 
                    onClick={() => router.push('/printer')}
                    size="sm"
                  >
                    <PlusCircle className="h-4 w-4 mr-1" />
                    Add New Printer
                  </Button>
                </div>
              </div>
              
              {networkPrinters.length > 0 ? (
                <div className="border rounded-md p-4 mt-4">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-[50px]">Default</TableHead>
                        <TableHead>Name</TableHead>
                        <TableHead>IP Address</TableHead>
                        <TableHead>Port</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {networkPrinters.map((printer) => (
                        <TableRow key={printer.id}>
                          <TableCell>
                            {printer.isDefault && (
                              <span className="inline-block w-3 h-3 bg-green-500 rounded-full" title="Default Printer" />
                            )}
                          </TableCell>
                          <TableCell>{printer.name}</TableCell>
                          <TableCell>{printer.ipAddress}</TableCell>
                          <TableCell>{printer.port}</TableCell>
                          <TableCell>
                            <span className="capitalize">{printer.printerType.toLowerCase()}</span>
                          </TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => {
                                // Handle connecting printer to drawer logic here
                                if (selectedDrawer) {
                                  const updatedDrawer = {
                                    ...selectedDrawer,
                                    printerId: printer.id,
                                    connectionType: 'PRINTER'
                                  };
                                  
                                  hardwareServiceInstance.updateCashDrawer(selectedDrawer.id, updatedDrawer)
                                    .then(() => {
                                      loadDrawers();
                                      toast({
                                        title: "Success",
                                        description: `Connected printer ${printer.name} to drawer`,
                                      });
                                    })
                                    .catch(error => {
                                      console.error('Error connecting printer to drawer:', error);
                                      toast({
                                        title: "Error",
                                        description: "Failed to connect printer to drawer",
                                        variant: "destructive"
                                      });
                                    });
                                } else {
                                  toast({
                                    title: "Error",
                                    description: "Please select a drawer first",
                                    variant: "destructive"
                                  });
                                }
                              }}
                            >
                              Connect to Drawer
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="border rounded-md p-6 mt-4 text-center">
                  <p className="text-muted-foreground">No network printers found. Click "Scan Network" to search for printers or add a new printer.</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderCashManagementTab = () => {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Current Session</CardTitle>
          </CardHeader>
          <CardContent>
            {currentSession ? (
              <div className="space-y-4">
                <div>
                  <p><strong>Status:</strong> {currentSession.status}</p>
                  <p><strong>Opening Amount:</strong> ${currentSession.openAmount != null ? currentSession.openAmount.toFixed(2) : '0.00'}</p>
                  {currentSession.operations && (
                    <p><strong>Operations:</strong> {currentSession.operations.length}</p>
                  )}
                  <p><strong>Created At:</strong> {new Date(currentSession.createdAt).toLocaleString()}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Amount</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="0.00" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input 
                    id="notes" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Enter notes here" 
                  />
                </div>

                <div className="flex space-x-4">
                  <Button onClick={handleAddCash}>Add Cash</Button>
                  <Button onClick={handleRemoveCash} variant="outline">Remove Cash</Button>
                  <Button onClick={handleCloseSession} variant="destructive">Close Session</Button>
                </div>
              </div>
            ) : drawers.length > 0 ? (
              <div className="space-y-4">
                <p>No active session. Open a new session:</p>
                
                <div className="space-y-2">
                  <Label htmlFor="drawer">Select Drawer</Label>
                  <Select 
                    value={selectedDrawer?.id || ''} 
                    onValueChange={(value) => {
                      const drawer = drawers.find(d => d.id === value) || null;
                      setSelectedDrawer(drawer);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a cash drawer" />
                    </SelectTrigger>
                    <SelectContent>
                      {drawers.map((drawer) => (
                        <SelectItem key={drawer.id} value={drawer.id}>
                          {drawer.name} ({drawer.connectionType})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="amount">Opening Amount</Label>
                  <Input 
                    id="amount" 
                    type="number" 
                    step="0.01" 
                    min="0" 
                    value={amount} 
                    onChange={(e) => setAmount(e.target.value)} 
                    placeholder="0.00" 
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Notes (Optional)</Label>
                  <Input 
                    id="notes" 
                    value={notes} 
                    onChange={(e) => setNotes(e.target.value)} 
                    placeholder="Enter notes here" 
                  />
                </div>

                <Button onClick={handleOpenSession}>Open Session</Button>
              </div>
            ) : (
              <div>
                <p>No drawers available. Please add a cash drawer first.</p>
                <Button 
                  onClick={() => setActiveTab('hardware')} 
                  className="mt-4"
                >
                  Configure Drawers
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session History</CardTitle>
          </CardHeader>
          <CardContent>
            {sessionHistory.length === 0 ? (
              <p>No session history available.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Opening</TableHead>
                    <TableHead>Closing</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessionHistory.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>{new Date(session.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell>{session.status}</TableCell>
                      <TableCell>${session.openAmount != null ? session.openAmount.toFixed(2) : '0.00'}</TableCell>
                      <TableCell>
                        {session.closeAmount != null
                          ? `$${session.closeAmount.toFixed(2)}` 
                          : '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  const renderDrawerLogsTab = () => {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Drawer Activity Logs</CardTitle>
          </CardHeader>
          <CardContent>
            {selectedDrawer && (
              <div className="mb-4">
                <h3 className="text-lg font-medium">Selected Drawer: {selectedDrawer.name}</h3>
              </div>
            )}
            
            {logsLoading ? (
              <div className="flex justify-center py-8">
                <p>Loading logs...</p>
              </div>
            ) : drawerLogs.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Time</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Action</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {drawerLogs.map((log) => (
                    <TableRow key={log.id}>
                      <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                      <TableCell>{log.user?.name || log.userId}</TableCell>
                      <TableCell>{log.action}</TableCell>
                      <TableCell>
                        {log.success ? (
                          <span className="text-green-600">Success</span>
                        ) : (
                          <span className="text-red-600">Failed - {log.error}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <div className="flex justify-center py-8">
                <p>No logs found.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cash Drawer Management</h1>
        <Button variant="outline" onClick={handleBackToPos}>Back to POS</Button>
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="hardware">Hardware Setup</TabsTrigger>
          <TabsTrigger value="management">Cash Management</TabsTrigger>
          <TabsTrigger value="logs">Drawer Logs</TabsTrigger>
        </TabsList>
        
        <TabsContent value="hardware" className="mt-4">
          {renderHardwareTab()}
        </TabsContent>
        
        <TabsContent value="management" className="mt-4">
          {renderCashManagementTab()}
        </TabsContent>
        
        <TabsContent value="logs" className="mt-4">
          {renderDrawerLogsTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
