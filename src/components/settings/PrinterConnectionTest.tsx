import React, { useState } from 'react';
import { Button, TextField, Paper, Typography, Box, CircularProgress, Alert } from '@mui/material';
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
      
      <Button 
        variant="contained" 
        onClick={handleTest}
        disabled={testing}
        startIcon={testing ? <CircularProgress size={20} color="inherit" /> : null}
      >
        {testing ? 'Testing...' : 'Test Connection'}
      </Button>
      
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
