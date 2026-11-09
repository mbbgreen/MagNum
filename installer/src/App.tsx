import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { 
  Folder, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Minus, 
  Sun, 
  Moon, 
  Globe 
} from 'lucide-react';
import './App.css';

type Lang = 'en' | 'fa';
type Theme = 'dark' | 'light';

const t = {
  en: {
    title: 'Install MagNum',
    subtitle: 'Autonomous Software Engineering Workspace',
    installPath: 'Installation Path:',
    quickInstall: 'Install Now',
    browseTitle: 'Browse folder',
    readyStatus: 'Ready to install',
    extracting: 'Extracting package files...',
    shortcuts: 'Creating system shortcuts...',
    registering: 'Registering in Windows...',
    completed: 'Installation Completed Successfully!',
    launching: 'Launching MagNum...',
    errorTitle: 'Installation Failed',
    retry: 'Retry',
    pleaseWait: 'Please wait a moment...',
    brandTag: 'MAGNUM SETUP',
    footerTag: 'MagNum installer',
    uninstallTitle: 'Uninstall MagNum',
    uninstallSubtitle: 'Are you sure you want to completely remove MagNum?',
    uninstallBtn: 'Uninstall Now',
    uninstallCompleted: 'MagNum was successfully removed.',
  },
  fa: {
    title: 'نصب مگنوم',
    subtitle: 'محیط کار هوشمند مهندسی نرم‌افزار',
    installPath: 'مسیر نصب:',
    quickInstall: 'نصب سریع',
    browseTitle: 'انتخاب پوشه',
    readyStatus: 'آماده برای نصب',
    extracting: 'در حال استخراج فایل‌های برنامه...',
    shortcuts: 'در حال ساخت میانبرها...',
    registering: 'در حال ثبت در ویندوز...',
    completed: 'نصب با موفقیت انجام شد!',
    launching: 'در حال اجرای مگنوم...',
    errorTitle: 'خطا در فرآیند نصب',
    retry: 'تلاش مجدد',
    pleaseWait: 'لطفاً چند لحظه صبر کنید...',
    brandTag: 'نصب مگنوم',
    footerTag: 'نصب کننده مگنوم',
    uninstallTitle: 'حذف مگنوم',
    uninstallSubtitle: 'آیا از حذف کامل نرم‌افزار مگنوم از سیستم خود اطمینان دارید؟',
    uninstallBtn: 'حذف کامل برنامه',
    uninstallCompleted: 'مگنوم با موفقیت از سیستم حذف شد.',
  }
};

export default function InstallerApp() {
  const [mode, setMode] = useState<'install' | 'uninstall'>('install');
  const [lang, setLang] = useState<Lang>('en');
  const [theme, setTheme] = useState<Theme>('dark');
  const [step, setStep] = useState<'ready' | 'installing' | 'finished' | 'error'>('ready');
  const [installPath, setInstallPath] = useState('');
  const [progress, setProgress] = useState(0);
  const [statusKey, setStatusKey] = useState<keyof typeof t['en']>('readyStatus');
  const [errorMsg, setErrorMsg] = useState('');

  const strings = t[lang];

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    // تشخیص خودکار حالت نصب یا حذف
    invoke<string>('get_app_mode').then((m) => {
      if (m === 'uninstall') setMode('uninstall');
    });

    // شنونده درصد حذف
    let unlistenUn: (() => void) | undefined;
    listen<{ percent: number; status: string }>('uninstall_progress', (e) => {
      setProgress(e.payload.percent);
      if (e.payload.percent === 100) setStep('finished');
    }).then((f) => { unlistenUn = f; });

    return () => { unlistenUn?.(); };
  }, []);

  useEffect(() => {
    
    invoke<string>('get_default_install_path').then(setInstallPath).catch(() => {});

    
    let unlistenFn: (() => void) | undefined;
    listen<{ percent: number; status: string }>('install_progress', (event) => {
      const p = event.payload.percent;
      setProgress(p);

      if (p < 80) setStatusKey('extracting');
      else if (p < 95) setStatusKey('shortcuts');
      else if (p < 100) setStatusKey('registering');
      else setStatusKey('completed');
    }).then((f) => { unlistenFn = f; });

    return () => {
      unlistenFn?.();
    };
  }, []);

  const handleChooseFolder = async () => {
    const selected = await invoke<string | null>('choose_directory');
    if (selected) setInstallPath(selected);
  };

  const handleStartInstall = async () => {
    setStep('installing');
    setStatusKey('extracting');
    try {
      await invoke('start_install', { targetDir: installPath });
      setStep('finished');
      setTimeout(() => {
        invoke('launch_installed_app', { targetDir: installPath });
      }, 1500);
    } catch (err: any) {
      setErrorMsg(err?.message || String(err));
      setStep('error');
    }
  };

  const handleStartUninstall = async () => {
    setStep('installing');
    try {
      await invoke('start_uninstall', { targetDir: installPath });
      setStep('finished');
    } catch (err: any) {
      setErrorMsg(err?.message || String(err));
      setStep('error');
    }
  };

  const toggleLang = () => setLang(prev => (prev === 'en' ? 'fa' : 'en'));
  const toggleTheme = () => setTheme(prev => (prev === 'dark' ? 'light' : 'dark'));

  const appWindow = getCurrentWindow();

  return (
    <div className="installer-container" data-tauri-drag-region dir={lang === 'fa' ? 'rtl' : 'ltr'}>
      
      {}
      <div className="titlebar-wrapper" data-tauri-drag-region dir="ltr">
        <div className="brand-indicator">
          <span className="dot" />
          <span>{strings.brandTag}</span>
        </div>

        {}
        <div className="titlebar-controls" dir="ltr">
          <button onClick={toggleTheme} className="tb-btn tb-utility" title="Toggle Theme">
            {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          </button>
          
          <button onClick={toggleLang} className="tb-btn tb-utility lang-toggle" title="Switch Language">
            <Globe size={12} />
            <span>{lang === 'en' ? 'FA' : 'EN'}</span>
          </button>

          <div className="tb-divider" />

          {}
          <button onClick={() => appWindow.minimize()} className="tb-btn" title="Minimize">
            <Minus size={14} />
          </button>
          <button onClick={() => appWindow.close()} className="tb-btn tb-close" title="Close">
            <X size={14} />
          </button>
        </div>
      </div>

      {}
      <div className="installer-card">
        <div className="logo-wrapper">
          <img src="/logo.png" alt="MagNum" className="app-logo" />
        </div>

        <h1 className="app-title">{mode === 'uninstall' ? strings.uninstallTitle : strings.title}</h1>
        <p className="app-subtitle">{mode === 'uninstall' ? strings.uninstallSubtitle : strings.subtitle}</p>

        {step === 'ready' && (
          <div className="content-box">
            <div className="path-selector">
              <span className="path-label">{strings.installPath}</span>
              <div className="path-input-group">
                <input 
                  type="text" 
                  value={installPath} 
                  onChange={(e) => setInstallPath(e.target.value)}
                  dir="ltr"
                />
                <button onClick={handleChooseFolder} title={strings.browseTitle}>
                  <Folder size={15} />
                </button>
              </div>
            </div>

            <div className="actions">
              <button 
                className="primary-btn" 
                onClick={mode === 'uninstall' ? handleStartUninstall : handleStartInstall}
                style={mode === 'uninstall' ? { background: '#ef4444', color: '#fff' } : {}}
              >
                {mode === 'uninstall' ? strings.uninstallBtn : strings.quickInstall}
              </button>
            </div>
          </div>
        )}

        {step === 'installing' && (
          <div className="content-box">
            <div className="progress-status">
              <span>{strings[statusKey]}</span>
              <span dir="ltr" className="code-font">{progress}%</span>
            </div>
            <div className="progress-bar-bg">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }} />
            </div>
            <span className="install-note">{strings.pleaseWait}</span>
          </div>
        )}

        {step === 'finished' && (
          <div className="content-box result-state">
            <CheckCircle2 size={44} color="var(--accent-green)" />
            <span className="result-title">{mode === 'uninstall' ? strings.uninstallCompleted : strings.completed}</span>
            {mode !== 'uninstall' && <span className="result-desc">{strings.launching}</span>}
          </div>
        )}

        {step === 'error' && (
          <div className="content-box result-state">
            <AlertCircle size={44} color="var(--diff-del-text)" />
            <span className="result-title">{strings.errorTitle}</span>
            <span className="error-text selectable-text">{errorMsg}</span>
            <button className="primary-btn" onClick={() => setStep('ready')}>{strings.retry}</button>
          </div>
        )}
      </div>

      <div className="installer-footer">
        <span>Nethers Games &copy; 2026</span>
        <span>{strings.footerTag}</span>
      </div>
    </div>
  );
}
