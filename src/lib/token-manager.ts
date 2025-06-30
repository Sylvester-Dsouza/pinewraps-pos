'use client';

import { getAuth, User } from 'firebase/auth';
import Cookies from 'js-cookie';
import { toast } from 'sonner';

interface TokenInfo {
  token: string;
  expiresAt: number;
  issuedAt: number;
}

class TokenManager {
  private static instance: TokenManager;
  private refreshPromise: Promise<string> | null = null;
  private refreshTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isRefreshing = false;
  private pendingRequests: Array<{
    resolve: (token: string) => void;
    reject: (error: Error) => void;
  }> = [];

  private constructor() {
    this.setupVisibilityListener();
    this.setupHeartbeat();
  }

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  /**
   * Get current valid token, refreshing if necessary
   */
  async getValidToken(): Promise<string> {
    try {
      const currentToken = this.getCurrentToken();
      
      if (currentToken && this.isTokenValid(currentToken)) {
        return currentToken;
      }

      // If already refreshing, wait for the current refresh
      if (this.isRefreshing && this.refreshPromise) {
        return await this.refreshPromise;
      }

      // Start new refresh
      return await this.refreshToken();
    } catch (error) {
      console.error('Error getting valid token:', error);
      throw error;
    }
  }

  /**
   * Get current token from cookie
   */
  private getCurrentToken(): string | null {
    return Cookies.get('firebase-token') || null;
  }

  /**
   * Check if token is valid and not expired
   */
  private isTokenValid(token: string): boolean {
    try {
      // Decode JWT payload to check expiry
      const payload = JSON.parse(atob(token.split('.')[1]));
      const expiresAt = payload.exp * 1000; // Convert to milliseconds
      const now = Date.now();
      
      // Consider token invalid if it expires in the next 5 minutes
      const bufferTime = 5 * 60 * 1000; // 5 minutes
      return expiresAt > (now + bufferTime);
    } catch (error) {
      console.error('Error validating token:', error);
      return false;
    }
  }

  /**
   * Refresh the Firebase token
   */
  async refreshToken(): Promise<string> {
    if (this.isRefreshing && this.refreshPromise) {
      return await this.refreshPromise;
    }

    this.isRefreshing = true;
    this.refreshPromise = this.performTokenRefresh();

    try {
      const token = await this.refreshPromise;
      this.isRefreshing = false;
      this.refreshPromise = null;
      
      // Resolve any pending requests
      this.pendingRequests.forEach(({ resolve }) => resolve(token));
      this.pendingRequests = [];
      
      return token;
    } catch (error) {
      this.isRefreshing = false;
      this.refreshPromise = null;
      
      // Reject any pending requests
      this.pendingRequests.forEach(({ reject }) => reject(error as Error));
      this.pendingRequests = [];
      
      throw error;
    }
  }

  /**
   * Perform the actual token refresh with retry logic
   */
  private async performTokenRefresh(): Promise<string> {
    const auth = getAuth();
    const user = auth.currentUser;

    if (!user) {
      throw new Error('No authenticated user found');
    }

    let retryCount = 0;
    const maxRetries = 3;
    const baseDelay = 1000; // 1 second

    while (retryCount < maxRetries) {
      try {
        console.log(`Token refresh attempt ${retryCount + 1}/${maxRetries}`);
        
        // Force refresh the token
        const token = await user.getIdToken(true);
        
        // Store token in cookie with proper expiry
        Cookies.set('firebase-token', token, {
          expires: 1, // 1 day (Firebase tokens expire in 1 hour, but we refresh proactively)
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict'
        });

        console.log('Token refreshed successfully');
        this.scheduleNextRefresh();
        
        return token;
      } catch (error: any) {
        retryCount++;
        console.error(`Token refresh attempt ${retryCount} failed:`, error);
        
        if (retryCount >= maxRetries) {
          console.error('All token refresh attempts failed');
          this.handleRefreshFailure(error);
          throw new Error('Failed to refresh token after multiple attempts');
        }
        
        // Exponential backoff
        const delay = baseDelay * Math.pow(2, retryCount - 1);
        console.log(`Retrying token refresh in ${delay}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw new Error('Token refresh failed');
  }

  /**
   * Schedule the next token refresh
   */
  private scheduleNextRefresh(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
    }

    // Refresh token every 45 minutes (15 minutes before Firebase token expires)
    const refreshInterval = 45 * 60 * 1000; // 45 minutes
    
    this.refreshTimer = setTimeout(() => {
      console.log('Scheduled token refresh triggered');
      this.refreshToken().catch(error => {
        console.error('Scheduled token refresh failed:', error);
      });
    }, refreshInterval);
  }

  /**
   * Handle token refresh failure
   */
  private handleRefreshFailure(error: any): void {
    console.error('Token refresh failed completely:', error);
    
    // Clear stored token
    Cookies.remove('firebase-token');
    
    // Show user-friendly error
    toast.error('Session expired. Please log in again.', {
      duration: 5000,
    });
    
    // Redirect to login after a short delay
    setTimeout(() => {
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }, 2000);
  }

  /**
   * Setup visibility change listener for background refresh
   */
  private setupVisibilityListener(): void {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) {
          console.log('App became visible, checking token validity');
          this.checkAndRefreshToken();
        }
      });
    }
  }

  /**
   * Setup heartbeat to keep session alive
   */
  private setupHeartbeat(): void {
    // Send heartbeat every 10 minutes
    this.heartbeatTimer = setInterval(() => {
      this.checkAndRefreshToken();
    }, 10 * 60 * 1000);
  }

  /**
   * Check token and refresh if needed
   */
  private async checkAndRefreshToken(): Promise<void> {
    try {
      const currentToken = this.getCurrentToken();
      if (!currentToken || !this.isTokenValid(currentToken)) {
        console.log('Token invalid or expired, refreshing...');
        await this.refreshToken();
      }
    } catch (error) {
      console.error('Error checking token:', error);
    }
  }

  /**
   * Initialize token manager
   */
  async initialize(): Promise<void> {
    try {
      await this.getValidToken();
      this.scheduleNextRefresh();
      console.log('Token manager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize token manager:', error);
      throw error;
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.refreshTimer) {
      clearTimeout(this.refreshTimer);
      this.refreshTimer = null;
    }
    
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
    
    this.pendingRequests = [];
    this.isRefreshing = false;
    this.refreshPromise = null;
  }

  /**
   * Force logout and cleanup
   */
  async logout(): Promise<void> {
    this.cleanup();
    Cookies.remove('firebase-token');
    
    const auth = getAuth();
    await auth.signOut();
    
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
  }
}

export default TokenManager;
