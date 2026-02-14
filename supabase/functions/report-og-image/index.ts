import { createClient } from 'npm:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');

    if (!slug) {
      throw new Error('Slug parameter required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: report } = await supabase
      .rpc('get_report_by_slug', { p_slug: slug });

    if (!report || report.length === 0) {
      throw new Error('Report not found');
    }

    const reportData = report[0];

    const svg = generateOGImage(
      reportData.title,
      reportData.week,
      reportData.season,
      reportData.metadata.top_riser_name,
      reportData.metadata.top_riser_change,
      reportData.metadata.top_faller_name,
      reportData.metadata.top_faller_change
    );

    return new Response(svg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
        'Cache-Control': 'public, max-age=3600',
      },
    });

  } catch (error) {
    console.error('Error generating OG image:', error);

    const errorSvg = `
      <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
        <rect width="1200" height="630" fill="#1e40af"/>
        <text x="600" y="315" font-family="Arial, sans-serif" font-size="48" fill="white" text-anchor="middle">
          Dynasty Market Report
        </text>
      </svg>
    `;

    return new Response(errorSvg, {
      headers: {
        ...corsHeaders,
        'Content-Type': 'image/svg+xml',
      },
    });
  }
});

function generateOGImage(
  title: string,
  week: number,
  season: number,
  topRiserName: string,
  topRiserChange: number,
  topFallerName: string,
  topFallerChange: number
): string {
  return `
    <svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#2563eb;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#7c3aed;stop-opacity:1" />
        </linearGradient>
      </defs>

      <!-- Background -->
      <rect width="1200" height="630" fill="url(#bgGradient)"/>

      <!-- Title Section -->
      <text x="60" y="100" font-family="Arial, sans-serif" font-size="72" font-weight="bold" fill="white">
        Dynasty Market Report
      </text>
      <text x="60" y="160" font-family="Arial, sans-serif" font-size="36" fill="#93c5fd">
        Week ${week}, ${season}
      </text>

      <!-- Divider -->
      <line x1="60" y1="200" x2="1140" y2="200" stroke="#60a5fa" stroke-width="2"/>

      <!-- Top Riser -->
      <g>
        <rect x="60" y="250" width="500" height="140" rx="12" fill="rgba(255,255,255,0.1)"/>
        <text x="80" y="290" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#86efac">
          📈 TOP RISER
        </text>
        <text x="80" y="330" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">
          ${truncateText(topRiserName, 20)}
        </text>
        <text x="80" y="365" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#4ade80">
          +${topRiserChange.toLocaleString()}
        </text>
      </g>

      <!-- Top Faller -->
      <g>
        <rect x="640" y="250" width="500" height="140" rx="12" fill="rgba(255,255,255,0.1)"/>
        <text x="660" y="290" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="#fca5a5">
          📉 TOP FALLER
        </text>
        <text x="660" y="330" font-family="Arial, sans-serif" font-size="28" font-weight="bold" fill="white">
          ${truncateText(topFallerName, 20)}
        </text>
        <text x="660" y="365" font-family="Arial, sans-serif" font-size="32" font-weight="bold" fill="#f87171">
          ${topFallerChange.toLocaleString()}
        </text>
      </g>

      <!-- Footer -->
      <text x="60" y="570" font-family="Arial, sans-serif" font-size="28" fill="#93c5fd">
        FantasyDraftPros.com
      </text>
    </svg>
  `;
}

function truncateText(text: string, maxLength: number): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}
