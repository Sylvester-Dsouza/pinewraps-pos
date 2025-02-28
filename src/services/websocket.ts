import { getAuth, onAuthStateChanged } from 'firebase/auth';

class WebSocketService {
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000; // Start with 1 second delay
  private subscribers: { [key: string]: ((data: any) => void)[] } = {};
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private authInitialized = false;
  private user: any = null;

  constructor(user?: any) {
    if (typeof window !== 'undefined') {
      if (user) {
        this.user = user;
        this.authInitialized = true;
        this.connect();
      } else {
        this.initializeAuth();
      }
    }
  }

  private initializeAuth() {
    const auth = getAuth();
    onAuthStateChanged(auth, (user) => {
      console.log('Auth state changed:', user ? 'User logged in' : 'No user');
      this.authInitialized = true;
      this.user = user;
      if (user) {
        this.connect();
      } else if (this.ws) {
        this.ws.close();
      }
    });
  }

  private async getAuthToken(): Promise<string | null> {
    if (this.user) {
      return this.user.getIdToken();
    }

    if (!this.authInitialized) {
      console.log('Waiting for auth to initialize...');
      return new Promise((resolve) => {
        const auth = getAuth();
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          unsubscribe();
          this.user = user;
          if (user) {
            user.getIdToken().then(resolve);
          } else {
            resolve(null);
          }
        });
      });
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      this.user = user;
      if (user) {
        return await user.getIdToken();
      }
    } catch (error) {
      console.error('Error getting auth token:', error);
    }
    return null;
  }

  private getWebSocketUrl(): string {
    if (typeof window === 'undefined') return '';

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
    const url = new URL(baseUrl);
    
    return `${protocol}//${url.host}/ws`;
  }

  private async connect() {
    if (this.isConnecting || typeof window === 'undefined') return;
    
    try {
      this.isConnecting = true;
      
      // Get auth token
      const token = await this.getAuthToken();
      if (!token) {
        console.error('No auth token available, waiting for authentication...');
        this.scheduleReconnect();
        return;
      }

      const wsUrl = this.getWebSocketUrl();
      console.log('Connecting to WebSocket:', wsUrl);
      
      // Add token to URL
      const url = new URL(wsUrl);
      url.searchParams.append('token', token);
      
      this.ws = new WebSocket(url.toString());

      this.ws.onopen = () => {
        console.log('WebSocket connected successfully');
        this.reconnectAttempts = 0;
        this.reconnectDelay = 1000;
        this.isConnecting = false;
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('WebSocket message received:', data);
          if (data.type && this.subscribers[data.type]) {
            this.subscribers[data.type].forEach(callback => callback(data.data));
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
        }
      };

      this.ws.onclose = (event) => {
        console.log('WebSocket connection closed:', event.code, event.reason);
        this.isConnecting = false;
        this.scheduleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
        this.scheduleReconnect();
      };

    } catch (error) {
      console.error('Error connecting to WebSocket:', error);
      this.isConnecting = false;
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      console.log(`Scheduling reconnect attempt ${this.reconnectAttempts + 1} in ${this.reconnectDelay}ms`);
      this.reconnectTimer = setTimeout(() => {
        this.reconnectAttempts++;
        this.reconnectDelay *= 2; // Exponential backoff
        this.connect();
      }, this.reconnectDelay);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  public subscribe(event: string, callback: (data: any) => void): () => void {
    if (!this.subscribers[event]) {
      this.subscribers[event] = [];
    }
    this.subscribers[event].push(callback);

    // If not connected and authenticated, try to connect
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      this.connect();
    }

    return () => {
      this.subscribers[event] = this.subscribers[event].filter(cb => cb !== callback);
    };
  }

  public reconnect() {
    this.reconnectAttempts = 0;
    this.reconnectDelay = 1000;
    if (this.ws) {
      this.ws.close();
    }
    this.connect();
  }

  // Disconnect WebSocket
  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    this.subscribers = {};
    this.reconnectAttempts = 0;
    console.log('WebSocket disconnected');
  }
}

// Create a singleton instance for backward compatibility
const wsService = typeof window !== 'undefined' ? new WebSocketService() : null;
export default WebSocketService;
export { wsService };
