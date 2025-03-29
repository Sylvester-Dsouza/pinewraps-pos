'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Plus, Edit, Trash2, ArrowLeft, RefreshCw, Printer, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { api } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { testPrinterConnection as testPrinterDirectConnection, detectPrinterProxy } from '@/services/printer';

interface Printer {
  id: string;
  name: string;
  ipAddress: string;
  port: number;
  isDefault: boolean;
  isActive: boolean;
  connected: boolean;
}

export default function PrinterPage() {
  const [activeTab, setActiveTab] = useState('list');
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [selectedPrinter, setSelectedPrinter] = useState<Printer | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isOpeningDrawer, setIsOpeningDrawer] = useState(false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isOpeningCashDrawer, setIsOpeningCashDrawer] = useState(false);
  const [directTestIp, setDirectTestIp] = useState('');
  const [directTestPort, setDirectTestPort] = useState('9100');
  const [proxyStatus, setProxyStatus] = useState<{ connected: boolean; url?: string; error?: string } | null>(null);
  const [isCheckingProxy, setIsCheckingProxy] = useState(false);
  const [formData, setFormData] = useState<Partial<Printer>>({
    name: '',
    ipAddress: '',
    port: 9100,
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
      const name = params.get('name');
      const ipAddress = params.get('ipAddress');
      const port = params.get('port');
      
      // If we have query params, update form data and switch to config tab
      if (name || ipAddress || port) {
        const newFormData: Partial<Printer> = {
          ...formData,
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

  useEffect(() => {
    if (activeTab === 'direct-test') {
      checkPrinterProxyStatus();
    }
  }, [activeTab]);

  const checkPrinterProxyStatus = async () => {
    setIsCheckingProxy(true);
    try {
      const status = await detectPrinterProxy();
      setProxyStatus(status);
      
      // If proxy is connected and we don't have an IP set, use the last connected printer IP
      if (status.connected && !directTestIp && printers.length > 0) {
        const defaultPrinter = printers.find(p => p.isDefault) || printers[0];
        if (defaultPrinter) {
          setDirectTestIp(defaultPrinter.ipAddress);
          setDirectTestPort(defaultPrinter.port.toString());
        }
      }
    } catch (error) {
      console.error('Error checking printer proxy status:', error);
      setProxyStatus({
        connected: false,
        error: 'Failed to check printer proxy status'
      });
    } finally {
      setIsCheckingProxy(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target;
    
    if (type === 'number') {
      setFormData({ ...formData, [name]: value ? parseInt(value) : undefined });
    } else {
      setFormData({ ...formData, [name]: value });
    }
  };

  const handleCheckboxChange = (checked: boolean) => {
    setFormData({ ...formData, isDefault: checked });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name) {
      toast.error('Printer name is required');
      return;
    }
    
    if (!formData.ipAddress) {
      toast.error('IP address is required');
      return;
    }
    
    if (!formData.port) {
      toast.error('Port is required');
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
        toast.success('Printer added successfully');
      }
      
      // Reset form and go back to list
      setFormData({
        name: '',
        ipAddress: '',
        port: 9100,
        isDefault: false,
      });
      setSelectedPrinter(null);
      setActiveTab('list');
      
      // Reload printers list
      loadPrinters();
    } catch (error) {
      console.error('Error saving printer:', error);
      toast.error('Failed to save printer');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (printer: Printer) => {
    setSelectedPrinter(printer);
    setFormData({
      name: printer.name,
      ipAddress: printer.ipAddress,
      port: printer.port,
      isDefault: printer.isDefault,
    });
    setActiveTab('config');
  };

  const handleDelete = async (id: string) => {
    setIsDeleting(true);
    
    try {
      await api.delete(`/api/pos/printer/${id}`);
      toast.success('Printer deleted successfully');
      
      // Reload printers list
      loadPrinters();
    } catch (error) {
      console.error('Error deleting printer:', error);
      toast.error('Failed to delete printer');
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setSelectedPrinter(null);
    setFormData({
      name: '',
      ipAddress: '',
      port: 9100,
      isDefault: false,
    });
    setActiveTab('list');
  };

  const testPrinterConnection = async (id: string) => {
    setIsTestingConnection(true);
    
    try {
      const response = await api.post(`/api/pos/printer/${id}/test`);
      
      if (response.data.success) {
        toast.success('Printer connection successful');
      } else {
        toast.error(`Printer connection failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error testing printer connection:', error);
      toast.error('Failed to test printer connection');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const testDirectPrinter = async () => {
    if (!directTestIp) {
      toast.error('IP address is required');
      return;
    }
    
    setIsTestingConnection(true);
    
    try {
      // First try our new direct connection test using the printer proxy
      const proxyResult = await testPrinterDirectConnection(directTestIp, parseInt(directTestPort || '9100', 10));
      
      if (proxyResult.connected) {
        toast.success(proxyResult.message);
        return;
      }
      
      // If direct test fails, fall back to the API endpoint
      console.log('Direct printer proxy test failed, falling back to API endpoint');
      const response = await api.post('/api/pos/printer/test-direct', {
        ipAddress: directTestIp,
        port: directTestPort || '9100'
      });
      
      if (response.data.success) {
        toast.success('Printer connection successful');
      } else {
        toast.error(`Printer connection failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error testing direct printer connection:', error);
      toast.error('Failed to test printer connection');
    } finally {
      setIsTestingConnection(false);
    }
  };

  const printDirectTest = async (openDrawer: boolean) => {
    if (!directTestIp) {
      toast.error('IP address is required');
      return;
    }
    
    if (openDrawer) {
      setIsOpeningDrawer(true);
    } else {
      setIsPrinting(true);
    }
    
    try {
      const port = parseInt(directTestPort || '9100', 10);
      const proxyUrl = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
      
      // Determine which endpoint to use based on the action
      const endpoint = openDrawer ? '/print-and-open-test' : '/print-test';
      console.log(`Sending request to ${proxyUrl}${endpoint}`);
      
      // First try direct proxy call with the correct parameter names for each endpoint
      try {
        const requestBody = {
          // Use the correct parameter names based on the endpoint
          ...(endpoint === '/print-test' || endpoint === '/print-and-open-test' 
            ? { printerIp: directTestIp, printerPort: port } 
            : { ip: directTestIp, port: port }),
          skipConnectivityCheck: true
        };
        
        console.log(`Using parameters for ${endpoint}:`, requestBody);
        
        const response = await fetch(`${proxyUrl}${endpoint}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(requestBody)
        });
        
        const data = await response.json();
        
        if (data.success) {
          toast.success(openDrawer ? 'Print and cash drawer operation successful' : 'Print operation successful');
          return;
        } else {
          console.error('Direct proxy error:', data.error || 'Unknown error');
          // If direct fails, try the API endpoint
        }
      } catch (error) {
        console.error('Error with direct proxy call:', error);
        // If direct fails, try the API endpoint
      }
      
      // Fall back to the API endpoint
      const response = await api.post('/api/pos/printer/test-direct', {
        ipAddress: directTestIp,
        port: directTestPort || '9100',
        action: openDrawer ? 'print-and-open' : 'print'
      });
      
      if (response.data.success) {
        toast.success(openDrawer ? 'Print and cash drawer operation successful' : 'Print operation successful');
      } else {
        toast.error(`Operation failed: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error in printer operation:', error);
      toast.error(openDrawer ? 'Failed to print and open drawer' : 'Failed to print');
    } finally {
      if (openDrawer) {
        setIsOpeningDrawer(false);
      } else {
        setIsPrinting(false);
      }
    }
  };

  const openCashDrawerOnly = async () => {
    if (!directTestIp) {
      toast.error('Please enter an IP address');
      return;
    }

    setIsOpeningCashDrawer(true);
    try {
      const port = parseInt(directTestPort) || 9100;
      
      // First try direct proxy call
      try {
        const proxyUrl = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
        console.log(`Sending open-drawer request to ${proxyUrl}/open-drawer`);
        
        const response = await fetch(`${proxyUrl}/open-drawer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ip: directTestIp,
            port: port,
            skipConnectivityCheck: true
          })
        });
        
        const data = await response.json();
        
        if (data.success) {
          toast.success('Cash drawer opened successfully');
          return;
        } else {
          console.error('Direct proxy error:', data.error);
          // If direct fails, try the API endpoint
        }
      } catch (error) {
        console.error('Error with direct proxy call:', error);
        // If direct fails, try the API endpoint
      }
      
      // If direct test fails, fall back to the API endpoint
      const response = await fetch('/api/pos/printer/test-direct', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          action: 'open-drawer',
          ipAddress: directTestIp,
          port: port
        })
      });
      
      const data = await response.json();
      
      if (data.success) {
        toast.success('Cash drawer opened successfully');
      } else {
        toast.error(`Failed to open cash drawer: ${data.error || 'Unknown error'}`);
      }
    } catch (error: any) {
      console.error('Error opening cash drawer:', error);
      toast.error(`Error opening cash drawer: ${error.message || 'Unknown error'}`);
    } finally {
      setIsOpeningCashDrawer(false);
    }
  };

  const openCashDrawer = async (id: string) => {
    setIsOpeningDrawer(true);
    
    try {
      const response = await api.post(`/api/pos/printer/${id}/test`);
      
      if (response.data.success) {
        toast.success('Cash drawer opened successfully');
      } else {
        toast.error(`Failed to open cash drawer: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error opening cash drawer:', error);
      toast.error('Failed to open cash drawer');
    } finally {
      setIsOpeningDrawer(false);
    }
  };

  const openDirectCashDrawer = async () => {
    if (!directTestIp) {
      toast.error('IP address is required');
      return;
    }
    
    setIsOpeningDrawer(true);
    
    try {
      const response = await api.post('/api/pos/printer/test-direct', {
        ipAddress: directTestIp,
        port: directTestPort || '9100'
      });
      
      if (response.data.success) {
        toast.success('Cash drawer opened successfully');
      } else {
        toast.error(`Failed to open cash drawer: ${response.data.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error opening direct cash drawer:', error);
      toast.error('Failed to open cash drawer');
    } finally {
      setIsOpeningDrawer(false);
    }
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Printer Management</h1>
        <Button onClick={() => router.push('/pos')} variant="outline" size="sm">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to POS
        </Button>
      </div>
      
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="list">Printer List</TabsTrigger>
          <TabsTrigger value="config">
            {selectedPrinter ? 'Edit Printer' : 'Add Printer'}
          </TabsTrigger>
          <TabsTrigger value="direct-test">Direct Test</TabsTrigger>
        </TabsList>
        
        <TabsContent value="list">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Configured Printers</CardTitle>
              <Button onClick={() => setActiveTab('config')} size="sm">
                <Plus className="mr-2 h-4 w-4" />
                Add Printer
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-4">
                  <RefreshCw className="h-6 w-6 animate-spin" />
                </div>
              ) : printers.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  No printers configured. Click "Add Printer" to get started.
                </div>
              ) : (
                <div className="grid gap-4">
                  {printers.map((printer) => (
                    <Card key={printer.id} className="relative">
                      <CardContent className="pt-6">
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium flex items-center">
                              <Printer className="h-4 w-4 mr-2" />
                              {printer.name}
                              {printer.isDefault && (
                                <span className="ml-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">
                                  Default
                                </span>
                              )}
                              {printer.connected && (
                                <span className="ml-2 text-xs bg-green-500 text-white px-2 py-0.5 rounded-full">
                                  Connected
                                </span>
                              )}
                            </h3>
                            <p className="text-sm text-muted-foreground mt-1">
                              IP: {printer.ipAddress}:{printer.port}
                            </p>
                          </div>
                          <div className="flex space-x-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => testPrinterConnection(printer.id)}
                              disabled={isTestingConnection}
                            >
                              {isTestingConnection ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                'Test Connection'
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openCashDrawer(printer.id)}
                              disabled={isOpeningDrawer}
                            >
                              {isOpeningDrawer ? (
                                <RefreshCw className="h-4 w-4 animate-spin" />
                              ) : (
                                'Open Drawer'
                              )}
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(printer)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm">
                                  <Trash2 className="h-4 w-4 text-destructive" />
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
                                    onClick={() => handleDelete(printer.id)}
                                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                    disabled={isDeleting}
                                  >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <CardTitle>
                {selectedPrinter ? 'Edit Printer' : 'Add New Printer'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Printer Name</Label>
                    <Input
                      id="name"
                      name="name"
                      value={formData.name || ''}
                      onChange={handleInputChange}
                      placeholder="Office Printer"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="ipAddress">IP Address</Label>
                    <Input
                      id="ipAddress"
                      name="ipAddress"
                      value={formData.ipAddress || ''}
                      onChange={handleInputChange}
                      placeholder="192.168.1.100"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="port">Port</Label>
                    <Input
                      id="port"
                      name="port"
                      type="number"
                      value={formData.port || ''}
                      onChange={handleInputChange}
                      placeholder="9100"
                      required
                    />
                  </div>
                  
                  <div className="flex items-center space-x-2 pt-8">
                    <Checkbox
                      id="isDefault"
                      checked={formData.isDefault || false}
                      onCheckedChange={handleCheckboxChange}
                    />
                    <Label htmlFor="isDefault" className="cursor-pointer">
                      Set as default printer
                    </Label>
                  </div>
                </div>
                
                <div className="flex justify-end space-x-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleCancel}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      'Save Printer'
                    )}
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="direct-test">
          <Card>
            <CardHeader>
              <CardTitle>Direct Printer Test</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Test a printer connection directly without saving it to the database.
                  This is useful for troubleshooting or testing new printers.
                </p>
                
                {/* Printer Proxy Status */}
                <div className="bg-muted p-3 rounded-md">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center space-x-2">
                      <div className={`h-3 w-3 rounded-full ${isCheckingProxy ? 'bg-yellow-500' : (proxyStatus?.connected ? 'bg-green-500' : 'bg-red-500')}`}></div>
                      <span className="text-sm font-medium">Printer Proxy Service:</span>
                      <span className="text-sm">
                        {isCheckingProxy 
                          ? 'Checking...' 
                          : (proxyStatus?.connected 
                              ? `Connected (${proxyStatus.url})` 
                              : `Disconnected${proxyStatus?.error ? `: ${proxyStatus.error}` : ''}`)}
                      </span>
                    </div>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={checkPrinterProxyStatus}
                      disabled={isCheckingProxy}
                    >
                      <RefreshCw className={`h-4 w-4 ${isCheckingProxy ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="directTestIp">IP Address</Label>
                    <Input
                      id="directTestIp"
                      value={directTestIp}
                      onChange={(e) => setDirectTestIp(e.target.value)}
                      placeholder="192.168.1.100"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="directTestPort">Port</Label>
                    <Input
                      id="directTestPort"
                      value={directTestPort}
                      onChange={(e) => setDirectTestPort(e.target.value)}
                      placeholder="9100"
                    />
                  </div>
                </div>
                
                <div className="flex space-x-2 pt-4">
                  <Button
                    variant="outline"
                    onClick={testDirectPrinter}
                    disabled={isTestingConnection}
                  >
                    {isTestingConnection ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Testing...
                      </>
                    ) : (
                      'Test Connection'
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => printDirectTest(true)}
                    disabled={isOpeningDrawer}
                  >
                    {isOpeningDrawer ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Printer className="mr-2 h-4 w-4" />
                        Print and Open
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => printDirectTest(false)}
                    disabled={isPrinting}
                  >
                    {isPrinting ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Printing...
                      </>
                    ) : (
                      <>
                        <Printer className="mr-2 h-4 w-4" />
                        Print Only
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={openCashDrawerOnly}
                    disabled={isOpeningCashDrawer}
                  >
                    {isOpeningCashDrawer ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Opening...
                      </>
                    ) : (
                      <>
                        <Printer className="mr-2 h-4 w-4" />
                        Open Cash Drawer
                      </>
                    )}
                  </Button>
                  
                  <Button
                    variant="outline"
                    onClick={() => {
                      // Add this printer to the configuration form
                      setFormData({
                        ...formData,
                        name: 'New Printer',
                        ipAddress: directTestIp,
                        port: parseInt(directTestPort) || 9100,
                      });
                      setActiveTab('config');
                    }}
                  >
                    Add to Configuration
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
