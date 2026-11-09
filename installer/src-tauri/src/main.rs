#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::fs::{self, File};
use std::io::Cursor;
use std::os::windows::process::CommandExt;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::{AppHandle, Emitter};
use winreg::enums::*;
use winreg::RegKey;

const CREATE_NO_WINDOW: u32 = 0x08000000;

const APP_BUNDLE_ZIP: &[u8] = include_bytes!("../../../target/release/app_payload.zip");

#[derive(Clone, serde::Serialize)]
struct ProgressPayload {
    percent: u32,
    status: String,
}

fn kill_running_processes() {
    let _ = Command::new("taskkill")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/IM", "magnum.exe", "/F", "/T"])
        .output();
    let _ = Command::new("taskkill")
        .creation_flags(CREATE_NO_WINDOW)
        .args(["/IM", "node.exe", "/F", "/T"])
        .output();
    std::thread::sleep(std::time::Duration::from_millis(500));
}

#[tauri::command]
fn get_default_install_path() -> Result<String, String> {
    
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(key) = hkcu.open_subkey("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\MagNum") {
        if let Ok(loc) = key.get_value::<String, _>("InstallLocation") {
            if !loc.trim().is_empty() {
                return Ok(loc);
            }
        }
    }

    let local_app_data = std::env::var("LOCALAPPDATA")
        .map_err(|e| format!("Could not get LOCALAPPDATA: {}", e))?;
    let path = PathBuf::from(local_app_data).join("Programs").join("MagNum");
    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
async fn choose_directory() -> Result<Option<String>, String> {
    use rfd::AsyncFileDialog;
    let folder = AsyncFileDialog::new().pick_folder().await;
    Ok(folder.map(|f| f.path().to_string_lossy().to_string()))
}

fn extract_payload(target_path: &Path, app: Option<&AppHandle>) -> Result<(), String> {
    fs::create_dir_all(target_path).map_err(|e| format!("Failed to create install dir: {}", e))?;

    let cursor = Cursor::new(APP_BUNDLE_ZIP);
    let mut archive = zip::ZipArchive::new(cursor).map_err(|e| format!("Invalid zip archive: {}", e))?;
    let total_files = archive.len();

    for i in 0..total_files {
        let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
        
        let outpath = match file.enclosed_name() {
            Some(path) => target_path.join(path),
            None => continue,
        };

        let is_directory = file.is_dir() 
            || file.name().ends_with('/') 
            || file.name().ends_with('\\');

        if is_directory {
            fs::create_dir_all(&outpath).map_err(|e| e.to_string())?;
        } else {
            if let Some(p) = outpath.parent() {
                if !p.exists() {
                    fs::create_dir_all(p).map_err(|e| e.to_string())?;
                }
            }
            
            if outpath.is_dir() {
                continue;
            }

            let mut outfile = File::create(&outpath).map_err(|e| format!("Error creating file {:?}: {}", outpath, e))?;
            std::io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
        }

        if let Some(app_handle) = app {
            let percent = 15 + ((i as f32 / total_files as f32) * 65.0) as u32;
            if i % 10 == 0 || i == total_files - 1 {
                app_handle.emit(
                    "install_progress",
                    ProgressPayload {
                        percent,
                        status: format!("در حال کپی: {}", file.name()),
                    },
                ).ok();
            }
        }
    }

    Ok(())
}

#[tauri::command]
async fn start_install(app: AppHandle, target_dir: String) -> Result<(), String> {
    let target_path = PathBuf::from(&target_dir);

    
    kill_running_processes();

    app.emit(
        "install_progress",
        ProgressPayload {
            percent: 15,
            status: "در حال استخراج فایل‌های برنامه...".into(),
        },
    )
    .ok();

    extract_payload(&target_path, Some(&app))?;

    // ساخت فایل uninstall.exe در پوشه برنامه
    if let Ok(cur) = std::env::current_exe() {
        let _ = fs::copy(&cur, target_path.join("uninstall.exe"));
    }

    
    app.emit(
        "install_progress",
        ProgressPayload {
            percent: 85,
            status: "در حال ایجاد میانبرها...".into(),
        },
    )
    .ok();

    let exe_path = target_path.join("magnum.exe");
    create_shortcuts(&exe_path)?;

    
    app.emit(
        "install_progress",
        ProgressPayload {
            percent: 95,
            status: "در حال ثبت در ویندوز...".into(),
        },
    )
    .ok();

    register_uninstall(&target_path, &exe_path)?;

    app.emit(
        "install_progress",
        ProgressPayload {
            percent: 100,
            status: "نصب با موفقیت انجام شد".into(),
        },
    )
    .ok();

    Ok(())
}

fn create_shortcuts(exe_path: &Path) -> Result<(), String> {
    let desktop_dir = dirs::desktop_dir().ok_or("Cannot find Desktop")?;
    let start_menu_dir = dirs::data_dir()
        .map(|p| {
            p.join("Microsoft")
                .join("Windows")
                .join("Start Menu")
                .join("Programs")
        })
        .ok_or("Cannot find Start Menu")?;

    let desktop_lnk = desktop_dir.join("MagNum.lnk");
    let start_menu_lnk = start_menu_dir.join("MagNum.lnk");
    let work_dir = exe_path.parent().unwrap_or(Path::new("."));

    let create_lnk = |lnk_path: &Path| {
        let script = format!(
            "$WshShell = New-Object -ComObject WScript.Shell; $Shortcut = $WshShell.CreateShortcut('{}'); $Shortcut.TargetPath = '{}'; $Shortcut.WorkingDirectory = '{}'; $Shortcut.IconLocation = '{}'; $Shortcut.Save()",
            lnk_path.to_string_lossy(),
            exe_path.to_string_lossy(),
            work_dir.to_string_lossy(),
            exe_path.to_string_lossy()
        );
        let _ = Command::new("powershell")
            .creation_flags(CREATE_NO_WINDOW)
            .args(["-NoProfile", "-NonInteractive", "-WindowStyle", "Hidden", "-Command", &script])
            .output();
    };

    create_lnk(&desktop_lnk);
    create_lnk(&start_menu_lnk);
    Ok(())
}

fn register_uninstall(install_dir: &Path, exe_path: &Path) -> Result<(), String> {
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    let path = Path::new("Software")
        .join("Microsoft")
        .join("Windows")
        .join("CurrentVersion")
        .join("Uninstall")
        .join("MagNum");

    let (key, _) = hkcu.create_subkey(&path).map_err(|e| e.to_string())?;

    let version = env!("CARGO_PKG_VERSION");
    key.set_value("DisplayName", &"MagNum").map_err(|e| e.to_string())?;
    key.set_value("DisplayVersion", &version).map_err(|e| e.to_string())?;
    key.set_value("Publisher", &"Nethers Games").map_err(|e| e.to_string())?;
    key.set_value("DisplayIcon", &exe_path.to_string_lossy().as_ref()).map_err(|e| e.to_string())?;
    key.set_value("InstallLocation", &install_dir.to_string_lossy().as_ref()).map_err(|e| e.to_string())?;
    key.set_value("NoModify", &1u32).ok();
    key.set_value("NoRepair", &1u32).ok();

    // جایگزین خط قدیمی UninstallString
    let uninstaller_exe = install_dir.join("uninstall.exe");
    key.set_value("UninstallString", &format!("\"{}\"", uninstaller_exe.to_string_lossy())).ok();
    key.set_value("QuietUninstallString", &format!("\"{}\" /S", uninstaller_exe.to_string_lossy())).ok();

    Ok(())
}

#[tauri::command]
fn launch_installed_app(target_dir: String) {
    let exe = PathBuf::from(target_dir).join("magnum.exe");
    if exe.exists() {
        let _ = Command::new(&exe)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }
    std::process::exit(0);
}

fn handle_silent_mode(args: &[String]) -> bool {
    let is_silent = args.iter().any(|arg| {
        let a = arg.to_uppercase();
        a == "/S" || a == "-S" || a == "/SILENT" || a == "--SILENT" || a == "/QUIET" || a == "/P" || a == "/PASSIVE"
    });

    if !is_silent {
        return false;
    }

    
    let mut target_dir = None;
    for arg in args {
        if arg.starts_with("/D=") || arg.starts_with("/d=") {
            target_dir = Some(arg[3..].trim_matches('"').to_string());
        } else if arg.starts_with("--dir=") {
            target_dir = Some(arg[6..].trim_matches('"').to_string());
        }
    }

    let target_path_str = target_dir.unwrap_or_else(|| {
        get_default_install_path().unwrap_or_else(|_| {
            let local = std::env::var("LOCALAPPDATA").unwrap_or_else(|_| "C:\\".into());
            PathBuf::from(local).join("Programs").join("MagNum").to_string_lossy().to_string()
        })
    });

    let target_path = PathBuf::from(&target_path_str);

    
    kill_running_processes();

    
    if let Err(e) = extract_payload(&target_path, None) {
        eprintln!("Silent extraction failed: {}", e);
        std::process::exit(1);
    }

    let exe_path = target_path.join("magnum.exe");
    let _ = create_shortcuts(&exe_path);
    let _ = register_uninstall(&target_path, &exe_path);

    
    let no_launch = args.iter().any(|a| a == "--no-launch");
    if !no_launch && exe_path.exists() {
        let _ = Command::new(&exe_path)
            .creation_flags(CREATE_NO_WINDOW)
            .spawn();
    }

    std::process::exit(0);
}

#[tauri::command]
fn get_app_mode() -> String {
    let args: Vec<String> = std::env::args().collect();
    let is_un = std::env::current_exe().map(|e| e.to_string_lossy().to_lowercase().contains("uninstall")).unwrap_or(false)
        || args.iter().any(|a| a.to_uppercase() == "--UNINSTALL" || a.to_uppercase() == "/U");
    if is_un { "uninstall".into() } else { "install".into() }
}

#[tauri::command]
async fn start_uninstall(app: AppHandle, target_dir: String) -> Result<(), String> {
    let target_path = PathBuf::from(&target_dir);
    kill_running_processes();

    // پاکسازی میانبرها
    if let Some(d) = dirs::desktop_dir() { let _ = fs::remove_file(d.join("MagNum.lnk")); }
    if let Some(d) = dirs::data_dir() { let _ = fs::remove_file(d.join("Microsoft\\Windows\\Start Menu\\Programs\\MagNum.lnk")); }

    // پاکسازی رجیستری
    let hkcu = RegKey::predef(HKEY_CURRENT_USER);
    if let Ok(k) = hkcu.open_subkey_with_flags("Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall", KEY_WRITE) {
        let _ = k.delete_subkey_all("MagNum");
    }

    // پاکسازی فایل‌ها
    if target_path.exists() {
        for _ in 0..5 {
            if fs::remove_dir_all(&target_path).is_ok() { break; }
            std::thread::sleep(std::time::Duration::from_millis(300));
        }
    }
    app.emit("uninstall_progress", ProgressPayload { percent: 100, status: "حذف شد".into() }).ok();
    Ok(())
}

// برای اینکه uninstall.exe روی خودش قفل نکند و از Temp اجرا شود
fn ensure_run_from_temp(args: &[String]) {
    if get_app_mode() != "uninstall" { return; }
    if let Ok(cur) = std::env::current_exe() {
        let temp = std::env::temp_dir();
        if !cur.starts_with(&temp) {
            let temp_exe = temp.join("magnum_uninstaller_worker.exe");
            let _ = fs::copy(&cur, &temp_exe);
            let mut cmd = Command::new(&temp_exe);
            cmd.arg("--uninstall");
            for a in args.iter().skip(1) { cmd.arg(a); }
            let _ = cmd.spawn();
            std::process::exit(0);
        }
    }
}

fn main() {
    let args: Vec<String> = std::env::args().collect();
    ensure_run_from_temp(&args);
    if args.len() > 1 && handle_silent_mode(&args) {
        return;
    }

    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![
            get_default_install_path,
            choose_directory,
            start_install,
            get_app_mode,
            start_uninstall,
            launch_installed_app
        ])
        .run(tauri::generate_context!())
        .expect("error while running installer");
}