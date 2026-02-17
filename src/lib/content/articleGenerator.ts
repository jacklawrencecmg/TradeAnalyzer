import { supabase } from '../supabase';
import { getFDPValue } from '../fdp/getFDPValue';

export interface PlayerMovement {
  player_id: string;
  full_name: string;
  position: string;
  team?: string;
  current_value: number;
  previous_value: number;
  change: number;
  change_percent: number;
  rank: number;
}

export interface ArticleContent {
  headline: string;
  subheadline: string;
  article_type: string;
  sections: ArticleSection[];
  players: PlayerMovement[];
  meta_description: string;
  keywords: string[];
}

export interface ArticleSection {
  heading: string;
  paragraphs: string[];
  player_cards?: string[];
  data_table?: any;
}

export async function generateRiserArticle(players: PlayerMovement[]): Promise<ArticleContent> {
  const topRiser = players[0];
  const positionGroup = groupByPosition(players);

  const headline = `${topRiser.full_name} Leads Dynasty Value Surge: ${players.length} Players Making Major Moves`;
  const subheadline = `${topRiser.position} ${topRiser.full_name} jumps ${Math.abs(topRiser.change)} points after strong finish to the season. Here's who else is trending up in dynasty rankings.`;

  const sections: ArticleSection[] = [
    {
      heading: 'The Biggest Story',
      paragraphs: [
        generatePlayerRiseStory(topRiser),
        generateContextAnalysis(topRiser),
        generateTradingAdvice(topRiser, 'rising')
      ],
      player_cards: [topRiser.player_id]
    },
    {
      heading: 'Other Major Risers',
      paragraphs: players.slice(1, 5).map(p => generateShortPlayerStory(p)),
      player_cards: players.slice(1, 5).map(p => p.player_id)
    },
    {
      heading: 'Position Breakdown',
      paragraphs: Object.entries(positionGroup).map(([pos, pList]) =>
        generatePositionSummary(pos, pList as PlayerMovement[], 'rising')
      )
    },
    {
      heading: 'What This Means for Your Dynasty Team',
      paragraphs: [
        generateDynastyImpact(players, 'rising'),
        generateTradeWindowAdvice(players)
      ]
    }
  ];

  return {
    headline,
    subheadline,
    article_type: 'riser',
    sections,
    players,
    meta_description: `${topRiser.full_name} and ${players.length - 1} other dynasty players are surging in value. See the complete list of risers and what it means for your roster.`,
    keywords: [
      'dynasty risers',
      'dynasty player values',
      `${topRiser.full_name} dynasty`,
      'fantasy football trends',
      'dynasty buy targets'
    ]
  };
}

export async function generateFallerArticle(players: PlayerMovement[]): Promise<ArticleContent> {
  const topFaller = players[0];

  const headline = `Dynasty Value Drop: ${topFaller.full_name} and ${players.length - 1} Players Falling in Rankings`;
  const subheadline = `${topFaller.position} ${topFaller.full_name} slides ${Math.abs(topFaller.change)} points in dynasty value. Our model identifies sell-high opportunities before the market catches up.`;

  const sections: ArticleSection[] = [
    {
      heading: 'Understanding the Drop',
      paragraphs: [
        generatePlayerFallStory(topFaller),
        generateContextAnalysis(topFaller),
        generateTradingAdvice(topFaller, 'falling')
      ],
      player_cards: [topFaller.player_id]
    },
    {
      heading: 'Other Players Losing Value',
      paragraphs: players.slice(1, 5).map(p => generateShortPlayerStory(p)),
      player_cards: players.slice(1, 5).map(p => p.player_id)
    },
    {
      heading: 'Sell High Windows',
      paragraphs: [
        generateSellHighStrategy(players),
        generateMarketTimingAdvice(players)
      ]
    }
  ];

  return {
    headline,
    subheadline,
    article_type: 'faller',
    sections,
    players,
    meta_description: `${topFaller.full_name} and ${players.length - 1} dynasty assets are declining. Learn which players to sell before values drop further.`,
    keywords: [
      'dynasty fallers',
      'sell high candidates',
      `${topFaller.full_name} dynasty value`,
      'dynasty trade strategy',
      'fantasy football sells'
    ]
  };
}

export async function generateBuyLowArticle(players: PlayerMovement[]): Promise<ArticleContent> {
  const headline = `${players.length} Dynasty Buy-Low Targets: Market Inefficiencies Detected`;
  const subheadline = `Our model has identified undervalued assets where the market hasn't caught up to the underlying production metrics. Strike before the window closes.`;

  const sections: ArticleSection[] = [
    {
      heading: 'The Best Buy-Low Opportunity',
      paragraphs: [
        generateBuyLowCase(players[0]),
        generateValueGapAnalysis(players[0]),
        generateAcquisitionStrategy(players[0])
      ],
      player_cards: [players[0].player_id]
    },
    {
      heading: 'More Buy-Low Candidates',
      paragraphs: players.slice(1).map(p => generateBuyLowSummary(p)),
      player_cards: players.slice(1).map(p => p.player_id)
    },
    {
      heading: 'How to Execute Buy-Low Trades',
      paragraphs: [
        'The key to successful buy-low trades is timing and framing. Target these players when their recent performance has created negative sentiment but the underlying metrics remain strong.',
        'Package a slightly overvalued asset with a mid-tier piece to acquire these undervalued players. Most dynasty managers overweight recent performance and underweight predictive metrics.'
      ]
    }
  ];

  return {
    headline,
    subheadline,
    article_type: 'buy_low',
    sections,
    players,
    meta_description: `${players.length} dynasty buy-low targets where market value trails true value. Get ahead of the market with these acquisition targets.`,
    keywords: [
      'dynasty buy low',
      'undervalued dynasty players',
      'dynasty trade targets',
      'fantasy football value',
      'dynasty strategy'
    ]
  };
}

function generatePlayerRiseStory(player: PlayerMovement): string {
  const changePercent = player.change_percent.toFixed(1);

  const templates = [
    `After a breakout stretch to close the season, ${player.full_name} has surged ${Math.abs(player.change)} points in dynasty value over the past week. The ${player.position} ${player.team ? `for the ${player.team}` : ''} is now commanding ${player.current_value} points on our FDP scale, representing a ${changePercent}% increase that reflects his emergence as a foundational dynasty asset.`,

    `The dynasty community is waking up to what the advanced metrics have been signaling: ${player.full_name} is a legitimate top-tier ${player.position}. His value has jumped ${Math.abs(player.change)} points to ${player.current_value}, and our model suggests this isn't an overreaction—it's a market correction that was overdue.`,

    `${player.full_name} is experiencing the type of value surge that creates championship rosters. The ${player.position} has gained ${Math.abs(player.change)} points in dynasty value, now sitting at ${player.current_value} points. This ${changePercent}% increase reflects both his on-field production and improving situation${player.team ? ` with the ${player.team}` : ''}.`
  ];

  return templates[Math.floor(Math.random() * templates.length)];
}

function generatePlayerFallStory(player: PlayerMovement): string {
  const changePercent = Math.abs(player.change_percent).toFixed(1);

  return `${player.full_name}'s dynasty value has declined ${Math.abs(player.change)} points to ${player.current_value}, a ${changePercent}% drop that reflects concerning trends in both production metrics and situational factors. While ${player.position}s can experience volatility, the underlying data suggests this may not be a temporary dip. Dynasty managers should carefully evaluate whether to hold or pivot to younger assets.`;
}

function generateContextAnalysis(player: PlayerMovement): string {
  if (player.position === 'QB') {
    return `Quarterback values in dynasty are heavily influenced by scoring format and roster construction. ${player.full_name}'s value shift represents a meaningful change in how the model projects his long-term production ceiling and weekly floor. In superflex formats, this movement is even more significant given the position's scarcity premium.`;
  } else if (player.position === 'RB') {
    return `Running back values are the most volatile in dynasty due to the position's combination of high injury risk and shorter peak windows. ${player.full_name}'s value change reflects updated projections on workload sustainability, offensive line quality, and team commitment to the run game. Dynasty managers must weigh the position's win-now impact against its rapid depreciation curve.`;
  } else if (player.position === 'WR') {
    return `Wide receiver is the most stable position for dynasty value, making ${player.full_name}'s movement particularly noteworthy. The combination of target volume, route participation, and quarterback situation has shifted the model's long-term outlook. WRs typically maintain value longer than RBs, so these adjustments often signal multi-year trends rather than temporary noise.`;
  } else {
    return `Tight end remains the scarcest position in fantasy, where elite producers command massive premiums. ${player.full_name}'s value movement reflects the small sample size of truly valuable TEs. The position's top tier creates significant separation from replacement level, making elite tight ends among the most stable dynasty assets.`;
  }
}

function generateTradingAdvice(player: PlayerMovement, direction: 'rising' | 'falling'): string {
  if (direction === 'rising') {
    return `For ${player.full_name} managers, the trade window dynamics have shifted. If you're competing for a championship, hold firm—his ascent signals exactly the type of asset that wins leagues. If you're rebuilding, this surge creates maximum leverage to extract multiple picks or young players from contenders who need to strike now. The market often lags our model by 7-10 days, so act fast if you're selling.`;
  } else {
    return `${player.full_name} owners face a critical decision point. The value decline creates a narrow window to sell before the broader market adjusts. If you're contending and he's a core piece, the calculus is different—championship equity may justify holding through volatility. But rebuilding teams should prioritize moving him now while residual name value still commands premium returns. Every day of delay reduces your leverage.`;
  }
}

function generateShortPlayerStory(player: PlayerMovement): string {
  const direction = player.change > 0 ? 'up' : 'down';
  const verb = player.change > 0 ? 'gaining' : 'losing';

  return `**${player.full_name}** (${player.position}${player.team ? `, ${player.team}` : ''}): ${verb} ${Math.abs(player.change)} points to reach ${player.current_value}. The ${player.position} is trending ${direction} as the model recalibrates his long-term production profile based on recent usage patterns and situation changes.`;
}

function generatePositionSummary(position: string, players: PlayerMovement[], direction: 'rising' | 'falling'): string {
  const verb = direction === 'rising' ? 'gaining' : 'losing';
  const avgChange = players.reduce((sum, p) => sum + Math.abs(p.change), 0) / players.length;

  return `**${position}**: ${players.length} ${position}s are ${verb} significant value, averaging ${avgChange.toFixed(0)} points of movement. ${players.map(p => p.full_name).join(', ')} lead the position group.`;
}

function generateDynastyImpact(players: PlayerMovement[], direction: 'rising' | 'falling'): string {
  if (direction === 'rising') {
    return `These value surges create strategic opportunities across your dynasty league. If you own any of these risers and you're rebuilding, this is your moment to cash out at peak value. Contenders should hold—these are precisely the assets that separate championship rosters from pretenders. For teams without exposure, consider whether paying the new premium makes sense for your window, or if you can find comparable production at lower cost elsewhere in the market.`;
  } else {
    return `Value drops always create both risk and opportunity. If you're holding these players, be honest about your competitive window. Contenders should consider whether the production still justifies the roster spot, while rebuilders should sell immediately before the decline accelerates. For buyers, patience is key—let the market fully adjust before offering premium packages. These players may still produce, but dynasty is about long-term asset management, not short-term hope.`;
  }
}

function generateTradeWindowAdvice(players: PlayerMovement[]): string {
  return `Remember that public perception typically lags analytical models by several days to weeks. The trade market hasn't fully priced in these movements yet, creating a brief arbitrage window. Use our trade calculator to identify which combinations extract maximum value while the inefficiency exists. In dynasty, information edges are temporary—act decisively when the data speaks this clearly.`;
}

function generateBuyLowCase(player: PlayerMovement): string {
  return `${player.full_name} represents the quintessential buy-low opportunity: a player whose underlying metrics remain elite but whose market value has sagged due to factors our model predicts will reverse. At ${player.current_value} points, he's trading below true value by our calculations. The advanced stats—target quality, snap share, route participation—all point to sustained production that the market is currently discounting.`;
}

function generateValueGapAnalysis(player: PlayerMovement): string {
  return `Our model identifies value gaps by comparing market consensus to predictive metrics. ${player.full_name}'s current price doesn't match his projected production over the next 24 months. This disconnect typically occurs when recent performance creates recency bias, or when situational narratives override data. Smart dynasty managers exploit these windows before market efficiency restores proper pricing.`;
}

function generateAcquisitionStrategy(player: PlayerMovement): string {
  return `To acquire ${player.full_name}, avoid direct offers that telegraph your interest. Instead, package him as the secondary piece in a larger trade discussion, or offer slightly overvalued assets that trade on name recognition rather than production. Most managers will accept a deal that "feels fair" even when the underlying value tilts in your favor. The key is making the other side believe they're winning.`;
}

function generateBuyLowSummary(player: PlayerMovement): string {
  return `**${player.full_name}** (${player.position}): Trading at ${player.current_value} points despite metrics suggesting higher value. The situation${player.team ? ` with the ${player.team}` : ''} creates short-term pessimism that savvy managers should exploit.`;
}

function generateSellHighStrategy(players: PlayerMovement[]): string {
  return `Sell-high opportunities exist when market value exceeds underlying production metrics. These ${players.length} players are currently overvalued relative to their likely future output. The optimal strategy is packaging them with other pieces to acquire younger, more stable assets. Don't wait for the market to correct—elite dynasty managers sell the peak, not the decline.`;
}

function generateMarketTimingAdvice(players: PlayerMovement[]): string {
  return `Timing is everything in dynasty trades. These players are experiencing the market lag where perception hasn't caught up to reality. You have approximately 1-2 weeks before the broader fantasy community processes the same data our model has already integrated. Use this window to your advantage, but be prepared to adjust offers as the market moves. The worst outcome is holding through the correction when you could have maximized return.`;
}

function groupByPosition(players: PlayerMovement[]): Record<string, PlayerMovement[]> {
  return players.reduce((acc, player) => {
    if (!acc[player.position]) acc[player.position] = [];
    acc[player.position].push(player);
    return acc;
  }, {} as Record<string, PlayerMovement[]>);
}

export function generateArticleSlug(headline: string): string {
  return headline
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}
