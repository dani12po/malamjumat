'use client';
import { useEffect, useRef, useState } from 'react';
import { trackSession } from '@/lib/ad-session';
import VideoThumb from '@/app/f/[slug]/thumb';

// Player dengan intercept iklan saat klik play.
// Mekanisme:
//   - Klik play ke-1 s/d ke-5: buka halaman iklan di tab baru, video BELUM play.
//     User harus klik play lagi setelah iklan terbuka → kali kedua langsung play.
//   - Setelah 5x intercept (total klik = 10 dengan klik post-iklan), semua klik
//     berikutnya langsung play tanpa iklan (batas tercapai).
//   - Counter disimpan di sessionStorage per video ID (reset tiap buka tab baru).
//   - Backlink iklan dirotasi acak dari settings.backlinks.
//   - Bila tidak ada backlink → langsung play seperti biasa.

const MARKS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95];
const TIME_MARKS = [10, 20, 30, 45, 60, 90, 120, 180];
const MAX_AD_INTERCEPTS = 4;

function getInterceptCount(videoId) {
  try {
    return Number(sessionStorage.getItem(`play-ad-${videoId}`) || '0') || 0;
  } catch {
    return 0;
  }
}

function incInterceptCount(videoId) {
  try {
    const n = getInterceptCount(videoId) + 1;
    sessionStorage.setItem(`play-ad-${videoId}`, String(n));
    return n;
  } catch {
    return 1;
  }
}

// Deteksi apakah URL adalah video langsung (MP4, dll) bukan iframe embed
function isDirectVideoUrl(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const path = u.pathname.toLowerCase();
    // Ekstensi video umum
    if (/\.(mp4|webm|ogg|mov|m4v|mkv|avi|flv|wmv|3gp)(\?|$)/i.test(path)) return true;
    // Domain CDN video terkenal yang serve MP4 langsung
    if (/video\.twimg\.com|twimg\.com\/amplify_video/i.test(u.hostname + u.pathname)) return true;
    if (/\/(vid|video|amplify_video)\//i.test(u.pathname)) return true;
    return false;
  } catch {
    return false;
  }
}

// Bungkus URL video dengan proxy bila domain-nya kemungkinan blokir CORS/Referer
function proxyVideoUrl(url) {
  if (!url) return url;
  try {
    const u = new URL(url);
    // Domain yang diketahui blokir embed langsung
    const needsProxy = [
      'video.twimg.com', 'pbs.twimg.com', 'twimg.com',
      'scontent.cdninstagram.com', 'instagram.com',
      'fbcdn.net', 'facebook.com',
      'tiktokcdn.com', 'tiktok.com'
    ].some(d => u.hostname.endsWith(d));
    if (needsProxy) {
      return `/api/video?u=${encodeURIComponent(url)}`;
    }
    return url;
  } catch {
    return url;
  }
}

function pickBacklink(settings) {
  const links = Array.isArray(settings?.backlinks) && settings.backlinks.length > 0
    ? settings.backlinks.filter(Boolean)
    : settings?.directLink
      ? [settings.directLink]
      : [];
  if (links.length === 0) return null;
  return links[Math.floor(Math.random() * links.length)];
}

export default function VideoPlayer({ video, settings }) {
  const [unlocked, setUnlocked] = useState(false);
  // 'idle' | 'ad-shown' = sudah buka iklan, tunggu klik play ke-2
  const [adState, setAdState] = useState('idle');
  const vidRef = useRef(null);
  const wrapRef = useRef(null);
  const pausedOnce = useRef(false);
  const hitMarks = useRef({});
  const hitTimes = useRef({});
  const visibleSent = useRef(false);

  useEffect(() => {
    trackSession('VIDEO_OPEN', { id: video.id });
  }, [video.id]);

  // Reset state saat pindah video
  useEffect(() => {
    setUnlocked(false);
    setAdState('idle');
    pausedOnce.current = false;
    hitMarks.current = {};
    hitTimes.current = {};
  }, [video.id]);

  // VIDEO_VISIBLE: player benar-benar masuk viewport (sekali per video).
  useEffect(() => {
    visibleSent.current = false;
    const el = wrapRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') {
      visibleSent.current = true;
      trackSession('VIDEO_VISIBLE', { id: video.id });
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!visibleSent.current && entries.some((e) => e.isIntersecting)) {
          visibleSent.current = true;
          trackSession('VIDEO_VISIBLE', { id: video.id });
          io.disconnect();
        }
      },
      { threshold: 0.4 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [video.id]);

  function handleClick() {
    // Sudah unlocked → tidak seharusnya terjadi (thumbnail tidak render), tapi safeguard
    if (unlocked) return;

    const count = getInterceptCount(video.id);
    const backlink = pickBacklink(settings);

    // Tidak ada backlink atau sudah melebihi batas → langsung play
    if (!backlink || count >= MAX_AD_INTERCEPTS) {
      doPlay('direct');
      return;
    }

    if (adState === 'idle') {
      // Klik pertama: buka iklan di tab baru, tampilkan overlay "klik lagi untuk play"
      incInterceptCount(video.id);
      // Buka iklan — pakai window.open agar tidak di-block (dipanggil dari click handler)
      try {
        window.open(backlink, '_blank', 'noopener');
      } catch {
        // Bila di-block popup blocker, tetap lanjut ke state ad-shown
      }
      setAdState('ad-shown');
      trackSession('PRE_PLAY_AD_OPEN', { id: video.id, count: count + 1 });
    } else {
      // Klik kedua setelah iklan terbuka → play
      doPlay('post-ad');
    }
  }

  function doPlay(via) {
    setUnlocked(true);
    setAdState('idle');
    trackSession('VIDEO_START', { id: video.id });
    trackSession('PRE_PLAY_OPPORTUNITY', { id: video.id });
    trackSession('VIDEO_PLAY', { id: video.id, via });
  }

  function handlePlay() {
    trackSession(pausedOnce.current ? 'VIDEO_RESUME' : 'VIDEO_PLAY', { id: video.id, via: 'player' });
  }

  function handlePause() {
    const el = vidRef.current;
    if (el && el.ended) return;
    pausedOnce.current = true;
    trackSession('VIDEO_PAUSE', { id: video.id });
  }

  function handleTime() {
    const el = vidRef.current;
    if (!el || !el.duration) return;
    const pct = (el.currentTime / el.duration) * 100;
    for (const m of MARKS) {
      if (pct >= m && !hitMarks.current[m]) {
        hitMarks.current[m] = true;
        trackSession('VIDEO_PROGRESS', { id: video.id, percent: m });
      }
    }
    const sec = Math.floor(el.currentTime || 0);
    for (const t of TIME_MARKS) {
      if (sec >= t && !hitTimes.current[t]) {
        hitTimes.current[t] = true;
        trackSession('VIDEO_TIME_' + t, { id: video.id, sec: t });
      }
    }
  }

  function handleReady() {
    trackSession('VIDEO_READY', { id: video.id });
  }

  function handleEnded() {
    trackSession('VIDEO_COMPLETE', { id: video.id });
  }

  return (
    <div className="video-content" ref={wrapRef}>
      <div id="player">
        {!unlocked ? (
          <div
            className={`video-link${adState === 'ad-shown' ? ' ad-shown' : ''}`}
            onClick={handleClick}
            style={{ cursor: 'pointer', position: 'relative' }}
          >
            <VideoThumb src={video.thumb} alt={video.title} className="thumbnail" />

            {adState === 'ad-shown' ? (
              // Overlay saat iklan sudah dibuka — minta klik lagi untuk play
              <div className="play-ad-overlay" aria-live="polite">
                <div className="play-ad-box">
                  <span className="play-ad-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </span>
                  <p className="play-ad-msg">Tap lagi untuk putar video</p>
                </div>
              </div>
            ) : (
              // Tombol play normal
              <span className="play-badge" aria-hidden="true">
                <svg viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z" />
                </svg>
              </span>
            )}
          </div>
        ) : video.embed && !isDirectVideoUrl(video.embed) ? (
          // Embed iframe — untuk YouTube, Doodstream, dll
          <iframe
            id="videq_iframe"
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            allow="fullscreen; autoplay"
            src={video.embed}
            onLoad={handleReady}
          />
        ) : (
          // Video langsung (MP4 dari field file ATAU field embed yang berisi URL video)
          <video
            id="videq_iframe"
            ref={vidRef}
            controls
            autoPlay
            playsInline
            src={proxyVideoUrl(video.embed || video.file || '')}
            poster={video.thumb}
            onPlay={handlePlay}
            onPause={handlePause}
            onTimeUpdate={handleTime}
            onEnded={handleEnded}
            onLoadedData={handleReady}
          />
        )}
      </div>
    </div>
  );
}
