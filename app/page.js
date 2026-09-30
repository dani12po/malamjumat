import Link from 'next/link';
import { redirect } from 'next/navigation';
import { readDB } from '@/lib/db';
import VideoThumb from '@/app/f/[slug]/thumb';
import { TopAd, NativeAd, BottomAd, MobileAd } from '@/app/ad-slots';
import SmartCTA from '@/app/SmartCTA';

export async function generateMetadata() {
  const db = await readDB();
  const name = db.settings?.siteName || 'Drive Video';
  return { title: name, robots: 'noindex, nofollow' };
}

function FolderIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M10 4l2 2h8a2 2 0 0 1 2 2v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h5z"></path>
    </svg>
  );
}

// Homepage portal: hero unggulan + grid per folder + slot iklan terstruktur.
// Tanpa folder = alihkan ke /admin (belum ada konten).
export default async function Home() {
  const db = await readDB();
  const folders = db.folders || [];
  const videos = db.videos || [];
  const settings = db.settings || {};
  if (folders.length === 0) redirect('/admin');

  const withVideos = folders
    .map((f) => ({ folder: f, list: videos.filter((v) => v.folderId === f.id) }))
    .filter((g) => g.list.length > 0);
  const featured = withVideos.length > 0 ? withVideos[0].list[0] : null;

  return (
    <main className="drive-shell">
      <header className="drive-topbar">
        <div className="brand-mark" aria-hidden="true">
          <svg viewBox="0 0 24 24">
            <path d="M10 4l2 2h7a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h5z"></path>
          </svg>
        </div>
        <div className="drive-title-wrap">
          <div className="drive-label">Portal Video</div>
          <h1 className="drive-title">{settings.siteName || 'Drive Video'}</h1>
        </div>
      </header>

      <TopAd slot="home-top" />

      {featured ? (
        <section className="hero">
          <Link href={`/d/${featured.id}`} className="hero-link" aria-label={featured.title}>
            <VideoThumb src={featured.thumb} alt={featured.label || 'featured'} />
            <span className="thumb-label">{featured.label || ''}</span>
            <span className="play-badge" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z"></path>
              </svg>
            </span>
            <span className="hero-title">{featured.title}</span>
          </Link>
        </section>
      ) : null}

      {withVideos.map((g) => (
        <section key={g.folder.id}>
          <div className="section-title">
            <span>{g.folder.title}</span>
            <Link className="section-link" href={`/f/${g.folder.id}`}>Lihat semua →</Link>
          </div>
          <div className="file-grid">
            {g.list.slice(0, 6).map((v) => (
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
          </div>
          <NativeAd slot={`home-native-${g.folder.id}`} />
        </section>
      ))}

      <SmartCTA settings={settings}>Jelajahi Sponsor</SmartCTA>
      <BottomAd slot="home-bottom" />
      <MobileAd slot="home-mobile" />

      <footer className="portal-footer">
        <span className="admin-small">{settings.siteName || 'Drive Video'} — portal video & konten.</span>
      </footer>
    </main>
  );
}
