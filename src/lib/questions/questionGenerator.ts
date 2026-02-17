import { getFDPValue } from '../fdp/getFDPValue';

export interface QuestionData {
  question: string;
  question_type: string;
  player_id: string;
  player_id_2?: string;
  short_answer: string;
  explanation_sections: ExplanationSection[];
  value_data: ValueComparisonData;
  similar_players: string[];
  meta_description: string;
  keywords: string[];
}

export interface ExplanationSection {
  heading: string;
  paragraphs: string[];
  data_table?: any;
}

export interface ValueComparisonData {
  primary_player: PlayerValueData;
  secondary_player?: PlayerValueData;
  tier_info?: string;
  ranking?: number;
}

export interface PlayerValueData {
  player_id: string;
  full_name: string;
  position: string;
  team?: string;
  fdp_value: number;
  rank: number;
  age?: number;
  recent_trend?: string;
}

export async function generateBuyLowQuestion(player: any, marketData: any): Promise<QuestionData> {
  const fullName = player.full_name;
  const position = player.position;
  const currentValue = getFDPValue(player);
  const marketValue = marketData?.consensus_value || currentValue;
  const valueGap = currentValue - marketValue;
  const isBuyLow = valueGap < -100;

  const question = `Is ${fullName} a buy low in dynasty?`;

  const shortAnswer = isBuyLow
    ? `Yes, ${fullName} appears to be undervalued right now. Our model shows he's trading ${Math.abs(valueGap)} points below his true dynasty value, creating a buy-low window for savvy managers.`
    : `Not particularly. ${fullName} is currently trading close to fair value at ${currentValue} points. While he's a solid dynasty asset, there isn't a significant market inefficiency to exploit right now.`;

  const sections: ExplanationSection[] = [
    {
      heading: 'Current Market Analysis',
      paragraphs: [
        generateMarketAnalysis(player, currentValue, marketValue, valueGap),
        generatePositionContext(position, fullName)
      ]
    },
    {
      heading: 'Why This Creates Opportunity',
      paragraphs: isBuyLow
        ? [
            generateBuyLowReasoning(fullName, position, valueGap),
            generateAcquisitionTiming(fullName)
          ]
        : [
            generateFairValueReasoning(fullName, currentValue),
            generateAlternativeStrategy(position)
          ]
    },
    {
      heading: 'Trade Advice',
      paragraphs: [
        generateTradeStrategy(fullName, isBuyLow, currentValue),
        generateOfferStructure(fullName, position, isBuyLow)
      ]
    },
    {
      heading: 'Long-Term Outlook',
      paragraphs: [
        generateLongTermView(fullName, position, player),
        generateRiskAssessment(fullName, position)
      ]
    }
  ];

  return {
    question,
    question_type: 'buy_low',
    player_id: player.player_id,
    short_answer: shortAnswer,
    explanation_sections: sections,
    value_data: {
      primary_player: {
        player_id: player.player_id,
        full_name: fullName,
        position: position,
        team: player.team,
        fdp_value: currentValue,
        rank: player.rank || 0,
        recent_trend: valueGap < -100 ? 'declining' : valueGap > 100 ? 'rising' : 'stable'
      }
    },
    similar_players: [],
    meta_description: `Is ${fullName} a buy low in dynasty fantasy football? Analysis of current value, market trends, and trade advice for acquiring ${fullName}.`,
    keywords: [
      `${fullName} dynasty`,
      `${fullName} buy low`,
      `${fullName} trade value`,
      'dynasty buy low targets',
      `${position} dynasty value`
    ]
  };
}

export async function generateTradeComparisonQuestion(
  playerA: any,
  playerB: any
): Promise<QuestionData> {
  const nameA = playerA.full_name;
  const nameB = playerB.full_name;
  const valueA = getFDPValue(playerA);
  const valueB = getFDPValue(playerB);
  const difference = valueA - valueB;
  const percentDiff = Math.abs((difference / valueB) * 100);

  const question = `Should I trade ${nameA} for ${nameB}?`;

  let shortAnswer: string;
  if (Math.abs(difference) < 100) {
    shortAnswer = `This is a fair trade. ${nameA} (${valueA} points) and ${nameB} (${valueB} points) are nearly equal in dynasty value. Your decision should be based on team fit, positional needs, and your competitive window.`;
  } else if (difference > 0) {
    shortAnswer = `You'd be selling low. ${nameA} is worth ${valueA} points compared to ${nameB}'s ${valueB} points—a ${Math.abs(difference)} point gap. Unless you have specific roster needs, this trade favors the ${nameB} side.`;
  } else {
    shortAnswer = `This could be a good move. ${nameB} is valued at ${valueB} points compared to ${nameA}'s ${valueA} points. You'd be upgrading by ${Math.abs(difference)} points, which represents solid value gain.`;
  }

  const sections: ExplanationSection[] = [
    {
      heading: 'Value Comparison',
      paragraphs: [
        generateValueComparison(nameA, nameB, valueA, valueB, difference),
        generatePercentageAnalysis(percentDiff)
      ]
    },
    {
      heading: 'Who Wins This Trade?',
      paragraphs: [
        generateTradeWinner(nameA, nameB, difference, playerA.position, playerB.position),
        generateContextualFactors(playerA, playerB)
      ]
    },
    {
      heading: 'Positional Considerations',
      paragraphs: [
        generatePositionalAnalysis(playerA, playerB),
        generateRosterFitAdvice(playerA.position, playerB.position)
      ]
    },
    {
      heading: 'Trade Execution',
      paragraphs: [
        generateNegotiationAdvice(nameA, nameB, difference),
        generateTimingConsiderations()
      ]
    }
  ];

  return {
    question,
    question_type: 'trade_comparison',
    player_id: playerA.player_id,
    player_id_2: playerB.player_id,
    short_answer: shortAnswer,
    explanation_sections: sections,
    value_data: {
      primary_player: {
        player_id: playerA.player_id,
        full_name: nameA,
        position: playerA.position,
        team: playerA.team,
        fdp_value: valueA,
        rank: playerA.rank || 0
      },
      secondary_player: {
        player_id: playerB.player_id,
        full_name: nameB,
        position: playerB.position,
        team: playerB.team,
        fdp_value: valueB,
        rank: playerB.rank || 0
      }
    },
    similar_players: [],
    meta_description: `Should you trade ${nameA} for ${nameB} in dynasty? Complete value comparison, trade analysis, and advice for this fantasy football trade.`,
    keywords: [
      `${nameA} vs ${nameB}`,
      `${nameA} ${nameB} trade`,
      'dynasty trade advice',
      'fantasy football trade',
      `${playerA.position} dynasty value`
    ]
  };
}

export async function generateDynastyOutlookQuestion(player: any, tier: string): Promise<QuestionData> {
  const fullName = player.full_name;
  const position = player.position;
  const currentValue = getFDPValue(player);
  const age = player.age || 25;

  const question = `What is ${fullName}'s dynasty outlook?`;

  const outlook = determineOutlook(currentValue, age, position);
  const shortAnswer = `${fullName} is a ${tier} dynasty ${position} with ${outlook} outlook. At ${currentValue} points, he ranks among the ${getTierDescription(tier)} at his position, making him a ${getAssetType(tier, outlook)} dynasty asset.`;

  const sections: ExplanationSection[] = [
    {
      heading: 'Current Dynasty Standing',
      paragraphs: [
        generateCurrentStanding(fullName, position, currentValue, tier),
        generateTierContext(tier, position)
      ]
    },
    {
      heading: 'Future Projection',
      paragraphs: [
        generateFutureProjection(fullName, age, position, outlook),
        generateTimelineAnalysis(age, position)
      ]
    },
    {
      heading: 'Best Strategy',
      paragraphs: [
        generateStrategyAdvice(fullName, tier, outlook),
        generateWindowConsiderations(tier)
      ]
    },
    {
      heading: 'Trade Value Timeline',
      paragraphs: [
        generateValueTimeline(fullName, age, position),
        generateSellWindow(age, position, outlook)
      ]
    }
  ];

  return {
    question,
    question_type: 'dynasty_outlook',
    player_id: player.player_id,
    short_answer: shortAnswer,
    explanation_sections: sections,
    value_data: {
      primary_player: {
        player_id: player.player_id,
        full_name: fullName,
        position: position,
        team: player.team,
        fdp_value: currentValue,
        rank: player.rank || 0,
        age: age
      },
      tier_info: tier
    },
    similar_players: [],
    meta_description: `${fullName} dynasty outlook and long-term value projection. Complete analysis of trade value, timeline, and optimal strategy for dynasty managers.`,
    keywords: [
      `${fullName} dynasty outlook`,
      `${fullName} long term value`,
      `${fullName} dynasty ranking`,
      `${position} dynasty rankings`,
      'dynasty player projections'
    ]
  };
}

function generateMarketAnalysis(player: any, currentValue: number, marketValue: number, gap: number): string {
  if (Math.abs(gap) < 50) {
    return `${player.full_name} is currently trading at ${currentValue} points in our dynasty value model, which aligns closely with broader market consensus. The ${player.position} market is efficiently priced right now, meaning most managers understand his true value.`;
  } else if (gap < 0) {
    return `${player.full_name} is currently priced at ${currentValue} points in our model, but market trading patterns suggest managers are valuing him closer to ${marketValue} points. This ${Math.abs(gap)}-point gap represents a genuine market inefficiency where perception trails underlying metrics.`;
  } else {
    return `${player.full_name} is currently valued at ${currentValue} points in our model, though market sentiment has inflated his perceived value to around ${marketValue} points. This suggests the market may be overreacting to recent performance or narrative.`;
  }
}

function generatePositionContext(position: string, name: string): string {
  const contexts: Record<string, string> = {
    'QB': `Quarterback values in dynasty are uniquely stable due to positional longevity and late-career primes. ${name}'s value as a QB is less susceptible to rapid depreciation compared to running backs, but also less likely to experience explosive growth unless his situation dramatically improves.`,
    'RB': `Running back values are the most volatile in dynasty due to short shelf lives and injury risk. ${name}'s window as a premium asset is limited, making timing crucial for both acquisition and sale decisions. The position's value curve drops sharply after age 27.`,
    'WR': `Wide receivers maintain dynasty value longer than any skill position, with primes often extending into their early 30s. ${name} benefits from the position's stability, making him a safer long-term hold compared to running backs while still offering significant upside potential.`,
    'TE': `Tight end is fantasy's scarcest position, where elite producers command massive premiums. ${name}'s value at the position is amplified by the lack of true difference-makers, making top-tier tight ends among the most stable dynasty assets despite the position's late development curve.`
  };
  return contexts[position] || contexts['WR'];
}

function generateBuyLowReasoning(name: string, position: string, gap: number): string {
  return `The ${Math.abs(gap)}-point value gap on ${name} exists because the market is overweighting recent negative narratives while undervaluing the underlying production metrics that predict long-term success. As a ${position}, his advanced stats—target quality, snap share, and situation—remain strong despite temporary market pessimism. This creates a classic buy-low window where analytical managers can acquire him below fair value before the market corrects.`;
}

function generateAcquisitionTiming(name: string): string {
  return `Timing is critical when targeting ${name}. The buy-low window typically lasts 1-2 weeks before the market recognizes the inefficiency and prices adjust upward. Dynasty managers should act decisively with offers that appear fair on surface value but capitalize on the current market discount. Package slightly overvalued name-recognition players to extract maximum value from the opportunity.`;
}

function generateFairValueReasoning(name: string, value: number): string {
  return `${name} is trading at fair value (${value} points) because the market has accurately priced in his current production, situation, and long-term outlook. There's no significant arbitrage opportunity here—what you see is what you get. This doesn't make him a bad asset, but it does mean acquiring him requires paying full freight with no built-in margin of safety.`;
}

function generateAlternativeStrategy(position: string): string {
  return `Rather than targeting players at fair value, consider redirecting your attention to undervalued ${position}s where market inefficiencies create better risk-reward profiles. The best dynasty managers consistently identify and exploit mispricings rather than chasing correctly valued assets.`;
}

function generateTradeStrategy(name: string, isBuyLow: boolean, value: number): string {
  if (isBuyLow) {
    return `When trading for ${name}, avoid direct 1-for-1 offers that make your intentions obvious. Instead, propose multi-player deals where ${name} is the secondary piece, or package picks that feel fair but actually undervalue his true worth. Most managers will accept trades that "look right" even when the underlying numbers favor your side.`;
  } else {
    return `Since ${name} is fairly priced at ${value} points, acquisition requires paying market rate. If you're determined to add him, focus on offering players whose value is declining (selling high on your end) or package mid-round picks that feel like adds but don't move the needle long-term.`;
  }
}

function generateOfferStructure(name: string, position: string, isBuyLow: boolean): string {
  if (isBuyLow) {
    return `Structure your offer to include ${name} as part of a larger package. For example, request him alongside a throw-in player while sending back assets that trade on name value rather than production. The key is making the deal feel balanced while actually exploiting the current market discount on ${name}.`;
  } else {
    return `For a fairly-priced ${position} like ${name}, your offer needs to match or slightly exceed his value. Consider offering a younger player with upside plus a mid-round pick, or package two mid-tier ${position}s whose combined value edges past ${name}'s number. The goal is creating perceived fairness while managing your long-term asset base.`;
  }
}

function generateLongTermView(name: string, position: string, player: any): string {
  const age = player.age || 25;
  if (position === 'RB') {
    return `${name}'s long-term dynasty outlook is tied to the running back aging curve, which shows sharp decline after age 27. At ${age} years old, his window of peak production ${age < 26 ? 'extends for several more seasons' : age < 28 ? 'is in its final years' : 'is likely behind him'}. Dynasty managers should ${age < 26 ? 'buy and hold' : age < 28 ? 'contend now or sell' : 'sell immediately'} based on their competitive timeline.`;
  } else if (position === 'WR') {
    return `${name}'s long-term outlook as a wide receiver is relatively stable given the position's extended prime window. At ${age} years old, he ${age < 27 ? 'has multiple seasons ahead in his peak years' : age < 30 ? 'remains in a productive window' : 'is in the veteran stage but can still produce'}. WRs maintain value longer than RBs, making ${name} a ${age < 28 ? 'core building block' : 'competitive asset'} for dynasty rosters.`;
  } else {
    return `${name}'s long-term dynasty value benefits from ${position} longevity. At ${age} years old, he ${age < 26 ? 'has significant runway for growth and sustained production' : age < 30 ? 'is in his prime production years' : 'brings veteran stability'}. The position's aging curve favors sustained value, making him a reliable dynasty asset.`;
  }
}

function generateRiskAssessment(name: string, position: string): string {
  return `Primary risks for ${name} include injury (always present for ${position}s), situation changes (coaching staff, quarterback, offensive scheme), and natural regression to the mean after outlier performances. Dynasty managers should monitor snap share, target quality, and advanced metrics rather than focusing solely on box score stats. These leading indicators predict value changes before the market reacts.`;
}

function generateValueComparison(nameA: string, nameB: string, valueA: number, valueB: number, diff: number): string {
  const winner = diff > 0 ? nameA : nameB;
  const loser = diff > 0 ? nameB : nameA;
  const gap = Math.abs(diff);

  if (gap < 100) {
    return `${nameA} (${valueA} points) and ${nameB} (${valueB} points) are separated by just ${gap} points in our dynasty value model. This marginal difference means the trade is essentially even from a pure value standpoint, with the winner depending on roster construction, league settings, and competitive window rather than raw points.`;
  } else {
    return `${winner} holds a clear ${gap}-point advantage in dynasty value, representing approximately ${((gap / Math.min(valueA, valueB)) * 100).toFixed(0)}% more value than ${loser}. This gap is significant enough that the trade isn't fair straight-up—additional compensation would be needed to balance the deal and prevent value leakage for the side trading ${winner}.`;
  }
}

function generatePercentageAnalysis(percent: number): string {
  if (percent < 5) {
    return `The value difference represents less than 5% variance, which falls within normal market fluctuation and modeling uncertainty. In practical terms, this is a coin flip where team-specific factors matter more than raw valuation.`;
  } else if (percent < 15) {
    return `The ${percent.toFixed(0)}% value gap is noticeable but not overwhelming. The trade could work for either side depending on positional scarcity, roster composition, and whether you're competing now or building for the future.`;
  } else {
    return `A ${percent.toFixed(0)}% value differential is substantial in dynasty terms. This represents a meaningful gap that should be bridged with additional assets—typically a 2nd round pick or equivalent player—to achieve fair value exchange.`;
  }
}

function generateTradeWinner(nameA: string, nameB: string, diff: number, posA: string, posB: string): string {
  if (Math.abs(diff) < 100) {
    return `This trade has no clear winner from a value perspective. ${nameA} and ${nameB} are near-equivalent assets, so the "winner" depends entirely on your roster needs. If you need a ${posB} more than a ${posA}, getting ${nameB} makes you the winner regardless of the marginal point difference.`;
  } else if (diff > 0) {
    return `The ${nameB} side wins this trade by ${Math.abs(diff)} points. Trading ${nameA} for ${nameB} straight-up means selling an objectively more valuable asset for a lesser one. Unless you have compelling roster reasons (injury concerns, position surplus, win-now pressure), this represents negative expected value.`;
  } else {
    return `The ${nameB} side wins this trade by ${Math.abs(diff)} points. Acquiring ${nameB} for ${nameA} means upgrading your roster's total value, which compounds over time. In dynasty, consistently winning trades by even small margins creates championship rosters through accumulated advantages.`;
  }
}

function generateContextualFactors(playerA: any, playerB: any): string {
  return `Beyond pure value, consider age (dynasty favors youth), injury history (availability is the best ability), situation stability (coaching changes matter), and positional scarcity (elite tight ends command premiums). If ${playerA.full_name} is significantly younger or plays a scarcer position, the value gap narrows. Conversely, if ${playerB.full_name} has a more stable situation, his upside could exceed static value projections.`;
}

function generatePositionalAnalysis(playerA: any, playerB: any): string {
  const posA = playerA.position;
  const posB = playerB.position;

  if (posA === posB) {
    return `Both players are ${posA}s, which simplifies the comparison—you're making a direct position upgrade or downgrade without complicating roster balance. ${posA} values ${posA === 'RB' ? 'depreciate quickly, so younger is better' : posA === 'QB' ? 'remain stable long-term' : posA === 'WR' ? 'maintain value better than running backs' : 'are scarce at the top tier'}.`;
  } else {
    return `This trade crosses positions (${posA} for ${posB}), which introduces roster construction considerations. Evaluate your current depth at both positions and your league's scoring settings. ${posB}s ${posB === 'RB' ? 'score more per game but age faster' : posB === 'QB' ? 'produce consistently but are easier to replace' : posB === 'WR' ? 'maintain value longer' : 'are harder to find'} compared to ${posA}s.`;
  }
}

function generateRosterFitAdvice(posA: string, posB: string): string {
  return `Your decision should factor in positional scarcity on your roster. If you're deep at ${posA} but thin at ${posB}, trading for the ${posB} makes strategic sense even if you're giving up slight value. Conversely, if ${posA} is already a weakness, creating a bigger hole there could damage your competitive prospects more than the ${posB} upgrade helps.`;
}

function generateNegotiationAdvice(nameA: string, nameB: string, diff: number): string {
  if (Math.abs(diff) < 50) {
    return `Since values are essentially even, negotiate based on your leverage and their roster needs. If they're desperate for a ${nameA}-type player and you're not attached to him, extract a small add (3rd round pick, depth piece) to "even out" the deal. Most managers will agree to minor additions to close trades they want.`;
  } else if (diff < 0) {
    return `You're on the favorable side of this trade value-wise. When offering ${nameA} for ${nameB}, start by proposing the straight swap—some managers accept without realizing the value gap. If they counter, you can afford to add a small piece (late pick, bench player) and still win the trade overall.`;
  } else {
    return `You're on the unfavorable side trading ${nameA} for ${nameB}. Counter by requesting an additional piece to bridge the ${Math.abs(diff)}-point gap. A 2nd round pick (worth ~${Math.abs(diff/2)} points) or a fringe starter would make the deal fairer. Don't accept the straight swap unless you have overwhelming roster reasons.`;
  }
}

function generateTimingConsiderations(): string {
  return `Trade timing matters in dynasty. Offseason values are typically more stable, while in-season trades often involve emotional reactions to recent games. If you're selling, target contenders after they lose their RB1 to injury. If you're buying, target rebuilders before the rookie draft when picks feel most valuable. Patient dynasty managers exploit these psychological timing edges.`;
}

function generateCurrentStanding(name: string, pos: string, value: number, tier: string): string {
  return `${name} currently ranks as a ${tier} dynasty ${pos} at ${value} points in our model. This places him ${getTierPlacement(tier)} the position, making him ${getTierAssetType(tier)}. His current standing reflects a combination of production metrics, situational factors, and long-term projection rather than just recent performance.`;
}

function generateTierContext(tier: string, position: string): string {
  const tierContexts: Record<string, string> = {
    'elite': `Elite tier represents the top 5-8 dynasty assets at the position—players who combine elite production with youth or situation stability. These players are the cornerstones of championship rosters and rarely become available in trades without significant overpayment.`,
    'tier 1': `Tier 1 includes high-end ${position}1s who produce consistently but lack the combination of youth and elite ceiling that defines the very top tier. These are excellent dynasty assets who can anchor your lineup but may not carry your team alone.`,
    'tier 2': `Tier 2 represents solid ${position}1s or exceptional ${position}2s—players who provide reliable production without elite upside. These assets are the workhorses of dynasty rosters, offering stability and consistency rather than league-winning ceiling.`,
    'tier 3': `Tier 3 includes ${position}2s with ${position}1 upside or aging ${position}1s sliding down the curve. These players have value but come with question marks about sustainability or ceiling, requiring careful evaluation of your competitive window.`
  };
  return tierContexts[tier.toLowerCase()] || tierContexts['tier 2'];
}

function generateFutureProjection(name: string, age: number, position: string, outlook: string): string {
  const outlookMap: Record<string, string> = {
    'ascending': `${name}'s dynasty outlook is ascending, meaning his peak years are still ahead. At ${age} years old, he's entering or in the prime window for ${position}s, with production trajectory pointing upward. This makes him an ideal buy for rebuilders or teams with 2-3 year windows, as his value should continue appreciating before eventually plateauing.`,
    'stable': `${name}'s dynasty outlook is stable, indicating he's in his prime production years. At ${age}, he's neither appreciating nor depreciating significantly, making him perfect for contending teams who need reliable production now. His value should remain relatively consistent over the next 2-3 seasons before natural aging factors begin affecting his dynasty price.`,
    'declining': `${name}'s dynasty outlook is declining due to age-related factors. At ${age}, he's past the typical prime window for ${position}s, meaning his production and value are likely to decrease over the next 1-2 seasons. This doesn't make him worthless—veterans can still produce—but rebuilding teams should sell while competitive teams can extract value from his remaining window.`
  };
  return outlookMap[outlook] || outlookMap['stable'];
}

function generateTimelineAnalysis(age: number, position: string): string {
  if (position === 'RB') {
    if (age < 25) return `As a young running back, his prime is now through age 27. Expect 3-4 more years of high-level production before natural decline begins. This timeline makes him perfect for teams competing now through the mid-term.`;
    if (age < 28) return `In the peak RB window, his highest-value years are happening now. Expect 1-2 more elite seasons before the aging curve catches up. Contenders should buy; rebuilders should sell.`;
    return `Past the typical RB prime, his production window is limited. While he can still contribute, dynasty value will continue declining. Only contending teams should hold; all others should sell immediately.`;
  } else if (position === 'WR') {
    if (age < 25) return `Young wide receivers often break out in years 2-4. His prime window extends through his early 30s potentially, giving dynasty managers a long runway for production and value appreciation.`;
    if (age < 29) return `In his prime WR years, expect sustained production for 3-5 more seasons. Wide receivers age gracefully compared to other positions, maintaining value deep into their career.`;
    return `As a veteran WR, he's past peak but can still produce for 2-3 years. His dynasty value is in gentle decline, but not the cliff that RBs face at similar ages.`;
  }
  return `At ${age} years old, his production timeline is typical for the ${position} position, with prime years generally running through the late 20s.`;
}

function generateStrategyAdvice(name: string, tier: string, outlook: string): string {
  if (tier.toLowerCase() === 'elite' && outlook === 'ascending') {
    return `Elite ascending assets like ${name} should be held at almost any cost. These are the players who win dynasty championships over multi-year windows. Only sell if you receive a massive overpay that includes multiple first-round picks or a package of younger elite talent.`;
  } else if (outlook === 'declining') {
    return `For declining assets like ${name}, the strategy is clear: sell to contenders while he still has name value and production. Don't wait for the value to crater—trade him now while rebuilders can still extract significant return. Target competitive teams who need to win now.`;
  } else {
    return `${name} is a hold for contenders and a trade chip for rebuilders. If you're competing for a championship, his stable production makes him valuable. If you're rebuilding, package him with other win-now pieces to acquire younger players and premium draft capital. Don't hold middle-tier veterans through a rebuild.`;
  }
}

function generateWindowConsiderations(tier: string): string {
  return `Your competitive window dictates how you should value ${tier} players. Contending teams can sacrifice future assets for present production, while rebuilding teams must prioritize youth and picks over current value. Don't make trades that contradict your team's timeline—that's how good rosters become mediocre ones.`;
}

function generateValueTimeline(name: string, age: number, position: string): string {
  if (position === 'RB' && age > 26) {
    return `${name}'s trade value is on a declining timeline. Every week that passes reduces his dynasty price, especially if he's accumulating touches. The optimal sell window was 6-12 months ago, but the second-best time is now before further depreciation.`;
  } else if (age < 24) {
    return `${name}'s trade value is on an ascending timeline as he develops. His price could continue rising over the next 1-2 seasons as production increases and his NFL track record grows. Patient managers who hold through early-career volatility often capture maximum value.`;
  } else {
    return `${name}'s trade value is relatively stable in the near term. His price won't dramatically increase or decrease over the next 6-12 months barring injury or situation changes. This stability means timing matters less than finding the right trade partner.`;
  }
}

function generateSellWindow(age: number, position: string, outlook: string): string {
  if (outlook === 'declining') {
    return `The sell window is open and narrowing. His value will only decrease from here, so dynasty managers should be actively shopping him to contenders. Don't wait for "one more good season" to maximize value—that season might never come, and the value will be gone.`;
  } else if (outlook === 'ascending') {
    return `The sell window won't open for 2-3 years when he's approaching or entering prime production. Right now, patient managers who bought low are being rewarded with appreciation. The time to sell will be when he's delivering peak production and the market is at maximum optimism.`;
  } else {
    return `The sell window is open but not urgent. He'll maintain current value for 1-2 more seasons before natural factors begin chipping away at his price. Managers should monitor his situation and production trajectory, preparing to sell when either begins declining.`;
  }
}

function determineOutlook(value: number, age: number, position: string): string {
  if (position === 'RB') {
    if (age < 25) return 'ascending';
    if (age < 28) return 'stable';
    return 'declining';
  } else if (position === 'WR') {
    if (age < 26) return 'ascending';
    if (age < 29) return 'stable';
    return 'declining';
  } else if (position === 'QB') {
    if (age < 27) return 'ascending';
    if (age < 32) return 'stable';
    return 'declining';
  }
  return 'stable';
}

function getTierDescription(tier: string): string {
  const tiers: Record<string, string> = {
    'elite': 'elite tier',
    'tier 1': 'top tier',
    'tier 2': 'second tier',
    'tier 3': 'third tier'
  };
  return tiers[tier.toLowerCase()] || 'middle tier';
}

function getAssetType(tier: string, outlook: string): string {
  if (tier.toLowerCase() === 'elite') return 'premium';
  if (outlook === 'ascending') return 'ascending';
  if (outlook === 'declining') return 'sell-now';
  return 'solid';
}

function getTierPlacement(tier: string): string {
  const placements: Record<string, string> = {
    'elite': 'at the very top of',
    'tier 1': 'in the top tier of',
    'tier 2': 'in the middle tier of',
    'tier 3': 'in the lower tier of'
  };
  return placements[tier.toLowerCase()] || 'among';
}

function getTierAssetType(tier: string): string {
  const types: Record<string, string> = {
    'elite': 'a foundational dynasty asset who can anchor championship rosters',
    'tier 1': 'a high-quality dynasty asset suitable for contending teams',
    'tier 2': 'a solid dynasty piece who provides reliable value',
    'tier 3': 'a serviceable dynasty asset with upside or a veteran in decline'
  };
  return types[tier.toLowerCase()] || 'a dynasty asset';
}

export function generateQuestionSlug(question: string): string {
  return question
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 100);
}
