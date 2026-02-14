import { useState, useEffect, useRef } from 'react';
import { Bell, TrendingUp, TrendingDown, AlertCircle, X, Check } from 'lucide-react';
import { getSessionId } from '../lib/session/getSessionId';

interface Alert {
  alert_id: string;
  player_id: string;
  player_name: string;
  alert_type: string;
  message: string;
  severity: 'low' | 'medium' | 'high';
  created_at: string;
  metadata: any;
}

interface AlertsDropdownProps {
  onSelectPlayer?: (playerId: string) => void;
}

export default function AlertsDropdown({ onSelectPlayer }: AlertsDropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const fetchAlerts = async () => {
    try {
      setLoading(true);
      const sessionId = getSessionId();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/watchlist-alerts`,
        {
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'X-Session-Id': sessionId,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch alerts');
      }

      setAlerts(data.alerts || []);
      setUnreadCount(data.count || 0);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (alertIds: string[]) => {
    try {
      const sessionId = getSessionId();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/watchlist-alerts`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'X-Session-Id': sessionId,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ alert_ids: alertIds }),
        }
      );

      if (!response.ok) {
        throw new Error('Failed to mark alerts as read');
      }

      setAlerts(alerts.filter(a => !alertIds.includes(a.alert_id)));
      setUnreadCount(Math.max(0, unreadCount - alertIds.length));
    } catch (err) {
      console.error('Error marking alerts as read:', err);
    }
  };

  const markAllAsRead = () => {
    if (alerts.length > 0) {
      markAsRead(alerts.map(a => a.alert_id));
    }
  };

  const getAlertIcon = (type: string) => {
    switch (type) {
      case 'value_spike':
      case 'sell_high':
      case 'trending_up':
        return <TrendingUp className="w-4 h-4" />;
      case 'value_drop':
      case 'buy_low':
      case 'trending_down':
        return <TrendingDown className="w-4 h-4" />;
      case 'role_change':
        return <AlertCircle className="w-4 h-4" />;
      default:
        return <Bell className="w-4 h-4" />;
    }
  };

  const getAlertColor = (type: string, severity: string) => {
    if (severity === 'high') {
      return 'bg-red-50 border-red-200 text-red-900';
    }
    if (severity === 'medium') {
      return 'bg-yellow-50 border-yellow-200 text-yellow-900';
    }

    switch (type) {
      case 'value_spike':
      case 'sell_high':
      case 'trending_up':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'value_drop':
      case 'buy_low':
      case 'trending_down':
        return 'bg-blue-50 border-blue-200 text-blue-900';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-900';
    }
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-600 rounded-full min-w-[20px]">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Panel */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-xl border border-gray-200 z-50 max-h-[600px] overflow-hidden flex flex-col">
          {/* Header */}
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
            <div className="flex items-center gap-2">
              <Bell className="w-5 h-5 text-gray-700" />
              <h3 className="font-bold text-gray-900">
                Alerts {unreadCount > 0 && `(${unreadCount})`}
              </h3>
            </div>
            {alerts.length > 0 && (
              <button
                onClick={markAllAsRead}
                className="text-xs text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
              >
                <Check className="w-3 h-3" />
                Mark all read
              </button>
            )}
          </div>

          {/* Alerts List */}
          <div className="overflow-y-auto flex-1">
            {loading ? (
              <div className="p-8 text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-3"></div>
                <p className="text-gray-600 text-sm">Loading alerts...</p>
              </div>
            ) : alerts.length === 0 ? (
              <div className="p-8 text-center">
                <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                <p className="text-gray-600 font-semibold mb-1">No new alerts</p>
                <p className="text-gray-500 text-sm">
                  Add players to your watchlist to receive alerts
                </p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {alerts.map((alert) => (
                  <div
                    key={alert.alert_id}
                    className={`p-4 hover:bg-gray-50 transition-colors border-l-4 ${getAlertColor(alert.alert_type, alert.severity)}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 mt-1">
                        {getAlertIcon(alert.alert_type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <button
                          onClick={() => {
                            onSelectPlayer?.(alert.player_id);
                            markAsRead([alert.alert_id]);
                            setIsOpen(false);
                          }}
                          className="text-left w-full hover:underline"
                        >
                          <p className="text-sm font-semibold text-gray-900 mb-1">
                            {alert.player_name}
                          </p>
                          <p className="text-sm text-gray-700 leading-relaxed">
                            {alert.message}
                          </p>
                        </button>
                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-gray-500">
                            {getTimeAgo(alert.created_at)}
                          </p>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              markAsRead([alert.alert_id]);
                            }}
                            className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
                          >
                            Dismiss
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Footer */}
          {alerts.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
              <button
                onClick={() => {
                  setIsOpen(false);
                }}
                className="w-full text-center text-sm text-blue-600 hover:text-blue-800 font-semibold"
              >
                View Watchlist
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
