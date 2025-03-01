'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { HardwareService, Port, CashDrawer } from '@/services/hardware.service';
import { drawerService, DrawerSession, DrawerOperation } from '@/services/drawer.service';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { NetworkDrawerManager } from './network-drawer';
import { 
  Table, 
  TableBody, 
  TableCaption, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";

const hardwareService = HardwareService.getInstance();

export default function DrawerPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading } = useAuth();
  
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [amount, setAmount] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedDrawer, setSelectedDrawer] = useState<CashDrawer | null>(null);
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [currentSession, setCurrentSession] = useState<DrawerSession | null>(null);
  const [sessionHistory, setSessionHistory] = useState<DrawerSession[]>([]);
  const [activeTab, setActiveTab] = useState('hardware');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
    
    if (!loading && user) {
      loadPorts();
      loadCurrentSession();
      loadDrawers();
      loadSessionHistory();
    }
  }, [loading, user, router]);

  const loadPorts = async () => {
    try {
      setIsLoading(true);
      const portsList = await hardwareService.listPorts();
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
        const drawersList = await hardwareService.listCashDrawers();
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
      const drawersList = await hardwareService.listCashDrawers();
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

  const handleBackToPos = () => {
    router.push('/pos');
  };

  const handleConnect = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // If a drawer is selected, connect to it
      if (selectedDrawer) {
        const result = await hardwareService.connectDrawer(selectedDrawer.id);
        
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

      const result = await hardwareService.connectDrawer(selectedPort);
      
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

  const handleOpenDrawer = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // If no drawer is selected, try to use the connected drawer
      const drawerId = selectedDrawer?.id;
      
      const result = await drawerService.openDrawer(drawerId);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: 'Drawer opened',
        });
      } else {
        const errorMsg = result.error || 'Failed to open drawer';
        setErrorMessage(errorMsg);
        toast({
          title: 'Open Drawer Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (err) {
      console.error('Unexpected error opening drawer:', err);
      const errorMsg = err.message || 'An unexpected error occurred';
      setErrorMessage(errorMsg);
      toast({
        title: 'Open Drawer Error',
        description: errorMsg,
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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

  const renderHardwareTab = () => {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Cash Drawer Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label className="mb-2 block">Selected Drawer</Label>
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
                    {drawers.length === 0 ? (
                      <SelectItem value="no-drawers" disabled>No drawers available</SelectItem>
                    ) : (
                      drawers.map(drawer => (
                        <SelectItem key={drawer.id} value={drawer.id}>
                          {drawer.name} ({drawer.connectionType})
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              {!selectedDrawer && (
                <div>
                  <Label className="mb-2 block">Serial Port (Only for direct serial connection)</Label>
                  <Select 
                    value={selectedPort} 
                    onValueChange={setSelectedPort}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a port" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports.length === 0 ? (
                        <SelectItem value="no-ports" disabled>No ports available</SelectItem>
                      ) : (
                        ports.map(port => (
                          <SelectItem key={port.path} value={port.path}>
                            {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex space-x-4">
                <Button 
                  onClick={handleOpenDrawer} 
                  disabled={!selectedDrawer && !selectedPort}
                >
                  Open Drawer
                </Button>
              </div>
              
              {errorMessage && (
                <div className="bg-red-50 border border-red-200 p-4 rounded-md">
                  <h3 className="text-red-800 font-semibold">Error</h3>
                  <p className="text-red-700">{errorMessage}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
        
        <NetworkDrawerManager />
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
                      {drawers.map(drawer => (
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

  return (
    <div className="container mx-auto py-8">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cash Drawer Management</h1>
        <Button variant="outline" onClick={handleBackToPos}>Back to POS</Button>
      </div>
      
      <Tabs defaultValue={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="hardware">Hardware Setup</TabsTrigger>
          <TabsTrigger value="management">Cash Management</TabsTrigger>
        </TabsList>
        
        <TabsContent value="hardware" className="mt-4">
          {renderHardwareTab()}
        </TabsContent>
        
        <TabsContent value="management" className="mt-4">
          {renderCashManagementTab()}
        </TabsContent>
      </Tabs>
    </div>
  );
}
