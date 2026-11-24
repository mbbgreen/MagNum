import React, { useEffect, useRef, useState } from 'react';
import { X, ZoomIn, ZoomOut, Copy, Download, Check, ChevronLeft, ChevronRight, Maximize, Loader2, AlertCircle } from 'lucide-react';
import { Language, translations } from '../../i18n/translations';

export interface ViewerImage { src: string; name: string; }
interface ViewerState { images: ViewerImage[]; index: number; }

let current: ViewerState | null = null;
const listeners = new Set<(s: ViewerState | null) => void>();
function emit(s: ViewerState | null) { current = s; listeners.forEach(fn => fn(s)); }

export function openImageViewer(images: ViewerImage[], index = 0) {
  const clean = images.filter(i => i && i.src);
  if (!clean.length) return;
  emit({ images: clean, index: Math.max(0, Math.min(index, clean.length - 1)) });
}
export function closeImageViewer() { emit(null); }

async function copyImageToClipboard(src: string) {
  const blob = await (await fetch(src)).blob();
  let png: Blob = blob;
  if (blob.type !== 'image/png') {
    const bmp = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bmp.width; c.height = bmp.height;
    c.getContext('2d')!.drawImage(bmp, 0, 0);
    png = await new Promise<Blob>((res, rej) => c.toBlob(x => x ? res(x) : rej(new Error('encode failed')), 'image/png'));
    bmp.close();
  }
  await navigator.clipboard.write([new ClipboardItem({ 'image/png': png })]);
}

async function downloadImage(src: string, name: string) {
  const blob = await (await fetch(src)).blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name || 'attached-image.png';
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

const btn: React.CSSProperties = {
  background: 'transparent', border: 'none', color: 'var(--text-muted)',
  width: 30, height: 30, borderRadius: 7, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0, flexShrink: 0
};

export const ImageViewerHost: React.FC<{ lang?: Language }> = ({ lang = 'en' }) => {
  const [viewer, setViewer] = useState<ViewerState | null>(current);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'ok' | 'err'>('idle');
  const [dragging, setDragging] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, x: 0, y: 0, moved: false });
  const t = translations[lang];

  useEffect(() => { listeners.add(setViewer); return () => { listeners.delete(setViewer); }; }, []);

  const img = viewer ? viewer.images[viewer.index] : null;
  const src = img?.src || '';

  useEffect(() => { setZoom(1); setOffset({ x: 0, y: 0 }); setLoaded(false); setFailed(false); setCopyState('idle'); }, [src]);

  const clampZoom = (z: number) => Math.min(8, Math.max(0.2, z));
  const resetView = () => { setZoom(1); setOffset({ x: 0, y: 0 }); };
  const go = (dir: -1 | 1) => {
    if (!viewer) return;
    const next = viewer.index + dir;
    if (next < 0 || next >= viewer.images.length) return;
    emit({ ...viewer, index: next });
  };

  useEffect(() => {
    if (!viewer) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeImageViewer();
      else if (e.key === 'ArrowLeft') go(-1);
      else if (e.key === 'ArrowRight') go(1);
      else if (e.key === '+' || e.key === '=') setZoom(z => clampZoom(z * 1.25));
      else if (e.key === '-') setZoom(z => clampZoom(z / 1.25));
      else if (e.key === '0') resetView();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [viewer]);

  useEffect(() => {
    const el = stageRef.current;
    if (!el || !viewer) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setZoom(z => clampZoom(z * (e.deltaY < 0 ? 1.15 : 1 / 1.15)));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [viewer]);

  if (!viewer || !img) return null;

  const onPointerDown = (e: React.PointerEvent) => {
    if (zoom <= 1) return;
    drag.current = { active: true, x: e.clientX, y: e.clientY, moved: false };
    setDragging(true);
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active) return;
    const dx = e.clientX - drag.current.x, dy = e.clientY - drag.current.y;
    if (Math.abs(dx) + Math.abs(dy) > 2) drag.current.moved = true;
    drag.current.x = e.clientX; drag.current.y = e.clientY;
    setOffset(o => ({ x: o.x + dx, y: o.y + dy }));
  };
  const onPointerUp = () => { drag.current.active = false; setDragging(false); };

  const doCopy = async () => {
    try { await copyImageToClipboard(src); setCopyState('ok'); }
    catch { setCopyState('err'); }
    setTimeout(() => setCopyState('idle'), 1600);
  };

  return (
    <div
      dir="ltr"
      onMouseDown={(e) => { if (e.target === e.currentTarget && !drag.current.moved) closeImageViewer(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 100001,
        background: 'rgba(6, 8, 10, 0.82)', backdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column', animation: 'mnvFade 0.16s ease-out'
      }}
    >
      <style>{`@keyframes mnvFade{from{opacity:0}to{opacity:1}}@keyframes mnvPop{from{opacity:0;transform:scale(.96)}to{opacity:1;transform:scale(1)}}`}</style>

      {/* Toolbar */}
      <div style={{
        height: 48, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8,
        padding: '0 12px', borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-popover)'
      }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
          {t.attachedImageTitle(viewer.index + 1)}
        </span>
        <span className="code-font" title={img.name} style={{ fontSize: 11, color: 'var(--text-dim)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 260 }}>
          {img.name}
        </span>
        <div style={{ flex: 1 }} />
        {viewer.images.length > 1 && (
          <span className="code-font" style={{ fontSize: 11, color: 'var(--text-dim)', marginRight: 4 }}>
            {viewer.index + 1}/{viewer.images.length}
          </span>
        )}
        <button className="hover-bright" style={btn} title={t.zoomOutTip} onClick={() => setZoom(z => clampZoom(z / 1.25))}><ZoomOut size={15} /></button>
        <span className="code-font" style={{ fontSize: 11, color: 'var(--text-muted)', width: 44, textAlign: 'center', userSelect: 'none' }}>
          {Math.round(zoom * 100)}%
        </span>
        <button className="hover-bright" style={btn} title={t.zoomInTip} onClick={() => setZoom(z => clampZoom(z * 1.25))}><ZoomIn size={15} /></button>
        <button className="hover-bright" style={btn} title={t.resetViewTip} onClick={resetView}><Maximize size={14} /></button>
        <div style={{ width: 1, height: 18, background: 'var(--border-subtle)', margin: '0 2px' }} />
        <button className="hover-bright" style={{ ...btn, color: copyState === 'ok' ? 'var(--accent-green)' : copyState === 'err' ? 'var(--diff-del-text)' : 'var(--text-muted)' }}
          title={copyState === 'ok' ? t.copiedTip : copyState === 'err' ? t.copyFailedTip : t.copyImageTip} onClick={doCopy}>
          {copyState === 'ok' ? <Check size={15} /> : <Copy size={14} />}
        </button>
        <button className="hover-bright" style={btn} title={t.downloadTip} onClick={() => downloadImage(src, img.name).catch(() => {})}><Download size={15} /></button>
        <button className="hover-bright" style={{ ...btn, color: 'var(--text-main)' }} title={t.closeEscTip} onClick={closeImageViewer}><X size={16} /></button>
      </div>

      {/* Stage */}
      <div
        ref={stageRef}
        onMouseDown={(e) => { if (e.target === e.currentTarget && !drag.current.moved) closeImageViewer(); }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
        onDoubleClick={() => { if (zoom > 1) resetView(); else setZoom(2.5); }}
        style={{
          flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: zoom > 1 ? (dragging ? 'grabbing' : 'grab') : 'zoom-in',
          touchAction: 'none'
        }}
      >
        {!loaded && !failed && <Loader2 size={26} color="var(--accent-green)" style={{ animation: 'magnumSpin 1s linear infinite', position: 'absolute' }} />}
        {failed && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, color: 'var(--diff-del-text)', fontSize: 12.5 }}>
            <AlertCircle size={24} /> {t.failedLoadImage}
          </div>
        )}
        <img
          src={src} alt={img.name} draggable={false}
          onLoad={() => setLoaded(true)} onError={() => setFailed(true)}
          style={{
            maxWidth: '92vw', maxHeight: '82vh', objectFit: 'contain',
            borderRadius: 8, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
            transition: dragging ? 'none' : 'transform 0.08s linear',
            opacity: loaded ? 1 : 0, userSelect: 'none', pointerEvents: 'none',
            animation: 'mnvPop 0.18s ease-out'
          }}
        />
        {viewer.images.length > 1 && (
          <>
            <button className="hover-bright" disabled={viewer.index === 0}
              onClick={(e) => { e.stopPropagation(); go(-1); }}
              style={{ ...btn, position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', opacity: viewer.index === 0 ? 0.3 : 1 }}>
              <ChevronLeft size={18} />
            </button>
            <button className="hover-bright" disabled={viewer.index === viewer.images.length - 1}
              onClick={(e) => { e.stopPropagation(); go(1); }}
              style={{ ...btn, position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', width: 38, height: 38, background: 'var(--bg-popover)', border: '1px solid var(--border-subtle)', opacity: viewer.index === viewer.images.length - 1 ? 0.3 : 1 }}>
              <ChevronRight size={18} />
            </button>
          </>
        )}
      </div>

      <div dir={lang === 'fa' ? 'rtl' : 'ltr'} style={{ flexShrink: 0, textAlign: 'center', padding: '8px 0 12px', fontSize: 10.5, color: 'var(--text-dim)', userSelect: 'none' }}>
        {t.imageViewerHint}
      </div>
    </div>
  );
};
