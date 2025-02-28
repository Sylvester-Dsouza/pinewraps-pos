'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { HardwareService, Port } from '@/services/hardware.service';
import { drawerService, DrawerSession, DrawerOperation } from '@/services/drawer.service';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/use-auth';

const hardwareService = HardwareService.getInstance();

const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-AE', {
    style: 'currency',
    currency: 'AED',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(amount);
};

export default function DrawerPage() {
  const { toast } = useToast();
  const router = useRouter();
  const { user, loading } = useAuth();
  const [ports, setPorts] = useState<Port[]>([]);
  const [selectedPort, setSelectedPort] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentSession, setCurrentSession] = useState<DrawerSession | null>(null);
  const [amount, setAmount] = useState('');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
      return;
    }

    if (!loading && user) {
      loadPorts();
      loadCurrentSession();
    }
  }, [loading, user, router]);

  const loadPorts = async () => {
    try {
      const response = await hardwareService.listPorts();
      setPorts(response || []);
    } catch (error) {
      console.error('Error loading ports:', error);
      toast({
        title: 'Error',
        description: 'Failed to load available ports',
        variant: 'destructive',
      });
    }
  };

  const loadCurrentSession = async () => {
    try {
      const session = await drawerService.getCurrentSession();
      setCurrentSession(session);
    } catch (error) {
      console.error('Error loading current session:', error);
    }
  };

  const handleBackToPos = () => {
    router.push('/pos');
  };

  const handleConnect = async () => {
    try {
      await hardwareService.connectDrawer(selectedPort);
      setIsConnected(true);
      toast({
        title: 'Success',
        description: 'Connected to cash drawer',
      });
    } catch (error) {
      console.error('Error connecting to drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to cash drawer',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnect = async () => {
    try {
      await hardwareService.disconnectDrawer();
      setIsConnected(false);
      setSelectedPort('');
      toast({
        title: 'Success',
        description: 'Disconnected from cash drawer',
      });
    } catch (error) {
      console.error('Error disconnecting drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect from cash drawer',
        variant: 'destructive',
      });
    }
  };

  const handleOpenDrawer = async () => {
    try {
      await hardwareService.openDrawer();
      toast({
        title: 'Success',
        description: 'Cash drawer opened',
      });
    } catch (error) {
      console.error('Error opening drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to open cash drawer',
        variant: 'destructive',
      });
    }
  };

  const handleOpenSession = async () => {
    try {
      if (!amount) {
        toast({
          title: 'Error',
          description: 'Please enter an opening amount',
          variant: 'destructive',
        });
        return;
      }

      const session = await drawerService.openSession(parseFloat(amount));
      setCurrentSession(session);
      setAmount('');
      toast({
        title: 'Success',
        description: 'Drawer session opened',
      });
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
    try {
      if (!amount) {
        toast({
          title: 'Error',
          description: 'Please enter a closing amount',
          variant: 'destructive',
        });
        return;
      }

      const session = await drawerService.closeSession(parseFloat(amount));
      setCurrentSession(null);
      setAmount('');
      toast({
        title: 'Success',
        description: 'Drawer session closed',
      });
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
    try {
      if (!amount) {
        toast({
          title: 'Error',
          description: 'Please enter an amount',
          variant: 'destructive',
        });
        return;
      }

      await drawerService.addCash(parseFloat(amount));
      loadCurrentSession();
      setAmount('');
      toast({
        title: 'Success',
        description: 'Cash added to drawer',
      });
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
    try {
      if (!amount) {
        toast({
          title: 'Error',
          description: 'Please enter an amount',
          variant: 'destructive',
        });
        return;
      }

      await drawerService.takeCash(parseFloat(amount));
      loadCurrentSession();
      setAmount('');
      toast({
        title: 'Success',
        description: 'Cash taken from drawer',
      });
    } catch (error) {
      console.error('Error taking cash:', error);
      toast({
        title: 'Error',
        description: 'Failed to take cash',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null; // Router will handle redirect
  }

  return (
    <div className="container mx-auto p-4 space-y-4">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold">Cash Drawer Management</h1>
        <Button
          onClick={handleBackToPos}
          variant="outline"
          className="flex items-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back to POS
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Hardware Control */}
        <Card>
          <CardHeader>
            <CardTitle>Hardware Control</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
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
            <div className="space-x-2">
              {!isConnected ? (
                <Button onClick={handleConnect} disabled={!selectedPort}>
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

        {/* Session Management */}
        <Card>
          <CardHeader>
            <CardTitle>Session Management</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {currentSession ? (
              <>
                <div>
                  <Label>Session Status</Label>
                  <p>Opening Amount: {formatCurrency(currentSession.openingAmount)}</p>
                  <p>Status: {currentSession.status}</p>
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
                </div>
                <div className="space-x-2">
                  <Button onClick={handleAddCash}>Add Cash</Button>
                  <Button onClick={handleTakeCash}>Take Cash</Button>
                  <Button onClick={handleCloseSession} variant="destructive">
                    Close Session
                  </Button>
                </div>
              </>
            ) : (
              <>
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
                <Button onClick={handleOpenSession}>Open Session</Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Transaction History */}
        {currentSession && (
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle>Transaction History</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {currentSession.operations?.map((op: DrawerOperation) => (
                  <div key={op.id} className="flex justify-between items-center p-2 bg-gray-50 rounded">
                    <span>{op.type}</span>
                    <span>{formatCurrency(op.amount)}</span>
                    <span>{new Date(op.createdAt).toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
