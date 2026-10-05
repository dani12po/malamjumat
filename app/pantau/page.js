'use client';
import { useEffect, useState, useCallback, useRef } from 'react';

// ─── Konstanta ─────────────────────────────────────────────────────────────────
const REFRESH_SEC = 5;    // realtime (online sekarang) refresh tiap 5 detik
const STATS_SEC   = 30;   // chart + stats lengkap refresh tiap 30 detik

const COUNTRY_FLAG = (cc) => {
  if (!cc || cc === '—' || cc.length !== 2) return '🌐';
  try {
    return String.fromCodePoint(...[...cc.toUpperCase()].map(c => 0x1F1E6 - 65 + c.charCodeAt(0)));
  } catch { return '🌐'; }
};

const DEVICE_ICON = { mobile: '📱', tablet: '📟', desktop: '💻', unknown: '❓' };

function fmtNum(n) {
  if (n == null) return '—';
  return Number(n).toLocaleString('id-ID');
}

// ─── Komponen Chart Stacked Bar (SVG murni, tanpa library) ───────────────────
// Pageviews (biru) = bagian bawah, Pengunjung (merah) = ditumpuk di atas
function BarChart({ data, height = 220 }) {
  if (!data || data.length === 0) {
    return <div className="pc-empty">Belum ada data untuk periode ini</div>;
  }

  // Max = total tertinggi (pv + visitors) untuk skala Y
  const maxTotal = Math.max(...data.map(d => d.pageviews), 1);

  const W = 900;
  const PAD_L = 44;
  const PAD_R = 10;
  const PAD_T = 20;
  const PAD_B = 36;
  const chartW = W - PAD_L - PAD_R;
  const chartH = height - PAD_T - PAD_B;

  const n = data.length;
  const slotW = chartW / n;
  // Bar selebar slot (dengan gap kecil) — bar tunggal per periode
  const barW = Math.max(3, Math.min(slotW * 0.75, 36));

  const gridLines = [0, 0.25, 0.5, 0.75, 1].map(f => ({
    y: PAD_T + chartH * (1 - f),
    label: fmtNum(Math.round(maxTotal * f))
  }));

  return (
    <svg viewBox={`0 0 ${W} ${height}`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {/* Grid */}
      {gridLines.map((g, i) => (
        <g key={i}>
          <line x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y} stroke="#2a2d3a" strokeWidth="1" />
          <text x={PAD_L - 4} y={g.y + 4} textAnchor="end" fontSize="9" fill="#6b7280">{g.label}</text>
        </g>
      ))}

      {/* Stacked Bars */}
      {data.map((d, i) => {
        const cx = PAD_L + i * slotW + slotW / 2;
        const x = cx - barW / 2;
        const bottom = PAD_T + chartH; // baseline

        // Pageviews = full bar biru (dari bawah)
        const hPV = (d.pageviews / maxTotal) * chartH;
        const yPV = bottom - hPV;

        // Pengunjung = tumpuk di atas pageviews (merah)
        const hV = (d.visitors / maxTotal) * chartH;
        const yV = yPV - hV;

        const showLabel = n <= 32 || i % Math.ceil(n / 24) === 0;

        return (
          <g key={i}>
            {/* Pageviews (biru) — bawah */}
            {hPV > 0 && (
              <rect x={x} y={yPV} width={barW} height={hPV}
                fill="#3b82f6" opacity="0.9" rx="2"
              >
                <title>{d.period}: {d.pageviews} pageviews</title>
              </rect>
            )}
            {/* Pengunjung (merah) — tumpuk atas */}
            {hV > 0 && (
              <rect x={x} y={yV} width={barW} height={hV}
                fill="#ef4444" opacity="0.9"
                rx={hPV > 0 ? "0" : "2"}
              >
                <title>{d.period}: {d.visitors} pengunjung</title>
              </rect>
            )}
            {/* Label X */}
            {showLabel && (
              <text x={cx} y={bottom + 14} textAnchor="middle"
                fontSize={n > 20 ? '7' : '9'} fill="#9ca3af">
                {d.period}
              </text>
            )}
          </g>
        );
      })}

      {/* Legend — kiri atas */}
      <rect x={PAD_L} y={5} width={10} height={8} fill="#3b82f6" rx="1" />
      <text x={PAD_L + 13} y={12} fontSize="9" fill="#d1d5db">Pageviews (bawah)</text>
      <rect x={PAD_L + 120} y={5} width={10} height={8} fill="#ef4444" rx="1" />
      <text x={PAD_L + 133} y={12} fontSize="9" fill="#d1d5db">Pengunjung unik (atas)</text>
    </svg>
  );
}

// ─── Komponen Hourly Heatmap ──────────────────────────────────────────────────
function HourlyBar({ data }) {
  if (!data || data.length === 0) return null;
  const hours = Array.from({ length: 24 }, (_, i) => {
    const h = String(i).padStart(2, '0');
    const found = data.find(d => d.hour === h);
    return { hour: h, cnt: found ? Number(found.cnt) : 0 };
  });
  const max = Math.max(...hours.map(h => h.cnt), 1);
  return (
    <div className="pc-hourly">
      {hours.map(h => {
        const pct = h.cnt / max;
        return (
          <div key={h.hour} className="pc-hour-col" title={`${h.hour}:00 — ${fmtNum(h.cnt)} hit`}>
            <div className="pc-hour-bar" style={{ height: `${Math.max(4, pct * 80)}px`, background: pct > 0.7 ? '#ef4444' : pct > 0.4 ? '#f59e0b' : '#3b82f6' }} />
            <div className="pc-hour-lbl">{h.hour}</div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Komponen Donut Device ────────────────────────────────────────────────────
function DeviceChart({ devices }) {
  if (!devices || devices.length === 0) return <div className="pc-empty">—</div>;
  const total = devices.reduce((s, d) => s + d.cnt, 0);
  const colors = ['#3b82f6', '#ef4444', '#f59e0b', '#10b981'];
  return (
    <div className="pc-device-list">
      {devices.map((d, i) => {
        const pct = total > 0 ? ((d.cnt / total) * 100).toFixed(1) : 0;
        return (
          <div key={d.device} className="pc-device-row">
            <span>{DEVICE_ICON[d.device] || '❓'} {d.device}</span>
            <div className="pc-device-bar-wrap">
              <div className="pc-device-bar" style={{ width: `${pct}%`, background: colors[i % colors.length] }} />
            </div>
            <span className="pc-device-pct">{pct}%</span>
            <span className="pc-device-cnt">{fmtNum(d.cnt)}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Komponen Realtime Pulse ──────────────────────────────────────────────────
function RealtimePulse({ active }) {
  return (
    <div className="pc-rt-badge">
      <span className="pc-rt-dot" />
      <span className="pc-rt-num">{active ?? 0}</span>
      <span className="pc-rt-lbl">online sekarang</span>
    </div>
  );
}

// ─── Halaman Utama /pantau ─────────────────────────────────────────────────────
export default function PantauPage() {
  const [pass, setPass]         = useState('');
  const [authed, setAuthed]     = useState(false);
  const [range, setRange]       = useState('30d');
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [countdown, setCountdown] = useState(REFRESH_SEC);
  const timerRef = useRef(null);
  const statsTimerRef = useRef(null);
  const savedPass = useRef('');

  // Coba auto-login dari localStorage
  useEffect(() => {
    const saved = localStorage.getItem('pantau-pass');
    if (saved) { savedPass.current = saved; setPass(saved); doFetch(saved, range); }
    // eslint-disable-next-line
  }, []);

  // Fetch realtime saja (5 detik) — query ringan
  const doFetchRealtime = useCallback(async (p) => {
    try {
      const res = await fetch('/api/pantau?mode=realtime', {
        headers: { 'x-admin-pass': p }
      });
      if (!res.ok) return;
      const rt = await res.json();
      setData(prev => prev ? { ...prev, realtime: rt } : prev);
    } catch { /* abaikan */ }
  }, []);

  const doFetch = useCallback(async (p, r) => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/pantau?range=${encodeURIComponent(r)}`, {
        headers: { 'x-admin-pass': p }
      });
      if (res.status === 401) { setError('Password salah'); setAuthed(false); return; }
      if (!res.ok) { setError(`Error ${res.status}`); return; }
      const json = await res.json();
      setData(json);
      setAuthed(true);
      setCountdown(REFRESH_SEC);
    } catch (e) {
      setError('Tidak bisa terhubung ke server');
    } finally {
      setLoading(false);
    }
  }, []);

  // Timer 1: realtime setiap 5 detik
  useEffect(() => {
    if (!authed) return;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      doFetchRealtime(savedPass.current);
      setCountdown(c => Math.max(0, c - 5));
    }, REFRESH_SEC * 1000);
    return () => clearInterval(timerRef.current);
  }, [authed, doFetchRealtime]);

  // Timer 2: stats penuh setiap 30 detik + countdown display
  useEffect(() => {
    if (!authed) return;
    if (statsTimerRef.current) clearInterval(statsTimerRef.current);
    statsTimerRef.current = setInterval(() => {
      doFetch(savedPass.current, range);
      setCountdown(STATS_SEC);
    }, STATS_SEC * 1000);
    // Countdown tick setiap detik
    const tick = setInterval(() => {
      setCountdown(c => (c <= 1 ? STATS_SEC : c - 1));
    }, 1000);
    return () => {
      clearInterval(statsTimerRef.current);
      clearInterval(tick);
    };
  }, [authed, range, doFetch]);

  function handleLogin() {
    if (!pass.trim()) return;
    savedPass.current = pass;
    localStorage.setItem('pantau-pass', pass);
    doFetch(pass, range);
  }

  function handleRange(r) {
    setRange(r);
    doFetch(savedPass.current, r);
  }

  // ── Login screen ──
  if (!authed) {
    return (
      <main className="pc-login">
        <div className="pc-login-card">
          <div className="pc-login-icon">📊</div>
          <h1 className="pc-login-title">Monitor Pengunjung</h1>
          <p className="pc-login-sub">Masukkan password admin untuk melihat statistik.</p>
          {error && <p className="pc-login-error">{error}</p>}
          <input
            className="admin-input pc-login-input"
            type="password"
            placeholder="Password admin"
            value={pass}
            onChange={e => setPass(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleLogin()}
            autoFocus
          />
          <button className="admin-btn pc-login-btn" onClick={handleLogin} disabled={loading}>
            {loading ? 'Memuat…' : 'Masuk'}
          </button>
        </div>
      </main>
    );
  }

  const s = data?.summary || {};
  const rangeLabels = { today: 'Hari ini', '7d': '7 Hari', '30d': '30 Hari' };

  // ── Dashboard ──
  return (
    <main className="pc-shell">
      {/* Header */}
      <header className="pc-header">
        <div className="pc-header-left">
          <span className="pc-header-icon">📊</span>
          <div>
            <div className="pc-header-title">Monitor Pengunjung</div>
            <div className="pc-header-sub">Realtime: tiap 5s • Stats: tiap {countdown}s</div>
          </div>
        </div>
        <div className="pc-header-right">
          <RealtimePulse active={data?.realtime?.active} />
          <button className="admin-btn ghost" onClick={() => doFetch(savedPass.current, range)} disabled={loading}>
            {loading ? '⟳' : '↻ Refresh'}
          </button>
          <button className="admin-btn ghost" onClick={() => { localStorage.removeItem('pantau-pass'); setAuthed(false); setData(null); }}>
            Keluar
          </button>
        </div>
      </header>

      {/* Range selector */}
      <div className="pc-range-bar">
        {['today', '7d', '30d'].map(r => (
          <button key={r} className={`pc-range-btn${range === r ? ' active' : ''}`} onClick={() => handleRange(r)}>
            {rangeLabels[r]}
          </button>
        ))}
        {/* Bulan tersedia */}
        {data?.availableMonths?.length > 0 && data.availableMonths.map(ym => (
          <button key={ym} className={`pc-range-btn${range === `month:${ym}` ? ' active' : ''}`}
            onClick={() => handleRange(`month:${ym}`)}>
            {ym}
          </button>
        ))}
      </div>

      {error && <div className="pc-error">{error}</div>}

      {/* Summary Stats */}
      <div className="pc-stats-grid">
        <div className="pc-stat-card">
          <div className="pc-stat-val">{fmtNum(s.pageviews)}</div>
          <div className="pc-stat-lbl">📄 Pageviews</div>
        </div>
        <div className="pc-stat-card">
          <div className="pc-stat-val">{fmtNum(s.visitors)}</div>
          <div className="pc-stat-lbl">👤 Pengunjung Unik</div>
        </div>
        <div className="pc-stat-card">
          <div className="pc-stat-val">{fmtNum(s.sessions)}</div>
          <div className="pc-stat-lbl">🔁 Sesi</div>
        </div>
        <div className="pc-stat-card">
          <div className="pc-stat-val">{s.pvPerVisit ?? '—'}</div>
          <div className="pc-stat-lbl">📈 PV / Kunjungan</div>
        </div>
        <div className="pc-stat-card">
          <div className="pc-stat-val pc-stat-peak">{s.peakHour || '—'}</div>
          <div className="pc-stat-lbl">⏰ Jam Tersibuk</div>
        </div>
      </div>

      {/* Chart Utama */}
      <div className="pc-card">
        <div className="pc-card-title">
          📊 Pageviews & Pengunjung — {rangeLabels[range] || range}
        </div>
        {loading && !data ? <div className="pc-loading">Memuat data…</div> : <BarChart data={data?.chart} height={220} />}
      </div>

      {/* Jam Aktif + Realtime side by side */}
      <div className="pc-two-col">
        <div className="pc-card">
          <div className="pc-card-title">⏱ Aktivitas per Jam (WIB)</div>
          <HourlyBar data={data?.hourly} />
        </div>
        <div className="pc-card">
          <div className="pc-card-title">🟢 Sedang Online ({data?.realtime?.active ?? 0})</div>
          {data?.realtime?.pages?.length > 0 ? (
            <table className="pc-table">
              <thead><tr><th>Halaman</th><th>Negara</th><th>Device</th><th>Jml</th></tr></thead>
              <tbody>
                {data.realtime.pages.map((r, i) => (
                  <tr key={i}>
                    <td className="pc-td-path">{r.path}</td>
                    <td>{COUNTRY_FLAG(r.country)} {r.country}</td>
                    <td>{DEVICE_ICON[r.device] || '❓'} {r.device}</td>
                    <td className="pc-td-num">{r.cnt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="pc-empty">Tidak ada pengunjung aktif saat ini</div>
          )}
        </div>
      </div>

      {/* Top Pages + Top Countries side by side */}
      <div className="pc-two-col">
        <div className="pc-card">
          <div className="pc-card-title">🔥 Halaman Terpopuler</div>
          {data?.topPages?.length > 0 ? (
            <table className="pc-table">
              <thead><tr><th>Halaman</th><th>Hits</th></tr></thead>
              <tbody>
                {data.topPages.map((p, i) => (
                  <tr key={i}>
                    <td className="pc-td-path">
                      <span className="pc-rank">#{i + 1}</span> {p.path}
                    </td>
                    <td className="pc-td-num">{fmtNum(p.cnt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="pc-empty">Belum ada data</div>}
        </div>
        <div className="pc-card">
          <div className="pc-card-title">🌍 Asal Negara</div>
          {data?.topCountries?.length > 0 ? (
            <table className="pc-table">
              <thead><tr><th>Negara</th><th>Pengunjung</th></tr></thead>
              <tbody>
                {data.topCountries.map((c, i) => (
                  <tr key={i}>
                    <td>{COUNTRY_FLAG(c.country)} <strong>{c.country}</strong></td>
                    <td className="pc-td-num">{fmtNum(c.cnt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <div className="pc-empty">Belum ada data</div>}
        </div>
      </div>

      {/* Device Breakdown */}
      <div className="pc-card">
        <div className="pc-card-title">📱 Perangkat Pengunjung</div>
        <DeviceChart devices={data?.devices} />
      </div>

      <footer className="pc-footer">
        Data diperbarui otomatis setiap {REFRESH_SEC} detik •
        Waktu zona: WIB (UTC+7) •
        Hanya sesi aktif ≤5 menit yang dihitung "online sekarang"
      </footer>
    </main>
  );
}
