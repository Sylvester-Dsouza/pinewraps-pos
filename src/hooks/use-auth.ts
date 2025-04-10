import { useEffect, useState } from 'react';
import { api } from '@/lib/axios';
import Cookies from 'js-cookie';

export interface User {
  id: string;
  email: string;
  role: string;
  name?: string;
}

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = Cookies.get('firebase-token');
    if (!token) {
      setLoading(false);
      return;
    }

    const verifyToken = async () => {
      try {
        const response = await api.post('/api/auth/verify', { token });
        setUser(response.data.data);
      } catch (error) {
        console.error('Error verifying token:', error);
        Cookies.remove('firebase-token');
      } finally {
        setLoading(false);
      }
    };

    verifyToken();
  }, []);

  const logout = async () => {
    // Remove the auth token
    Cookies.remove('firebase-token');
    
    // Clear any staff role flags from localStorage
    localStorage.removeItem('isKitchenStaff');
    localStorage.removeItem('isDesignStaff');
    localStorage.removeItem('isFinalCheckStaff');
    localStorage.removeItem('isCashierStaff');
    localStorage.removeItem('userRole');
    
    // Reset user state
    setUser(null);
    
    // Unregister service worker to prevent caching issues
    if ('serviceWorker' in navigator) {
      try {
        const registrations = await navigator.serviceWorker.getRegistrations();
        for (const registration of registrations) {
          await registration.unregister();
          console.log('Service Worker unregistered');
        }
        
        // Clear caches to ensure fresh data after login
        if ('caches' in window) {
          const cacheNames = await caches.keys();
          await Promise.all(cacheNames.map(cacheName => caches.delete(cacheName)));
          console.log('Caches cleared');
        }
      } catch (error) {
        console.error('Error during service worker cleanup:', error);
      }
    }
    
    // Force redirect to login page using window.location
    // This is the most reliable way to ensure a complete navigation
    window.location.href = '/login';
  };

  return { user, loading, logout };
}
