import React from 'react';
import { FileText, X } from 'lucide-react';
import { Attachment } from '../../types';
import { openImageViewer } from './ImageViewer';
import { Language, translations } from '../../i18n/translations';

export const isImageAtt = (a: Attachment) =>
  (a.type || '').startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|avif|svg|ico)$/i.test(a.name || '');

export const attSrc = (a: Attachment) => a.base64 || a.url || '';

export const fmtSize = (n: number) =>
  n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : n >= 1024 ? Math.round(n / 1024) + ' KB' : (n || 0) + ' B';

interface Props {
  attachments: Attachment[];
  variant?: 'message' | 'composer';
  onRemove?: (id: string) => void;
  lang?: Language;
}

export const AttachmentPreview: React.FC<Props> = ({ attachments, variant = 'message', onRemove, lang = 'en' }) => {
  const t = translations[lang];
  const size = variant === 'message' ? 76 : 56;
  const images = attachments.filter(isImageAtt).map(a => ({ src: attSrc(a), name: a.name })).filter(i => i.src);

  return (
    <>
      {attachments.map(att => {
        const src = attSrc(att);
        if (isImageAtt(att) && src) {
          return (
            <div key={att.id} style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
              <button
                type="button"
                className="hover-bright"
                title={att.name}
                onClick={() => openImageViewer(images, Math.max(0, images.findIndex(i => i.src === src)))}
                style={{
                  width: '100%', height: '100%', padding: 0, display: 'block',
                  border: '1px solid var(--border-subtle)', borderRadius: 10,
                  overflow: 'hidden', cursor: 'zoom-in', background: 'var(--bg-card)'
                }}
              >
                <img src={src} alt={att.name} draggable={false} loading="lazy"
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
              </button>
              {onRemove && (
                <button type="button" title={t.removeBtn}
                  onClick={(e) => { e.stopPropagation(); onRemove(att.id); }}
                  style={{
                    position: 'absolute', top: -6, right: -6, width: 18, height: 18,
                    borderRadius: '50%', border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-popover)', color: 'var(--text-muted)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    cursor: 'pointer', padding: 0, boxShadow: '0 2px 8px var(--shadow-heavy)'
                  }}>
                  <X size={10} />
                </button>
              )}
            </div>
          );
        }
        return (
          <div key={att.id} style={{
            display: 'flex', alignItems: 'center', gap: 7, background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)', borderRadius: 8, padding: '5px 9px',
            fontSize: 11, color: 'var(--text-main)', maxWidth: 220
          }}>
            <FileText size={14} color="var(--accent-green)" style={{ flexShrink: 0 }} />
            <span title={att.name} style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
            <span style={{ color: 'var(--text-dim)', fontSize: 10, flexShrink: 0 }}>{fmtSize(att.size || 0)}</span>
            {onRemove && (
              <button type="button" title={t.removeBtn} onClick={() => onRemove(att.id)}
                style={{ background: 'transparent', border: 'none', color: 'var(--diff-del-text)', cursor: 'pointer', display: 'flex', padding: 1, flexShrink: 0 }}>
                <X size={11} />
              </button>
            )}
          </div>
        );
      })}
    </>
  );
};
