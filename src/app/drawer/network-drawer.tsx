'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { HardwareService, CashDrawer } from '@/services/hardware.service';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Trash2, Plus, Save, RefreshCw } from 'lucide-react';

const hardwareService = HardwareService.getInstance();

// Form data interface with string port for input fields
interface DrawerFormData {
  id: string;
  name: string;
  ipAddress: string;
  port: string;
  connectionType: string;
  locationId: string;
}

export function NetworkDrawerManager() {
  const { toast } = useToast();
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedDrawer, setSelectedDrawer] = useState<CashDrawer | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [formData, setFormData] = useState<DrawerFormData>({
    id: '',
    name: '',
    ipAddress: '',
    port: '',
    connectionType: 'NETWORK',
    locationId: ''
  });

  useEffect(() => {
    loadDrawers();
  }, []);

  const loadDrawers = async () => {
    setIsLoading(true);
    try {
      const drawersList = await hardwareService.listCashDrawers();
      setDrawers(drawersList);
    } catch (error) {
      console.error('Error loading drawers:', error);
      toast({
        title: 'Error',
        description: 'Failed to load cash drawers',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectDrawer = (drawer: CashDrawer) => {
    setSelectedDrawer(drawer);
    setFormData({
      id: drawer.id,
      name: drawer.name,
      ipAddress: drawer.ipAddress || '',
      port: drawer.port?.toString() || '',
      connectionType: drawer.connectionType,
      locationId: drawer.locationId || ''
    });
  };

  const handleNewDrawer = () => {
    setSelectedDrawer(null);
    setFormData({
      id: '',
      name: '',
      ipAddress: '',
      port: '',
      connectionType: 'NETWORK',
      locationId: ''
    });
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSaveDrawer = async () => {
    try {
      if (!formData.name) {
        toast({
          title: 'Error',
          description: 'Drawer name is required',
          variant: 'destructive',
        });
        return;
      }

      if (formData.connectionType === 'NETWORK' && (!formData.ipAddress || !formData.port)) {
        toast({
          title: 'Error',
          description: 'IP Address and Port are required for network drawers',
          variant: 'destructive',
        });
        return;
      }

      // Create a new object with the correct types for the API
      const drawerData: Partial<CashDrawer> = {
        id: formData.id,
        name: formData.name,
        ipAddress: formData.ipAddress,
        connectionType: formData.connectionType as 'SERIAL' | 'NETWORK' | 'USB',
        locationId: formData.locationId || undefined
      };
      
      // Convert port string to number for network drawers
      if (formData.connectionType === 'NETWORK' && formData.port) {
        drawerData.port = parseInt(formData.port, 10);
      }

      const drawer = await hardwareService.saveCashDrawer(drawerData);
      toast({
        title: 'Success',
        description: `Cash drawer ${drawer.name} saved successfully`,
      });
      
      await loadDrawers();
      setSelectedDrawer(drawer);
    } catch (error) {
      console.error('Error saving drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to save cash drawer',
        variant: 'destructive',
      });
    }
  };

  const handleConnectDrawer = async () => {
    if (!selectedDrawer) {
      toast({
        title: 'Error',
        description: 'Please select a drawer to connect',
        variant: 'destructive',
      });
      return;
    }

    try {
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
    } catch (error) {
      console.error('Error connecting to drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to connect to cash drawer',
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
          description: 'Cash drawer opened',
        });
      } else {
        toast({
          title: 'Error',
          description: 'Failed to open cash drawer',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error opening drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to open cash drawer',
        variant: 'destructive',
      });
    }
  };

  const handleDisconnectDrawer = async () => {
    try {
      await hardwareService.disconnectDrawer();
      setIsConnected(false);
      toast({
        title: 'Success',
        description: 'Disconnected from cash drawer',
      });
    } catch (error) {
      console.error('Error disconnecting from drawer:', error);
      toast({
        title: 'Error',
        description: 'Failed to disconnect from cash drawer',
        variant: 'destructive',
      });
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex justify-between items-center">
            <span>Network Cash Drawers</span>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={loadDrawers}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
              <Button variant="outline" size="sm" onClick={handleNewDrawer}>
                <Plus className="h-4 w-4 mr-2" />
                New Drawer
              </Button>
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="list" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="list">Drawer List</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>
            
            <TabsContent value="list" className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center p-4">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
                </div>
              ) : drawers.length === 0 ? (
                <div className="text-center p-4 text-gray-500">
                  No cash drawers configured. Create one in the Configuration tab.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {drawers.map(drawer => (
                    <Card 
                      key={drawer.id} 
                      className={`cursor-pointer hover:border-primary transition-all ${selectedDrawer?.id === drawer.id ? 'border-primary bg-primary/5' : ''}`}
                      onClick={() => handleSelectDrawer(drawer)}
                    >
                      <CardContent className="p-4">
                        <div className="font-medium">{drawer.name}</div>
                        {drawer.connectionType === 'NETWORK' && (
                          <div className="text-sm text-gray-500">
                            {drawer.ipAddress}:{drawer.port}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-1">
                          Type: {drawer.connectionType}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {selectedDrawer && (
                <div className="flex flex-col space-y-2 mt-4 pt-4 border-t">
                  <div className="font-medium">Selected: {selectedDrawer.name}</div>
                  <div className="flex space-x-2">
                    {!isConnected ? (
                      <Button onClick={handleConnectDrawer}>
                        Connect
                      </Button>
                    ) : (
                      <>
                        <Button onClick={handleOpenDrawer} variant="secondary">
                          Open Drawer
                        </Button>
                        <Button onClick={handleDisconnectDrawer} variant="outline">
                          Disconnect
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="config" className="space-y-4">
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">Drawer Name</Label>
                  <Input 
                    id="name" 
                    name="name" 
                    value={formData.name} 
                    onChange={handleInputChange} 
                    placeholder="Main Register"
                  />
                </div>
                
                <div className="grid gap-2">
                  <Label htmlFor="connectionType">Connection Type</Label>
                  <Select 
                    value={formData.connectionType} 
                    onValueChange={(value) => handleSelectChange('connectionType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select connection type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="NETWORK">Network (IP)</SelectItem>
                      <SelectItem value="SERIAL">Serial</SelectItem>
                      <SelectItem value="USB">USB</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                {formData.connectionType === 'NETWORK' && (
                  <>
                    <div className="grid gap-2">
                      <Label htmlFor="ipAddress">IP Address</Label>
                      <Input 
                        id="ipAddress" 
                        name="ipAddress" 
                        value={formData.ipAddress} 
                        onChange={handleInputChange} 
                        placeholder="192.168.1.100"
                      />
                    </div>
                    
                    <div className="grid gap-2">
                      <Label htmlFor="port">Port</Label>
                      <Input 
                        id="port" 
                        name="port" 
                        value={formData.port} 
                        onChange={handleInputChange} 
                        placeholder="9100"
                        type="number"
                      />
                    </div>
                  </>
                )}
                
                <div className="grid gap-2">
                  <Label htmlFor="locationId">Location ID (Optional)</Label>
                  <Input 
                    id="locationId" 
                    name="locationId" 
                    value={formData.locationId} 
                    onChange={handleInputChange} 
                    placeholder="Main Store"
                  />
                </div>
                
                <Button onClick={handleSaveDrawer} className="mt-4">
                  <Save className="h-4 w-4 mr-2" />
                  Save Drawer
                </Button>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
