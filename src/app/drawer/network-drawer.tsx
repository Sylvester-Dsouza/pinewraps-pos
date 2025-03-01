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
import { Trash2, Plus, Save, RefreshCw, Edit } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
  const [selectedDrawer, setSelectedDrawer] = useState<CashDrawer | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
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
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const response = await hardwareService.listCashDrawers();
      const networkDrawers = response.filter((drawer: CashDrawer) => 
        drawer.connectionType === 'NETWORK'
      );
      setDrawers(networkDrawers);
      
      if (networkDrawers.length === 0) {
        toast({
          title: 'No Network Drawers',
          description: 'No network drawers found. Please add one first.',
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error loading drawers:', error);
      const errorMsg = error.message || 'Failed to load drawers';
      setErrorMessage(errorMsg);
      toast({
        title: 'Error',
        description: 'Failed to load drawers',
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
    
    // Switch to the configuration tab
    const tabsList = document.querySelector('[role="tablist"]');
    const configTab = tabsList?.querySelector('[value="config"]');
    if (configTab) {
      (configTab as HTMLElement).click();
    }
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

      setIsLoading(true);
      setErrorMessage(null);

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
      const errorMsg = error.message || 'Failed to save drawer';
      setErrorMessage(errorMsg);
      toast({
        title: 'Error',
        description: 'Failed to save cash drawer',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
      setIsLoading(true);
      setErrorMessage(null);
      
      const result = await hardwareService.connectDrawer(selectedDrawer.id);
      setIsConnected(result.success);
      
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
    } catch (error) {
      console.error('Error connecting drawer:', error);
      const errorMsg = error.message || 'An unexpected error occurred';
      setErrorMessage(errorMsg);
      toast({
        title: 'Error',
        description: `Failed to connect to ${selectedDrawer.name}`,
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
      
      const result = await hardwareService.openDrawer();
      
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
    } catch (error) {
      console.error('Error opening drawer:', error);
      const errorMsg = error.message || 'An unexpected error occurred';
      setErrorMessage(errorMsg);
      toast({
        title: 'Error',
        description: 'Failed to open drawer',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnectDrawer = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const result = await hardwareService.disconnectDrawer();
      
      if (result.success) {
        setIsConnected(false);
        toast({
          title: 'Success',
          description: 'Disconnected from drawer',
        });
      } else {
        const errorMsg = result.error || 'Failed to disconnect from drawer';
        setErrorMessage(errorMsg);
        toast({
          title: 'Disconnection Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error disconnecting drawer:', error);
      const errorMsg = error.message || 'An unexpected error occurred';
      setErrorMessage(errorMsg);
      toast({
        title: 'Error',
        description: 'Failed to disconnect from drawer',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeleteDrawer = async () => {
    if (!formData.id) return;
    
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      const result = await hardwareService.deleteCashDrawer(formData.id);
      
      if (result.success) {
        toast({
          title: 'Success',
          description: `Drawer "${formData.name}" deleted successfully`,
        });
        
        // Reset form and selection
        handleNewDrawer();
        
        // Refresh drawer list
        await loadDrawers();
      } else {
        const errorMsg = result.error || 'Failed to delete drawer';
        setErrorMessage(errorMsg);
        toast({
          title: 'Error',
          description: errorMsg,
          variant: 'destructive',
        });
      }
    } catch (error) {
      console.error('Error deleting drawer:', error);
      const errorMsg = error.message || 'An unexpected error occurred';
      setErrorMessage(errorMsg);
      toast({
        title: 'Error',
        description: 'Failed to delete drawer',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
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
                    >
                      <CardContent className="p-4">
                        <div className="flex justify-between items-start">
                          <div 
                            className="flex-1"
                            onClick={() => handleSelectDrawer(drawer)}
                          >
                            <div className="font-medium">{drawer.name}</div>
                            {drawer.connectionType === 'NETWORK' && (
                              <div className="text-sm text-gray-500">
                                {drawer.ipAddress}:{drawer.port}
                              </div>
                            )}
                            <div className="text-xs text-gray-400 mt-1">
                              Type: {drawer.connectionType}
                            </div>
                          </div>
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSelectDrawer(drawer);
                              const tabsList = document.querySelector('[role="tablist"]');
                              const configTab = tabsList?.querySelector('[value="config"]');
                              if (configTab) {
                                (configTab as HTMLElement).click();
                              }
                            }}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
              
              {selectedDrawer && (
                <div className="flex flex-col space-y-2 mt-4 pt-4 border-t">
                  <div className="font-medium">Selected: {selectedDrawer.name}</div>
                  <div className="flex flex-col space-y-2">
                    {!isConnected ? (
                      <Button 
                        onClick={handleConnectDrawer} 
                        disabled={!selectedDrawer || isLoading}
                      >
                        Connect
                      </Button>
                    ) : (
                      <>
                        <Button 
                          onClick={handleOpenDrawer} 
                          disabled={isLoading}
                        >
                          Open Drawer
                        </Button>
                        <Button 
                          onClick={handleDisconnectDrawer} 
                          variant="outline"
                          disabled={isLoading}
                        >
                          Disconnect
                        </Button>
                      </>
                    )}
                    {isLoading && (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent"></div>
                        <span>Processing...</span>
                      </div>
                    )}
                    {errorMessage && (
                      <div className="mt-2 p-3 bg-red-50 border border-red-200 rounded-md">
                        <h4 className="text-sm font-medium text-red-800">Error Details:</h4>
                        <p className="text-sm text-red-700 whitespace-pre-wrap break-words">{errorMessage}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
            
            <TabsContent value="config" className="space-y-4">
              <div className="grid gap-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium">
                    {formData.id ? `Edit Drawer: ${formData.name}` : 'New Drawer'}
                  </h3>
                  <div className="flex space-x-2">
                    {formData.id && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={handleNewDrawer}
                      >
                        <Plus className="h-4 w-4 mr-2" />
                        New Drawer
                      </Button>
                    )}
                  </div>
                </div>
                
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
                
                <div className="flex justify-between mt-4">
                  <Button 
                    onClick={handleSaveDrawer} 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-4 w-4 mr-2" />
                        Save Drawer
                      </>
                    )}
                  </Button>
                  
                  {formData.id && (
                    <Button 
                      variant="destructive"
                      disabled={isLoading}
                      onClick={() => setShowDeleteConfirm(true)}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete Drawer
                    </Button>
                  )}
                </div>
                
                {/* Delete Confirmation Dialog */}
                <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Are you absolutely sure?</DialogTitle>
                      <DialogDescription>
                        This will permanently delete the drawer "{formData.name}". 
                        This action cannot be undone.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex justify-between">
                      <Button 
                        variant="outline" 
                        onClick={() => setShowDeleteConfirm(false)}
                      >
                        Cancel
                      </Button>
                      <Button 
                        variant="destructive" 
                        onClick={() => {
                          setShowDeleteConfirm(false);
                          handleDeleteDrawer();
                        }}
                      >
                        Delete
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
