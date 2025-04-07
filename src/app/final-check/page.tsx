"use client";

import { useEffect, useState } from 'react';
import FinalCheckDisplay from '@/components/final-check/final-check-display';
import { useRouter } from 'next/navigation';
import { AlertCircle } from 'lucide-react';

export default function FinalCheckPage() {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user has final check staff permission
    const isFinalCheckStaff = localStorage.getItem('isFinalCheckStaff') === 'true';
    const userRole = localStorage.getItem('userRole');
    
    // Admin and super admin have access to all screens
    const hasAdminAccess = userRole === 'ADMIN' || userRole === 'SUPER_ADMIN';
    
    setHasPermission(isFinalCheckStaff || hasAdminAccess);
  }, []);

  if (hasPermission === null) {
    // Loading state
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  if (hasPermission === false) {
    // No permission message
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-lg shadow-md max-w-md w-full text-center">
          <AlertCircle className="h-16 w-16 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h1>
          <p className="text-gray-600 mb-6">You do not have permission to access the Final Check Display Screen.</p>
          <button 
            onClick={() => router.push('/pos')} 
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Return to POS
          </button>
        </div>
      </div>
    );
  }

  // User has permission
  return <FinalCheckDisplay />;
}
