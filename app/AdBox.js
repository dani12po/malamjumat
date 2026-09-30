// Slot unit Adsterra: HTML resmi network dirender mentah (SSR) di posisinya.
// Kosong = tidak render apa-apa (tanpa unit palsu, tanpa ruang kosong, tanpa CLS).
export default function AdBox({ html, minH = 100 }) {
  if (!html) return null;
  return (
    <div className="adbox">
      <span className="adbox-label">Advertisement</span>
      <div className="adbox-body" style={minH ? { minHeight: minH } : undefined} dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}
