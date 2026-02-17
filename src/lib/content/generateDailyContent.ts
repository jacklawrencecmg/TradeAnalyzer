import { supabase } from '../supabase';
import { getFDPValue } from '../fdp/getFDPValue';
import {
  generateRiserArticle,
  generateFallerArticle,
  generateBuyLowArticle,
  generateArticleSlug,
  PlayerMovement,
  ArticleContent
} from './articleGenerator';

export async function generateDailyArticles(): Promise<void> {
  console.log('Starting daily article generation...');

  try {
    const risers = await detectRisers();
    const fallers = await detectFallers();
    const buyLows = await detectBuyLows();

    if (risers.length >= 5) {
      const article = await generateRiserArticle(risers.slice(0, 10));
      await saveArticle(article);
      console.log(`Created riser article: ${article.headline}`);
    }

    if (fallers.length >= 5) {
      const article = await generateFallerArticle(fallers.slice(0, 10));
      await saveArticle(article);
      console.log(`Created faller article: ${article.headline}`);
    }

    if (buyLows.length >= 5) {
      const article = await generateBuyLowArticle(buyLows.slice(0, 10));
      await saveArticle(article);
      console.log(`Created buy-low article: ${article.headline}`);
    }

    await markFeaturedArticles();

    console.log('Daily article generation complete!');
  } catch (error) {
    console.error('Error generating daily articles:', error);
    throw error;
  }
}

async function detectRisers(): Promise<PlayerMovement[]> {
  const { data: currentValues } = await supabase
    .rpc('get_latest_player_values', {})
    .order('base_value', { ascending: false })
    .limit(500);

  if (!currentValues) return [];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const movements: PlayerMovement[] = [];

  for (const player of currentValues) {
    const { data: historicalValue } = await supabase
      .from('ktc_value_snapshots')
      .select('fdp_value, snapshot_date')
      .eq('player_id', player.player_id)
      .lte('snapshot_date', sevenDaysAgo.toISOString())
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (historicalValue) {
      const currentValue = getFDPValue(player);
      const previousValue = historicalValue.fdp_value;
      const change = currentValue - previousValue;
      const changePercent = (change / previousValue) * 100;

      if (change > 100) {
        const { data: rankData } = await supabase
          .rpc('get_latest_player_values', {})
          .gte('base_value', player.base_value)
          .select('player_id');

        movements.push({
          player_id: player.player_id,
          full_name: player.full_name,
          position: player.position,
          team: player.team,
          current_value: currentValue,
          previous_value: previousValue,
          change,
          change_percent: changePercent,
          rank: rankData?.length || 0
        });
      }
    }
  }

  return movements.sort((a, b) => b.change - a.change);
}

async function detectFallers(): Promise<PlayerMovement[]> {
  const { data: currentValues } = await supabase
    .rpc('get_latest_player_values', {})
    .order('base_value', { ascending: false })
    .limit(500);

  if (!currentValues) return [];

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const movements: PlayerMovement[] = [];

  for (const player of currentValues) {
    const { data: historicalValue } = await supabase
      .from('ktc_value_snapshots')
      .select('fdp_value, snapshot_date')
      .eq('player_id', player.player_id)
      .lte('snapshot_date', sevenDaysAgo.toISOString())
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (historicalValue) {
      const currentValue = getFDPValue(player);
      const previousValue = historicalValue.fdp_value;
      const change = currentValue - previousValue;
      const changePercent = (change / previousValue) * 100;

      if (change < -100) {
        const { data: rankData } = await supabase
          .rpc('get_latest_player_values', {})
          .gte('base_value', player.base_value)
          .select('player_id');

        movements.push({
          player_id: player.player_id,
          full_name: player.full_name,
          position: player.position,
          team: player.team,
          current_value: currentValue,
          previous_value: previousValue,
          change,
          change_percent: changePercent,
          rank: rankData?.length || 0
        });
      }
    }
  }

  return movements.sort((a, b) => a.change - b.change);
}

async function detectBuyLows(): Promise<PlayerMovement[]> {
  const { data: currentValues } = await supabase
    .rpc('get_latest_player_values', {})
    .order('base_value', { ascending: false })
    .limit(200);

  if (!currentValues) return [];

  const buyLows: PlayerMovement[] = [];

  for (const player of currentValues) {
    const currentValue = getFDPValue(player);

    const { data: consensusData } = await supabase
      .from('market_consensus')
      .select('consensus_value, data_points')
      .eq('player_id', player.player_id)
      .maybeSingle();

    if (consensusData && consensusData.data_points >= 3) {
      const marketValue = consensusData.consensus_value;
      const valueGap = currentValue - marketValue;

      if (valueGap < -200) {
        const { data: rankData } = await supabase
          .rpc('get_latest_player_values', {})
          .gte('base_value', player.base_value)
          .select('player_id');

        buyLows.push({
          player_id: player.player_id,
          full_name: player.full_name,
          position: player.position,
          team: player.team,
          current_value: currentValue,
          previous_value: marketValue,
          change: valueGap,
          change_percent: (valueGap / marketValue) * 100,
          rank: rankData?.length || 0
        });
      }
    }
  }

  return buyLows.sort((a, b) => a.change - b.change);
}

async function saveArticle(article: ArticleContent): Promise<void> {
  const slug = generateArticleSlug(article.headline);

  const { data: existing } = await supabase
    .from('generated_articles')
    .select('article_id')
    .eq('slug', slug)
    .maybeSingle();

  const contentJson = {
    sections: article.sections,
    player_count: article.players.length
  };

  if (existing) {
    await supabase
      .from('generated_articles')
      .update({
        headline: article.headline,
        subheadline: article.subheadline,
        content_json: contentJson,
        player_ids: article.players.map(p => p.player_id),
        last_modified: new Date().toISOString(),
        meta_description: article.meta_description,
        keywords: article.keywords
      })
      .eq('article_id', existing.article_id);
  } else {
    const { data: newArticle, error } = await supabase
      .from('generated_articles')
      .insert({
        slug,
        headline: article.headline,
        subheadline: article.subheadline,
        article_type: article.article_type,
        content_json: contentJson,
        player_ids: article.players.map(p => p.player_id),
        meta_description: article.meta_description,
        keywords: article.keywords,
        featured: false
      })
      .select()
      .single();

    if (error) throw error;

    if (newArticle) {
      for (const player of article.players) {
        await supabase
          .from('article_player_mentions')
          .insert({
            article_id: newArticle.article_id,
            player_id: player.player_id,
            mention_context: article.article_type
          });
      }
    }
  }
}

async function markFeaturedArticles(): Promise<void> {
  await supabase
    .from('generated_articles')
    .update({ featured: false })
    .neq('article_id', '00000000-0000-0000-0000-000000000000');

  const { data: recentArticles } = await supabase
    .from('generated_articles')
    .select('article_id, article_type, publish_date')
    .order('publish_date', { ascending: false })
    .limit(10);

  if (!recentArticles) return;

  const articleTypes = ['riser', 'faller', 'buy_low'];
  const featured: string[] = [];

  for (const type of articleTypes) {
    const article = recentArticles.find(a => a.article_type === type);
    if (article) {
      featured.push(article.article_id);
    }
  }

  if (featured.length > 0) {
    await supabase
      .from('generated_articles')
      .update({ featured: true })
      .in('article_id', featured);
  }
}
