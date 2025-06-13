'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { drawerService } from '@/services/drawer.service';
import { toast } from 'react-hot-toast';

interface DrawerStatusContextType {
  isDrawerOpen: boolean;
  checkDrawerStatus: () => Promise<boolean>;
  loading: boolean;
}

const DrawerStatusContext = createContext<DrawerStatusContextType>({
  isDrawerOpen: false,
  checkDrawerStatus: async () => false,
  loading: true,
});

export const useDrawerStatus = () => useContext(DrawerStatusContext);

export function DrawerStatusProvider({ children }: { children: React.ReactNode }) {
  const [isDrawerOpen, setIsDrawerOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  const checkDrawerStatus = async () => {
    try {
      setLoading(true);
      const response = await drawerService.getCurrentSession();
      console.log('Drawer session response:', response);

      // The backend returns the session object directly, and axios wraps it in response.data
      // So the session is at response.data, and the status is at response.data.status
      const session = response.data;
      const isOpen = session?.status === 'OPEN';

      console.log('Session object:', session);
      console.log('Session status:', session?.status);
      console.log('Is drawer open:', isOpen);

      setIsDrawerOpen(isOpen);
      return isOpen;
    } catch (error) {
      console.error('Error checking drawer status:', error);
      setIsDrawerOpen(false);
      return false;
    } finally {
      setLoading(false);
    }
  };

  // Check drawer status on mount and set up polling
  useEffect(() => {
    // Initial check
    checkDrawerStatus();
    
    // Set up polling every 30 seconds
    const intervalId = setInterval(() => {
      checkDrawerStatus();
    }, 30000);
    
    // Clean up interval on unmount
    return () => clearInterval(intervalId);
  }, []);

  return (
    <DrawerStatusContext.Provider value={{ isDrawerOpen, checkDrawerStatus, loading }}>
      {children}
    </DrawerStatusContext.Provider>
  );
}
