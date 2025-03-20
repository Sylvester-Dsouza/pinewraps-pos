'use client';

import { useState, useEffect } from 'react';
import Cookies from 'js-cookie';
import axios from 'axios';

const baseURL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function useUserRole() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUserRole = async () => {
      try {
        const token = Cookies.get('firebase-token');
        if (!token) {
          setLoading(false);
          return;
        }

        const response = await axios.post(
          `${baseURL}/api/auth/verify`,
          { token },
          {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          }
        );

        if (response.data.success && response.data.data?.role) {
          setUserRole(response.data.data.role);
        }
      } catch (error) {
        console.error('Error fetching user role:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserRole();
  }, []);

  const isSuperAdmin = userRole === 'SUPER_ADMIN';
  
  return {
    userRole,
    loading,
    isSuperAdmin
  };
}
