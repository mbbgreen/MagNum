import React, { useEffect, useRef, useState } from 'react';
import { Brain, Sparkles, Zap } from 'lucide-react';
import { Language } from '../../i18n/translations';
import { ProviderLogo, ProviderId } from '../shared/ProviderLogo';
import './ModelsSettings.css';

type ThinkLevel = 'low' | 'medium' | 'high';

interface ModelsSettingsProps {
  lang: Language;
  defaultProvider: ProviderId;
  onDefaultProviderChange: (p: ProviderId) => void;
  deepThink: boolean;
  onDeepThinkChange: (enabled: boolean) => void;
  geminiThinking: ThinkLevel;
  onGeminiThinkingChange: (level: ThinkLevel) => void;
  chatgptThink: boolean;
  onChatgptThinkChange: (enabled: boolean) => void;
}

const L = {
  en: {
    title: 'Models',
    subtitle: 'Pick the model that is always selected when MagNum launches, and set the default reasoning mode for every provider.',
    startup: 'Startup model',
    default: 'DEFAULT',
    setDefault: 'Set as default',
    note: 'These defaults apply to every new chat. You can still switch the model or reasoning mode per conversation from the chat box.',
    providers: {
      deepseek: { name: 'DeepSeek', tag: 'Fast autonomous engineering & instant tool calling' },
      gemini: { name: 'Gemini', tag: 'Google AI Studio — long-context multimodal reasoning' },
      chatgpt: { name: 'ChatGPT', tag: 'OpenAI — autonomous engineering via your own account' }
    },
    deepThink: 'DeepThink',
    deepThinkDesc: 'Deep reasoning chain for complex engineering tasks',
    thinkLevel: 'Thinking Level',
    thinkLevelDesc: 'Default reasoning depth for new Gemini chats',
    think: 'Think',
    thinkDesc: 'Extended reasoning for reliable engineering answers',
    levels: { low: 'Low', medium: 'Medium', high: 'High' } as Record<ThinkLevel, string>,
    on: 'On',
    off: 'Off'
  },
  fa: {
    title: 'مدل‌ها',
    subtitle: 'مدلی را انتخاب کنید که هنگام باز شدن مگنوم همیشه به‌طور پیش‌فرض انتخاب شده باشد و حالت استدلال هر سرویس را جداگانه تنظیم کنید.',
    startup: 'مدل هنگام ورود',
    default: 'پیش‌فرض',
    setDefault: 'انتخاب به‌عنوان پیش‌فرض',
    note: 'این پیش‌فرض‌ها برای هر گفتگوی جدید اعمال می‌شوند. داخل هر گفتگو هم می‌توانید مدل یا سطح استدلال را از کادر پیام تغییر دهید.',
    providers: {
      deepseek: { name: 'دیپ‌سیک (\u200FDeepSeek\u200F)', tag: 'مهندسی خودکار سریع و اجرای فوری ابزارها' },
      gemini: { name: 'جمنای (\u200FGemini\u200F)', tag: 'استدلال چندرسانه‌ای با زمینهٔ طولانی از \u200FGoogle\u200F' },
      chatgpt: { name: '\u200FChatGPT\u200F', tag: 'مهندسی خودکار \u200FOpenAI\u200F با حساب کاربری خودتان' }
    },
    deepThink: '\u200FDeepThink\u200F',
    deepThinkDesc: 'زنجیره استدلال عمیق برای تسک‌های پیچیده مهندسی',
    thinkLevel: 'سطح استدلال (\u200FThinking\u200F)',
    thinkLevelDesc: 'عمق پیش‌فرض استدلال برای گفتگوهای جدید \u200FGemini\u200F',
    think: '\u200FThink\u200F',
    thinkDesc: 'استدلال گسترده برای پاسخ‌های مهندسی قابل‌اعتماد',
    levels: { low: 'کم', medium: 'متوسط', high: 'زیاد' } as Record<ThinkLevel, string>,
    on: 'روشن',
    off: 'خاموش'
  }
};

const PROVIDERS: { id: ProviderId; color: string; rgb: string }[] = [
  { id: 'deepseek', color: '#4d6bfe', rgb: '77,107,254' },
  { id: 'gemini', color: '#4285f4', rgb: '66,133,244' },
  { id: 'chatgpt', color: '#10a37f', rgb: '16,163,127' }
];

const CheckMark: React.FC = () => (
  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
    <path className="mn-check-path" d="M3 8.5 L6.5 12 L13 4.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const ThinkToggle: React.FC<{ on: boolean; onChange: (v: boolean) => void; label: string }> = ({ on, onChange, label }) => {
  const [ping, setPing] = useState(0);
  const prev = useRef(on);
  useEffect(() => {
    if (on && !prev.current) setPing(Date.now());
    prev.current = on;
  }, [on]);
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`mn-toggle ${on ? 'on' : ''}`}
      onClick={(e) => { e.stopPropagation(); onChange(!on); }}
    >
      {ping > 0 && <span key={ping} className="mn-toggle-ping" />}
      <span className="mn-toggle-knob">
        <Sparkles size={11} />
      </span>
    </button>
  );
};

const ThinkSegmented: React.FC<{ value: ThinkLevel; onChange: (v: ThinkLevel) => void; labels: Record<ThinkLevel, string> }> = ({ value, onChange, labels }) => {
  const levels: ThinkLevel[] = ['low', 'medium', 'high'];
  const idx = levels.indexOf(value);
  return (
    <div className="mn-seg" style={{ '--seg-i': idx } as React.CSSProperties} onClick={(e) => e.stopPropagation()}>
      <span className="mn-seg-thumb" />
      {levels.map(lv => (
        <button
          key={lv}
          type="button"
          className={value === lv ? 'active' : ''}
          aria-pressed={value === lv}
          onClick={() => onChange(lv)}
        >
          {labels[lv]}
        </button>
      ))}
    </div>
  );
};

const ProviderCard: React.FC<{
  id: ProviderId;
  color: string;
  rgb: string;
  index: number;
  selected: boolean;
  onSelect: () => void;
  name: string;
  tag: string;
  defaultLabel: string;
  setDefaultLabel: string;
  thinkLabel: string;
  thinkDesc: string;
  thinkActive: boolean;
  thinkIcon: React.ReactNode;
  thinkControl: React.ReactNode;
}> = ({ id, color, rgb, index, selected, onSelect, name, tag, defaultLabel, setDefaultLabel, thinkLabel, thinkDesc, thinkActive, thinkIcon, thinkControl }) => {
  const [burst, setBurst] = useState(0);
  const [thinkPulse, setThinkPulse] = useState(0);
  const prevSelected = useRef(selected);
  const prevActive = useRef(thinkActive);

  useEffect(() => {
    if (selected && !prevSelected.current) setBurst(Date.now());
    prevSelected.current = selected;
  }, [selected]);

  useEffect(() => {
    if (thinkActive !== prevActive.current) setThinkPulse(Date.now());
    prevActive.current = thinkActive;
  }, [thinkActive]);

  return (
    <div
      className={`mn-card ${selected ? 'is-default' : ''}`}
      style={{ '--pc': color, '--pc-rgb': rgb, animationDelay: `${index * 90}ms` } as React.CSSProperties}
      role="radio"
      aria-checked={selected}
      aria-label={`${name} — ${setDefaultLabel}`}
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(); }
      }}
    >
      {burst > 0 && <span key={`b${burst}`} className="mn-burst" />}
      {burst > 0 && <span key={`s${burst}`} className="mn-shine" />}
      <div className="mn-card-top">
        <div className="mn-logo-wrap">
          <span className="mn-logo-ring" />
          <span className="mn-logo-pulse" />
          <span className="mn-logo-pulse p2" />
          <div className="mn-logo">
            <ProviderLogo provider={id} size={30} />
          </div>
        </div>
        <div className="mn-meta">
          <div className="mn-name-row">
            <span className="mn-name">{name}</span>
            {selected && (
              <span className="mn-badge">
                <CheckMark />
                {defaultLabel}
              </span>
            )}
          </div>
          <span className="mn-tag">{tag}</span>
        </div>
        <button
          type="button"
          className="mn-radio"
          aria-label={setDefaultLabel}
          tabIndex={-1}
          onClick={(e) => { e.stopPropagation(); onSelect(); }}
        >
          {selected && <CheckMark />}
        </button>
      </div>
      <div className="mn-think" onClick={(e) => e.stopPropagation()}>
        <div className="mn-think-info">
          <span className={`mn-think-icon ${thinkActive ? 'active' : ''}`}>
            {thinkPulse > 0 && <span key={thinkPulse} className="mn-think-ping" />}
            {thinkIcon}
          </span>
          <div>
            <div className="mn-think-label">{thinkLabel}</div>
            <div className="mn-think-desc">{thinkDesc}</div>
          </div>
        </div>
        {thinkControl}
      </div>
    </div>
  );
};

export const ModelsSettings: React.FC<ModelsSettingsProps> = ({
  lang,
  defaultProvider,
  onDefaultProviderChange,
  deepThink,
  onDeepThinkChange,
  geminiThinking,
  onGeminiThinkingChange,
  chatgptThink,
  onChatgptThinkChange
}) => {
  const t = L[lang] || L.en;
  const current = PROVIDERS.find(p => p.id === defaultProvider) || PROVIDERS[0];

  return (
    <div className="mn-models" dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      <div className="mn-head">
        <div>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
        <div className="mn-current" style={{ '--pc': current.color, '--pc-rgb': current.rgb } as React.CSSProperties}>
          <span className="mn-current-logo" key={defaultProvider}>
            <ProviderLogo provider={defaultProvider} size={16} />
          </span>
          <span>
            <small>{t.startup}</small>
            {t.providers[defaultProvider].name}
          </span>
        </div>
      </div>

      <div className="mn-cards" role="radiogroup" aria-label={t.title}>
        {PROVIDERS.map((p, i) => {
          const meta = t.providers[p.id];
          const selected = defaultProvider === p.id;
          let thinkLabel = '';
          let thinkDesc = '';
          let thinkActive = false;
          let thinkIcon: React.ReactNode = <Brain size={15} />;
          let thinkControl: React.ReactNode = null;

          if (p.id === 'deepseek') {
            thinkLabel = t.deepThink;
            thinkDesc = t.deepThinkDesc;
            thinkActive = deepThink;
            thinkIcon = <Sparkles size={15} />;
            thinkControl = <ThinkToggle on={deepThink} onChange={onDeepThinkChange} label={t.deepThink} />;
          } else if (p.id === 'gemini') {
            thinkLabel = t.thinkLevel;
            thinkDesc = t.thinkLevelDesc;
            thinkActive = true;
            thinkIcon = <Zap size={15} />;
            thinkControl = <ThinkSegmented value={geminiThinking} onChange={onGeminiThinkingChange} labels={t.levels} />;
          } else {
            thinkLabel = t.think;
            thinkDesc = t.thinkDesc;
            thinkActive = chatgptThink;
            thinkIcon = <Brain size={15} />;
            thinkControl = <ThinkToggle on={chatgptThink} onChange={onChatgptThinkChange} label={t.think} />;
          }

          return (
            <ProviderCard
              key={p.id}
              id={p.id}
              color={p.color}
              rgb={p.rgb}
              index={i}
              selected={selected}
              onSelect={() => onDefaultProviderChange(p.id)}
              name={meta.name}
              tag={meta.tag}
              defaultLabel={t.default}
              setDefaultLabel={t.setDefault}
              thinkLabel={thinkLabel}
              thinkDesc={thinkDesc}
              thinkActive={thinkActive}
              thinkIcon={thinkIcon}
              thinkControl={thinkControl}
            />
          );
        })}
      </div>

      <p className="mn-foot">{t.note}</p>
    </div>
  );
};
