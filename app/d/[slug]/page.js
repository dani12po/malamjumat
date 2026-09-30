import Link from 'next/link';
import { notFound } from 'next/navigation';
import { readDB } from '@/lib/db';
import { splitAdScripts, unitAt } from '@/lib/ads';
import VideoPlayer from './player';
import VideoThumb from '@/app/f/[slug]/thumb';
import AdBox from '@/app/AdBox';

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
  const folder = db.folders.find((f) => f.id === video.folderId) || null;
  const related = db.videos.filter((v) => v.folderId === video.folderId && v.id !== video.id).slice(0, 8);

  return (
    <>
      <style>{`.vv-player,.video-link .thumbnail{height:100%;width:100%}
#videq_iframe,.video-link{width:100%;height:100dvh;padding-bottom:env(safe-area-inset-bottom);box-sizing:border-box}
.video-page-dark{margin:0 auto;padding:0;background:#000;min-height:100dvh}
.video-link{display:block;overflow:visible;position:relative;background-color:#000;cursor:pointer}
.video-link .thumbnail{object-fit:contain;object-position:center}
.video-link::after{content:"";position:absolute;top:50%;left:50%;border-radius:50%;transform:translate(-50%,-50%);background:#fe6081;width:48px;height:48px;background-image:url(data:image/svg+xml;base64,PHN2ZyAgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiAgd2lkdGg9IjI0IiAgaGVpZ2h0PSIyNCIgIHZpZXdCb3g9IjAgMCAyNCAyNCIgIGZpbGw9IiNmZmYiICBjbGFzcz0iaWNvbiBpY29uLXRhYmxlciBpY29ucy10YWJsZXItZmlsbGVkIGljb24tdGFibGVyLXBsYXllci1wbGF5Ij48cGF0aCBzdHJva2U9Im5vbmUiIGQ9Ik0wIDBoMjR2MjRIMHoiIGZpbGw9Im5vbmUiLz48cGF0aCBkPSJNNiA0djE2YTEgMSAwIDAgMCAxLjUyNCAuODUybDEzIC04YTEgMSAwIDAgMCAwIC0xLjcwNGwtMTMgLThhMSAxIDAgMCAwIC0xLjUyNCAuODUyeiIgLz48L3N2Zz4=);background-position:center;background-repeat:no-repeat;background-size:24px;filter:drop-shadow(0 0 10px rgba(0,0,0,.4))}
#videq_iframe{border:none;margin-bottom:-3%;background:#000}`}</style>
      <div className="video-page-dark">
        <h1 className="video-title">{video.title}</h1>
        <AdBox html={unitAt(bodyHtml, 0)} minH={100} />
        <AdBox html={unitAt(bodyHtml, 1)} minH={100} />
        <div className="video-layout">
          <div className="video-main">
            <VideoPlayer video={video} settings={settings} />
            <AdBox html={unitAt(bodyHtml, 2)} minH={100} />
            <section>
              <div className="section-title" style={{ margin: '20px 4px 10px' }}>Deskripsi</div>
              <div className="video-meta">
                {video.label ? <span className="meta-chip">{video.label}</span> : null}
                {folder ? <Link className="meta-chip meta-link" href={`/f/${folder.id}`}>Folder: {folder.title}</Link> : null}
              </div>
            </section>
            <AdBox html={unitAt(bodyHtml, 3)} minH={100} />
            {related.length > 0 ? (
              <section>
                <div className="section-title" style={{ margin: '20px 4px 10px' }}>Video Terkait</div>
                <div className="file-grid">
                  {related.map((v) => (
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
              </section>
            ) : null}
            <AdBox html={unitAt(bodyHtml, 4)} minH={100} />
          </div>
          {unitAt(bodyHtml, 5) ? (
            <aside className="video-side">
              <AdBox html={unitAt(bodyHtml, 5)} minH={250} />
            </aside>
          ) : null}
        </div>
      </div>
    </>
  );
}
