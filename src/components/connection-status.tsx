'use client';

import React from 'react';
import { useAuth } from '@/providers/auth-provider';
import { Wifi, WifiOff, Clock, AlertTriangle } from 'lucide-react';

export function ConnectionStatus() {
  const { connectionStatus, sessionTimeRemaining } = useAuth();

  const getStatusIcon = () => {
    switch (connectionStatus) {
      case 'online':
        return <Wifi className="h-4 w-4 text-green-500" />;
      case 'offline':
        return <WifiOff className="h-4 w-4 text-red-500" />;
      case 'checking':
        return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
      default:
        return <Wifi className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusText = () => {
    switch (connectionStatus) {
      case 'online':
        return 'Online';
      case 'offline':
        return 'Offline';
      case 'checking':
        return 'Checking...';
      default:
        return 'Unknown';
    }
  };

  const getStatusColor = () => {
    switch (connectionStatus) {
      case 'online':
        return 'text-green-600 bg-green-50 border-green-200';
      case 'offline':
        return 'text-red-600 bg-red-50 border-red-200';
      case 'checking':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getSessionColor = () => {
    if (sessionTimeRemaining <= 10) {
      return 'text-red-600';
    } else if (sessionTimeRemaining <= 30) {
      return 'text-yellow-600';
    }
    return 'text-green-600';
  };

  return (
    <div className="flex items-center gap-4 px-3 py-2 text-sm">
      {/* Connection Status */}
      <div className={`flex items-center gap-2 px-2 py-1 rounded-md border ${getStatusColor()}`}>
        {getStatusIcon()}
        <span className="font-medium">{getStatusText()}</span>
      </div>

      {/* Session Time */}
      {sessionTimeRemaining > 0 && (
        <div className="flex items-center gap-1">
          <Clock className="h-4 w-4 text-gray-500" />
          <span className={`font-medium ${getSessionColor()}`}>
            {sessionTimeRemaining}m
          </span>
        </div>
      )}
    </div>
  );
}

export default ConnectionStatus;
