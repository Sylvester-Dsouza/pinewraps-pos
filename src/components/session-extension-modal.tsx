'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface SessionExtensionModalProps {
  isOpen: boolean;
  onClose: () => void;
  timeRemaining: number;
}

export function SessionExtensionModal({ isOpen, onClose, timeRemaining }: SessionExtensionModalProps) {
  const { refreshToken } = useAuth();
  const [isExtending, setIsExtending] = useState(false);
  const [countdown, setCountdown] = useState(timeRemaining);

  useEffect(() => {
    if (!isOpen) return;

    setCountdown(timeRemaining);
    
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoLogout();
          return 0;
        }
        return prev - 1;
      });
    }, 60000); // Update every minute

    return () => clearInterval(timer);
  }, [isOpen, timeRemaining]);

  const handleExtendSession = async () => {
    setIsExtending(true);
    try {
      await refreshToken();
      toast.success('Session extended successfully', {
        duration: 3000,
      });
      onClose();
    } catch (error) {
      console.error('Failed to extend session:', error);
      toast.error('Failed to extend session. Please log in again.', {
        duration: 5000,
      });
    } finally {
      setIsExtending(false);
    }
  };

  const handleAutoLogout = () => {
    toast.error('Session expired. Logging out...', {
      duration: 3000,
    });
    setTimeout(() => {
      window.location.href = '/login';
    }, 3000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4 shadow-xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-100 rounded-full">
            <AlertTriangle className="h-6 w-6 text-yellow-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900">Session Expiring Soon</h2>
        </div>

        <div className="mb-6">
          <p className="text-gray-600 mb-4">
            Your session will expire in <span className="font-semibold text-red-600">{countdown} minutes</span>.
            Would you like to extend your session?
          </p>
          
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Session will be extended for another hour</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            disabled={isExtending}
          >
            Dismiss
          </button>
          <button
            onClick={handleExtendSession}
            disabled={isExtending}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isExtending ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                Extending...
              </>
            ) : (
              'Extend Session'
            )}
          </button>
        </div>

        <div className="mt-4 text-xs text-gray-500 text-center">
          If no action is taken, you will be automatically logged out when the session expires.
        </div>
      </div>
    </div>
  );
}

export default SessionExtensionModal;
