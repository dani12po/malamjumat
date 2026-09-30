import Link from 'next/link';
import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { readDB } from '@/lib/db';
import { splitAdScripts } from '@/lib/ads';
import { allocateUnits, detectDevice } from '@/lib/ad-placement';
import VideoPlayer from './player';
import VideoThumb from '@/app/f/[slug]/thumb';
import { PreVideoAd, UnderPlayerAd, PostVideoAd, MidContentAd, NativeAd, SidebarAd, BottomAd, MobileAd } from '@/app/ad-slots';
import SmartCTA from '@/app/SmartCTA';

export async function generateMetadata({ params }) {
  const db = await readDB();
  const v = db.videos.find((x) => x.id === params.slug);
  return { title: v?.title || 'Video', robots: 'noindex, nofollow' };
}

export const viewport = { width: 'device-width', initialScale: 1 };

// Struktur: judul -> unit pre-video -> player -> unit post -> deskripsi ->
// unit -> terkait -> unit, + sidebar desktop. Tiap unit tampil MAKS 1x
// per halaman (tanpa duplikat). Slot kosong tidak render apa-apa.
export default async function VideoPage({ params }) {
  const db = await readDB();
  const video = db.videos.find((x) => x.id === params.slug);
  if (!video) return notFound();
  const settings = db.settings || {};
  const { bodyHtml } = splitAdScripts(settings);
  // Alokasi prioritas + device adaptif (satu unit maks 1 slot per halaman).
  const U = allocateUnits(bodyHtml, 'video', detectDevice(headers().get('user-agent')));
  const feedEvery = Math.min(20, Math.max(2, Number(settings.feedEvery) || 6));
  const folder = db.folders.find((f) => f.id === video.folderId) || null;
  const related = db.videos.filter((v) => v.folderId === video.folderId && v.id !== video.id).slice(0, 8);

  return (
      <div className="video-page-dark">
        <h1 className="video-title">{video.title}</h1>
        <PreVideoAd slot="pre-1" />
        <PreVideoAd slot="pre-2" />
        <div className={`video-layout${U.left ? ' has-left' : ''}`}>
          {U.left ? (
            <aside className="video-side video-side-left">
              <SidebarAd slot="side-left" />
            </aside>
          ) : null}
          <div className="video-main">
            <VideoPlayer video={video} settings={settings} />
            <SmartCTA settings={settings}>Tonton di Sponsor</SmartCTA>
            <UnderPlayerAd slot="under-player" />
            <PostVideoAd slot="post-1" />
            <section>
              <div className="section-title" style={{ margin: '20px 4px 10px' }}>Deskripsi</div>
              <div className="video-meta">
                {video.label ? <span className="meta-chip">{video.label}</span> : null}
                {folder ? <Link className="meta-chip meta-link" href={`/f/${folder.id}`}>Folder: {folder.title}</Link> : null}
              </div>
            </section>
            <MidContentAd slot="desc" />
            {related.length > 0 ? (
              <section>
                <div className="section-title" style={{ margin: '20px 4px 10px' }}>Video Terkait</div>
                <SmartCTA settings={settings}>Jelajahi Sponsor</SmartCTA>
                <div className="file-grid">
                  {related.map((v, i) => (
                    <Fragment key={v.id}>
                    <article className="drive-file-card">
                      <Link href={`/d/${v.id}`} className="thumb-link" aria-label={v.title}>
                        <VideoThumb src={v.thumb} alt={v.label || 'vidoycdn'} />
                        <span className="thumb-label">{v.label || ''}</span>
                        <span className="play-badge" aria-hidden="true">
                          <svg viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"></path>
                          </svg>
                        </span>
                      </Link>
                      <Link href={`/d/${v.id}`} className="file-name" title={v.title}>
                        {v.title}
                      </Link>
                    </article>
                    {(i + 1) % feedEvery === 0 ? (
                      <div className="autoad-cell">
                        <NativeAd slot={`related-feed-${Math.floor((i + 1) / feedEvery)}`} />
                      </div>
                    ) : null}
                    </Fragment>
                  ))}
                </div>
              </section>
            ) : null}
            <NativeAd slot="related-bottom" trigger="video:progress:50" />
          </div>
          {U.sidebar ? (
            <aside className="video-side">
              <SidebarAd slot="side-right" />
            </aside>
          ) : null}
        </div>
        <BottomAd slot="bottom-1" />
        <SmartCTA settings={settings}>Lihat Penawaran Sponsor</SmartCTA>
        <BottomAd slot="bottom-2" trigger="video:complete" />
        <MobileAd slot="mobile-inline" />
      </div>
  );
}
