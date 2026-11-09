import React, { useState } from 'react';
import { 
  ArrowLeft, 
  Search, 
  Settings as GeneralIcon, 
  Palette, 
  Cpu, 
  Globe, 
  Code, 
  BookOpen, 
  Check,
  ExternalLink,
  Bot
} from 'lucide-react';
import { Language, translations } from '../../i18n/translations';
import { alertDialog } from '../modals/AppDialog';

interface SettingsViewProps {
  provider?: 'deepseek' | 'gemini';
  geminiThinking?: 'low' | 'medium' | 'high';
  onGeminiThinkingChange?: (level: 'low' | 'medium' | 'high') => void;
  currentLang: Language;
  onLanguageChange: (lang: Language) => void;
currentTheme: 'dark' | 'light';
onThemeChange: (theme: 'dark' | 'light') => void;
  isDeepThink: boolean;
  onToggleDeepThink: () => void;
  autoApplyPatch: boolean;
  onToggleAutoPatch: () => void;
  requireCommandApproval: boolean;
  onToggleCommandApproval: () => void;
  onClose: () => void;
  onRunDiagnostic: () => void;
  diagnosticResult?: any;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  provider,
  geminiThinking,
  onGeminiThinkingChange,
  currentLang,
  onLanguageChange,
  currentTheme,
  onThemeChange,
  isDeepThink,
  onToggleDeepThink,
  autoApplyPatch,
  onToggleAutoPatch,
  requireCommandApproval,
  onToggleCommandApproval,
  onClose,
  onRunDiagnostic,
  diagnosticResult
}) => {
  const [activeCategory, setActiveCategory] = useState<'browser' | 'general' | 'appearance' | 'models' | 'agents'>('browser');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [browserProtection, setBrowserProtection] = useState(false);
  const [openLocalhost, setOpenLocalhost] = useState(true);
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);
  const [httpMode, setHttpMode] = useState('HTTP/2');

  const t = translations[currentLang];

  return (
    <div style={{
      display: 'flex',
      height: '100%',
      width: '100%',
      background: 'var(--bg-primary)',
      color: 'var(--text-main)',
      overflow: 'hidden'
    }}>
      
      <aside style={{
        width: '260px',
        minWidth: '260px',
        borderRight: '1px solid var(--border-subtle)',
        background: 'var(--bg-topbar)',
        display: 'flex',
        flexDirection: 'column',
        padding: '12px 10px',
        gap: '12px'
      }}>
        <button
          onClick={onClose}
          style={{
            background: 'transparent',
            border: 'none',
            color: 'var(--text-main)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            padding: '6px 8px',
            borderRadius: '6px'
          }}
          className="hover-bright"
        >
          <ArrowLeft size={14} />
          <span>{t.back}</span>
        </button>

        <div style={{
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border-subtle)',
          borderRadius: '8px',
          padding: '6px 10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <Search size={13} color="var(--text-dim)" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={t.searchSettings}
            style={{
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-main)',
              fontSize: '12px',
              width: '100%'
            }}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', flex: 1, overflowY: 'auto' }}>
          
          <div 
            onClick={() => setActiveCategory('general')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeCategory === 'general' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeCategory === 'general' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <GeneralIcon size={14} />
            <span>{t.general}</span>
          </div>

          <div 
            onClick={() => setActiveCategory('appearance')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeCategory === 'appearance' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeCategory === 'appearance' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <Palette size={14} />
            <span>{t.appearance}</span>
          </div>

          <div 
            onClick={() => setActiveCategory('models')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeCategory === 'models' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeCategory === 'models' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <Cpu size={14} />
            <span>{t.models}</span>
          </div>

          <div
            onClick={() => setActiveCategory('agents')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeCategory === 'agents' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeCategory === 'agents' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <Bot size={14} />
            <span>{t.agents}</span>
          </div>

          <div 
            onClick={() => setActiveCategory('browser')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              cursor: 'pointer',
              background: activeCategory === 'browser' ? 'rgba(255,255,255,0.08)' : 'transparent',
              color: activeCategory === 'browser' ? 'var(--text-main)' : 'var(--text-muted)'
            }}
          >
            <Globe size={14} />
            <span>{t.browserNetwork}</span>
          </div>

          <div 
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '8px 10px',
              borderRadius: '6px',
              color: 'var(--text-dim)',
              fontSize: '12px'
            }}
          >
            <Code size={14} />
            <span>{t.codeIntelligence}</span>
          </div>

          <div 
            onClick={() => alertDialog({ title: 'Docs', message: 'MagNum Agent Docs v1.0.0' })}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '8px 10px',
              borderRadius: '6px',
              color: 'var(--text-dim)',
              fontSize: '12px',
              cursor: 'pointer'
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <BookOpen size={14} />
              <span>{t.docs}</span>
            </div>
            <ExternalLink size={11} />
          </div>

        </div>

        <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.2)', color: 'var(--accent-green)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 800 }}>
            MG
          </div>
          <span style={{ fontSize: '12px', fontWeight: 600 }}>MBB GREEN</span>
        </div>
      </aside>

      <main style={{
        flex: 1,
        overflowY: 'auto',
        padding: '30px 48px',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
        maxWidth: '850px'
      }}>
        
        {activeCategory === 'browser' && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{t.browserNetwork}</h2>

            {diagnosticResult && (
              <div style={{ padding: '10px 14px', borderRadius: 8, border: `1px solid ${diagnosticResult.ok ? 'rgba(16,185,129,0.4)' : 'rgba(239,68,68,0.4)'}`, background: diagnosticResult.ok ? 'var(--accent-green-dim)' : 'var(--diff-del)', color: diagnosticResult.ok ? 'var(--diff-add-text)' : 'var(--diff-del-text)', fontSize: 12 }}>
                <b>[{diagnosticResult.status}]</b> {diagnosticResult.message}
              </div>
            )}

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.browserAutomation}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.browserAutomationDesc}</div>
                </div>
                <div style={{ background: 'rgba(255,255,255,0.06)', padding: '4px 10px', borderRadius: '6px', fontSize: '12px', border: '1px solid var(--border-subtle)' }}>
                  Stealth Browser Tab ▾
                </div>
              </div>

              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.browserProtection}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.browserProtectionDesc}</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={browserProtection} 
                  onChange={(e) => setBrowserProtection(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-green)', cursor: 'pointer' }} 
                />
              </div>

              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.openLocalLinks}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.openLocalLinksDesc}</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={openLocalhost} 
                  onChange={(e) => setOpenLocalhost(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-green)', cursor: 'pointer' }} 
                />
              </div>

              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.openWebLinks}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.openWebLinksDesc}</div>
                </div>
                <input 
                  type="checkbox" 
                  checked={webSearchEnabled} 
                  onChange={(e) => setWebSearchEnabled(e.target.checked)}
                  style={{ width: '16px', height: '16px', accentColor: 'var(--accent-green)', cursor: 'pointer' }} 
                />
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-dim)', fontWeight: 600, marginBottom: '8px' }}>{t.network}</div>
              
              <div style={{
background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '10px',
                overflow: 'hidden'
              }}>
                <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.httpMode}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.httpModeDesc}</div>
                  </div>
                  <select 
                    value={httpMode}
                    onChange={(e) => setHttpMode(e.target.value)}
                    style={{ background: 'rgba(255,255,255,0.06)', color: 'var(--text-main)', border: '1px solid var(--border-subtle)', borderRadius: '6px', padding: '4px 8px', fontSize: '12px', outline: 'none' }}
                  >
                    <option value="HTTP/2">HTTP/2</option>
                    <option value="HTTP/1.1">HTTP/1.1</option>
                  </select>
                </div>

                <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.runDiagnostic}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.diagnosticDesc}</div>
                  </div>
                  <button
                    onClick={onRunDiagnostic}
                    style={{
                      background: 'rgba(255,255,255,0.08)',
                      border: '1px solid var(--border-subtle)',
                      color: 'var(--text-main)',
                      padding: '6px 14px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer'
                    }}
                    className="hover-bright"
                  >
                    Run Diagnostic
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

        {activeCategory === 'general' && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{t.general}</h2>

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              overflow: 'hidden'
            }}>
              <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)' }}>
                <div style={{ maxWidth: '480px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.languageSetting}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '4px', lineHeight: '1.5' }}>
                    {t.languageSettingDesc}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button
                    onClick={() => onLanguageChange('en')}
                    style={{
                      background: currentLang === 'en' ? 'var(--accent-green)' : 'rgba(255,255,255,0.06)',
                      color: currentLang === 'en' ? 'var(--on-accent)' : 'var(--text-main)',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    English
                  </button>
                  <button
                    onClick={() => onLanguageChange('fa')}
                    style={{
                      background: currentLang === 'fa' ? 'var(--accent-green)' : 'rgba(255,255,255,0.06)',
                      color: currentLang === 'fa' ? 'var(--on-accent)' : 'var(--text-main)',
                      fontWeight: 600,
                      border: 'none',
                      borderRadius: '6px',
                      padding: '6px 14px',
                      fontSize: '12px',
                      cursor: 'pointer'
                    }}
                  >
                    فارسی
                  </button>
                </div>
              </div>
            </div>
          </>
        )}

{activeCategory === 'agents' && (
  <>
    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{t.agents}</h2>
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', overflow: 'hidden' }}>
      <div style={{ padding: '16px', borderBottom: '1px solid var(--border-subtle)' }}>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{t.agentsDesc}</div>
      </div>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.autoPatchSetting}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.autoPatchDesc}</div>
        </div>
        <input
          type="checkbox"
          checked={autoApplyPatch}
          onChange={onToggleAutoPatch}
          style={{ width: '16px', height: '16px', accentColor: 'var(--accent-green)', cursor: 'pointer' }}
        />
      </div>
      <div style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)' }}>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.autoRunSetting}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.autoRunDesc}</div>
        </div>
        <input
          type="checkbox"
          checked={!requireCommandApproval}
          onChange={onToggleCommandApproval}
          style={{ width: '16px', height: '16px', accentColor: 'var(--accent-green)', cursor: 'pointer' }}
        />
      </div>
      <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', fontSize: '11.5px', color: 'var(--text-dim)', lineHeight: 1.7 }}>
        {t.agentsScopeNote}
      </div>
    </div>
  </>
)}

{activeCategory === 'appearance' && (
  <>
    <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{t.appearance}</h2>
    <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', borderRadius: '10px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div>
        <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.themeSetting}</div>
        <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.themeSettingDesc}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px' }}>
        <div onClick={() => onThemeChange('dark')} style={{ padding: '12px', borderRadius: '10px', border: currentTheme === 'dark' ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)', background: '#0a0b0e', cursor: 'pointer' }}>
          <div style={{ height: '56px', background: '#14171d', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.08)', borderLeft: '3px solid #10b981', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '6px' }}>
            <span style={{ width: '60%', height: '8px', borderRadius: '4px', background: 'rgba(255,255,255,0.12)' }} />
            <span style={{ width: '20%', height: '8px', borderRadius: '4px', background: 'rgba(16,185,129,0.5)' }} />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#f3f4f6' }}>Dark Emerald</div>
          <div style={{ fontSize: '10.5px', color: '#9ca3af', marginTop: '2px' }}>Deep OLED-friendly workspace</div>
        </div>
        <div onClick={() => onThemeChange('light')} style={{ padding: '12px', borderRadius: '10px', border: currentTheme === 'light' ? '2px solid var(--accent-green)' : '1px solid var(--border-subtle)', background: '#ffffff', cursor: 'pointer' }}>
          <div style={{ height: '56px', background: '#f1f5f3', borderRadius: '6px', border: '1px solid rgba(15,23,20,0.1)', borderLeft: '3px solid #059669', marginBottom: '8px', display: 'flex', alignItems: 'center', padding: '0 10px', gap: '6px' }}>
            <span style={{ width: '60%', height: '8px', borderRadius: '4px', background: 'rgba(15,23,20,0.12)' }} />
            <span style={{ width: '20%', height: '8px', borderRadius: '4px', background: 'rgba(5,150,105,0.45)' }} />
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: '#111827' }}>White Emerald</div>
          <div style={{ fontSize: '10.5px', color: '#4b5563', marginTop: '2px' }}>Clean daylight studio palette</div>
        </div>
      </div>
    </div>
  </>
)}

        {activeCategory === 'models' && (
          <>
            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>{t.models}</h2>

            <div style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '10px',
              padding: '16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px'
            }}>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600 }}>{t.activeModels}</div>
                <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{t.activeModelsDesc}</div>
              </div>

              <div style={{
                padding: '14px',
                background: 'rgba(16, 185, 129, 0.05)',
                border: '1px solid rgba(16, 185, 129, 0.3)',
                borderRadius: '8px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--accent-green)' }}>DeepSeek 4.1 Flash</span>
                    <span style={{ background: 'var(--accent-green)', color: 'var(--on-accent)', fontSize: '9px', fontWeight: 800, padding: '2px 6px', borderRadius: '4px' }}>DEFAULT</span>
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Ultra-low latency autonomous code engineering & fast tool calling.
                  </div>
                </div>
                <Check size={16} color="var(--accent-green)" />
              </div>

              {provider !== 'gemini' ? (
                <div style={{
                  padding: '14px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: '8px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>DeepThink (Reasoning Mode)</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Deep reasoning & complex chain-of-thought analysis, powered by DeepSeek 4.1 Flash.
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={isDeepThink} 
                    onChange={onToggleDeepThink}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-green)', cursor: 'pointer' }} 
                  />
                </div>
              ) : (
                <div style={{ padding: '14px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-subtle)', borderRadius: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 700 }}>{t.thinkingLevelSetting}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t.thinkingLevelDesc}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {(['low', 'medium', 'high'] as const).map(lv => (
                      <button key={lv} onClick={() => onGeminiThinkingChange && onGeminiThinkingChange(lv)}
                        style={{
                          background: (geminiThinking || 'medium') === lv ? 'var(--accent-green)' : 'rgba(255,255,255,0.06)',
                          color: (geminiThinking || 'medium') === lv ? 'var(--on-accent)' : 'var(--text-main)',
                          fontWeight: 600, border: 'none', borderRadius: 6, padding: '6px 12px',
                          fontSize: 12, cursor: 'pointer', textTransform: 'capitalize'
                        }}>
                        {lv}
                      </button>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </>
        )}

      </main>
    </div>
  );
};
