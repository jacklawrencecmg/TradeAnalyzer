import React, { useState, useEffect } from 'react';
import { AlertTriangle, WrenchIcon, ShieldAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';

type SystemMode = 'normal' | 'maintenance' | 'safe_mode';

interface SystemModeInfo {
  mode: SystemMode;
  message: string;
  severity: 'info' | 'warning' | 'critical';
}

export default function SystemModeBanner() {
  const [modeInfo, setModeInfo] = useState<SystemModeInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    checkSystemMode();
    const interval = setInterval(checkSystemMode, 30000);
    return () => clearInterval(interval);
  }, []);

  const checkSystemMode = async () => {
    try {
      const { data, error } = await supabase.rpc('get_system_mode');

      if (error) {
        console.error('Failed to check system mode:', error);
        setIsLoading(false);
        return;
      }

      const mode = data as SystemMode;

      if (mode === 'normal') {
        setModeInfo(null);
      } else if (mode === 'maintenance') {
        setModeInfo({
          mode: 'maintenance',
          message: 'System maintenance in progress. Player values and rankings are read-only and may be temporarily stale.',
          severity: 'warning',
        });
      } else if (mode === 'safe_mode') {
        setModeInfo({
          mode: 'safe_mode',
          message: 'SAFE MODE ACTIVE: System detected critical issues. Displaying validated snapshot. Some features may be unavailable.',
          severity: 'critical',
        });
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error checking system mode:', err);
      setIsLoading(false);
    }
  };

  if (isLoading || !modeInfo) {
    return null;
  }

  const getBgColor = () => {
    switch (modeInfo.severity) {
      case 'critical':
        return 'bg-red-600';
      case 'warning':
        return 'bg-yellow-500';
      default:
        return 'bg-blue-500';
    }
  };

  const getIcon = () => {
    switch (modeInfo.mode) {
      case 'safe_mode':
        return <ShieldAlert className="w-6 h-6" />;
      case 'maintenance':
        return <WrenchIcon className="w-6 h-6" />;
      default:
        return <AlertTriangle className="w-6 h-6" />;
    }
  };

  return (
    <div className={`${getBgColor()} text-white py-3 px-4 shadow-lg`}>
      <div className="max-w-7xl mx-auto flex items-center gap-3">
        {getIcon()}
        <div className="flex-1">
          <div className="font-bold uppercase text-sm tracking-wide">
            {modeInfo.mode === 'safe_mode' ? 'Safe Mode' : 'Maintenance Mode'}
          </div>
          <div className="text-sm">{modeInfo.message}</div>
        </div>
        {modeInfo.mode === 'safe_mode' && (
          <div className="text-xs bg-white/20 px-3 py-1 rounded">
            Limited Functionality
          </div>
        )}
      </div>
    </div>
  );
}
