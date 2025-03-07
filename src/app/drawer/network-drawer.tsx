'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { HardwareService, CashDrawer, Printer } from '@/services/hardware.service';
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
  serialPath: string;
  printerId: string;
  locationId: string;
}

export function NetworkDrawerManager() {
  const { toast } = useToast();
  const [drawers, setDrawers] = useState<CashDrawer[]>([]);
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedDrawer, setSelectedDrawer] = useState<CashDrawer | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("list");
  const [formData, setFormData] = useState<DrawerFormData>({
    id: '',
    name: '',
    ipAddress: '',
    port: '',
    connectionType: 'NETWORK',
    serialPath: '',
    printerId: '',
    locationId: ''
  });

  useEffect(() => {
    loadDrawers();
    loadPrinters();
  }, []);

  const loadDrawers = async () => {
    try {
      setIsLoading(true);
      const drawerList = await hardwareService.listCashDrawers();
      setDrawers(drawerList);
      setIsLoading(false);
    } catch (error) {
      console.error('Error loading drawers:', error);
      setIsLoading(false);
      toast({
        variant: "destructive",
        title: "Error loading cash drawers",
        description: error.message || "An error occurred while loading cash drawers",
      });
    }
  };

  const loadPrinters = async () => {
    try {
      const printerList = await hardwareService.listPrinters();
      setPrinters(printerList);
    } catch (error) {
      console.error('Error loading printers:', error);
      toast({
        variant: "destructive",
        title: "Error loading printers",
        description: error.message || "An error occurred while loading printers",
      });
    }
  };

  const handleConnectDrawer = async (drawer: CashDrawer) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      const response = await hardwareService.connectDrawer(drawer.id);
      
      if (response.success) {
        setIsConnected(true);
        setSelectedDrawer(drawer);
        toast({
          title: "Connected",
          description: `Successfully connected to ${drawer.name}`,
        });
      } else {
        setErrorMessage(response.error || 'Failed to connect to cash drawer');
        toast({
          variant: "destructive",
          title: "Connection Failed",
          description: response.error || "Failed to connect to cash drawer",
        });
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error connecting to drawer:', error);
      setIsLoading(false);
      setErrorMessage(error.message || 'Failed to connect to cash drawer');
      toast({
        variant: "destructive",
        title: "Connection Error",
        description: error.message || "An error occurred while connecting to cash drawer",
      });
    }
  };

  const handleOpenDrawer = async (drawer: CashDrawer) => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // For our simplified approach, we only support printer-connected drawers
      if (drawer.connectionType !== 'PRINTER') {
        toast({
          variant: "destructive",
          title: "Unsupported Drawer Type",
          description: "Only printer-connected drawers are supported",
        });
        setIsLoading(false);
        return;
      }
      
      const result = await hardwareService.openCashDrawer(drawer.id);
      
      if (result.success) {
        toast({
          title: "Success",
          description: `Cash drawer ${drawer.name} opened successfully`,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Failed to Open Drawer",
          description: result.error || "Failed to open drawer",
        });
      }
    } catch (error) {
      console.error('Error opening drawer:', error);
      setErrorMessage(error.message || 'Failed to open cash drawer');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An unexpected error occurred",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleFormChange = (field: keyof DrawerFormData) => (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [field]: e.target.value });
  };

  const handleSelectChange = (field: keyof DrawerFormData) => (value: string) => {
    setFormData({ ...formData, [field]: value });
    
    // Clear fields that are no longer relevant based on connection type
    if (field === 'connectionType') {
      if (value === 'NETWORK') {
        setFormData(prev => ({ ...prev, connectionType: value, serialPath: '', printerId: '' }));
      } else if (value === 'SERIAL') {
        setFormData(prev => ({ ...prev, connectionType: value, ipAddress: '', port: '', printerId: '' }));
      } else if (value === 'PRINTER') {
        setFormData(prev => ({ ...prev, connectionType: value, ipAddress: '', port: '', serialPath: '' }));
      }
    }
  };

  const handleAddDrawer = () => {
    setFormData({
      id: '',
      name: '',
      ipAddress: '',
      port: '',
      connectionType: 'NETWORK',
      serialPath: '',
      printerId: '',
      locationId: ''
    });
    setActiveTab("add");
  };

  const handleEditDrawer = (drawer: CashDrawer) => {
    setFormData({
      id: drawer.id,
      name: drawer.name,
      ipAddress: drawer.ipAddress || '',
      port: drawer.port ? drawer.port.toString() : '',
      connectionType: drawer.connectionType,
      serialPath: drawer.serialPath || '',
      printerId: drawer.printerId || '',
      locationId: drawer.locationId || '',
    });
    setActiveTab("add");
  };

  const handleSaveDrawer = async () => {
    try {
      setIsLoading(true);
      setErrorMessage(null);
      
      // Validate required fields
      if (!formData.name) {
        setErrorMessage('Name is required');
        setIsLoading(false);
        return;
      }
      
      // Validate connection type specific fields
      if (formData.connectionType === 'NETWORK' && (!formData.ipAddress || !formData.port)) {
        setErrorMessage('IP address and port are required for network connections');
        setIsLoading(false);
        return;
      } else if (formData.connectionType === 'SERIAL' && !formData.serialPath) {
        setErrorMessage('Serial path is required for serial connections');
        setIsLoading(false);
        return;
      } else if (formData.connectionType === 'PRINTER' && !formData.printerId) {
        setErrorMessage('Printer is required for printer-connected cash drawers');
        setIsLoading(false);
        return;
      }
      
      const payload = {
        name: formData.name,
        connectionType: formData.connectionType,
        ipAddress: formData.connectionType === 'NETWORK' ? formData.ipAddress : undefined,
        port: formData.connectionType === 'NETWORK' && formData.port ? parseInt(formData.port) : undefined,
        serialPath: formData.connectionType === 'SERIAL' ? formData.serialPath : undefined,
        printerId: formData.connectionType === 'PRINTER' ? formData.printerId : undefined,
        locationId: formData.locationId || undefined
      };
      
      let result: CashDrawer;
      
      if (formData.id) {
        // Update existing drawer
        result = await hardwareService.updateCashDrawer(formData.id, payload);
        toast({
          title: "Updated",
          description: `Cash drawer ${result.name} updated successfully`,
        });
      } else {
        // Create new drawer
        result = await hardwareService.saveCashDrawer(payload);
        toast({
          title: "Created",
          description: `Cash drawer ${result.name} created successfully`,
        });
      }
      
      // Reset form and reload drawers
      setFormData({
        id: '',
        name: '',
        ipAddress: '',
        port: '',
        connectionType: 'NETWORK',
        serialPath: '',
        printerId: '',
        locationId: ''
      });
      
      await loadDrawers();
      setActiveTab("list");
      setIsLoading(false);
    } catch (error) {
      console.error('Error saving drawer:', error);
      setIsLoading(false);
      setErrorMessage(error.message || 'Failed to save cash drawer');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while saving cash drawer",
      });
    }
  };

  const handleConfirmDeleteDrawer = (drawer: CashDrawer) => {
    if (confirm(`Are you sure you want to delete ${drawer.name}?`)) {
      handleDeleteDrawer(drawer);
    }
  };

  const handleDeleteDrawer = async (drawer: CashDrawer) => {
    try {
      setIsLoading(true);
      const response = await hardwareService.deleteCashDrawer(drawer.id);
      
      if (response.success) {
        toast({
          title: "Deleted",
          description: `Cash drawer ${drawer.name} deleted successfully`,
        });
        await loadDrawers();
      } else {
        setErrorMessage(response.error || 'Failed to delete cash drawer');
        toast({
          variant: "destructive",
          title: "Deletion Failed",
          description: response.error || "Failed to delete cash drawer",
        });
      }
      setIsLoading(false);
    } catch (error) {
      console.error('Error deleting drawer:', error);
      setIsLoading(false);
      setErrorMessage(error.message || 'Failed to delete cash drawer');
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message || "An error occurred while deleting cash drawer",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex justify-between items-center">
          <span>Cash Drawer Management</span>
          <Button variant="outline" size="sm" onClick={loadDrawers} disabled={isLoading}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="list">Cash Drawers</TabsTrigger>
            <TabsTrigger value="add">{formData.id ? 'Edit' : 'Add'} Cash Drawer</TabsTrigger>
          </TabsList>
          
          <TabsContent value="list" className="space-y-4">
            <Button onClick={handleAddDrawer} className="mb-4">
              <Plus className="h-4 w-4 mr-2" />
              Add New Cash Drawer
            </Button>
            
            {isLoading ? (
              <div className="flex justify-center py-4">Loading...</div>
            ) : drawers.length === 0 ? (
              <div className="text-center py-4">No cash drawers found. Create one to get started.</div>
            ) : (
              <div className="space-y-4">
                {drawers.map((drawer) => (
                  <Card key={drawer.id} className="p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold">{drawer.name}</h3>
                        <p className="text-sm text-gray-500">Connection: {drawer.connectionType}</p>
                        {drawer.connectionType === 'PRINTER' && drawer.printer && (
                          <p className="text-sm text-gray-500">Printer: {drawer.printer.name}</p>
                        )}
                      </div>
                      <div className="flex space-x-2">
                        <Button variant="outline" size="sm" onClick={() => handleEditDrawer(drawer)}>
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => handleConfirmDeleteDrawer(drawer)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex mt-4 space-x-2">
                      <Button size="sm" onClick={() => handleOpenDrawer(drawer)} disabled={isLoading}>
                        Open Drawer
                      </Button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
            
            {errorMessage && (
              <div className="text-red-500 mt-2">{errorMessage}</div>
            )}
          </TabsContent>
          
          <TabsContent value="add">
            <div className="space-y-4">
              <div className="grid w-full items-center gap-2">
                <Label htmlFor="name">Name</Label>
                <Input 
                  id="name" 
                  value={formData.name} 
                  onChange={handleFormChange('name')} 
                  placeholder="Main Register" 
                />
              </div>
              
              <div className="grid w-full items-center gap-2">
                <Label htmlFor="connectionType">Connection Type</Label>
                <Select value={formData.connectionType} onValueChange={handleSelectChange('connectionType')}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select connection type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NETWORK">Network</SelectItem>
                    <SelectItem value="SERIAL">Serial</SelectItem>
                    <SelectItem value="PRINTER">Printer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {formData.connectionType === 'NETWORK' && (
                <>
                  <div className="grid w-full items-center gap-2">
                    <Label htmlFor="ipAddress">IP Address</Label>
                    <Input 
                      id="ipAddress" 
                      value={formData.ipAddress} 
                      onChange={handleFormChange('ipAddress')} 
                      placeholder="192.168.1.100" 
                    />
                  </div>
                  
                  <div className="grid w-full items-center gap-2">
                    <Label htmlFor="port">Port</Label>
                    <Input 
                      id="port" 
                      value={formData.port} 
                      onChange={handleFormChange('port')} 
                      placeholder="9100" 
                      type="number"
                    />
                  </div>
                </>
              )}
              
              {formData.connectionType === 'SERIAL' && (
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="serialPath">Serial Path</Label>
                  <Input 
                    id="serialPath" 
                    value={formData.serialPath} 
                    onChange={handleFormChange('serialPath')} 
                    placeholder="/dev/tty.usbserial" 
                  />
                </div>
              )}

              {formData.connectionType === 'PRINTER' && (
                <div className="grid w-full items-center gap-2">
                  <Label htmlFor="printerId">Printer</Label>
                  <Select value={formData.printerId} onValueChange={handleSelectChange('printerId')}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a printer" />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.length === 0 ? (
                        <SelectItem value="no-printers" disabled>No printers available</SelectItem>
                      ) : (
                        printers.map(printer => (
                          <SelectItem key={printer.id} value={printer.id}>
                            {printer.name} ({printer.connectionType})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
              
              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setActiveTab("list")}>
                  Cancel
                </Button>
                <Button onClick={handleSaveDrawer} disabled={isLoading}>
                  <Save className="h-4 w-4 mr-2" />
                  {formData.id ? 'Update' : 'Save'} Cash Drawer
                </Button>
              </div>
              
              {errorMessage && (
                <div className="text-red-500 mt-2">{errorMessage}</div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
      
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the cash drawer "{selectedDrawer?.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDeleteDrawer} disabled={isLoading}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
