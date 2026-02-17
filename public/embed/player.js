(function() {
  const FDP_DOMAIN = 'https://www.fantasydraftpros.com';

  function getPlayerSlug(playerName) {
    return playerName
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  function getTrendIcon(trend) {
    if (trend === 'rising' || trend === 'up') return '↑';
    if (trend === 'declining' || trend === 'down') return '↓';
    return '→';
  }

  function getTrendColor(trend) {
    if (trend === 'rising' || trend === 'up') return '#10b981';
    if (trend === 'declining' || trend === 'down') return '#ef4444';
    return '#6b7280';
  }

  function createWidget(container, data) {
    const playerSlug = getPlayerSlug(data.full_name);
    const trendIcon = getTrendIcon(data.trend);
    const trendColor = getTrendColor(data.trend);

    const widgetHTML = `
      <div class="fdp-widget" style="
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        background: linear-gradient(135deg, #1a1d2e 0%, #16213e 100%);
        border-radius: 12px;
        padding: 16px;
        color: #ffffff;
        max-width: 320px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
        border: 1px solid rgba(255, 255, 255, 0.1);
      ">
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 12px;">
          <div style="flex: 1;">
            <div style="font-size: 18px; font-weight: 700; margin-bottom: 4px;">
              ${data.full_name}
            </div>
            <div style="font-size: 13px; color: #9ca3af;">
              ${data.position} • ${data.team || 'FA'}
            </div>
          </div>
          <div style="text-align: right;">
            <div style="font-size: 24px; font-weight: 800; color: #3b82f6;">
              ${data.value}
            </div>
            <div style="font-size: 12px; color: #9ca3af;">
              Dynasty Value
            </div>
          </div>
        </div>

        <div style="display: flex; gap: 8px; margin-bottom: 12px;">
          <div style="
            flex: 1;
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 6px;
            padding: 8px;
            text-align: center;
          ">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 2px;">
              Tier
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #3b82f6;">
              ${data.tier}
            </div>
          </div>
          <div style="
            flex: 1;
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 6px;
            padding: 8px;
            text-align: center;
          ">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 2px;">
              Rank
            </div>
            <div style="font-size: 14px; font-weight: 700; color: #3b82f6;">
              #${data.rank}
            </div>
          </div>
          <div style="
            flex: 1;
            background: rgba(59, 130, 246, 0.1);
            border: 1px solid rgba(59, 130, 246, 0.3);
            border-radius: 6px;
            padding: 8px;
            text-align: center;
          ">
            <div style="font-size: 11px; color: #9ca3af; margin-bottom: 2px;">
              Trend
            </div>
            <div style="font-size: 18px; font-weight: 700;" color="${trendColor}">
              ${trendIcon}
            </div>
          </div>
        </div>

        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding-top: 12px;
          border-top: 1px solid rgba(255, 255, 255, 0.1);
        ">
          <div style="font-size: 11px; color: #6b7280;">
            Updated ${data.last_updated}
          </div>
          <a
            href="${FDP_DOMAIN}/dynasty-value/${playerSlug}"
            target="_blank"
            rel="noopener"
            style="
              font-size: 11px;
              color: #3b82f6;
              text-decoration: none;
              font-weight: 600;
            "
          >
            FDP Dynasty Values →
          </a>
        </div>
      </div>
    `;

    container.innerHTML = widgetHTML;
  }

  function trackEmbed(playerName, domain) {
    const img = new Image();
    img.src = `${FDP_DOMAIN}/api/track-embed?player=${encodeURIComponent(playerName)}&domain=${encodeURIComponent(domain)}`;
  }

  function initWidget(script) {
    const playerName = script.getAttribute('data-player');
    const playerId = script.getAttribute('data-player-id');

    if (!playerName && !playerId) {
      console.error('FDP Widget: Missing data-player or data-player-id attribute');
      return;
    }

    const container = document.createElement('div');
    script.parentNode.insertBefore(container, script.nextSibling);

    const domain = window.location.hostname;

    fetch(`${FDP_DOMAIN}/api/public/player-widget?${playerId ? `id=${encodeURIComponent(playerId)}` : `name=${encodeURIComponent(playerName)}`}`)
      .then(response => response.json())
      .then(data => {
        if (data.error) {
          container.innerHTML = `<div style="color: red; font-size: 12px;">Error loading player data</div>`;
          return;
        }
        createWidget(container, data);
        trackEmbed(data.full_name, domain);
      })
      .catch(error => {
        console.error('FDP Widget Error:', error);
        container.innerHTML = `<div style="color: red; font-size: 12px;">Failed to load widget</div>`;
      });
  }

  const scripts = document.querySelectorAll('script[src*="embed/player.js"]');
  scripts.forEach(initWidget);
})();
