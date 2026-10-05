'use client';
import { useEffect, useState } from 'react';
import { detectUnitType, parseAdUnit } from '@/lib/ads';

export default function AdminPage() {
  const [pass, setPass] = useState('');
  const [authed, setAuthed] = useState(false);
  const [db, setDb] = useState({ folders: [], videos: [], settings: {} });
  const [tab, setTab] = useState('folders');
  const [loading, setLoading] = useState(false);

  // forms
  const [folderForm, setFolderForm] = useState({ id: '', title: '', parentId: '' });
  const [editingFolder, setEditingFolder] = useState(null);
  const [videoForm, setVideoForm] = useState({ id: '', folderId: '', title: '', thumb: '', embed: '', file: '', label: 'vidoycdn' });
  const [editingVideo, setEditingVideo] = useState(null);
  const [videoSearch, setVideoSearch] = useState('');
  const [folderFilter, setFolderFilter] = useState('all');
  const [settingsForm, setSettingsForm] = useState({});
  const [newBacklink, setNewBacklink] = useState('');
  const [newAdScript, setNewAdScript] = useState('');
  const [bans, setBans] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem('drive-admin-pass');
    if (saved) { setPass(saved); doLogin(saved, true); }
    // eslint-disable-next-line
  }, []);

  async function load(adminPass) {
    const key = adminPass || pass;
    const res = await fetch('/api/admin', { headers: { 'x-admin-pass': key } });
    if (res.status === 401) throw new Error('unauthorized (password salah / belum login)');
    if (!res.ok) throw new Error(`load gagal (${res.status})`);
    const j = await res.json();
    setDb({ folders: j.folders || [], videos: j.videos || [], settings: j.settings || {}, storage: j.storage || 'file' });
    setSettingsForm(j.settings || {});
  }

  async function doLogin(p, silent) {
    setLoading(true);
    try {
      const res = await fetch('/api/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: p }) });
      if (res.ok) {
        setAuthed(true);
        localStorage.setItem('drive-admin-pass', p);
        try {
          await load(p);
        } catch {
          if (!silent) alert('Login OK, tapi data gagal dimuat. Refresh halaman.');
        }
      } else if (!silent) alert('Kunci salah');
    } finally { setLoading(false); }
  }

  async function call(action, payload = {}) {
    let res;
    try {
      res = await fetch('/api/admin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-pass': pass },
        body: JSON.stringify({ action, ...payload })
      });
    } catch {
      alert('Tidak bisa menghubungi server. Pastikan server nyala / koneksi normal.');
      return null;
    }
    let j = null;
    try { j = await res.json(); } catch { /* respon bukan JSON */ }
    if (!res.ok) { alert('Gagal menyimpan: ' + (j?.error || `server error ${res.status}`)); return null; }
    try {
      await load();
    } catch {
      alert('Tersimpan, tapi daftar gagal dimuat ulang. Refresh halaman.');
    }
    return j;
  }

  if (!authed) {
    return (
      <main className="login-screen">
        <div className="login-card">
          <div className="login-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3H9zm3 4a2 2 0 0 1 1 3.73V19a1 1 0 0 1-2 0v-1.27A2 2 0 0 1 12 14z"></path></svg>
          </div>
          <h1 className="login-title">Admin</h1>
          <p className="login-sub">Masukkan kunci admin untuk masuk.</p>
          <input className="admin-input login-input" type="password" placeholder="Kunci admin" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && pass) doLogin(pass); }} autoFocus />
          <button className="admin-btn login-btn" onClick={() => doLogin(pass)} disabled={loading || !pass}>{loading ? 'Memeriksa…' : 'Masuk'}</button>
        </div>
      </main>
    );
  }

  const filteredVideos = (db.videos || []).filter((v) => {
    const okFolder = folderFilter === 'all' || v.folderId === folderFilter;
    const okSearch = !videoSearch || v.title.toLowerCase().includes(videoSearch.toLowerCase());
    return okFolder && okSearch;
  });

  function startEditFolder(f) {
    setEditingFolder(f.id);
    setFolderForm({ id: f.id, title: f.title, parentId: f.parentId || '' });
  }
  function startEditVideo(v) {
    setEditingVideo(v.id);
    setVideoForm({ id: v.id, folderId: v.folderId || '', title: v.title, thumb: v.thumb, embed: v.embed || '', file: v.file || '', label: v.label || 'vidoycdn' });
  }

  function exportJSON() {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'drive-db.json';
    a.click();
  }
  async function importJSON(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    try {
      const j = JSON.parse(text);
      await call('import', { db: j });
      alert('Import OK');
    } catch { alert('File JSON tidak valid'); }
  }

  return (
    <main className="drive-shell admin-wrap">
      <header className="drive-topbar">
        <div className="brand-mark"><svg viewBox="0 0 24 24"><path d="M10 4l2 2h7a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h5z"></path></svg></div>
        <div className="drive-title-wrap"><div className="drive-label">CMS • {db.settings?.siteName || 'Drive'}{db.storage ? ` • DB: ${db.storage === 'neon' ? 'Cloud' : 'Lokal'}` : ''}</div><h1 className="drive-title">Kelola Folder / Video / Iklan</h1></div>
        <button className="admin-btn ghost" onClick={() => { localStorage.removeItem('drive-admin-pass'); location.reload(); }}>Keluar</button>
      </header>

      <div className="admin-tabs">
        {['folders', 'videos', 'ads', 'settings', 'backup'].map((t) => (
          <button key={t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t === 'folders' ? `Folder (${db.folders.length})` : t === 'videos' ? `Video (${db.videos.length})` : t === 'ads' ? 'Backlink' : t === 'settings' ? 'Pengaturan' : 'Backup'}
          </button>
        ))}
      </div>

      {tab === 'folders' && (
        <div className="admin-card">
          <h2>{editingFolder ? 'Edit Folder' : 'Tambah Folder'}</h2>
          <div className="admin-row three">
            <input className="admin-input" placeholder="ID/slug (mis: 8eyirmnuplg, kosongkan=auto)" value={folderForm.id} disabled={!!editingFolder} onChange={(e) => setFolderForm({ ...folderForm, id: e.target.value })} />
            <input className="admin-input" placeholder="Judul folder (mis: # AI Hijab 1)" value={folderForm.title} onChange={(e) => setFolderForm({ ...folderForm, title: e.target.value })} />
            <select className="admin-select" value={folderForm.parentId} onChange={(e) => setFolderForm({ ...folderForm, parentId: e.target.value })}>
              <option value="">— Root (tanpa induk) —</option>
              {db.folders.map((f) => <option key={f.id} value={f.id}>{f.title} ({f.id})</option>)}
            </select>
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="admin-btn" onClick={async () => {
              if (!folderForm.title) return alert('Isi judul');
              if (editingFolder) { await call('update-folder', { id: editingFolder, title: folderForm.title, parentId: folderForm.parentId }); setEditingFolder(null); }
              else await call('create-folder', folderForm);
              setFolderForm({ id: '', title: '', parentId: '' });
            }}>{editingFolder ? 'Simpan' : 'Tambah'}</button>
            {editingFolder && <button className="admin-btn ghost" onClick={() => { setEditingFolder(null); setFolderForm({ id: '', title: '', parentId: '' }); }}>Batal</button>}
          </div>
          <div style={{ marginTop: 16, overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Judul</th><th>Link</th><th>Induk</th><th>Isi</th><th>Aksi</th></tr></thead>
              <tbody>
                {db.folders.map((f) => (
                  <tr key={f.id}>
                    <td>{f.title}<br /><span className="admin-small">{f.id}</span></td>
                    <td><a href={`/f/${f.id}`} target="_blank" style={{ color: '#fe6081' }}>/f/{f.id}</a></td>
                    <td>{f.parentId || '-'}</td>
                    <td>{db.videos.filter((v) => v.folderId === f.id).length} video</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="admin-btn ghost" onClick={() => startEditFolder(f)}>Edit</button>{' '}
                      <button className="admin-btn danger" onClick={() => confirm(`Hapus folder "${f.title}"?`) && call('delete-folder', { id: f.id })}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'videos' && (
        <div className="admin-card">
          <h2>{editingVideo ? 'Edit Video' : 'Tambah Video'}</h2>
          <div className="admin-row two">
            <input className="admin-input" placeholder="ID/slug (kosongkan=auto)" value={videoForm.id} disabled={!!editingVideo} onChange={(e) => setVideoForm({ ...videoForm, id: e.target.value })} />
            <select className="admin-select" value={videoForm.folderId} onChange={(e) => setVideoForm({ ...videoForm, folderId: e.target.value })}>
              <option value="">— Pilih folder —</option>
              {db.folders.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
          <div className="admin-row" style={{ marginTop: 10 }}>
            <input className="admin-input" placeholder="Judul file (mis: AI Motion - Cewe Hijab 01 - vidxlr.top)" value={videoForm.title} onChange={(e) => setVideoForm({ ...videoForm, title: e.target.value })} />
          </div>
          <div className="admin-row two" style={{ marginTop: 10 }}>
            <input className="admin-input" placeholder="Thumbnail URL (https://... 9:16 lebih bagus)" value={videoForm.thumb} onChange={(e) => setVideoForm({ ...videoForm, thumb: e.target.value })} />
            <input className="admin-input" placeholder="Label kecil (vidoycdn / vidoyhls)" value={videoForm.label} onChange={(e) => setVideoForm({ ...videoForm, label: e.target.value })} />
          </div>
          <div className="admin-row two" style={{ marginTop: 10 }}>
            <input className="admin-input" placeholder="Embed iframe URL (youtube/doodstream/dll, kosongkan jika pakai File)" value={videoForm.embed} onChange={(e) => setVideoForm({ ...videoForm, embed: e.target.value })} />
            <input className="admin-input" placeholder="File MP4 langsung (https://...mp4)" value={videoForm.file} onChange={(e) => setVideoForm({ ...videoForm, file: e.target.value })} />
          </div>
          <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
            <button className="admin-btn" onClick={async () => {
              if (!videoForm.title) return alert('Isi judul');
              if (editingVideo) { await call('update-video', { ...videoForm, id: editingVideo }); setEditingVideo(null); }
              else await call('create-video', videoForm);
              setVideoForm({ id: '', folderId: '', title: '', thumb: '', embed: '', file: '', label: 'vidoycdn' });
            }}>{editingVideo ? 'Simpan' : 'Tambah'}</button>
            {editingVideo && <button className="admin-btn ghost" onClick={() => { setEditingVideo(null); setVideoForm({ id: '', folderId: '', title: '', thumb: '', embed: '', file: '', label: 'vidoycdn' }); }}>Batal</button>}
          </div>
          <div className="admin-row two" style={{ marginTop: 16 }}>
            <input className="admin-input" placeholder="Cari judul..." value={videoSearch} onChange={(e) => setVideoSearch(e.target.value)} />
            <select className="admin-select" value={folderFilter} onChange={(e) => setFolderFilter(e.target.value)}>
              <option value="all">Semua folder</option>
              {db.folders.map((f) => <option key={f.id} value={f.id}>{f.title}</option>)}
            </select>
          </div>
          <div style={{ marginTop: 12, overflowX: 'auto' }}>
            <table className="admin-table">
              <thead><tr><th>Judul</th><th>Folder</th><th>Link</th><th>Aksi</th></tr></thead>
              <tbody>
                {filteredVideos.slice(0, 200).map((v) => (
                  <tr key={v.id}>
                    <td style={{ maxWidth: 320, overflow: 'hidden', textOverflow: 'ellipsis' }}>{v.title}<br /><span className="admin-small">{v.id}</span></td>
                    <td>{db.folders.find((f) => f.id === v.folderId)?.title || '-'}</td>
                    <td><a href={`/d/${v.id}`} target="_blank" style={{ color: '#fe6081' }}>/d/{v.id}</a></td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button className="admin-btn ghost" onClick={() => startEditVideo(v)}>Edit</button>{' '}
                      <button className="admin-btn danger" onClick={() => confirm('Hapus video ini?') && call('delete-video', { id: v.id })}>Hapus</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="admin-small">Menampilkan {Math.min(200, filteredVideos.length)} dari {filteredVideos.length} video (gunakan cari/filter).</p>
          </div>
        </div>
      )}

      {tab === 'ads' && (
        <div className="admin-card">
          <h2>Backlink Iklan — sumber uangnya di sini</h2>
          <p className="admin-small">Tambah backlink / direct link dari network (boleh banyak). Link HANYA terbuka saat iklannya diklik. Kode script di bawah jalan otomatis di semua page user.</p>
          {(() => {
            const backlinks = Array.isArray(settingsForm.backlinks)
              ? settingsForm.backlinks
              : (settingsForm.directLink ? [settingsForm.directLink] : []);
            function addBacklink() {
              const url = (newBacklink || '').trim();
              if (!url) return alert('Isi URL backlink dulu');
              if (!/^https?:\/\//i.test(url)) return alert('URL harus diawali http:// atau https://');
              const next = [...backlinks, url];
              setSettingsForm({ ...settingsForm, backlinks: next, directLink: next[0] || '' });
              setNewBacklink('');
            }
            function removeBacklink(idx) {
              const next = backlinks.filter((_, i) => i !== idx);
              setSettingsForm({ ...settingsForm, backlinks: next, directLink: next[0] || '' });
            }
            return (
              <>
                <div className="admin-row two" style={{ marginTop: 10 }}>
                  <input className="admin-input" value={newBacklink} onChange={(e) => setNewBacklink(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addBacklink(); }} placeholder="https://www.profitableratecpmnetwork.com/..." />
                  <button className="admin-btn" onClick={addBacklink}>+ Tambah Backlink</button>
                </div>
                <div style={{ marginTop: 12, overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead><tr><th>#</th><th>URL Backlink ({backlinks.length})</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {backlinks.map((u, i) => (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td style={{ maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-all' }}>{u}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="admin-btn danger" onClick={() => confirm('Hapus backlink ini?') && removeBacklink(i)}>Hapus</button>
                          </td>
                        </tr>
                      ))}
                      {backlinks.length === 0 ? <tr><td colSpan="3" className="admin-small">Belum ada backlink. Tambahkan minimal 1.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
          <h2 style={{ marginTop: 20 }}>Kode Script Iklan — jalan otomatis di semua page</h2>
          <p className="admin-small">
            Tempel kode dari Adsterra — semua format didukung:<br />
            • <b>Banner</b> (punya <code>atOptions</code> / <code>invoke.js</code>): ditempel di slot banner (pre-video, sidebar, dll)<br />
            • <b>Popunder / Social Bar / In-Page Push / Native</b> (script src-only): di-load otomatis, Adsterra yang tampilkan iklan-nya sendiri<br />
            Bisa tempel tag <code>&lt;script&gt;</code> utuh, URL <code>https://...</code>, atau URL protocol-relative <code>//...</code>
          </p>
          {(() => {
            const adScripts = Array.isArray(settingsForm.adScripts)
              ? settingsForm.adScripts
              : [settingsForm.popunderScript, settingsForm.customHeadScript].filter(Boolean);
            function normalizeScript(input) {
              const t = (input || '').trim();
              if (!t) return '';
              // Sudah tag <script> lengkap
              if (/<script[\s>]/i.test(t)) return t;
              // URL https:// atau http://
              if (/^https?:\/\/\S+$/i.test(t)) return `<script src="${t}" data-cfasync="false"></script>`;
              // Protocol-relative URL (format Adsterra Social Bar / In-Page Push)
              if (/^\/\/\S+$/i.test(t)) return `<script src="${t}" data-cfasync="false"></script>`;
              return '';
            }
            function addAdScript() {
              const code = normalizeScript(newAdScript);
              if (!code) return alert('Tempel tag <script> utuh atau URL .js (https://...)');
              const next = [...adScripts, code];
              setSettingsForm({ ...settingsForm, adScripts: next, popunderScript: '', customHeadScript: '' });
              setNewAdScript('');
            }
            function removeAdScript(idx) {
              const next = adScripts.filter((_, i) => i !== idx);
              setSettingsForm({ ...settingsForm, adScripts: next, popunderScript: '', customHeadScript: '' });
            }
            return (
              <>
                <div className="admin-row two" style={{ marginTop: 10 }}>
                  <input className="admin-input" style={{ fontFamily: 'monospace', fontSize: 12 }} value={newAdScript} onChange={(e) => setNewAdScript(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') addAdScript(); }} placeholder='<script src="//..."> atau https://... atau tag lengkap dari Adsterra' />
                  <button className="admin-btn" onClick={addAdScript}>+ Tambah Script</button>
                </div>
                <div style={{ marginTop: 12, overflowX: 'auto' }}>
                  <table className="admin-table">
                    <thead><tr><th>#</th><th>Kode Script ({adScripts.length})</th><th>Tipe</th><th>Ukuran</th><th>Aksi</th></tr></thead>
                    <tbody>
                      {adScripts.map((c, i) => {
                        // Klasifikasi tipe untuk tampilan admin (lebih akurat dari detectUnitType)
                        function getAdLabel(code) {
                          const s = String(code || '');
                          if (/atOptions\s*=/i.test(s) || /invoke\.js/i.test(s) || /id=(["'])container-/i.test(s)) return 'Banner';
                          if (/social/i.test(s)) return 'Social Bar';
                          if (/popunder|pop-under/i.test(s)) return 'Popunder';
                          if (/native/i.test(s)) return 'Native';
                          // src-only tanpa banner signal → auto-behavior
                          const scriptRe = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
                          let m; let hasSrc = false; let hasInline = false;
                          scriptRe.lastIndex = 0;
                          while ((m = scriptRe.exec(s)) !== null) {
                            if (/\bsrc\s*=/i.test(m[1])) hasSrc = true;
                            if ((m[2] || '').trim()) hasInline = true;
                          }
                          if (hasSrc && !hasInline) return 'Auto (Popunder/Social/Push)';
                          return detectUnitType(s);
                        }
                        return (
                        <tr key={i}>
                          <td>{i + 1}</td>
                          <td style={{ maxWidth: 480, overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-all', fontFamily: 'monospace', fontSize: 12 }}>{c.length > 140 ? c.slice(0, 140) + '…' : c}</td>
                          <td className="admin-small">{getAdLabel(c)}</td>
                          <td className="admin-small" style={{ fontFamily: 'monospace' }}>{(() => { const m = parseAdUnit(c); return m.width && m.height ? `${m.width}×${m.height}` : '—'; })()}</td>
                          <td style={{ whiteSpace: 'nowrap' }}>
                            <button className="admin-btn danger" onClick={() => confirm('Hapus script ini?') && removeAdScript(i)}>Hapus</button>
                          </td>
                        </tr>
                        );
                      })}
                      {adScripts.length === 0 ? <tr><td colSpan="5" className="admin-small">Belum ada script. Tempel kode dari network lalu Tambah.</td></tr> : null}
                    </tbody>
                  </table>
                </div>
              </>
            );
          })()}
          <h2 style={{ marginTop: 20 }}>Batas & Perilaku Iklan</h2>
          <div className="admin-row two" style={{ marginTop: 10 }}>
            <div><label className="admin-small">Maks iklan per halaman (1–50, default 10)</label><input className="admin-input" type="number" min="1" max="50" value={settingsForm.maxAdsPerPage ?? 10} onChange={(e) => setSettingsForm({ ...settingsForm, maxAdsPerPage: Number(e.target.value) })} /></div>
            <div><label className="admin-small">Native tiap N kartu (2–20, default 6)</label><input className="admin-input" type="number" min="2" max="20" value={settingsForm.feedEvery ?? 6} onChange={(e) => setSettingsForm({ ...settingsForm, feedEvery: Number(e.target.value) })} /></div>
          </div>
          <div className="admin-row two" style={{ marginTop: 10 }}>
            <div><label className="admin-small">Refresh tiap N detik (0=mati, min 30)</label><input className="admin-input" type="number" min="0" max="300" value={settingsForm.refreshSeconds ?? 0} onChange={(e) => setSettingsForm({ ...settingsForm, refreshSeconds: Number(e.target.value) })} /></div>
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <label className="admin-small" style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={settingsForm.stickyFooter !== false} onChange={(e) => setSettingsForm({ ...settingsForm, stickyFooter: e.target.checked })} /> Sticky footer</label>
              <label className="admin-small" style={{ display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}><input type="checkbox" checked={settingsForm.isolateBanners === true} onChange={(e) => setSettingsForm({ ...settingsForm, isolateBanners: e.target.checked })} /> Isolasi banner</label>
            </div>
          </div>
          <p className="admin-small" style={{ marginTop: 8 }}>Refresh default mati — aktifkan hanya bila kebijakan network mengizinkan (maks 3x, saat terlihat + tab fokus).</p>
          <div style={{ marginTop: 12 }}>
            <button className="admin-btn" onClick={() => call('settings', { settings: settingsForm })}>Simpan Iklan</button>
          </div>
        </div>
      )}

      {tab === 'settings' && (
        <div className="admin-card">
          <h2>Pengaturan Umum</h2>
          <div className="admin-row two">
            <div><label className="admin-small">Nama situs</label><input className="admin-input" value={settingsForm.siteName || ''} onChange={(e) => setSettingsForm({ ...settingsForm, siteName: e.target.value })} /></div>
            <div><label className="admin-small">Video per halaman (default 20)</label><input className="admin-input" type="number" value={settingsForm.perPage || 20} onChange={(e) => setSettingsForm({ ...settingsForm, perPage: Number(e.target.value) })} /></div>
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="admin-btn" onClick={() => call('settings', { settings: settingsForm })}>Simpan</button>
          </div>
          <p className="admin-small" style={{ marginTop: 12 }}>Warna primary mengikuti vidmonstr: #fe6081. Struktur link: /f/[id-folder] dan /d/[id-video] — sama persis dengan vidmonstr.com & tribunvideo.com.</p>
        </div>
      )}

      {tab === 'backup' && (
        <div className="admin-card">
          <h2>Backup / Restore</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="admin-btn" onClick={exportJSON}>Download JSON</button>
            <label className="admin-btn ghost" style={{ cursor: 'pointer' }}>Import JSON<input type="file" accept=".json" style={{ display: 'none' }} onChange={importJSON} /></label>
          </div>
          <p className="admin-small" style={{ marginTop: 10 }}>Data tersimpan di <b>data/db.json</b>. Backup rutin sebelum share / deploy.</p>
          <h2 style={{ marginTop: 20 }}>IP Terblokir Otomatis</h2>
          <p className="admin-small">IP penyerang (5x login salah / 10 mnt) diblokir 1 jam otomatis, tersimpan di database (berlaku semua instance).</p>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="admin-btn ghost" onClick={async () => { const r = await call('list-bans'); if (r) setBans(r.bans || []); }}>Muat Daftar Blokir</button>
          </div>
          {bans && (
            <div style={{ marginTop: 12, overflowX: 'auto' }}>
              <table className="admin-table">
                <thead><tr><th>IP</th><th>Alasan</th><th>Sampai</th><th>Aksi</th></tr></thead>
                <tbody>
                  {bans.map((b) => (
                    <tr key={b.ip}>
                      <td style={{ fontFamily: 'monospace' }}>{b.ip}</td>
                      <td>{b.reason} (gagal x{b.fails})</td>
                      <td>{b.until ? new Date(b.until).toLocaleString('id-ID') : '-'}</td>
                      <td><button className="admin-btn danger" onClick={async () => { if (!confirm(`Buka blokir ${b.ip}?`)) return; await call('unban', { ip: b.ip }); const r = await call('list-bans'); if (r) setBans(r.bans || []); }}>Unban</button></td>
                    </tr>
                  ))}
                  {bans.length === 0 ? <tr><td colSpan="4" className="admin-small">Tidak ada IP terblokir.</td></tr> : null}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
