import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readDB } from '@/lib/db';
import { splitAdScripts } from '@/lib/ads';
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
  // HTML network dirender mentah (SSR) agar script document.write/container jalan.
  // Item pertama di atas, sisanya di bawah — tanpa duplikat.
  const { bodyHtml } = splitAdScripts(settings);
  const perPage = Number(settings.perPage) || 20;
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

      {bodyHtml[0] ? (
        <div className="ad-slot" dangerouslySetInnerHTML={{ __html: bodyHtml[0] }} />
      ) : null}

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
          {videos.map((v) => (
            <article key={v.id} className="drive-file-card">
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
          ))}
          {videos.length === 0 ? <div className="empty-state">Belum ada video di folder ini.</div> : null}
        </div>
      </section>

      {bodyHtml.slice(1).map((html, i) => (
        <div key={i} className="ad-slot" dangerouslySetInnerHTML={{ __html: html }} />
      ))}

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

      {settings.popunderScript ? (
        <div dangerouslySetInnerHTML={{ __html: settings.popunderScript }} />
      ) : null}
      {settings.customHeadScript ? (
        <div dangerouslySetInnerHTML={{ __html: settings.customHeadScript }} />
      ) : null}
    </main>
  );
}
