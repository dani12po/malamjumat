import Link from 'next/link';
import { Fragment } from 'react';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { readDB } from '@/lib/db';
import { splitAdScripts } from '@/lib/ads';
import { allocateUnits, detectDevice } from '@/lib/ad-placement';
import { TopAd, NativeAd, BottomAd, MobileAd } from '@/app/ad-slots';
import SmartCTA from '@/app/SmartCTA';
import VideoThumb from './thumb';

export async function generateMetadata({ params }) {
  const db = await readDB();
  const folder = db.folders.find((f) => f.id === params.slug);
  return { title: folder ? `📂 ${folder.title}` : 'Folder', robots: 'noindex, nofollow' };
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 4l2 2h8a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h5z"></path>
    </svg>
  );
}

export default async function FolderPage({ params, searchParams }) {
  const db = await readDB();
  const folder = db.folders.find((f) => f.id === params.slug);
  if (!folder) return notFound();

  const settings = db.settings || {};
  const { bodyHtml } = splitAdScripts(settings);
  const U = allocateUnits(bodyHtml, 'folder', detectDevice(headers().get('user-agent')));
  const perPage = Number(settings.perPage) || 20;
  const feedEvery = Math.min(20, Math.max(2, Number(settings.feedEvery) || 6));
  const page = Math.max(1, parseInt(searchParams?.p || '1', 10) || 1);

  const childFolders = db.folders.filter((f) => f.parentId === folder.id);
  const allVideos = db.videos.filter((v) => v.folderId === folder.id);
  const totalPages = Math.max(1, Math.ceil(allVideos.length / perPage));
  const safePage = Math.min(page, totalPages);
  const videos = allVideos.slice((safePage - 1) * perPage, safePage * perPage);

  const pageNumbers = [];
  for (let i = 1; i <= totalPages; i++) {
    if (i <= 3 || i === totalPages || Math.abs(i - safePage) <= 1) pageNumbers.push(i);
  }
  const uniqPages = [...new Set(pageNumbers)];

  return (
    <main className="drive-shell">
      <header className="drive-topbar">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M10 4l2 2h7a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h5z"></path>
          </svg>
        </div>
        <div className="drive-title-wrap">
          <div className="drive-label">Folder</div>
          <h1 className="drive-title">{folder.title}</h1>
        </div>
      </header>

      <TopAd slot="top" />

      <section>
        <div className="section-title">Folder</div>
        <div className="folder-row">
          {folder.parentId ? (
            <Link href={`/f/${folder.parentId}`} className="folder-chip back-btn">
              <span>← .. Kembali</span>
            </Link>
          ) : null}
          {childFolders.map((f) => (
            <Link key={f.id} href={`/f/${f.id}`} className="folder-chip">
              <FolderIcon />
              <span>{f.title}</span>
            </Link>
          ))}
          {childFolders.length === 0 && !folder.parentId ? <div className="empty-folder-row"> </div> : null}
        </div>
      </section>

      <section>
        <div className="section-title">Video</div>
        <div className="file-grid">
          {videos.map((v, i) => {
            const feedK = Math.floor((i + 1) / feedEvery);
            const inGrid = (i + 1) % feedEvery === 0 ? `native-feed-${feedK}` : '';
            return (
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
                {inGrid ? (
                  <div className="autoad-cell">
                    <NativeAd slot={inGrid} />
                  </div>
                ) : null}
              </Fragment>
            );
          })}
          {videos.length === 0 ? <div className="empty-state">Belum ada video di folder ini.</div> : null}
        </div>
      </section>

      <BottomAd slot="bottom-1" />

      {totalPages > 1 ? (
        <nav className="drive-pagination" aria-label="Pagination">
          {uniqPages.map((n, idx) => (
            <span key={n} style={{ display: 'contents' }}>
              {idx > 0 && n - uniqPages[idx - 1] > 1 ? <span className="page-dot">…</span> : null}
              <Link href={`/f/${folder.id}?p=${n}`} className={`page-btn${n === safePage ? ' active' : ''}`}>
                {n}
              </Link>
            </span>
          ))}
          {safePage < totalPages ? (
            <Link href={`/f/${folder.id}?p=${safePage + 1}`} className="page-btn">
              →
            </Link>
          ) : null}
        </nav>
      ) : null}

      <BottomAd slot="bottom-2" />
      <SmartCTA settings={settings}>Jelajahi Sponsor</SmartCTA>
      <MobileAd slot="mobile-inline" />
    </main>
  );
}
