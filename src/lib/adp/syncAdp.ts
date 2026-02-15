import { supabase } from '../supabase';
import { normalizeName } from '../players/normalizeName';
import { resolvePlayerId } from '../players/resolvePlayerId';

interface AdpEntry {
  player_name: string;
  position: string;
  team: string;
  adp_overall: number;
}

interface SyncResult {
  success: boolean;
  imported: number;
  unresolved: number;
  errors: string[];
}

export async function syncAdp(sourceUrl?: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: false,
    imported: 0,
    unresolved: 0,
    errors: [],
  };

  try {
    const adpUrl = sourceUrl || import.meta.env.VITE_ADP_SOURCE_URL || process.env.ADP_SOURCE_URL;

    if (!adpUrl) {
      result.errors.push('No ADP source URL configured');
      return result;
    }

    const response = await fetch(adpUrl);
    if (!response.ok) {
      result.errors.push(`Failed to fetch ADP data: ${response.statusText}`);
      return result;
    }

    const contentType = response.headers.get('content-type');
    let adpData: AdpEntry[] = [];

    if (contentType?.includes('application/json')) {
      adpData = await response.json();
    } else if (contentType?.includes('text/csv')) {
      const csvText = await response.text();
      adpData = parseAdpCsv(csvText);
    } else {
      const text = await response.text();
      try {
        adpData = JSON.parse(text);
      } catch {
        adpData = parseAdpCsv(text);
      }
    }

    const today = new Date().toISOString().split('T')[0];
    const source = new URL(adpUrl).hostname;

    for (const entry of adpData) {
      try {
        if (!entry.player_name || !entry.adp_overall) {
          continue;
        }

        const normalizedName = normalizeName(entry.player_name);
        const playerId = await resolvePlayerId(
          normalizedName,
          entry.position || null,
          entry.team || null
        );

        if (playerId) {
          const { error } = await supabase.from('player_adp').upsert(
            {
              player_id: playerId,
              adp: entry.adp_overall,
              as_of_date: today,
              source,
            },
            { onConflict: 'player_id,as_of_date' }
          );

          if (error) {
            result.errors.push(`Failed to store ADP for ${entry.player_name}: ${error.message}`);
          } else {
            result.imported++;
          }
        } else {
          await supabase.from('unresolved_entities').insert({
            entity_type: 'player',
            raw_name: entry.player_name,
            normalized_name: normalizedName,
            context: {
              position: entry.position,
              team: entry.team,
              adp: entry.adp_overall,
              source: 'adp',
            },
          });
          result.unresolved++;
        }
      } catch (err) {
        result.errors.push(
          `Error processing ${entry.player_name}: ${err instanceof Error ? err.message : 'Unknown error'}`
        );
      }
    }

    result.success = true;
    return result;
  } catch (err) {
    result.errors.push(err instanceof Error ? err.message : 'Unknown error');
    return result;
  }
}

function parseAdpCsv(csvText: string): AdpEntry[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];

  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const nameIdx = headers.findIndex((h) => h.includes('name') || h.includes('player'));
  const posIdx = headers.findIndex((h) => h.includes('pos'));
  const teamIdx = headers.findIndex((h) => h.includes('team'));
  const adpIdx = headers.findIndex((h) => h.includes('adp') || h.includes('avg'));

  if (nameIdx === -1 || adpIdx === -1) {
    return [];
  }

  const entries: AdpEntry[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/"/g, ''));

    if (cols.length > Math.max(nameIdx, adpIdx)) {
      const adp = parseFloat(cols[adpIdx]);
      if (!isNaN(adp) && adp > 0) {
        entries.push({
          player_name: cols[nameIdx],
          position: posIdx >= 0 ? cols[posIdx] : '',
          team: teamIdx >= 0 ? cols[teamIdx] : '',
          adp_overall: adp,
        });
      }
    }
  }

  return entries;
}

export async function getLatestAdp(playerId: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('player_adp')
    .select('adp')
    .eq('player_id', playerId)
    .order('as_of_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.adp;
}

export async function getAdpByDate(playerId: string, date: string): Promise<number | null> {
  const { data, error } = await supabase
    .from('player_adp')
    .select('adp')
    .eq('player_id', playerId)
    .lte('as_of_date', date)
    .order('as_of_date', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    return null;
  }

  return data.adp;
}
