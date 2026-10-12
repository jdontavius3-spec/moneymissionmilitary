/**
 * MONEY MISSION MILITARY RECORDS — CLOUDFLARE EDGE ROUTER & ANALYTICS API
 * Serves portal static assets, handles DSP telemetry beacons, and exposes live stream metrics.
 */

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // Standard CORS headers for analytics API
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Content-Type': 'application/json'
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    // 1. API: /api/stats -> Return live scanned metrics
    if (url.pathname === '/api/stats' || url.pathname === '/api/metrics') {
      try {
        const metricsReq = new Request(new URL('/data/metrics.json', request.url));
        const metricsRes = await env.ASSETS.fetch(metricsReq);
        if (metricsRes.ok) {
          const data = await metricsRes.json();
          return new Response(JSON.stringify(data), {
            headers: {
              ...corsHeaders,
              'Cache-Control': 'public, max-age=60, s-maxage=60'
            }
          });
        }
      } catch (err) {
        // Fallback default response
      }

      return new Response(JSON.stringify({
        artist: "2Cold",
        single: "Ungrateful",
        goal: 50000,
        totalStreams: 1732,
        progressPercent: 3.46,
        status: "LIVE SCANNER ACTIVE",
        youtube: { views: 66, videoId: "1tnm59_OUBw" }
      }), { headers: corsHeaders });
    }

    // 2. API: /api/track -> Ingest client telemetry
    if (url.pathname === '/api/track' && request.method === 'POST') {
      try {
        const payload = await request.json();
        // Log telemetry event to Cloudflare Worker logs
        console.log('[MMM Telemetry]', JSON.stringify({
          event: payload.event,
          platform: payload.platform || null,
          referrer: payload.referrer || 'direct',
          timestamp: payload.timestamp || new Date().toISOString(),
          ipCountry: request.headers.get('cf-ipcountry') || 'US',
          userAgent: request.headers.get('user-agent') || 'unknown'
        }));

        return new Response(JSON.stringify({ success: true, logged: true }), {
          status: 200,
          headers: corsHeaders
        });
      } catch (e) {
        return new Response(JSON.stringify({ error: "Invalid JSON" }), {
          status: 400,
          headers: corsHeaders
        });
      }
    }

    // Default: Root URL rewrite to index.html
    if (url.pathname === '/' || url.pathname === '') {
      return env.ASSETS.fetch(new Request(new URL('/index.html', request.url)));
    }

    // Admin & Dashboard route rewrite
    if (url.pathname === '/admin' || url.pathname === '/dashboard') {
      return env.ASSETS.fetch(new Request(new URL('/admin.html', request.url)));
    }

    // Pass through to static assets
    return env.ASSETS.fetch(request);
  }
};
