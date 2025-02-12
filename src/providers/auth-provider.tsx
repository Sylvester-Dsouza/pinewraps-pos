'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, onAuthStateChanged, signOut } from 'firebase/auth';
import { useRouter } from 'next/navigation';
import { auth } from '@/lib/firebase';
import Cookies from 'js-cookie';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  signOut: async () => {},
  refreshToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

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
      if (!user) return null;
      
      // Force refresh the token
      const token = await user.getIdToken(true);
      
      // Store token in cookie
      Cookies.set('firebase-token', token, {
        expires: 7, // 7 days
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict'
      });

      return token;
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
          
          // Store token in cookie
          Cookies.set('firebase-token', token, {
            expires: 7, // 7 days
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'strict'
          });

          setUser(user);
        } else {
          // Remove token from cookie
          Cookies.remove('firebase-token');
          setUser(null);
        }
      } catch (error) {
        console.error('Auth state change error:', error);
        Cookies.remove('firebase-token');
        setUser(null);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  // Set up token refresh interval
  useEffect(() => {
    if (!user) return;

    // Refresh token every 30 minutes
    const interval = setInterval(refreshToken, 30 * 60 * 1000);

    return () => clearInterval(interval);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, signOut: handleSignOut, refreshToken }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
