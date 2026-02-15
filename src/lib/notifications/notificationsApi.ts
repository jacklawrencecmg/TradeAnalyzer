/**
 * Notifications API
 *
 * Client-side helpers for managing notifications and watchlists.
 */

import { supabase } from '../supabase';

export interface Notification {
  id: string;
  type: string;
  playerId?: string;
  playerName?: string;
  leagueId?: string;
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  metadata: Record<string, any>;
  readAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  isUnread: boolean;
}

export interface WatchlistPlayer {
  id: string;
  playerId: string;
  playerName: string;
  position: string;
  team?: string;
  notes?: string;
  addedAt: string;
}

/**
 * Get user notifications
 */
export async function getNotifications(options: {
  userId: string;
  unreadOnly?: boolean;
  limit?: number;
}): Promise<Notification[]> {
  const { userId, unreadOnly = false, limit = 50 } = options;

  let query = supabase
    .from('user_notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (unreadOnly) {
    query = query.is('read_at', null);
  }

  // Only active notifications
  query = query.or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());

  const { data, error } = await query;

  if (error || !data) {
    console.error('Error fetching notifications:', error);
    return [];
  }

  return data.map((row) => ({
    id: row.id,
    type: row.type,
    playerId: row.player_id,
    playerName: row.player_name,
    leagueId: row.league_id,
    title: row.title,
    message: row.message,
    priority: row.priority,
    metadata: row.metadata || {},
    readAt: row.read_at,
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    isUnread: !row.read_at,
  }));
}

/**
 * Get unread notification count
 */
export async function getUnreadCount(userId: string): Promise<number> {
  try {
    const { data, error } = await supabase.rpc('get_unread_notification_count', {
      p_user_id: userId,
    });

    if (error) {
      console.error('Error getting unread count:', error);
      return 0;
    }

    return data || 0;
  } catch (error) {
    console.error('Exception getting unread count:', error);
    return 0;
  }
}

/**
 * Mark notification as read
 */
export async function markNotificationRead(notificationId: string, userId: string): Promise<boolean> {
  const { error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', notificationId)
    .eq('user_id', userId);

  if (error) {
    console.error('Error marking notification read:', error);
    return false;
  }

  return true;
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsRead(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('user_notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
    .select('id');

  if (error) {
    console.error('Error marking all notifications read:', error);
    return 0;
  }

  return data?.length || 0;
}

/**
 * Add player to watchlist
 */
export async function addToWatchlist(
  userId: string,
  playerId: string,
  leagueId?: string | null
): Promise<boolean> {
  // Get or create watchlist for user
  const { data: watchlist } = await supabase
    .from('user_watchlists')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  let watchlistId: string;

  if (!watchlist) {
    // Create watchlist
    const { data: newWatchlist, error: createError } = await supabase
      .from('user_watchlists')
      .insert({ user_id: userId, session_id: `user_${userId}` })
      .select('id')
      .single();

    if (createError || !newWatchlist) {
      console.error('Error creating watchlist:', createError);
      return false;
    }

    watchlistId = newWatchlist.id;
  } else {
    watchlistId = watchlist.id;
  }

  // Add player to watchlist
  const { error } = await supabase.from('watchlist_players').insert({
    watchlist_id: watchlistId,
    player_id: playerId,
  });

  if (error) {
    // Check if already exists
    if (error.code === '23505') {
      // Unique constraint violation - already watching
      return true;
    }

    console.error('Error adding to watchlist:', error);
    return false;
  }

  return true;
}

/**
 * Remove player from watchlist
 */
export async function removeFromWatchlist(userId: string, playerId: string): Promise<boolean> {
  const { data: watchlist } = await supabase
    .from('user_watchlists')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!watchlist) {
    return false;
  }

  const { error } = await supabase
    .from('watchlist_players')
    .delete()
    .eq('watchlist_id', watchlist.id)
    .eq('player_id', playerId);

  if (error) {
    console.error('Error removing from watchlist:', error);
    return false;
  }

  return true;
}

/**
 * Check if player is in watchlist
 */
export async function isInWatchlist(userId: string, playerId: string): Promise<boolean> {
  const { data: watchlist } = await supabase
    .from('user_watchlists')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!watchlist) {
    return false;
  }

  const { data } = await supabase
    .from('watchlist_players')
    .select('player_id')
    .eq('watchlist_id', watchlist.id)
    .eq('player_id', playerId)
    .maybeSingle();

  return data !== null;
}

/**
 * Get watchlist players
 */
export async function getWatchlistPlayers(userId: string): Promise<WatchlistPlayer[]> {
  const { data: watchlist } = await supabase
    .from('user_watchlists')
    .select('id')
    .eq('user_id', userId)
    .maybeSingle();

  if (!watchlist) {
    return [];
  }

  const { data, error } = await supabase
    .from('watchlist_players')
    .select('id, player_id, notes, added_at')
    .eq('watchlist_id', watchlist.id)
    .order('added_at', { ascending: false });

  if (error || !data) {
    console.error('Error fetching watchlist:', error);
    return [];
  }

  // TODO: Enrich with player details from nfl_players table
  return data.map((row) => ({
    id: row.id,
    playerId: row.player_id,
    playerName: 'Player ' + row.player_id, // Placeholder
    position: 'Unknown',
    notes: row.notes,
    addedAt: row.added_at,
  }));
}

/**
 * Subscribe to real-time notification updates
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notification: Notification) => void
) {
  const subscription = supabase
    .channel('user_notifications')
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'user_notifications',
        filter: `user_id=eq.${userId}`,
      },
      (payload) => {
        const notification: Notification = {
          id: payload.new.id,
          type: payload.new.type,
          playerId: payload.new.player_id,
          leagueId: payload.new.league_id,
          title: payload.new.title,
          message: payload.new.message,
          priority: payload.new.priority,
          metadata: payload.new.metadata || {},
          readAt: payload.new.read_at,
          expiresAt: payload.new.expires_at,
          createdAt: payload.new.created_at,
          isUnread: !payload.new.read_at,
        };

        callback(notification);
      }
    )
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}
