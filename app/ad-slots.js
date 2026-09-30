import AdBox from './AdBox';

// Sistem slot bernama (§22): tiap slot = 1 unit bernama, maks 1x per halaman.
// Slot tanpa unit tidak render apa-apa. Nama slot dipakai opportunity engine
// (klaim, state, health). Wadah responsif (tanpa scroll horizontal).
export function TopAd({ unit }) {
  return <AdBox html={unit} slot="top" minH={90} className="adbox-wide" />;
}

export function PreVideoAd({ unit }) {
  return <AdBox html={unit} slot="pre-video" minH={90} className="adbox-med" />;
}

export function PostVideoAd({ unit }) {
  return <AdBox html={unit} slot="post-video" minH={100} className="adbox-med" lazy eagerOnPlay />;
}

export function MidContentAd({ unit }) {
  return <AdBox html={unit} slot="mid-content" minH={100} className="adbox-med" lazy />;
}

export function NativeAd({ unit }) {
  return <AdBox html={unit} slot="native" minH={120} className="adbox-med" lazy />;
}

export function SidebarAd({ unit }) {
  return <AdBox html={unit} slot="sidebar" minH={250} className="adbox-side" />;
}

export function BottomAd({ unit }) {
  return <AdBox html={unit} slot="bottom" minH={90} className="adbox-wide" lazy />;
}

export function MobileAd({ unit }) {
  if (!unit) return null;
  return (
    <div className="mobile-only">
      <AdBox html={unit} slot="mobile" minH={60} className="adbox-med" lazy />
    </div>
  );
}
