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
      
      // Check if a drawer is already connected
      const isDrawerConnected = hardwareService.isDrawerConnected();
      setIsConnected(isDrawerConnected);
    }
  }, [loading, user, router]);

  const loadPorts = async () => {
    try {
      const portsList = await hardwareService.listPorts();
      setPorts(portsList);
    } catch (error) {
      console.error('Error loading ports:', error);
    }
  };

  const loadCurrentSession = async () => {
    try {
      const session = await drawerService.getCurrentSession();
      setCurrentSession(session);
      
      // If there's a session with a cash drawer, select it
      if (session?.cashDrawer) {
        setSelectedDrawer(session.cashDrawer);
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
      // If a drawer is selected, connect to it
      if (selectedDrawer) {
        const connected = await hardwareService.connectDrawer(selectedDrawer.id);
        setIsConnected(connected);
        
        if (connected) {
          toast({
            title: 'Success',
            description: `Connected to ${selectedDrawer.name}`,
          });
        } else {
          toast({
            title: 'Error',
            description: `Failed to connect to ${selectedDrawer.name}`,
            variant: 'destructive',
          });
        }
        return;
      }
      
      // Otherwise connect to the selected port
      if (!selectedPort) {
        toast({
          title: 'Error',
          description: 'Please select a port',
          variant: 'destructive',
        });
        return;
      }

      const connected = await hardwareService.connectDrawer(selectedPort);
      setIsConnected(connected);
      
      if (connected) {
        toast({
          title: 'Success',
          description: 'Connected to drawer',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to connect to drawer',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error connecting to drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to drawer',
        variant: 'destructive',
      });
    }
  };

  const handleOpenDrawer = async () => {
    try {
      const opened = await hardwareService.openDrawer();
      
      if (opened) {
        toast({
          title: 'Success',
          description: 'Drawer opened',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to open drawer',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error opening drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to open drawer',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await hardwareService.disconnectDrawer();
      setIsConnected(false);
      toast({
        title: 'Success',
        description: 'Disconnected from drawer',
      });
    } catch (error) {
      console.error('Error disconnecting from drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect from drawer',
        variant: 'destructive',
      });
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

    try {
      const session = await drawerService.openSession(parseFloat(amount), selectedDrawer?.id, notes);
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
      const session = await drawerService.closeSession(parseFloat(amount), notes);
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
        loadCurrentSession();
        setAmount('');
        setNotes('');
        toast({
          title: 'Success',
          description: 'Cash added successfully',
        });
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

  const handleTakeCash = async () => {
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
        loadCurrentSession();
        setAmount('');
        setNotes('');
        toast({
          title: 'Success',
          description: 'Cash removed successfully',
        });
      }
    } catch (error) {
      console.error('Error taking cash:', error);
      toast({
        title: 'Error',
        description: 'Failed to remove cash',
        variant: 'destructive',
      });
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Cash Drawer Management</h1>
        <Button variant="outline" onClick={handleBackToPos}>
          Back to POS
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid grid-cols-4 mb-4">
          <TabsTrigger value="hardware">Hardware Control</TabsTrigger>
          <TabsTrigger value="session">Session Management</TabsTrigger>
          <TabsTrigger value="network">Network Drawer</TabsTrigger>
          <TabsTrigger value="history">Session History</TabsTrigger>
        </TabsList>
        
        <TabsContent value="hardware">
          <Card>
            <CardHeader>
              <CardTitle>Hardware Control</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Select Port</Label>
                  <Select value={selectedPort} onValueChange={setSelectedPort}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a port" />
                    </SelectTrigger>
                    <SelectContent>
                      {ports && ports.map((port) => (
                        <SelectItem key={port.path} value={port.path}>
                          {port.path} {port.manufacturer ? `(${port.manufacturer})` : ''}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedPort && ports.find(p => p.path === selectedPort) && (
                    <div className="text-sm text-gray-500">
                      <p>Manufacturer: {ports.find(p => p.path === selectedPort)?.manufacturer || 'N/A'}</p>
                      <p>Serial Number: {ports.find(p => p.path === selectedPort)?.serialNumber || 'N/A'}</p>
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  <Label>Select Network Drawer</Label>
                  <Select value={selectedDrawer?.id || 'none'} onValueChange={(value) => {
                    if (value === 'none') {
                      setSelectedDrawer(null);
                      return;
                    }
                    const drawer = drawers.find(d => d.id === value);
                    setSelectedDrawer(drawer || null);
                  }}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a network drawer" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None</SelectItem>
                      {drawers.filter(d => d.connectionType === 'NETWORK').map((drawer) => (
                        <SelectItem key={drawer.id} value={drawer.id}>
                          {drawer.name} ({drawer.ipAddress}:{drawer.port})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedDrawer && (
                    <div className="text-sm text-gray-500">
                      <p>Connection Type: {selectedDrawer.connectionType}</p>
                      {selectedDrawer.connectionType === 'NETWORK' && (
                        <p>IP Address: {selectedDrawer.ipAddress}:{selectedDrawer.port}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
              
              <div className="space-x-2">
                {!isConnected ? (
                  <Button onClick={handleConnect} disabled={!selectedPort && !selectedDrawer}>
                    Connect
                  </Button>
                ) : (
                  <>
                    <Button onClick={handleOpenDrawer}>
                      Open Drawer
                    </Button>
                    <Button onClick={handleDisconnect} variant="destructive">
                      Disconnect
                    </Button>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="session">
          <Card>
            <CardHeader>
              <CardTitle>Session Management</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {currentSession ? (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Session Status</Label>
                      <p className="mt-1">Opening Amount: {formatCurrency(currentSession.openingAmount)}</p>
                      <p>Status: <span className="font-medium">{currentSession.status}</span></p>
                      <p>Opened At: {formatDate(currentSession.openedAt)}</p>
                      {currentSession.cashDrawer && (
                        <p>Cash Drawer: <span className="font-medium">{currentSession.cashDrawer.name}</span></p>
                      )}
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Amount (AED)</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter amount in AED"
                        step="0.01"
                        min="0"
                      />
                      <Label>Notes</Label>
                      <Input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Enter notes (e.g., reason for adding/removing cash)"
                      />
                      <div className="flex space-x-2 mt-2">
                        <Button onClick={handleAddCash}>Add Cash</Button>
                        <Button onClick={handleTakeCash}>Remove Cash</Button>
                        <Button onClick={handleCloseSession} variant="destructive">
                          Close Session
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {currentSession.operations && currentSession.operations.length > 0 && (
                    <div className="mt-4">
                      <h3 className="text-lg font-medium mb-2">Operations</h3>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Type</TableHead>
                            <TableHead>Amount</TableHead>
                            <TableHead>Notes</TableHead>
                            <TableHead>Time</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {currentSession.operations.map((op) => (
                            <TableRow key={op.id}>
                              <TableCell>{op.type}</TableCell>
                              <TableCell>{formatCurrency(op.amount)}</TableCell>
                              <TableCell>{op.notes || '-'}</TableCell>
                              <TableCell>{formatDate(op.createdAt)}</TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Opening Amount (AED)</Label>
                      <Input
                        type="number"
                        value={amount}
                        onChange={(e) => setAmount(e.target.value)}
                        placeholder="Enter opening amount in AED"
                        step="0.01"
                        min="0"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Input
                        type="text"
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Enter notes"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <Label>Select Cash Drawer (Optional)</Label>
                      <Select value={selectedDrawer?.id || 'none'} onValueChange={(value) => {
                        if (value === 'none') {
                          setSelectedDrawer(null);
                          return;
                        }
                        const drawer = drawers.find(d => d.id === value);
                        setSelectedDrawer(drawer || null);
                      }}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a cash drawer" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">None</SelectItem>
                          {drawers.map((drawer) => (
                            <SelectItem key={drawer.id} value={drawer.id}>
                              {drawer.name} ({drawer.connectionType})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <Button onClick={handleOpenSession} className="mt-2">Open Session</Button>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="network">
          <NetworkDrawerManager />
        </TabsContent>
        
        <TabsContent value="history">
          <Card>
            <CardHeader>
              <CardTitle>Session History</CardTitle>
            </CardHeader>
            <CardContent>
              {sessionHistory.length === 0 ? (
                <div className="text-center p-4 text-gray-500">
                  No session history available.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Opened At</TableHead>
                      <TableHead>Closed At</TableHead>
                      <TableHead>Opening Amount</TableHead>
                      <TableHead>Closing Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Cash Drawer</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sessionHistory.map((session) => (
                      <TableRow key={session.id}>
                        <TableCell>{formatDate(session.openedAt)}</TableCell>
                        <TableCell>{session.closedAt ? formatDate(session.closedAt) : '-'}</TableCell>
                        <TableCell>{formatCurrency(session.openingAmount)}</TableCell>
                        <TableCell>{session.closingAmount ? formatCurrency(session.closingAmount) : '-'}</TableCell>
                        <TableCell>{session.status}</TableCell>
                        <TableCell>{session.cashDrawer ? session.cashDrawer.name : '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
