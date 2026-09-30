import AdBox from './AdBox';

// Sistem slot bernama: `slot` WAJIB unik per penempatan dan diteruskan dari
// pemanggil (pre-1, side-right, native-feed-3, ...). Trigger default per jenis
// slot mengikuti scheduler (scroll/dwell/video/play/load).
export function TopAd({ slot = 'top', trigger = 'load' }) {
  return <AdBox slot={slot} trigger={trigger} minH={90} className="adbox-wide" />;
}

export function PreVideoAd({ slot = 'pre-video', trigger = 'load' }) {
  return <AdBox slot={slot} trigger={trigger} minH={90} className="adbox-med" />;
}

export function UnderPlayerAd({ slot = 'under-player', trigger = 'load' }) {
  return <AdBox slot={slot} trigger={trigger} minH={90} className="adbox-med" />;
}

export function PostVideoAd({ slot = 'post-video', trigger = 'video:play' }) {
  return <AdBox slot={slot} trigger={trigger} minH={100} className="adbox-med" />;
}

export function MidContentAd({ slot = 'mid-content', trigger = 'scroll:30' }) {
  return <AdBox slot={slot} trigger={trigger} minH={100} className="adbox-med" />;
}

export function NativeAd({ slot = 'native', trigger = 'scroll:30' }) {
  return <AdBox slot={slot} trigger={trigger} minH={120} className="adbox-med" />;
}

export function SidebarAd({ slot = 'sidebar', trigger = 'scroll:30' }) {
  return <AdBox slot={slot} trigger={trigger} minH={250} className="adbox-side" />;
}

export function BottomAd({ slot = 'bottom', trigger = 'load' }) {
  return <AdBox slot={slot} trigger={trigger} minH={90} className="adbox-wide" />;
}

export function MobileAd({ slot = 'mobile', trigger = 'load' }) {
  return <AdBox slot={slot} trigger={trigger} minH={60} className="adbox-med" />;
}
