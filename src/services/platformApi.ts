import * as sleeperApi from './sleeperApi';
import * as espnApi from './espnApi';
import * as yahooApi from './yahooApi';

export type Platform = 'sleeper' | 'espn' | 'yahoo' | 'nfl';

export interface PlatformSettings {
  espn_s2?: string;
  swid?: string;
  yahoo_access_token?: string;
  season?: number;
}

export interface UnifiedLeague {
  id: string;
  name: string;
  platform: Platform;
  season: string;
  numTeams: number;
  settings: sleeperApi.LeagueSettings;
}

export interface UnifiedTeam {
  id: string;
  name: string;
  owner: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  players: UnifiedPlayer[];
}

export interface UnifiedPlayer {
  id: string;
  name: string;
  position: string;
  team: string | null;
  injuryStatus: string | null;
}

export async function fetchLeague(
  platform: Platform,
  leagueId: string,
  settings?: PlatformSettings
): Promise<UnifiedLeague> {
  switch (platform) {
    case 'sleeper': {
      const league = await sleeperApi.fetchLeagueDetails(leagueId);
      return {
        id: league.league_id,
        name: league.name,
        platform: 'sleeper',
        season: league.season,
        numTeams: league.settings.num_teams,
        settings: sleeperApi.getLeagueSettings(league),
      };
    }

    case 'espn': {
      const season = settings?.season || new Date().getFullYear();
      const league = await espnApi.fetchESPNLeague(
        leagueId,
        season,
        settings?.espn_s2,
        settings?.swid
      );
      return {
        id: league.id,
        name: league.name,
        platform: 'espn',
        season: season.toString(),
        numTeams: league.size,
        settings: espnApi.getESPNLeagueSettings(league),
      };
    }

    case 'yahoo': {
      if (!settings?.yahoo_access_token) {
        throw new Error('Yahoo access token required');
      }
      const league = await yahooApi.fetchYahooLeague(
        leagueId,
        settings.yahoo_access_token
      );
      return {
        id: league.league_id,
        name: league.name,
        platform: 'yahoo',
        season: league.season,
        numTeams: league.num_teams,
        settings: yahooApi.getYahooLeagueSettings(league),
      };
    }

    case 'nfl':
      throw new Error('NFL.com integration coming soon!');

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export async function fetchTeams(
  platform: Platform,
  leagueId: string,
  settings?: PlatformSettings
): Promise<UnifiedTeam[]> {
  switch (platform) {
    case 'sleeper': {
      const [rosters, users, players] = await Promise.all([
        sleeperApi.fetchLeagueRosters(leagueId),
        sleeperApi.fetchLeagueUsers(leagueId),
        sleeperApi.fetchAllPlayers(),
      ]);

      return rosters.map((roster) => {
        const user = users.find((u) => u.user_id === roster.owner_id);
        const teamPlayers = (roster.players || []).map((playerId) => {
          const player = players[playerId];
          return {
            id: playerId,
            name: player?.full_name || 'Unknown',
            position: player?.position || 'N/A',
            team: player?.team || null,
            injuryStatus: player?.injury_status || null,
          };
        });

        return {
          id: roster.roster_id.toString(),
          name: user?.metadata?.team_name || user?.display_name || 'Unknown Team',
          owner: user?.display_name || 'Unknown',
          wins: roster.settings.wins,
          losses: roster.settings.losses,
          ties: roster.settings.ties,
          pointsFor: roster.settings.fpts,
          pointsAgainst: roster.settings.fpts_against,
          players: teamPlayers,
        };
      });
    }

    case 'espn': {
      const season = settings?.season || new Date().getFullYear();
      const teams = await espnApi.fetchESPNTeams(
        leagueId,
        season,
        settings?.espn_s2,
        settings?.swid
      );

      return teams.map((team) => {
        const teamPlayers = (team.roster?.entries || []).map((entry) => {
          const player = espnApi.convertESPNPlayer(entry.playerPoolEntry.player);
          return {
            id: player.player_id,
            name: player.full_name,
            position: player.position,
            team: player.team,
            injuryStatus: player.injury_status,
          };
        });

        return {
          id: team.id.toString(),
          name: `${team.location} ${team.nickname}`,
          owner: team.location,
          wins: team.record?.overall?.wins || 0,
          losses: team.record?.overall?.losses || 0,
          ties: team.record?.overall?.ties || 0,
          pointsFor: team.valuesByStat?.[0] || 0,
          pointsAgainst: team.valuesByStat?.[1] || 0,
          players: teamPlayers,
        };
      });
    }

    case 'yahoo': {
      if (!settings?.yahoo_access_token) {
        throw new Error('Yahoo access token required');
      }
      const teams = await yahooApi.fetchYahooTeams(
        leagueId,
        settings.yahoo_access_token
      );

      return teams.map((team: any) => {
        const teamData = team.team[0];
        const teamPlayers = (teamData.roster?.players || []).map((p: any) => {
          const player = yahooApi.convertYahooPlayer(p.player[0]);
          return {
            id: player.player_id,
            name: player.full_name,
            position: player.position,
            team: player.team,
            injuryStatus: player.injury_status,
          };
        });

        return {
          id: teamData.team_id,
          name: teamData.name,
          owner: teamData.managers[0]?.nickname || 'Unknown',
          wins: parseInt(teamData.team_standings?.outcome_totals?.wins || '0'),
          losses: parseInt(teamData.team_standings?.outcome_totals?.losses || '0'),
          ties: parseInt(teamData.team_standings?.outcome_totals?.ties || '0'),
          pointsFor: parseFloat(teamData.team_standings?.points_for || '0'),
          pointsAgainst: parseFloat(teamData.team_standings?.points_against || '0'),
          players: teamPlayers,
        };
      });
    }

    case 'nfl':
      throw new Error('NFL.com integration coming soon!');

    default:
      throw new Error(`Unsupported platform: ${platform}`);
  }
}

export function getPlatformAuthInstructions(platform: Platform): string {
  switch (platform) {
    case 'sleeper':
      return `
Sleeper leagues are easy to add!

1. Open your Sleeper league in the app or web
2. Look at the URL: https://sleeper.com/leagues/[LEAGUE_ID]
3. Copy the league ID (the numbers after /leagues/)
4. Paste it below

Example: If your URL is https://sleeper.com/leagues/123456789
Your League ID is: 123456789

No authentication required - Sleeper leagues are publicly accessible!
      `.trim();

    case 'espn':
      return espnApi.getESPNAuthInstructions();

    case 'yahoo':
      return yahooApi.getYahooAuthInstructions();

    case 'nfl':
      return `
NFL.com fantasy integration is coming soon!

In the meantime, you can manually import your league data
or use our other supported platforms: Sleeper, ESPN, or Yahoo.
      `.trim();

    default:
      return 'Platform not supported';
  }
}

export function getPlatformDisplayName(platform: Platform): string {
  const names: Record<Platform, string> = {
    sleeper: 'Sleeper',
    espn: 'ESPN Fantasy',
    yahoo: 'Yahoo Fantasy',
    nfl: 'NFL.com',
  };
  return names[platform] || platform;
}

export function getPlatformIcon(platform: Platform): string {
  const icons: Record<Platform, string> = {
    sleeper: '🛌',
    espn: '🏈',
    yahoo: '🟣',
    nfl: '🏆',
  };
  return icons[platform] || '⚡';
}

export function requiresAuthentication(platform: Platform): boolean {
  return platform === 'espn' || platform === 'yahoo';
}
