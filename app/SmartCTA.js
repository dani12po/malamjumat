// CTA Smartlink yang JELAS sebagai iklan (label Sponsored).
// Bukan player, bukan seluruh halaman — hanya tombol eksplisit.
// Tanpa backlink = tidak render apa-apa.
export default function SmartCTA({ settings, children }) {
  const links = Array.isArray(settings?.backlinks) && settings.backlinks.length > 0
    ? settings.backlinks.filter(Boolean)
    : settings?.directLink
      ? [settings.directLink]
      : [];
  if (links.length === 0) return null;
  const href = links[Math.floor(Math.random() * links.length)];
  return (
    <div className="smart-cta-wrap">
      <a className="smart-cta" href={href} target="_blank" rel="sponsored nofollow noopener">
        <span className="smart-cta-tag">Sponsored</span>
        <span>{children || 'Kunjungi Sponsor'}</span>
        <span aria-hidden="true">→</span>
      </a>
    </div>
  );
}
