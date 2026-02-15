export interface RedraftList {
  type: 'redraft_ppr' | 'redraft_half_ppr' | 'redraft_standard' | 'adp_ppr';
  url: string;
}

const REDRAFT_LISTS: RedraftList[] = [
  {
    type: 'redraft_ppr',
    url: 'https://www.fantasypros.com/nfl/rankings/ppr-cheatsheets.php',
  },
  {
    type: 'redraft_half_ppr',
    url: 'https://www.fantasypros.com/nfl/rankings/half-point-ppr-cheatsheets.php',
  },
  {
    type: 'adp_ppr',
    url: 'https://www.fantasypros.com/nfl/adp/ppr-overall.php',
  },
];

export interface DownloadedRedraftCsv {
  type: string;
  csvText: string;
  error?: string;
}

/**
 * Parse HTML to find CSV download link
 */
function findCsvDownloadLink(html: string): string | null {
  // Look for link with text containing "Download CSV" or "Export"
  const downloadLinkMatch = html.match(
    /<a[^>]*href="([^"]*)"[^>]*>(?:[^<]*Download[^<]*CSV|[^<]*Export[^<]*)<\/a>/i
  );

  if (downloadLinkMatch && downloadLinkMatch[1]) {
    return downloadLinkMatch[1];
  }

  // Alternative: look for CSV export button/link
  const csvButtonMatch = html.match(
    /<a[^>]*href="([^"]*\.csv[^"]*)"[^>]*>/i
  );

  if (csvButtonMatch && csvButtonMatch[1]) {
    return csvButtonMatch[1];
  }

  // Look for data export endpoints
  const exportMatch = html.match(/href="([^"]*export[^"]*\.php[^"]*)"/i);
  if (exportMatch && exportMatch[1]) {
    return exportMatch[1];
  }

  return null;
}

/**
 * Download redraft CSV from FantasyPros URL
 */
async function downloadRedraftCsvFromUrl(
  url: string
): Promise<{ csvText: string; error?: string }> {
  try {
    // First fetch the page HTML
    const pageResponse = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!pageResponse.ok) {
      return {
        csvText: '',
        error: `Failed to fetch page: ${pageResponse.status}`,
      };
    }

    const html = await pageResponse.text();

    // Find CSV download link
    let csvLink = findCsvDownloadLink(html);

    if (!csvLink) {
      return {
        csvText: '',
        error: 'Could not find CSV download link in page',
      };
    }

    // Make absolute URL if relative
    if (csvLink.startsWith('/')) {
      csvLink = `https://www.fantasypros.com${csvLink}`;
    } else if (!csvLink.startsWith('http')) {
      const baseUrl = url.substring(0, url.lastIndexOf('/') + 1);
      csvLink = baseUrl + csvLink;
    }

    // Download CSV
    const csvResponse = await fetch(csvLink, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'text/csv,application/csv,*/*',
        'Referer': url,
      },
    });

    if (!csvResponse.ok) {
      return {
        csvText: '',
        error: `Failed to download CSV: ${csvResponse.status}`,
      };
    }

    const csvText = await csvResponse.text();

    if (!csvText || csvText.length < 50) {
      return {
        csvText: '',
        error: 'CSV appears empty or invalid',
      };
    }

    return { csvText };
  } catch (error) {
    return {
      csvText: '',
      error: error instanceof Error ? error.message : 'Unknown download error',
    };
  }
}

/**
 * Download all redraft/ADP CSV files
 */
export async function downloadAllRedraftCsvs(): Promise<DownloadedRedraftCsv[]> {
  const results: DownloadedRedraftCsv[] = [];

  for (const list of REDRAFT_LISTS) {
    console.log(`Downloading redraft ${list.type}...`);

    const { csvText, error } = await downloadRedraftCsvFromUrl(list.url);

    results.push({
      type: list.type,
      csvText,
      error,
    });

    // Small delay to be respectful
    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  return results;
}

/**
 * Parse CSV text into rows
 */
export function parseCsvText(csvText: string): string[][] {
  const rows: string[][] = [];
  const lines = csvText.split('\n');

  for (const line of lines) {
    if (!line.trim()) continue;

    // Simple CSV parsing (handles quoted fields)
    const fields: string[] = [];
    let currentField = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          currentField += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        fields.push(currentField.trim());
        currentField = '';
      } else {
        currentField += char;
      }
    }

    fields.push(currentField.trim());
    rows.push(fields);
  }

  return rows;
}

/**
 * Download and parse a single redraft list
 */
export async function downloadRedraftList(
  type: string
): Promise<{ rows: string[][]; error?: string }> {
  const list = REDRAFT_LISTS.find((l) => l.type === type);

  if (!list) {
    return { rows: [], error: 'Unknown list type' };
  }

  const { csvText, error } = await downloadRedraftCsvFromUrl(list.url);

  if (error) {
    return { rows: [], error };
  }

  const rows = parseCsvText(csvText);
  return { rows };
}

/**
 * Download default redraft list (PPR)
 */
export async function downloadDefaultRedraftList(): Promise<{
  rows: string[][];
  error?: string;
}> {
  return downloadRedraftList('redraft_ppr');
}
