'use client';
import { useEffect, useRef, useState } from 'react';
import { trackSession } from '@/lib/ad-session';
import VideoThumb from '@/app/f/[slug]/thumb';

// Player murni: klik thumbnail langsung play (tanpa gate iklan, tanpa intercept).
// Hanya memancarkan event tontonan (VIDEO_OPEN/PLAY/PAUSE/RESUME/PROGRESS/COMPLETE)
// agar sistem iklan bisa me-reveal placement valid. Behavior popunder milik
// script resmi Adsterra dan tidak disentuh.

const MARKS = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
const TIME_MARKS = [10, 20, 30, 45, 60, 90, 120, 180];

export default function VideoPlayer({ video, settings }) {
  const [unlocked, setUnlocked] = useState(false);
  const vidRef = useRef(null);
  const wrapRef = useRef(null);
  const pausedOnce = useRef(false);
  const hitMarks = useRef({});
  const hitTimes = useRef({});
  const visibleSent = useRef(false);

  useEffect(() => {
    trackSession('VIDEO_OPEN', { id: video.id });
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
    // Klik Play asli user: buka video + beri sinyal (bukan klik iklan).
    setUnlocked(true);
    trackSession('VIDEO_START', { id: video.id });
    trackSession('VIDEO_PLAY', { id: video.id, via: 'unlock' });
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
    // Time engine: detik tontonan AKTUAL (bukan timer dinding).
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
          <div className="video-link" onClick={handleClick} style={{ cursor: 'pointer' }}>
            <VideoThumb src={video.thumb} alt={video.title} className="thumbnail" />
          </div>
        ) : video.embed ? (
          <iframe
            id="videq_iframe"
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            allow="fullscreen"
            src={video.embed}
            onLoad={handleReady}
          />
        ) : (
          <video
            id="videq_iframe"
            ref={vidRef}
            controls
            autoPlay
            playsInline
            src={video.file || ''}
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
