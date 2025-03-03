'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';

interface Printer {
  id: string;
  name: string;
  connectionType: string;
  ipAddress?: string;
  port?: number;
  vendorId?: string;
  productId?: string;
  serialPath?: string;
  isDefault: boolean;
  printerType: string;
  macName?: string;
}

export default function PrinterPage() {
  const [activeTab, setActiveTab] = useState('list');
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formData, setFormData] = useState<Partial<Printer>>({
    name: '',
    connectionType: 'USB',
    printerType: 'RECEIPT',
    isDefault: false,
  });
  const router = useRouter();

  const loadPrinters = async () => {
    setIsLoading(true);
    try {
      const response = await api.get('/api/pos/printer');
      setPrinters(response.data.printers || []);
    } catch (error) {
      console.error('Error loading printers:', error);
      toast.error('Failed to load printers');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPrinters();
    
    // Check for query params to pre-fill the form
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const connectionType = params.get('connectionType');
      const name = params.get('name');
      const ipAddress = params.get('ipAddress');
      const port = params.get('port');
      
      // If we have query params, update form data and switch to config tab
      if (connectionType || name || ipAddress || port) {
        const newFormData: Partial<Printer> = {
          ...formData,
          connectionType: connectionType || formData.connectionType,
          name: name || formData.name,
          ipAddress: ipAddress || formData.ipAddress,
          port: port ? parseInt(port) : formData.port,
        };
        
        setFormData(newFormData);
        setActiveTab('config');
        
        // Clear the query params from the URL to avoid reapplying them on refresh
        window.history.replaceState({}, document.title, window.location.pathname);
      }
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setFormData({ ...formData, [name]: value ? parseInt(value) : undefined });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData({ ...formData, [name]: value });
  };

  const handleCheckboxChange = (name: string, checked: boolean) => {
    setFormData({ ...formData, [name]: checked });
  };

  const handleSelectPrinter = (printer: Printer) => {
    setSelectedPrinter(printer);
    setFormData({
      ...printer
    });
    setActiveTab('config');
  };

  const handleNewPrinter = () => {
    setSelectedPrinter(null);
    setFormData({
      name: '',
      connectionType: 'USB',
      printerType: 'RECEIPT',
      isDefault: false,
    });
    setActiveTab('config');
  };

  const handleSavePrinter = async () => {
    if (!formData.name) {
      toast.error('Printer name is required');
      return;
    }

    if (formData.connectionType === 'NETWORK' && (!formData.ipAddress || !formData.port)) {
      toast.error('IP address and port are required for network printers');
      return;
    }

    setIsLoading(true);
    try {
      let response;
      
      if (selectedPrinter) {
        // Update existing printer
        response = await api.put(`/api/pos/printer/${selectedPrinter.id}`, formData);
        toast.success('Printer updated successfully');
      } else {
        // Create new printer
        response = await api.post('/api/pos/printer', formData);
        toast.success('Printer created successfully');
      }
      
      await loadPrinters();
      setActiveTab('list');
    } catch (error) {
      console.error('Error saving printer:', error);
      toast.error('Failed to save printer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleDeletePrinter = async () => {
    if (!selectedPrinter) return;
    
    setIsDeleting(true);
    try {
      await api.delete(`/api/pos/printer/${selectedPrinter.id}`);
      toast.success('Printer deleted successfully');
      await loadPrinters();
      setActiveTab('list');
      setSelectedPrinter(null);
    } catch (error) {
      console.error('Error deleting printer:', error);
      toast.error('Failed to delete printer');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleTestPrinter = async (printerId: string) => {
    try {
      const printer = printers.find(p => p.id === printerId);
      if (!printer) {
        toast.error('Printer not found');
        return;
      }
      
      const response = await api.post(`/api/pos/printer/${printerId}/test`);
        
      if (response.data.success) {
        toast.success('Cash drawer opened successfully');
      } else {
        toast.error(response.data.error || 'Failed to open cash drawer');
      }
    } catch (error) {
      console.error('Error opening cash drawer:', error);
      toast.error('Failed to open cash drawer');
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Printer Management</h1>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="list">Printer List</TabsTrigger>
          <TabsTrigger value="config">Configuration</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list" className="pt-4">
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-medium">Available Printers</h3>
            <Button onClick={handleNewPrinter} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New Printer
            </Button>
          </div>
          
          {isLoading && printers.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent mb-4"></div>
              <p className="text-muted-foreground">Loading printers...</p>
            </div>
          ) : printers.length === 0 ? (
            <div className="text-center p-8 border rounded-md">
              <p className="text-muted-foreground mb-4">No printers configured yet</p>
              <Button onClick={handleNewPrinter} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-2" />
                Add Your First Printer
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {printers.map(printer => (
                <Card 
                  key={printer.id} 
                  className={`cursor-pointer ${selectedPrinter?.id === printer.id ? 'border-primary' : ''}`}
                  onClick={() => handleSelectPrinter(printer)}
                >
                  <CardHeader className="p-4 pb-2">
                    <CardTitle className="text-base flex justify-between items-center">
                      <span>{printer.name} {printer.isDefault && <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded ml-2">Default</span>}</span>
                      <Button 
                        variant="ghost" 
                        size="icon"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSelectPrinter(printer);
                          setActiveTab("config");
                        }}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4 pt-0">
                    <div className="text-sm text-muted-foreground">
                      <p>Type: {printer.printerType}</p>
                      {printer.connectionType === 'NETWORK' ? (
                        <p>Network: {printer.ipAddress}:{printer.port}</p>
                      ) : printer.connectionType === 'USB' ? (
                        <p>USB: {printer.vendorId && printer.productId ? `${printer.vendorId}:${printer.productId}` : 'Auto-detect'}</p>
                      ) : (
                        <p>Serial: {printer.serialPath || 'Not specified'}</p>
                      )}
                    </div>
                    <div className="mt-2 flex justify-end">
                      <Button 
                        size="sm" 
                        variant="secondary"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleTestPrinter(printer.id);
                        }}
                      >
                        Test Drawer
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
        
        <TabsContent value="config" className="pt-4">
          <div className="flex justify-between mb-4">
            <h3 className="text-lg font-medium">
              {selectedPrinter ? `Edit Printer: ${selectedPrinter.name}` : 'New Printer'}
            </h3>
            {selectedPrinter && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete Printer</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to delete this printer? This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction 
                      onClick={handleDeletePrinter}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? 'Deleting...' : 'Delete'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </div>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="name">Printer Name</Label>
                <Input 
                  id="name"
                  name="name"
                  value={formData.name || ''}
                  onChange={handleInputChange}
                  placeholder="e.g. Receipt Printer"
                />
              </div>
              
              <div>
                <Label htmlFor="printerType">Printer Type</Label>
                <Select 
                  value={formData.printerType} 
                  onValueChange={(value) => handleSelectChange('printerType', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select printer type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECEIPT">Receipt Printer</SelectItem>
                    <SelectItem value="KITCHEN">Kitchen Printer</SelectItem>
                    <SelectItem value="LABEL">Label Printer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            
            <div>
              <Label htmlFor="connectionType">Connection Type</Label>
              <Select 
                value={formData.connectionType || ''}
                onValueChange={(value) => handleSelectChange('connectionType', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select connection type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USB">USB</SelectItem>
                  <SelectItem value="NETWORK">Network</SelectItem>
                  <SelectItem value="SERIAL">Serial</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {formData.connectionType === 'NETWORK' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ipAddress">IP Address</Label>
                  <Input 
                    id="ipAddress"
                    name="ipAddress"
                    value={formData.ipAddress || ''}
                    onChange={handleInputChange}
                    placeholder="e.g. 192.168.1.100"
                  />
                </div>
                <div>
                  <Label htmlFor="port">Port</Label>
                  <Input 
                    id="port"
                    name="port"
                    type="number"
                    value={formData.port || ''}
                    onChange={handleInputChange}
                    placeholder="e.g. 9100"
                  />
                </div>
              </div>
            )}
            
            {formData.connectionType === 'USB' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="vendorId">Vendor ID (optional)</Label>
                  <Input 
                    id="vendorId"
                    name="vendorId"
                    value={formData.vendorId || ''}
                    onChange={handleInputChange}
                    placeholder="e.g. 0x04b8"
                  />
                </div>
                <div>
                  <Label htmlFor="productId">Product ID (optional)</Label>
                  <Input 
                    id="productId"
                    name="productId"
                    value={formData.productId || ''}
                    onChange={handleInputChange}
                    placeholder="e.g. 0x0202"
                  />
                </div>
              </div>
            )}
            
            {formData.connectionType === 'SERIAL' && (
              <div>
                <Label htmlFor="serialPath">Serial Path</Label>
                <Input 
                  id="serialPath"
                  name="serialPath"
                  value={formData.serialPath || ''}
                  onChange={handleInputChange}
                  placeholder="e.g. COM1 (Windows) or /dev/ttyS0 (Linux)"
                />
              </div>
            )}
            
            <div className="flex items-center space-x-2">
              <Checkbox 
                id="isDefault" 
                checked={formData.isDefault} 
                onCheckedChange={(checked) => handleCheckboxChange('isDefault', checked === true)}
              />
              <Label htmlFor="isDefault">Set as default printer</Label>
            </div>
            
            <div className="flex justify-end space-x-2 pt-4">
              <Button 
                variant="outline" 
                onClick={() => setActiveTab('list')}
              >
                Cancel
              </Button>
              <Button 
                onClick={handleSavePrinter}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <div className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent"></div>
                    Saving...
                  </>
                ) : (
                  <>Save</>
                )}
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
