import { notFound } from 'next/navigation';
import { readDB } from '@/lib/db';
import VideoPlayer from './player';

export async function generateMetadata({ params }) {
  const db = await readDB();
  const v = db.videos.find((x) => x.id === params.slug);
  return { title: v?.title || 'Video', robots: 'noindex, nofollow' };
}

export const viewport = { width: 'device-width', initialScale: 1 };

export default async function VideoPage({ params }) {
  const db = await readDB();
  const video = db.videos.find((x) => x.id === params.slug);
  if (!video) return notFound();
  const settings = db.settings || {};

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
        <VideoPlayer video={video} settings={settings} />
        {settings.customHeadScript ? <div dangerouslySetInnerHTML={{ __html: settings.customHeadScript }} /> : null}
      </div>
    </>
  );
}
