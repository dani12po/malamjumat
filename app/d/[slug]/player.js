'use client';
import { useState } from 'react';

export default function VideoPlayer({ video, settings }) {
  const [unlocked, setUnlocked] = useState(false);

  function handleClick() {
    // Iklan sudah di-handle global (GlobalAds: klik pertama di page mana pun buka Direct Link).
    // Di sini klik langsung play, tanpa gate per-video.
    setUnlocked(true);
  }

  return (
    <div className="video-content">
      <div id="player">
        {!unlocked ? (
          <div className="video-link" onClick={handleClick} style={{ cursor: 'pointer' }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img className="thumbnail" src={video.thumb} alt={video.title} />
          </div>
        ) : video.embed ? (
          <iframe
            id="videq_iframe"
            scrolling="no"
            frameBorder="0"
            allowFullScreen
            allow="fullscreen"
            src={video.embed}
          />
        ) : (
          <video
            id="videq_iframe"
            controls
            autoPlay
            playsInline
            src={video.file || ''}
            poster={video.thumb}
          />
        )}
      </div>
      {settings?.popunderScript ? <div dangerouslySetInnerHTML={{ __html: settings.popunderScript }} /> : null}
    </div>
  );
}
