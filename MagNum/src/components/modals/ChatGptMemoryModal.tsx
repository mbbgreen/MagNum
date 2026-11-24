import React, { useEffect, useState } from 'react';
import { ChevronRight, X } from 'lucide-react';
import { Language } from '../../i18n/translations';
import { ProviderLogo } from '../shared/ProviderLogo';

const HIDE_NOTICE_KEY = 'magnum_hide_chatgpt_memory_notice';

let isOpenState = false;
const listeners = new Set<(open: boolean) => void>();

function emit(open: boolean) {
  isOpenState = open;
  listeners.forEach((fn) => fn(open));
}

export function shouldShowChatGptMemoryNotice(): boolean {
  try {
    return localStorage.getItem(HIDE_NOTICE_KEY) !== '1';
  } catch {
    return true;
  }
}

export function maybeShowChatGptMemoryNotice() {
  if (shouldShowChatGptMemoryNotice()) {
    emit(true);
  }
}

export function closeChatGptMemoryNotice(dontShowAgain = false) {
  if (dontShowAgain) {
    try {
      localStorage.setItem(HIDE_NOTICE_KEY, '1');
    } catch {}
  }
  emit(false);
}

const COPY = {
  en: {
    title: 'Turn Off ChatGPT Memory',
    subtitle: 'Important tip before using ChatGPT in MagNum',
    body: 'To prevent potential bugs, context mixing across tasks, and unexpected errors, please turn OFF Memory inside your ChatGPT settings:',
    pathLabel: 'Exact path on chatgpt.com:',
    steps: [
      <>Open <strong>Settings</strong> from your ChatGPT profile menu (bottom-left).</>,
      <>In the left sidebar under <strong>App</strong>, click <strong>Personalization</strong>.</>,
      <>Under <strong>ChatGPT memory</strong>, turn <strong>OFF</strong> the <strong>Enable memory</strong> switch.</>,
    ],
    dontShowAgain: "Don't show again",
    gotIt: 'Got it',
  },
  fa: {
    title: 'خاموش کردن گزینه \u200FMemory\u200F در \u200FChatGPT\u200F',
    subtitle: 'نکته مهم قبل از استفاده از \u200FChatGPT\u200F در مگنوم',
    body: 'برای جلوگیری از باگ‌های احتمالی، تداخل اطلاعات گفتگوها و خطاهای ناخواسته، لطفاً حتماً گزینهٔ \u200FMemory\u200F را در تنظیمات حساب \u200FChatGPT\u200F خود خاموش کنید:',
    pathLabel: 'مسیر دقیق در سایت \u200Fchatgpt.com\u200F:',
    steps: [
      <>در سایت <strong dir="ltr">chatgpt.com</strong> وارد بخش <strong dir="ltr">Settings</strong> (تنظیمات) شوید.</>,
      <>از منوی سمت چپ (زیر بخش <strong dir="ltr">App</strong>)، گزینهٔ <strong dir="ltr">Personalization</strong> را انتخاب کنید.</>,
      <>در بخش <strong dir="ltr">ChatGPT memory</strong>، کلید <strong dir="ltr">Enable memory</strong> را <strong>خاموش (\u200FOFF\u200F)</strong> کنید.</>,
    ],
    dontShowAgain: 'دیگر نمایش نده',
    gotIt: 'متوجه شدم',
  },
} as const;

const PATH_STEPS = [
  'chatgpt.com',
  'Settings',
  'Personalization',
  'ChatGPT memory',
  'Enable memory: OFF',
];

export const ChatGptMemoryModalHost: React.FC<{ lang: Language }> = ({ lang }) => {
  const [open, setOpen] = useState(isOpenState);

  useEffect(() => {
    listeners.add(setOpen);
    return () => {
      listeners.delete(setOpen);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeChatGptMemoryNotice(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  if (!open) return null;

  const isFa = lang === 'fa';
  const t = COPY[isFa ? 'fa' : 'en'];

  return (
    <div
      onMouseDown={() => closeChatGptMemoryNotice(false)}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(8px)',
        zIndex: 100000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
      }}
    >
      <div
        dir={isFa ? 'rtl' : 'ltr'}
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 470,
          maxWidth: '94vw',
          background: 'var(--bg-surface)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 14,
          boxShadow: '0 24px 60px var(--shadow-heavy)',
          padding: 20,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(16, 163, 127, 0.14)',
              border: '1px solid rgba(16, 163, 127, 0.35)',
              color: '#10a37f',
            }}
          >
            <ProviderLogo provider="chatgpt" size={20} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text-main)' }}>
              {t.title}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>
              {t.subtitle}
            </div>
          </div>
          <button
            type="button"
            onClick={() => closeChatGptMemoryNotice(false)}
            className="hover-bright"
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-dim)',
              cursor: 'pointer',
              display: 'flex',
              padding: 4,
              borderRadius: 6,
            }}
          >
            <X size={15} />
          </button>
        </div>

        <div style={{ fontSize: 12.5, color: 'var(--text-muted)', lineHeight: 1.75 }}>
          {t.body}
        </div>

        <div
          style={{
            background: 'var(--bg-card)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-dim)' }}>
            {t.pathLabel}
          </span>

          <div
            dir="ltr"
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignItems: 'center',
              gap: 4,
            }}
          >
            {PATH_STEPS.map((step, idx) => {
              const isLast = idx === PATH_STEPS.length - 1;
              return (
                <React.Fragment key={step}>
                  <span
                    className="code-font"
                    style={{
                      fontSize: 11,
                      fontWeight: isLast ? 700 : 600,
                      padding: '2px 7px',
                      borderRadius: 6,
                      background: isLast ? 'rgba(16, 163, 127, 0.16)' : 'var(--bg-surface)',
                      border: `1px solid ${isLast ? 'rgba(16, 163, 127, 0.45)' : 'var(--border-subtle)'}`,
                      color: isLast ? '#10a37f' : 'var(--text-main)',
                    }}
                  >
                    {step}
                  </span>
                  {!isLast && <ChevronRight size={12} color="var(--text-dim)" />}
                </React.Fragment>
              );
            })}
          </div>

          <ol
            style={{
              margin: 0,
              paddingInlineStart: 18,
              display: 'flex',
              flexDirection: 'column',
              gap: 5,
              fontSize: 12,
              color: 'var(--text-muted)',
              lineHeight: 1.7,
            }}
          >
            {t.steps.map((node, i) => (
              <li key={i}>{node}</li>
            ))}
          </ol>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            marginTop: 2,
          }}
        >
          <button
            type="button"
            onClick={() => closeChatGptMemoryNotice(true)}
            className="hover-bright"
            style={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              padding: '7px 14px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {t.dontShowAgain}
          </button>

          <button
            type="button"
            onClick={() => closeChatGptMemoryNotice(false)}
            className="hover-bright"
            style={{
              background: '#10a37f',
              border: 'none',
              color: '#ffffff',
              padding: '7px 18px',
              borderRadius: 8,
              fontSize: 12,
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {t.gotIt}
          </button>
        </div>
      </div>
    </div>
  );
};
