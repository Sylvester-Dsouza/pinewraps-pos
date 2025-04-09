"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/providers/auth-provider";

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // Check user role from localStorage
        const isKitchenStaff = localStorage.getItem('isKitchenStaff') === 'true';
        const isDesignStaff = localStorage.getItem('isDesignStaff') === 'true';
        const isFinalCheckStaff = localStorage.getItem('isFinalCheckStaff') === 'true';
        const isCashierStaff = localStorage.getItem('isCashierStaff') === 'true';
        
        // Redirect based on staff type
        if (isKitchenStaff) {
          router.replace('/kitchen');
        } else if (isDesignStaff) {
          router.replace('/design');
        } else if (isFinalCheckStaff) {
          router.replace('/final-check');
        } else if (isCashierStaff) {
          router.replace('/pos');
        } else {
          // Default for regular POS users with no staff roles
          // They should have full access to the POS page
          router.replace('/pos');
        }
      } else {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  // Show loading spinner while checking auth state
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
    </div>
  );
}
