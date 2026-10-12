/**
 * MONEY MISSION MILITARY — LIVE INTELLIGENCE TRACKER & ANALYTICS ENGINE
 * Version 1.0.0
 * Purpose: Track DSP conversions, incoming ad traffic, and synchronize live streaming milestones.
 */

(function () {
  'use strict';

  const TRACKING_ENDPOINT = '/api/track';
  const METRICS_ENDPOINT = '/api/stats';
  const FALLBACK_METRICS_PATH = '/data/metrics.json';

  // 1. Session & UTM Attribution
  function getSessionId() {
    let sid = sessionStorage.getItem('mmm_sid');
    if (!sid) {
      sid = 'sid_' + Math.random().toString(36).substring(2, 10) + '_' + Date.now();
      sessionStorage.setItem('mmm_sid', sid);
    }
    return sid;
  }

  function getUtmParams() {
    const params = new URLSearchParams(window.location.search);
    return {
      utm_source: params.get('utm_source') || '',
      utm_medium: params.get('utm_medium') || '',
      utm_campaign: params.get('utm_campaign') || '',
      utm_content: params.get('utm_content') || '',
      fbclid: params.get('fbclid') || ''
    };
  }

  // 2. Dispatch Event
  function dispatchEvent(eventName, payload) {
    const eventData = {
      event: eventName,
      timestamp: new Date().toISOString(),
      sessionId: getSessionId(),
      path: window.location.pathname,
      referrer: document.referrer || 'direct',
      device: /Mobi|Android/i.test(navigator.userAgent) ? 'mobile' : 'desktop',
      utm: getUtmParams(),
      ...payload
    };

    // Store in local ledger
    try {
      const rawLedger = localStorage.getItem('mmm_event_ledger');
      const ledger = rawLedger ? JSON.parse(rawLedger) : [];
      ledger.push(eventData);
      if (ledger.length > 200) ledger.shift();
      localStorage.setItem('mmm_event_ledger', JSON.stringify(ledger));

      // Update local click tallies
      if (eventName === 'dsp_click' && payload.platform) {
        const tallies = JSON.parse(localStorage.getItem('mmm_click_tallies') || '{}');
        tallies[payload.platform] = (tallies[payload.platform] || 0) + 1;
        tallies._total = (tallies._total || 0) + 1;
        localStorage.setItem('mmm_click_tallies', JSON.stringify(tallies));
      }
    } catch (e) {
      // Ignore storage errors in private browsing
    }

    // Transmit to Cloudflare API endpoint via Beacon
    const body = JSON.stringify(eventData);
    if (navigator.sendBeacon) {
      navigator.sendBeacon(TRACKING_ENDPOINT, body);
    } else {
      fetch(TRACKING_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body,
        keepalive: true
      }).catch(function () {});
    }

    // Meta Pixel forwarder (if loaded)
    if (typeof window.fbq === 'function') {
      if (eventName === 'page_view') {
        window.fbq('track', 'PageView');
      } else if (eventName === 'dsp_click') {
        window.fbq('trackCustom', 'DSPClick', { platform: payload.platform, url: payload.url });
      }
    }
  }

  // 3. Attach Listeners for Outbound DSP & Social Links
  function attachTrackers() {
    // Track Pageview
    dispatchEvent('page_view', { title: document.title });

    // Track DSP Stream Bar Links
    document.querySelectorAll('.stream-brand, .btn-hero-primary, .reel-action-btn, a[href*="spotify"], a[href*="apple"], a[href*="youtube"], a[href*="tiktok"], a[href*="instagram"]').forEach(function (el) {
      el.addEventListener('click', function (e) {
        const url = el.getAttribute('href') || '';
        let platform = el.textContent.trim() || 'Unknown';
        
        if (url.includes('apple.com')) platform = 'Apple Music';
        else if (url.includes('spotify.com')) platform = 'Spotify';
        else if (url.includes('youtu.be') || url.includes('youtube.com/watch')) platform = 'YouTube Music';
        else if (url.includes('youtube.com/@')) platform = 'Official YouTube';
        else if (url.includes('instagram.com')) platform = 'Instagram';
        else if (url.includes('tiktok.com')) platform = 'TikTok';

        dispatchEvent('dsp_click', {
          platform: platform,
          url: url,
          source_element: el.className || 'a'
        });
      });
    });

    // Track Lyric Card Generator Downloads
    const dlBtn = document.querySelector('.btn-challenge-primary');
    if (dlBtn) {
      dlBtn.addEventListener('click', function () {
        dispatchEvent('engagement', {
          action: 'generate_lyric_card',
          label: '2Cold Ungrateful Lyric Share Card'
        });
      });
    }

    // Track Theater Video Tabs
    document.querySelectorAll('.theater-tab-btn').forEach(function (tabBtn, idx) {
      tabBtn.addEventListener('click', function () {
        const tabNames = ['youtube_music_video', 'raw_studio_teaser', 'highway_visualizer'];
        dispatchEvent('video_tab_switch', {
          tab: tabNames[idx] || 'tab_' + idx
        });
      });
    });
  }

  // 4. Live Milestone & Stream Metrics Synchronizer
  function syncLiveMetrics() {
    const fetchUrl = METRICS_ENDPOINT;
    fetch(fetchUrl)
      .then(function (res) {
        if (!res.ok) throw new Error('API offline, falling back to static');
        return res.json();
      })
      .catch(function () {
        return fetch(FALLBACK_METRICS_PATH).then(function (r) { return r.json(); });
      })
      .then(function (data) {
        if (!data) return;
        renderLiveMetrics(data);
      })
      .catch(function (err) {
        console.warn('[MMM Intelligence] Live metrics load failed:', err);
      });
  }

  function renderLiveMetrics(data) {
    const targetGoal = data.goal || 50000;
    const totalStreams = data.totalStreams || data.youtubeViews || 0;
    const progressPercent = Math.min(100, Math.max(1, (totalStreams / targetGoal) * 100)).toFixed(1);

    // Update Counter Elements if present
    const counterEl = document.getElementById('liveStreamCounter');
    if (counterEl) {
      counterEl.textContent = totalStreams.toLocaleString();
    }

    const goalEl = document.getElementById('liveGoalCounter');
    if (goalEl) {
      goalEl.textContent = targetGoal.toLocaleString();
    }

    const barEl = document.getElementById('liveProgressBar');
    if (barEl) {
      barEl.style.width = progressPercent + '%';
    }

    const pctEl = document.getElementById('liveProgressPercent');
    if (pctEl) {
      pctEl.textContent = progressPercent + '%';
    }

    const scannerBadge = document.getElementById('liveScannerBadge');
    if (scannerBadge) {
      scannerBadge.innerHTML = '<span class="pulse-radar-dot"></span> LIVE SCANNER SYNCHRONIZED • ' + totalStreams.toLocaleString() + ' / ' + targetGoal.toLocaleString() + ' STREAMS';
    }
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      attachTrackers();
      syncLiveMetrics();
    });
  } else {
    attachTrackers();
    syncLiveMetrics();
  }

  // Expose API for dashboard
  window.MMM_TRACKER = {
    dispatch: dispatchEvent,
    sync: syncLiveMetrics
  };
})();
