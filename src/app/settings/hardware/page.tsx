'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { localHardwareService } from '@/services/local-hardware.service';

export default function HardwareSettingsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  
  const [bridgeUrl, setBridgeUrl] = useState('');
  const [accessToken, setAccessToken] = useState('');
  const [printerIp, setPrinterIp] = useState('');
  const [printerPort, setPrinterPort] = useState('9100');
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [bridgeStatus, setBridgeStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  const [printerStatus, setPrinterStatus] = useState<'unknown' | 'connected' | 'disconnected'>('unknown');
  
  // Load existing configuration
  useEffect(() => {
    const config = localHardwareService.getConfig();
    if (config) {
      setBridgeUrl(config.bridgeUrl || '');
      setAccessToken(config.accessToken || '');
      setPrinterIp(config.printerIp || '');
      setPrinterPort(config.printerPort?.toString() || '9100');
    }
  }, []);
  
  // Check connection status when component mounts
  useEffect(() => {
    if (localHardwareService.isConfigured()) {
      checkConnections();
    }
  }, []);
  
  // Handle save configuration
  const handleSave = async () => {
    if (!bridgeUrl || !accessToken || !printerIp) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setIsSaving(true);
    
    try {
      localHardwareService.initialize({
        bridgeUrl,
        accessToken,
        printerIp,
        printerPort: parseInt(printerPort, 10)
      });
      
      toast.success('Hardware configuration saved');
      
      // Check connections after saving
      await checkConnections();
    } catch (error) {
      console.error('Error saving hardware configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };
  
  // Check bridge and printer connections
  const checkConnections = async () => {
    setIsTesting(true);
    
    try {
      // Check bridge connection
      const bridgeConnected = await localHardwareService.checkBridgeConnection();
      setBridgeStatus(bridgeConnected ? 'connected' : 'disconnected');
      
      // If bridge is connected, check printer
      if (bridgeConnected) {
        const printerConnected = await localHardwareService.checkPrinterConnection();
        setPrinterStatus(printerConnected ? 'connected' : 'disconnected');
      } else {
        setPrinterStatus('unknown');
      }
    } catch (error) {
      console.error('Error checking connections:', error);
      setBridgeStatus('disconnected');
      setPrinterStatus('unknown');
      toast.error('Failed to check connections');
    } finally {
      setIsTesting(false);
    }
  };
  
  // Test the cash drawer
  const testCashDrawer = async () => {
    setIsTesting(true);
    
    try {
      const result = await localHardwareService.openCashDrawer();
      
      if (result.success) {
        toast.success('Cash drawer opened successfully');
      } else {
        toast.error(result.error || 'Failed to open cash drawer');
      }
    } catch (error) {
      console.error('Error testing cash drawer:', error);
      toast.error('Failed to open cash drawer');
    } finally {
      setIsTesting(false);
    }
  };
  
  // If still loading or no user, show loading state
  if (authLoading || !user) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Local Hardware Settings</h1>
      
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <h2 className="text-xl font-semibold mb-4">Hardware Bridge Configuration</h2>
        <p className="text-gray-600 mb-4">
          Configure the connection to your local hardware bridge server. This allows your Vercel-hosted POS to 
          communicate with local hardware like printers and cash drawers.
        </p>
        
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Bridge Server URL <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={bridgeUrl}
              onChange={(e) => setBridgeUrl(e.target.value)}
              placeholder="http://localhost:3005"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              The URL of your local hardware bridge server (e.g., http://localhost:3005)
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Access Token <span className="text-red-500">*</span>
            </label>
            <input
              type="password"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              placeholder="Enter access token"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              The secret token configured in your bridge server's .env file
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Printer IP Address <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={printerIp}
              onChange={(e) => setPrinterIp(e.target.value)}
              placeholder="192.168.1.100"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              The IP address of your Epson TM-M30 printer
            </p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Printer Port
            </label>
            <input
              type="text"
              value={printerPort}
              onChange={(e) => setPrinterPort(e.target.value)}
              placeholder="9100"
              className="w-full p-2 border border-gray-300 rounded-md"
            />
            <p className="text-xs text-gray-500 mt-1">
              The port your printer is using (default: 9100)
            </p>
          </div>
        </div>
        
        <div className="mt-6 flex flex-wrap gap-4">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-blue-300"
          >
            {isSaving ? 'Saving...' : 'Save Configuration'}
          </button>
          
          <button
            onClick={checkConnections}
            disabled={isTesting || !localHardwareService.isConfigured()}
            className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:bg-gray-300"
          >
            {isTesting ? 'Checking...' : 'Check Connections'}
          </button>
          
          <button
            onClick={testCashDrawer}
            disabled={isTesting || !localHardwareService.isConfigured() || bridgeStatus !== 'connected' || printerStatus !== 'connected'}
            className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-green-300"
          >
            {isTesting ? 'Testing...' : 'Test Cash Drawer'}
          </button>
        </div>
      </div>
      
      <div className="bg-white rounded-lg shadow-md p-6">
        <h2 className="text-xl font-semibold mb-4">Connection Status</h2>
        
        <div className="space-y-4">
          <div className="flex items-center">
            <div className="mr-3">Bridge Server:</div>
            <div className="flex items-center">
              {bridgeStatus === 'unknown' && (
                <span className="px-2 py-1 bg-gray-200 text-gray-800 rounded-full text-xs">Unknown</span>
              )}
              {bridgeStatus === 'connected' && (
                <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs">Connected</span>
              )}
              {bridgeStatus === 'disconnected' && (
                <span className="px-2 py-1 bg-red-200 text-red-800 rounded-full text-xs">Disconnected</span>
              )}
            </div>
          </div>
          
          <div className="flex items-center">
            <div className="mr-3">Printer:</div>
            <div className="flex items-center">
              {printerStatus === 'unknown' && (
                <span className="px-2 py-1 bg-gray-200 text-gray-800 rounded-full text-xs">Unknown</span>
              )}
              {printerStatus === 'connected' && (
                <span className="px-2 py-1 bg-green-200 text-green-800 rounded-full text-xs">Connected</span>
              )}
              {printerStatus === 'disconnected' && (
                <span className="px-2 py-1 bg-red-200 text-red-800 rounded-full text-xs">Disconnected</span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
