'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import Cookies from 'js-cookie';
import TokenManager from '@/lib/token-manager';
import { toast } from 'sonner';
import SessionExtensionModal from '@/components/session-extension-modal';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
  connectionStatus: string;
  sessionTimeRemaining: number;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshToken: async () => null,
  connectionStatus: 'online',
  sessionTimeRemaining: 0,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [connectionStatus, setConnectionStatus] = useState('online');
  const [sessionTimeRemaining, setSessionTimeRemaining] = useState(0);
  const [showSessionModal, setShowSessionModal] = useState(false);
  const router = useRouter();
  const tokenManager = TokenManager.getInstance();

  const handleSignOut = async () => {
    try {
      await auth.signOut();
      Cookies.remove('firebase-token');
      router.replace('/login');
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  const refreshToken = async () => {
    try {
      return await tokenManager.refreshToken();
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      try {
        if (user) {
          // Get the ID token with force refresh
          const token = await user.getIdToken(true);
          
          // Verify with backend
          const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/auth/verify`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}` // Add token to header as well
            },
            body: JSON.stringify({ token }),
          });

          const data = await response.json();

          if (!response.ok || !data.success) {
            throw new Error(data.message || 'Token verification failed');
          }

          // Check if user has POS access
          const userRole = data.data?.role;
          const allowedRoles = ['POS_USER', 'ADMIN', 'SUPER_ADMIN'];
          if (!allowedRoles.includes(userRole)) {
            console.error('User role not allowed:', userRole);
            throw new Error('Not authorized for POS access');
          }
          
          // Store token in cookie
          Cookies.set('firebase-token', token, {
            expires: 7, // 7 days
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });

          // Store user role information in localStorage for access across the app
          localStorage.setItem('userRole', userRole);
          localStorage.setItem('isKitchenStaff', data.data?.isKitchenStaff ? 'true' : 'false');
          localStorage.setItem('isDesignStaff', data.data?.isDesignStaff ? 'true' : 'false');
          localStorage.setItem('isFinalCheckStaff', data.data?.isFinalCheckStaff ? 'true' : 'false');
          localStorage.setItem('isCashierStaff', data.data?.isCashierStaff ? 'true' : 'false');

          setUser(user);
          
          // If on login page, redirect based on staff type
          if (window.location.pathname === '/login') {
            if (data.data?.isKitchenStaff) {
              router.push('/kitchen');
            } else if (data.data?.isDesignStaff) {
              router.push('/design');
            } else if (data.data?.isFinalCheckStaff) {
              router.push('/final-check');
            } else if (data.data?.isCashierStaff) {
              router.push('/pos');
            } else {
              // For users with no specific staff role, default to POS
              router.push('/pos');
            }
          }
        } else {
          // Remove token from cookie
          Cookies.remove('firebase-token');
          setUser(null);
          
          // Redirect to login if not already there
          if (window.location.pathname !== '/login') {
            router.push('/login');
          }
        }
      } catch (error: any) {
        console.error('Auth state change error:', error);
        // Remove token and user on error
        Cookies.remove('firebase-token');
        setUser(null);
        
        // Show error message
        if (error.message) {
          window.alert(error.message);
        }
        
        // Always redirect to login on error
        router.push('/login');
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // Initialize token manager and setup session monitoring
  useEffect(() => {
    if (!user) return;

    // Initialize token manager
    tokenManager.initialize().catch(error => {
      console.error('Failed to initialize token manager:', error);
    });

    // Setup session time monitoring
    const sessionTimer = setInterval(() => {
      const token = Cookies.get('firebase-token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          const expiresAt = payload.exp * 1000;
          const now = Date.now();
          const timeRemaining = Math.max(0, Math.floor((expiresAt - now) / 1000 / 60)); // minutes
          setSessionTimeRemaining(timeRemaining);

          // Show session extension modal when session is about to expire
          if (timeRemaining <= 10 && timeRemaining > 0 && !showSessionModal) {
            setShowSessionModal(true);
          } else if (timeRemaining > 10) {
            setShowSessionModal(false);
          }
        } catch (error) {
          console.error('Error parsing token for session time:', error);
        }
      }
    }, 60000); // Check every minute

    return () => {
      clearInterval(sessionTimer);
      tokenManager.cleanup();
    };
  }, [user]);

  // Setup connection status monitoring
  useEffect(() => {
    const updateConnectionStatus = () => {
      setConnectionStatus(navigator.onLine ? 'online' : 'offline');
    };

    window.addEventListener('online', updateConnectionStatus);
    window.addEventListener('offline', updateConnectionStatus);

    return () => {
      window.removeEventListener('online', updateConnectionStatus);
      window.removeEventListener('offline', updateConnectionStatus);
    };
  }, []);

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signOut: handleSignOut,
      refreshToken,
      connectionStatus,
      sessionTimeRemaining
    }}>
      {!loading && children}

      {/* Session Extension Modal */}
      <SessionExtensionModal
        isOpen={showSessionModal}
        onClose={() => setShowSessionModal(false)}
        timeRemaining={sessionTimeRemaining}
      />
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
