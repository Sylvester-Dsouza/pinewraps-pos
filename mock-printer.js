const net = require('net');

// Configuration
const MOCK_PRINTER_PORT = 9101;
const MOCK_PRINTER_IP = '127.0.0.1'; // localhost

// Create a TCP server
const server = net.createServer((socket) => {
  console.log('Client connected to mock printer');
  
  // Handle data from client
  socket.on('data', (data) => {
    console.log('Received printer command:', data);
    
    // Check if this is a printer status check
    if (data.includes(Buffer.from([0x10, 0x04, 0x01]))) {
      console.log('Status check received, responding with OK');
      // Send a response indicating printer is ready
      socket.write(Buffer.from([0x10, 0x04, 0x01, 0x00]));
    }
    
    // Check if this is a cash drawer command
    if (data.includes(Buffer.from([0x1B, 0x70, 0x00]))) {
      console.log('Cash drawer command received');
      // No response needed for drawer command
    }
    
    // For any other commands, just acknowledge
    console.log('Command data (hex):', data.toString('hex'));
    console.log('Command data (text):', data.toString());
  });
  
  // Handle client disconnect
  socket.on('end', () => {
    console.log('Client disconnected from mock printer');
  });
  
  // Handle errors
  socket.on('error', (err) => {
    console.error('Socket error:', err);
  });
});

// Start the server
server.listen(MOCK_PRINTER_PORT, MOCK_PRINTER_IP, () => {
  console.log(`Mock printer server running at ${MOCK_PRINTER_IP}:${MOCK_PRINTER_PORT}`);
  console.log('Use this IP and port in the printer proxy test page');
});

// Handle server errors
server.on('error', (err) => {
  console.error('Server error:', err);
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${MOCK_PRINTER_PORT} is already in use. Try a different port.`);
  }
});

console.log('Press Ctrl+C to stop the mock printer server');
