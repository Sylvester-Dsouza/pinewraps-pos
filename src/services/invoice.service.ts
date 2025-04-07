import { api } from './api';

export const invoiceService = {
  async downloadInvoice(orderId: string) {
    try {
      console.log('Requesting invoice for order:', orderId);
      
      const response = await api.post('/api/invoices/pos', { orderId }, { 
        responseType: 'blob',
        timeout: 30000,
        headers: {
          'Accept': 'application/pdf',
          'Content-Type': 'application/json'
        }
      });
      
      // Log response info
      console.log('Response received:', {
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
        status: response.status
      });

      // Verify response is a PDF
      if (response.headers['content-type'] !== 'application/pdf') {
        throw new Error('Invalid response format. Expected PDF.');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      const filenameMatch = contentDisposition?.match(/filename="(.+?)"/);
      const filename = filenameMatch ? filenameMatch[1] : `invoice-${orderId}.pdf`;
      console.log('Using filename:', filename);

      // Create blob and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup URL after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      
      // Try to read error from blob if available
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          console.error('Error response:', text);
          try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.message || errorData.error || 'Failed to download invoice');
          } catch {
            throw new Error('Failed to download invoice');
          }
        } catch (blobError) {
          console.error('Error reading blob:', blobError);
          throw new Error('Failed to download invoice');
        }
      }
      
      throw new Error(error.message || 'Failed to download invoice');
    }
  },

  async downloadGiftInvoice(orderId: string) {
    try {
      console.log('Requesting gift invoice for order:', orderId);
      
      const response = await api.post('/api/invoices/gift', { orderId }, { 
        responseType: 'blob',
        timeout: 30000,
        headers: {
          'Accept': 'application/pdf',
          'Content-Type': 'application/json'
        }
      });
      
      // Log response info
      console.log('Response received:', {
        contentType: response.headers['content-type'],
        contentLength: response.headers['content-length'],
        status: response.status
      });

      // Verify response is a PDF
      if (response.headers['content-type'] !== 'application/pdf') {
        throw new Error('Invalid response format. Expected PDF.');
      }

      // Get filename from Content-Disposition header or use default
      const contentDisposition = response.headers['content-disposition'];
      const filenameMatch = contentDisposition?.match(/filename="(.+?)"/); 
      const filename = filenameMatch ? filenameMatch[1] : `gift-invoice-${orderId}.pdf`;
      console.log('Using filename:', filename);

      // Create blob and trigger download
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      
      // Create download link
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Cleanup URL after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 1000);

    } catch (error: any) {
      console.error('Error downloading gift invoice:', error);
      
      // Try to read error from blob if available
      if (error.response?.data instanceof Blob) {
        try {
          const text = await error.response.data.text();
          console.error('Error response:', text);
          try {
            const errorData = JSON.parse(text);
            throw new Error(errorData.message || errorData.error || 'Failed to download gift invoice');
          } catch {
            throw new Error('Failed to download gift invoice');
          }
        } catch (blobError) {
          console.error('Error reading blob:', blobError);
          throw new Error('Failed to download gift invoice');
        }
      }
      
      throw new Error(error.message || 'Failed to download gift invoice');
    }
  }
};
