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

  const logout = () => {
    Cookies.remove('firebase-token');
    setUser(null);
  };

  return { user, loading, logout };
}
