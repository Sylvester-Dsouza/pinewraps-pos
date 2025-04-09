import React, { useState } from 'react';
import { Button, TextField, Paper, Typography, Box, CircularProgress, Alert, ButtonGroup } from '@mui/material';
import { testPrinterConnection } from '../../services/printer';

interface PrinterConnectionTestProps {
  onConnectionSuccess?: (ip: string, port: number) => void;
}

const PrinterConnectionTest: React.FC<PrinterConnectionTestProps> = ({ onConnectionSuccess }) => {
  const [ip, setIp] = useState<string>('');
  const [port, setPort] = useState<string>('9100');
  const [testing, setTesting] = useState<boolean>(false);
  const [result, setResult] = useState<{ connected: boolean; message: string } | null>(null);

  const handleTest = async () => {
    if (!ip) {
      setResult({
        connected: false,
        message: 'Please enter an IP address'
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const portNumber = parseInt(port, 10) || 9100;
      const testResult = await testPrinterConnection(ip, portNumber);
      
      setResult(testResult);
      
      if (testResult.connected && onConnectionSuccess) {
        onConnectionSuccess(ip, portNumber);
      }
    } catch (error: any) {
      console.error('Test connection error:', error);
      setResult({
        connected: false,
        message: `Error: ${error.message || 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handlePrintTest = async (action: 'print' | 'print-and-open') => {
    if (!ip) {
      setResult({
        connected: false,
        message: 'Please enter an IP address'
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const portNumber = parseInt(port, 10) || 9100;
      
      // First test the connection
      const testResult = await testPrinterConnection(ip, portNumber);
      
      if (!testResult.connected) {
        setResult(testResult);
        setTesting(false);
        return;
      }
      
      // Use the printer proxy directly instead of going through the API
      const PRINTER_PROXY_URL = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
      const proxyEndpoint = action === 'print' ? `${PRINTER_PROXY_URL}/test-print` : `${PRINTER_PROXY_URL}/print-and-open`;
      
      console.log(`Sending ${action} request directly to printer proxy at ${proxyEndpoint} with IP: ${ip}, Port: ${portNumber}`);
      
      const response = await fetch(proxyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ip: ip,
          port: portNumber,
          type: 'test',
          skipConnectivityCheck: true
        })
      });
      
      console.log(`${action} response status:`, response.status);
      const data = await response.json();
      console.log(`${action} response data:`, data);
      
      setResult({
        connected: data.success,
        message: data.success 
          ? `${action === 'print' ? 'Print' : 'Print and open drawer'} operation successful` 
          : `Error: ${data.error || 'Unknown error'}`
      });
      
      if (data.success && onConnectionSuccess) {
        onConnectionSuccess(ip, portNumber);
      }
    } catch (error: any) {
      console.error(`${action} error:`, error);
      setResult({
        connected: false,
        message: `Error: ${error.message || 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  // Direct API call without going through the test-direct endpoint
  const handleDirectPrintTest = async (action: 'print' | 'print-and-open') => {
    if (!ip) {
      setResult({
        connected: false,
        message: 'Please enter an IP address'
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const portNumber = parseInt(port, 10) || 9100;
      
      // Determine the proxy URL
      const proxyUrl = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
      
      // Determine the endpoint based on the action
      const endpoint = action === 'print' ? '/print-test' : '/print-and-open-test';
      
      console.log(`Sending direct ${action} request to ${proxyUrl}${endpoint} with IP: ${ip}, Port: ${portNumber}`);
      
      const response = await fetch(`${proxyUrl}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ip: ip,
          port: portNumber,
          skipConnectivityCheck: true
        })
      });
      
      console.log(`Direct ${action} response status:`, response.status);
      const data = await response.json();
      console.log(`Direct ${action} response data:`, data);
      
      setResult({
        connected: data.success,
        message: data.success 
          ? `${action === 'print' ? 'Print' : 'Print and open drawer'} operation successful` 
          : `Error: ${data.error || 'Unknown error'}`
      });
      
    } catch (error: any) {
      console.error(`Direct ${action} error:`, error);
      setResult({
        connected: false,
        message: `Error: ${error.message || 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  // Function to handle opening the cash drawer directly
  const handleOpenCashDrawer = async () => {
    if (!ip) {
      setResult({
        connected: false,
        message: 'Please enter an IP address'
      });
      return;
    }

    setTesting(true);
    setResult(null);

    try {
      const portNumber = parseInt(port, 10) || 9100;
      
      // Determine the proxy URL
      const proxyUrl = process.env.NEXT_PUBLIC_PRINTER_PROXY_URL || 'http://localhost:3005';
      
      console.log(`Sending open-drawer request to ${proxyUrl}/open-drawer with IP: ${ip}, Port: ${portNumber}`);
      
      const response = await fetch(`${proxyUrl}/open-drawer`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ip: ip,
          port: portNumber,
          skipConnectivityCheck: true
        })
      });
      
      console.log(`Open drawer response status:`, response.status);
      const data = await response.json();
      console.log(`Open drawer response data:`, data);
      
      setResult({
        connected: data.success,
        message: data.success 
          ? 'Cash drawer opened successfully' 
          : `Error: ${data.error || 'Unknown error'}`
      });
      
    } catch (error: any) {
      console.error(`Open drawer error:`, error);
      setResult({
        connected: false,
        message: `Error: ${error.message || 'Unknown error'}`
      });
    } finally {
      setTesting(false);
    }
  };

  return (
    <Paper elevation={2} sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Printer Connection Test
      </Typography>
      <Typography variant="body2" color="text.secondary" paragraph>
        Test the connection to your printer through the printer proxy service.
      </Typography>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <TextField
          label="Printer IP"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="192.168.1.100"
          fullWidth
          size="small"
        />
        <TextField
          label="Port"
          value={port}
          onChange={(e) => setPort(e.target.value)}
          type="number"
          sx={{ width: '120px' }}
          size="small"
        />
      </Box>
      
      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        <Button 
          variant="contained" 
          onClick={handleTest}
          disabled={testing}
          startIcon={testing ? <CircularProgress size={20} color="inherit" /> : null}
        >
          {testing ? 'Testing...' : 'Test Connection'}
        </Button>
        
        <ButtonGroup variant="outlined" disabled={testing}>
          <Button 
            onClick={() => handlePrintTest('print')}
            disabled={testing}
          >
            Print Test
          </Button>
          <Button 
            onClick={() => handlePrintTest('print-and-open')}
            disabled={testing}
          >
            Print & Open Drawer
          </Button>
          <Button 
            onClick={handleOpenCashDrawer}
            disabled={testing}
          >
            Open Cash Drawer
          </Button>
        </ButtonGroup>
      </Box>
      
      {result && (
        <Box sx={{ mt: 2 }}>
          <Alert severity={result.connected ? 'success' : 'error'}>
            {result.message}
          </Alert>
        </Box>
      )}
    </Paper>
  );
};

export default PrinterConnectionTest;
