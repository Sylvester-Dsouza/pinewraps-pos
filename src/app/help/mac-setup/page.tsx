'use client';

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { ArrowLeft } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function NetworkPrinterSetupPage() {
  const [activeTab, setActiveTab] = useState('overview');
  const router = useRouter();
  
  return (
    <div className="container mx-auto py-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Network Printer & Cash Drawer Setup</h1>
        <Button
          variant="outline"
          onClick={() => router.back()}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Button>
      </div>
      
      <Alert className="mb-6">
        <AlertTitle>Important</AlertTitle>
        <AlertDescription>
          This guide will help you set up network-connected printers and cash drawers.
          For best results, ensure your devices are properly connected to the network
          before proceeding.
        </AlertDescription>
      </Alert>
      
      <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-6">
        <TabsList className="grid grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="printer-setup">Printer Setup</TabsTrigger>
          <TabsTrigger value="drawer-setup">Cash Drawer Setup</TabsTrigger>
          <TabsTrigger value="troubleshooting">Troubleshooting</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Hardware Setup Overview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p>
                Connecting your POS hardware via WiFi/network offers several advantages
                over USB connections:
              </p>
              
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <span className="font-medium">No platform limitations</span>: Works on any
                  operating system without special drivers
                </li>
                <li>
                  <span className="font-medium">Greater flexibility</span>: Position hardware
                  anywhere within your network range
                </li>
                <li>
                  <span className="font-medium">Simplified setup</span>: No need for USB
                  hubs or special cables
                </li>
                <li>
                  <span className="font-medium">Centralized management</span>: Connect multiple
                  terminals to the same hardware
                </li>
              </ul>
              
              <p className="font-medium mt-4">Components You'll Need:</p>
              
              <ul className="list-disc pl-6 space-y-2">
                <li>Network-compatible receipt printer (with built-in Ethernet or WiFi)</li>
                <li>Cash drawer with RJ11 connection (connects to the printer)</li>
                <li>Local network with DHCP or assigned static IP addresses</li>
              </ul>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="printer-setup" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Network Printer Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-medium">Step 1: Connect your printer to the network</h3>
              <p>
                Most network-capable printers can connect via Ethernet cable or WiFi. Refer to
                your printer's manual for specific instructions.
              </p>
              
              <div className="border rounded-md p-3 my-4">
                <h4 className="font-medium">For Ethernet Connection:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                  <li>Connect an Ethernet cable from your printer to your router/switch</li>
                  <li>Power on the printer</li>
                  <li>Most printers will acquire an IP address automatically via DHCP</li>
                  <li>Print a network configuration page to find the assigned IP address</li>
                </ol>
              </div>
              
              <div className="border rounded-md p-3 my-4">
                <h4 className="font-medium">For WiFi Connection:</h4>
                <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                  <li>Access the printer's control panel or web interface</li>
                  <li>Navigate to network or wireless settings</li>
                  <li>Select your WiFi network and enter the password</li>
                  <li>Wait for the printer to connect and obtain an IP address</li>
                  <li>Print a network configuration page to confirm the IP address</li>
                </ol>
              </div>
              
              <h3 className="text-lg font-medium mt-6">Step 2: Add the printer to Pinewraps POS</h3>
              <ol className="list-decimal list-inside space-y-2 mt-2">
                <li>Go to the Printer Management page in Pinewraps POS</li>
                <li>Click "New Printer"</li>
                <li>Enter a name for your printer</li>
                <li>Select "Network" as the connection type</li>
                <li>Enter the IP address and port (usually 9100 for most receipt printers)</li>
                <li>Select the appropriate printer type (RECEIPT)</li>
                <li>Click "Save"</li>
              </ol>
              
              <h3 className="text-lg font-medium mt-6">Step 3: Test the printer</h3>
              <p>
                After adding the printer, you can test it by clicking the "Test" button next to
                the printer in the list. This will send a test page to the printer.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="drawer-setup" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Cash Drawer Setup</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-medium">Step 1: Connect the cash drawer to your printer</h3>
              <p>
                Most cash drawers connect to the printer using an RJ11 (phone-style) cable:
              </p>
              
              <ol className="list-decimal list-inside space-y-2 mt-2">
                <li>Locate the cash drawer port on the back of your receipt printer</li>
                <li>Connect the RJ11 cable from the cash drawer to this port</li>
                <li>Ensure the cash drawer is powered (if it requires separate power)</li>
              </ol>
              
              <div className="border rounded-md p-3 my-4 bg-blue-50">
                <h4 className="font-medium">Important Note:</h4>
                <p className="text-sm mt-2">
                  The cash drawer will be triggered by commands sent to the printer. When the printer
                  receives a cash drawer kick command, it sends an electrical signal through the RJ11
                  cable to open the drawer.
                </p>
              </div>
              
              <h3 className="text-lg font-medium mt-6">Step 2: Add the cash drawer to Pinewraps POS</h3>
              <ol className="list-decimal list-inside space-y-2 mt-2">
                <li>Go to the Cash Drawer Management page in Pinewraps POS</li>
                <li>Click "New Cash Drawer"</li>
                <li>Enter a name for your cash drawer</li>
                <li>Select "PRINTER" as the connection type</li>
                <li>Select the network printer you previously configured</li>
                <li>Click "Save"</li>
              </ol>
              
              <h3 className="text-lg font-medium mt-6">Step 3: Test the cash drawer</h3>
              <p>
                After adding the cash drawer, you can test it by clicking the "Test" button next to
                the drawer in the list. This will send a command to open the drawer through the connected printer.
              </p>
              
              <div className="border rounded-md p-3 my-4">
                <h4 className="font-medium">Troubleshooting Tip:</h4>
                <p className="text-sm mt-2">
                  If the drawer doesn't open, try the following:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm mt-1">
                  <li>Make sure the printer is online and properly connected to the network</li>
                  <li>Check that the RJ11 cable is securely connected at both ends</li>
                  <li>Verify the cash drawer has power (if separately powered)</li>
                  <li>Some drawers require a specific pin setting (typically 2 or 5)</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="troubleshooting" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Troubleshooting Network Hardware</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <h3 className="text-lg font-medium">Common Issues</h3>
              
              <div className="space-y-4">
                <div className="border rounded-md p-3">
                  <h4 className="font-medium">Printer Not Responding</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                    <li>Verify the printer is powered on and connected to the network</li>
                    <li>Check that the IP address in Pinewraps POS matches the printer's actual IP</li>
                    <li>Try pinging the printer from your computer to verify network connectivity</li>
                    <li>Ensure no firewall is blocking port 9100 (or your configured port)</li>
                    <li>Restart the printer and check if it obtains a new IP address</li>
                  </ol>
                </div>
                
                <div className="border rounded-md p-3">
                  <h4 className="font-medium">Cash Drawer Not Opening</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                    <li>Verify the printer associated with the drawer is online</li>
                    <li>Check the RJ11 connection between printer and cash drawer</li>
                    <li>Ensure the cash drawer has power (if required)</li>
                    <li>Try both pin 2 and pin 5 settings (the system attempts both)</li>
                    <li>Test if the drawer can be opened manually with a key</li>
                  </ol>
                </div>
                
                <div className="border rounded-md p-3">
                  <h4 className="font-medium">Intermittent Connectivity</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                    <li>Consider assigning a static IP to your printer via your router's DHCP reservation</li>
                    <li>Check for sources of wireless interference if using WiFi</li>
                    <li>Ensure the printer is within good range of your WiFi access point</li>
                    <li>Consider using a wired Ethernet connection for more reliable performance</li>
                  </ol>
                </div>
                
                <div className="border rounded-md p-3">
                  <h4 className="font-medium">Printing Looks Wrong</h4>
                  <ol className="list-decimal list-inside space-y-1 text-sm mt-2">
                    <li>Verify you've selected the correct printer type in Pinewraps POS</li>
                    <li>Check paper is loaded correctly and not jammed</li>
                    <li>Some thermal printers need specific heat settings - consult your manual</li>
                    <li>Ensure you're using the recommended paper type for your printer</li>
                  </ol>
                </div>
              </div>
              
              <div className="bg-green-50 border border-green-200 rounded-md p-4 mt-6">
                <h4 className="font-medium text-green-800">Still Need Help?</h4>
                <p className="text-sm text-green-800 mt-2">
                  If you've tried these troubleshooting steps and are still experiencing issues,
                  please contact Pinewraps support for additional assistance. Be prepared to provide:
                </p>
                <ul className="list-disc list-inside space-y-1 text-sm text-green-800 mt-1">
                  <li>Printer make and model</li>
                  <li>Cash drawer make and model</li>
                  <li>Network configuration details</li>
                  <li>Any error messages displayed</li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
