import { supabase } from '../supabase';
import { getFDPValue } from '../fdp/getFDPValue';
import {
  generateBuyLowQuestion,
  generateTradeComparisonQuestion,
  generateDynastyOutlookQuestion,
  generateQuestionSlug,
  QuestionData
} from './questionGenerator';

export async function generateAllSearchIntentPages(): Promise<void> {
  console.log('Starting search intent page generation...');

  try {
    const { data: players } = await supabase
      .rpc('get_latest_player_values', {})
      .order('base_value', { ascending: false })
      .limit(200);

    if (!players || players.length === 0) {
      console.log('No players found');
      return;
    }

    console.log(`Found ${players.length} players to process`);

    let generated = 0;

    for (const player of players) {
      try {
        await generatePlayerQuestions(player);
        generated++;

        if (generated % 20 === 0) {
          console.log(`Generated questions for ${generated}/${players.length} players`);
        }
      } catch (error) {
        console.error(`Error generating questions for ${player.full_name}:`, error);
      }
    }

    await generateTradeComparisonPages(players.slice(0, 50));

    console.log(`Search intent page generation complete! Generated questions for ${generated} players.`);
  } catch (error) {
    console.error('Error in search intent generation:', error);
    throw error;
  }
}

async function generatePlayerQuestions(player: any): Promise<void> {
  const playerId = player.player_id;
  const currentValue = getFDPValue(player);

  const { data: marketData } = await supabase
    .from('market_consensus')
    .select('consensus_value, data_points')
    .eq('player_id', playerId)
    .maybeSingle();

  const tier = determineTier(currentValue, player.position);

  await generateAndSaveBuyLowQuestion(player, marketData);
  await generateAndSaveDynastyOutlook(player, tier);
}

async function generateAndSaveBuyLowQuestion(player: any, marketData: any): Promise<void> {
  try {
    const questionData = await generateBuyLowQuestion(player, marketData);
    await saveQuestionPage(questionData);
  } catch (error) {
    console.error(`Error generating buy-low question for ${player.full_name}:`, error);
  }
}

async function generateAndSaveDynastyOutlook(player: any, tier: string): Promise<void> {
  try {
    const questionData = await generateDynastyOutlookQuestion(player, tier);
    await saveQuestionPage(questionData);
  } catch (error) {
    console.error(`Error generating dynasty outlook for ${player.full_name}:`, error);
  }
}

async function generateTradeComparisonPages(players: any[]): Promise<void> {
  console.log('Generating trade comparison pages...');

  const comparisons = selectTradeComparisons(players);
  let generated = 0;

  for (const [playerA, playerB] of comparisons) {
    try {
      const questionData = await generateTradeComparisonQuestion(playerA, playerB);
      await saveQuestionPage(questionData);
      generated++;
    } catch (error) {
      console.error(`Error generating comparison ${playerA.full_name} vs ${playerB.full_name}:`, error);
    }
  }

  console.log(`Generated ${generated} trade comparison pages`);
}

function selectTradeComparisons(players: any[]): [any, any][] {
  const comparisons: [any, any][] = [];

  const byPosition: Record<string, any[]> = {};
  for (const player of players) {
    if (!byPosition[player.position]) byPosition[player.position] = [];
    byPosition[player.position].push(player);
  }

  for (const [position, posPlayers] of Object.entries(byPosition)) {
    for (let i = 0; i < Math.min(posPlayers.length - 1, 20); i++) {
      for (let j = i + 1; j < Math.min(i + 4, posPlayers.length); j++) {
        comparisons.push([posPlayers[i], posPlayers[j]]);
      }
    }
  }

  return comparisons.slice(0, 100);
}

async function saveQuestionPage(questionData: QuestionData): Promise<void> {
  const slug = generateQuestionSlug(questionData.question);

  const { data: existing } = await supabase
    .from('generated_question_pages')
    .select('page_id')
    .eq('slug', slug)
    .maybeSingle();

  const explanationJson = {
    sections: questionData.explanation_sections
  };

  if (existing) {
    await supabase
      .from('generated_question_pages')
      .update({
        question: questionData.question,
        short_answer: questionData.short_answer,
        explanation_json: explanationJson,
        value_data: questionData.value_data,
        similar_players: questionData.similar_players,
        last_modified: new Date().toISOString(),
        meta_description: questionData.meta_description,
        keywords: questionData.keywords
      })
      .eq('page_id', existing.page_id);
  } else {
    await supabase
      .from('generated_question_pages')
      .insert({
        slug,
        question: questionData.question,
        question_type: questionData.question_type,
        player_id: questionData.player_id,
        player_id_2: questionData.player_id_2,
        short_answer: questionData.short_answer,
        explanation_json: explanationJson,
        value_data: questionData.value_data,
        similar_players: questionData.similar_players,
        meta_description: questionData.meta_description,
        keywords: questionData.keywords
      });
  }
}

function determineTier(value: number, position: string): string {
  const thresholds: Record<string, { elite: number; tier1: number; tier2: number }> = {
    'QB': { elite: 5000, tier1: 3500, tier2: 2000 },
    'RB': { elite: 4500, tier1: 3000, tier2: 1800 },
    'WR': { elite: 4500, tier1: 3000, tier2: 1800 },
    'TE': { elite: 4000, tier1: 2500, tier2: 1500 }
  };

  const t = thresholds[position] || thresholds['WR'];

  if (value >= t.elite) return 'Elite';
  if (value >= t.tier1) return 'Tier 1';
  if (value >= t.tier2) return 'Tier 2';
  return 'Tier 3';
}

export async function regenerateStalePages(): Promise<void> {
  console.log('Checking for stale question pages...');

  const { data: pendingUpdates } = await supabase
    .rpc('get_pending_question_updates', { p_limit: 50 });

  if (!pendingUpdates || pendingUpdates.length === 0) {
    console.log('No stale pages to regenerate');
    return;
  }

  console.log(`Regenerating ${pendingUpdates.length} stale pages...`);

  for (const update of pendingUpdates) {
    try {
      const { data: player } = await supabase
        .rpc('get_latest_player_values', {})
        .eq('player_id', update.player_id)
        .maybeSingle();

      if (player) {
        await generatePlayerQuestions(player);

        await supabase
          .from('question_page_updates')
          .update({ processed: true })
          .eq('page_id', update.page_id)
          .eq('processed', false);
      }
    } catch (error) {
      console.error(`Error regenerating page ${update.slug}:`, error);
    }
  }

  console.log('Stale page regeneration complete');
}
