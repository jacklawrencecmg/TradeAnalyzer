export interface CsvDownloadResult {
  success: boolean;
  csvText: string;
  error?: string;
  downloadUrl?: string;
  timestamp: string;
}

function findCsvDownloadLink(html: string, pageUrl: string): string | null {
  const patterns = [
    /<a[^>]*href="([^"]*)"[^>]*>(?:[^<]*Download[^<]*CSV|[^<]*Export[^<]*)<\/a>/i,
    /<a[^>]*href="([^"]*)"[^>]*class="[^"]*csv[^"]*"[^>]*>/i,
    /<a[^>]*href="([^"]*\.csv[^"]*)"[^>]*>/i,
    /href="([^"]*export[^"]*\.php[^"]*)"/i,
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match && match[1]) {
      let href = match[1];

      if (href.startsWith('/')) {
        const url = new URL(pageUrl);
        href = `${url.protocol}//${url.host}${href}`;
      } else if (!href.startsWith('http')) {
        const baseUrl = pageUrl.substring(0, pageUrl.lastIndexOf('/') + 1);
        href = baseUrl + href;
      }

      return href;
    }
  }

  return null;
}

export async function downloadCsvFromPage(
  pageUrl: string
): Promise<CsvDownloadResult> {
  const timestamp = new Date().toISOString();

  try {
    console.log(`Fetching page: ${pageUrl}`);

    const pageResponse = await fetch(pageUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!pageResponse.ok) {
      return {
        success: false,
        csvText: '',
        error: `Failed to fetch page: ${pageResponse.status} ${pageResponse.statusText}`,
        timestamp,
      };
    }

    const html = await pageResponse.text();

    const csvLink = findCsvDownloadLink(html, pageUrl);

    if (!csvLink) {
      return {
        success: false,
        csvText: '',
        error: 'Could not find CSV download link on page',
        timestamp,
      };
    }

    console.log(`Downloading CSV from: ${csvLink}`);

    await new Promise((resolve) => setTimeout(resolve, 500));

    const csvResponse = await fetch(csvLink, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'text/csv,application/csv,*/*',
        Referer: pageUrl,
      },
    });

    if (!csvResponse.ok) {
      return {
        success: false,
        csvText: '',
        error: `Failed to download CSV: ${csvResponse.status} ${csvResponse.statusText}`,
        downloadUrl: csvLink,
        timestamp,
      };
    }

    const csvText = await csvResponse.text();

    if (!csvText || csvText.length < 50) {
      return {
        success: false,
        csvText: '',
        error: 'CSV appears empty or invalid',
        downloadUrl: csvLink,
        timestamp,
      };
    }

    console.log(`✓ Downloaded ${csvText.split('\n').length} lines`);

    return {
      success: true,
      csvText,
      downloadUrl: csvLink,
      timestamp,
    };
  } catch (error) {
    return {
      success: false,
      csvText: '',
      error: error instanceof Error ? error.message : 'Unknown download error',
      timestamp,
    };
  }
}

export async function downloadMultipleCsvs(
  pageUrls: string[]
): Promise<Map<string, CsvDownloadResult>> {
  const results = new Map<string, CsvDownloadResult>();

  for (const url of pageUrls) {
    const result = await downloadCsvFromPage(url);
    results.set(url, result);

    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  return results;
}
