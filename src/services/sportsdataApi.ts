const API_KEY = import.meta.env.VITE_SPORTSDATA_API_KEY;
const BASE_URL = 'https://api.sportsdata.io/v3/nfl';

interface PlayerInfo {
  PlayerID: number;
  Name: string;
  Team: string;
  Position: string;
  Status: string;
  Height: string;
  Weight: number;
  BirthDate: string;
  College: string;
  Experience: number;
  FantasyPosition: string;
  Active: boolean;
  InjuryStatus: string;
  InjuryBodyPart: string;
  InjuryNotes: string;
}

interface PlayerProjection {
  PlayerID: number;
  Name: string;
  Team: string;
  Position: string;
  FantasyPoints: number;
  FantasyPointsPPR: number;
  PassingYards: number;
  PassingTouchdowns: number;
  PassingInterceptions: number;
  RushingYards: number;
  RushingTouchdowns: number;
  Receptions: number;
  ReceivingYards: number;
  ReceivingTouchdowns: number;
  Games: number;
}

interface PlayerStats {
  PlayerID: number;
  Name: string;
  Team: string;
  Position: string;
  FantasyPoints: number;
  FantasyPointsPPR: number;
  PassingYards: number;
  PassingTouchdowns: number;
  PassingInterceptions: number;
  RushingYards: number;
  RushingTouchdowns: number;
  Receptions: number;
  ReceivingYards: number;
  ReceivingTouchdowns: number;
  Games: number;
}

interface InjuryInfo {
  PlayerID: number;
  Name: string;
  Team: string;
  Position: string;
  Status: string;
  InjuryBodyPart: string;
  InjuryNotes: string;
  Updated: string;
}

interface NewsItem {
  NewsID: number;
  PlayerID: number;
  Name: string;
  Team: string;
  Title: string;
  Content: string;
  Updated: string;
  Source: string;
}

class SportsDataAPI {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private async fetchWithCache<T>(endpoint: string): Promise<T> {
    const cacheKey = endpoint;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }

    try {
      const response = await fetch(`${BASE_URL}${endpoint}?key=${API_KEY}`);

      if (!response.ok) {
        throw new Error(`API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      this.cache.set(cacheKey, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      console.error(`Error fetching ${endpoint}:`, error);
      throw error;
    }
  }

  async getAllPlayers(): Promise<PlayerInfo[]> {
    return this.fetchWithCache<PlayerInfo[]>('/scores/json/Players');
  }

  async getPlayerProjections(season: number = new Date().getFullYear()): Promise<PlayerProjection[]> {
    return this.fetchWithCache<PlayerProjection[]>(`/projections/json/PlayerSeasonProjections/${season}`);
  }

  async getWeeklyProjections(season: number, week: number): Promise<PlayerProjection[]> {
    return this.fetchWithCache<PlayerProjection[]>(`/projections/json/PlayerGameProjectionStatsByWeek/${season}/${week}`);
  }

  async getPlayerStats(season: number = new Date().getFullYear()): Promise<PlayerStats[]> {
    return this.fetchWithCache<PlayerStats[]>(`/stats/json/PlayerSeasonStats/${season}`);
  }

  async getInjuries(season: number = new Date().getFullYear(), week?: number): Promise<InjuryInfo[]> {
    const endpoint = week
      ? `/scores/json/Injuries/${season}/${week}`
      : `/scores/json/Injuries/${season}`;
    return this.fetchWithCache<InjuryInfo[]>(endpoint);
  }

  async getNews(): Promise<NewsItem[]> {
    return this.fetchWithCache<NewsItem[]>('/scores/json/News');
  }

  async getPlayerNews(playerName: string): Promise<NewsItem[]> {
    const allNews = await this.getNews();
    return allNews.filter(news =>
      news.Name?.toLowerCase().includes(playerName.toLowerCase())
    );
  }

  async getPlayerByName(playerName: string): Promise<PlayerInfo | null> {
    const players = await this.getAllPlayers();
    return players.find(p =>
      p.Name.toLowerCase() === playerName.toLowerCase()
    ) || null;
  }

  async getPlayerProjection(playerName: string, season?: number): Promise<PlayerProjection | null> {
    const projections = await this.getPlayerProjections(season);
    return projections.find(p =>
      p.Name.toLowerCase() === playerName.toLowerCase()
    ) || null;
  }

  async getPlayerValue(playerName: string): Promise<number> {
    try {
      const [projection, stats, injuries] = await Promise.all([
        this.getPlayerProjection(playerName),
        this.getPlayerStats().then(stats =>
          stats.find(s => s.Name.toLowerCase() === playerName.toLowerCase())
        ),
        this.getInjuries().then(injuries =>
          injuries.find(i => i.Name?.toLowerCase() === playerName.toLowerCase())
        )
      ]);

      if (!projection) {
        return 0;
      }

      let baseValue = projection.FantasyPointsPPR || projection.FantasyPoints || 0;

      // Adjust for recent performance
      if (stats) {
        const recentPerformance = stats.FantasyPointsPPR || stats.FantasyPoints || 0;
        baseValue = (baseValue * 0.6) + (recentPerformance * 0.4);
      }

      // Injury adjustment
      if (injuries) {
        const injuryMultiplier = this.getInjuryMultiplier(injuries.Status);
        baseValue *= injuryMultiplier;
      }

      // Position multipliers for dynasty value
      const positionMultipliers: Record<string, number> = {
        'QB': 1.2,
        'RB': 1.0,
        'WR': 1.1,
        'TE': 0.9,
        'K': 0.3,
        'DEF': 0.4
      };

      const position = projection.Position || projection.FantasyPosition;
      const multiplier = positionMultipliers[position] || 1.0;

      return Math.round(baseValue * multiplier * 10);
    } catch (error) {
      console.error(`Error calculating value for ${playerName}:`, error);
      return 0;
    }
  }

  private getInjuryMultiplier(status: string): number {
    const statusLower = status?.toLowerCase() || '';
    if (statusLower.includes('out')) return 0.3;
    if (statusLower.includes('doubtful')) return 0.5;
    if (statusLower.includes('questionable')) return 0.8;
    if (statusLower.includes('probable')) return 0.95;
    return 1.0;
  }

  clearCache(): void {
    this.cache.clear();
  }
}

export const sportsDataAPI = new SportsDataAPI();
export type { PlayerInfo, PlayerProjection, PlayerStats, InjuryInfo, NewsItem };
