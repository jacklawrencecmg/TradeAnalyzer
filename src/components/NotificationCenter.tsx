/**
 * Notification Center Page
 *
 * Full-page notification management interface with:
 * - Grouping by Team, Watched Players, Market News
 * - Filtering by type and priority
 * - Bulk actions (mark all read, delete)
 * - Search and sorting
 */

import React, { useState, useEffect } from 'react';
import {
  Bell,
  CheckCheck,
  Filter,
  Search,
  Star,
  TrendingUp,
  Users,
  X,
} from 'lucide-react';
import {
  getNotifications,
  markNotificationRead,
  markAllNotificationsRead,
  type Notification,
} from '../lib/notifications/notificationsApi';
import { useAuth } from '../hooks/useAuth';

type GroupBy = 'team' | 'watched' | 'market' | 'all';
type FilterPriority = 'all' | 'critical' | 'high' | 'normal' | 'low';

export function NotificationCenter() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState<GroupBy>('all');
  const [filterPriority, setFilterPriority] = useState<FilterPriority>('all');
  const [filterUnread, setFilterUnread] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (!user) return;
    loadNotifications();
  }, [user]);

  async function loadNotifications() {
    if (!user) return;

    setLoading(true);
    const data = await getNotifications({ userId: user.id, limit: 100 });
    setNotifications(data);
    setLoading(false);
  }

  async function handleMarkRead(notificationId: string) {
    if (!user) return;

    const success = await markNotificationRead(notificationId, user.id);
    if (success) {
      setNotifications((prev) =>
        prev.map((n) =>
          n.id === notificationId ? { ...n, readAt: new Date().toISOString(), isUnread: false } : n
        )
      );
    }
  }

  async function handleMarkAllRead() {
    if (!user) return;

    const count = await markAllNotificationsRead(user.id);
    if (count > 0) {
      setNotifications((prev) =>
        prev.map((n) => ({
          ...n,
          readAt: n.readAt || new Date().toISOString(),
          isUnread: false,
        }))
      );
    }
  }

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    // Priority filter
    if (filterPriority !== 'all' && n.priority !== filterPriority) {
      return false;
    }

    // Unread filter
    if (filterUnread && !n.isUnread) {
      return false;
    }

    // Search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      return (
        n.title.toLowerCase().includes(search) ||
        n.message.toLowerCase().includes(search) ||
        (n.playerName && n.playerName.toLowerCase().includes(search))
      );
    }

    return true;
  });

  // Group notifications
  const groupedNotifications = groupNotifications(filteredNotifications, groupBy);

  const unreadCount = notifications.filter((n) => n.isUnread).length;

  if (!user) {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center">
        <Bell className="w-16 h-16 mx-auto text-gray-400 mb-4" />
        <h2 className="text-2xl font-bold text-gray-900 mb-2">Notification Center</h2>
        <p className="text-gray-600">Please log in to view your notifications</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-sm text-gray-600 mt-1">{unreadCount} unread</p>
            )}
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              Mark all as read
            </button>
          )}
        </div>

        {/* Search and Filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search notifications..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Group By */}
          <div className="flex gap-2">
            <GroupButton
              active={groupBy === 'all'}
              onClick={() => setGroupBy('all')}
              icon={<Bell className="w-4 h-4" />}
              label="All"
            />
            <GroupButton
              active={groupBy === 'team'}
              onClick={() => setGroupBy('team')}
              icon={<Users className="w-4 h-4" />}
              label="Team"
            />
            <GroupButton
              active={groupBy === 'watched'}
              onClick={() => setGroupBy('watched')}
              icon={<Star className="w-4 h-4" />}
              label="Watched"
            />
            <GroupButton
              active={groupBy === 'market'}
              onClick={() => setGroupBy('market')}
              icon={<TrendingUp className="w-4 h-4" />}
              label="Market"
            />
          </div>

          {/* Priority Filter */}
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value as FilterPriority)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Priority</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>

          {/* Unread Filter */}
          <button
            onClick={() => setFilterUnread(!filterUnread)}
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-colors ${
              filterUnread
                ? 'bg-blue-600 text-white border-blue-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            <span>Unread</span>
          </button>
        </div>
      </div>

      {/* Notifications */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading notifications...</p>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <Bell className="w-16 h-16 mx-auto text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No notifications</h3>
          <p className="text-gray-600">
            {searchTerm || filterUnread || filterPriority !== 'all'
              ? 'Try adjusting your filters'
              : "We'll notify you about opportunities"}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(groupedNotifications).map(([group, items]) => (
            <NotificationGroup
              key={group}
              title={getGroupTitle(group, groupBy)}
              notifications={items}
              onMarkRead={handleMarkRead}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Group notifications by type
 */
function groupNotifications(
  notifications: Notification[],
  groupBy: GroupBy
): Record<string, Notification[]> {
  if (groupBy === 'all') {
    return { all: notifications };
  }

  const groups: Record<string, Notification[]> = {};

  for (const notification of notifications) {
    let key: string;

    switch (groupBy) {
      case 'team':
        key = notification.leagueId || 'general';
        break;
      case 'watched':
        key = notification.playerId ? 'watched_players' : 'other';
        break;
      case 'market':
        key =
          notification.type.includes('value') || notification.type.includes('market')
            ? 'market_updates'
            : 'other';
        break;
      default:
        key = 'all';
    }

    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(notification);
  }

  return groups;
}

/**
 * Get human-readable group title
 */
function getGroupTitle(key: string, groupBy: GroupBy): string {
  if (groupBy === 'all') return 'All Notifications';

  if (groupBy === 'watched') {
    return key === 'watched_players' ? 'Watched Players' : 'Other Updates';
  }

  if (groupBy === 'market') {
    return key === 'market_updates' ? 'Market Updates' : 'Other Notifications';
  }

  if (groupBy === 'team') {
    return key === 'general' ? 'General' : `Team ${key}`;
  }

  return key;
}

/**
 * Notification group component
 */
function NotificationGroup({
  title,
  notifications,
  onMarkRead,
}: {
  title: string;
  notifications: Notification[];
  onMarkRead: (id: string) => void;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="px-6 py-4 border-b border-gray-200 bg-gray-50">
        <h2 className="text-lg font-bold text-gray-900">{title}</h2>
        <p className="text-sm text-gray-600">{notifications.length} notifications</p>
      </div>

      <div className="divide-y divide-gray-200">
        {notifications.map((notification) => (
          <NotificationItem
            key={notification.id}
            notification={notification}
            onMarkRead={onMarkRead}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Notification item component
 */
function NotificationItem({
  notification,
  onMarkRead,
}: {
  notification: Notification;
  onMarkRead: (id: string) => void;
}) {
  const priorityColors = {
    critical: 'bg-red-50 border-l-4 border-red-500',
    high: 'bg-orange-50 border-l-4 border-orange-500',
    normal: 'bg-white border-l-4 border-blue-500',
    low: 'bg-white border-l-4 border-gray-300',
  };

  const priorityBadges = {
    critical: 'bg-red-100 text-red-800',
    high: 'bg-orange-100 text-orange-800',
    normal: 'bg-blue-100 text-blue-800',
    low: 'bg-gray-100 text-gray-800',
  };

  const priorityClass = priorityColors[notification.priority];
  const badgeClass = priorityBadges[notification.priority];

  const timeAgo = getTimeAgo(new Date(notification.createdAt));

  return (
    <div
      className={`p-6 hover:bg-gray-50 transition-colors ${
        notification.isUnread ? priorityClass : 'bg-white'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            {notification.isUnread && (
              <span className="flex-shrink-0 w-2.5 h-2.5 bg-blue-600 rounded-full"></span>
            )}
            <h3 className="text-lg font-semibold text-gray-900">{notification.title}</h3>
            <span className={`px-2 py-1 text-xs font-semibold rounded ${badgeClass}`}>
              {notification.priority.toUpperCase()}
            </span>
          </div>

          <p className="text-gray-700 mb-3">{notification.message}</p>

          <div className="flex items-center gap-4 text-sm text-gray-500">
            <span>{timeAgo}</span>
            {notification.playerName && <span>• Player: {notification.playerName}</span>}
          </div>
        </div>

        {notification.isUnread && (
          <button
            onClick={() => onMarkRead(notification.id)}
            className="flex-shrink-0 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 border border-blue-600 rounded hover:bg-blue-50 transition-colors"
          >
            Mark read
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Group button component
 */
function GroupButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
        active
          ? 'bg-blue-600 text-white'
          : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
      }`}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/**
 * Get human-readable time ago
 */
function getTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} days ago`;

  return date.toLocaleDateString();
}

export default NotificationCenter;
