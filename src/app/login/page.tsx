'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { authApi } from '@/services/api';
import { getAuth, onAuthStateChanged } from 'firebase/auth';
import Cookies from 'js-cookie';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Force logout if needed
  useEffect(() => {
    // Check if this is a logout request (from URL parameter)
    const urlParams = new URLSearchParams(window.location.search);
    const isLogout = urlParams.get('logout') === 'true';
    
    if (isLogout) {
      console.log('Logout requested, clearing auth state...');
      const auth = getAuth();
      auth.signOut().then(() => {
        console.log('Firebase signOut successful');
        // Clear all storage
        Cookies.remove('firebase-token');
        localStorage.clear();
        sessionStorage.clear();
        
        // Remove the logout parameter from URL
        window.history.replaceState({}, document.title, '/login');
      }).catch(err => {
        console.error('Error during signOut:', err);
      });
      return;
    }
    
    // Normal authentication check
    const auth = getAuth();
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user && !isLogout) {
        try {
          // Get fresh token and verify with backend
          const token = await user.getIdToken(true);
          const response = await authApi.verify();
          
          if (response.data.success) {
            // Store token and redirect based on staff role
            Cookies.set('firebase-token', token, {
              expires: 7,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'strict'
            });
            
            // Check user's staff roles
            const userData = response.data.data || response.data.user;
            
            if (userData?.isKitchenStaff) {
              router.replace('/kitchen');
            } else if (userData?.isDesignStaff) {
              router.replace('/design');
            } else if (userData?.isFinalCheckStaff) {
              router.replace('/final-check');
            } else if (userData?.isCashierStaff) {
              router.replace('/pos');
            } else {
              // Default for regular POS users
              router.replace('/pos');
            }
          }
        } catch (error) {
          console.error('Verification failed:', error);
          // If verification fails, sign out
          auth.signOut();
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Login with email/password
      const response = await authApi.login(email, password);
      
      if (response && !response.success) {
        throw new Error(response.message || 'Login failed');
      }

      // Redirect will be handled by the useEffect above
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Handle different types of errors
      if (error.response?.data?.message) {
        // API error with message
        setError(error.response.data.message);
      } else if (error.code === 'auth/wrong-password') {
        // Firebase auth errors
        setError('Invalid password');
      } else if (error.code === 'auth/user-not-found') {
        setError('User not found');
      } else if (error.code === 'auth/too-many-requests') {
        setError('Too many login attempts. Please try again later.');
      } else if (error.code === 'auth/invalid-credential') {
        setError('Invalid credentials. Please check your email and password.');
      } else if (error.code === 'auth/invalid-email') {
        setError('Invalid email format.');
      } else if (error.message) {
        // Generic error with message
        setError(error.message);
      } else {
        // Fallback error message
        setError('Failed to login. Please check your credentials.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow-lg">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            POS Login
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleLogin}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {error && (
            <div className="text-red-500 text-sm text-center">{error}</div>
          )}

          <div>
            <button
              type="submit"
              disabled={loading}
              className={`group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 ${
                loading ? 'opacity-50 cursor-not-allowed' : ''
              }`}
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
