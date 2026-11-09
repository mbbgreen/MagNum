use std::os::windows::process::CommandExt;
use std::process::{Child, Command};
use std::sync::Mutex;

use tauri::Manager;

const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct AppState {
    pub server: Mutex<Option<Child>>,
    pub job: Mutex<usize>,
}

#[repr(C)]
struct JobObjectBasicLimitInformation {
    per_process_user_time_limit: i64,
    per_job_user_time_limit: i64,
    limit_flags: u32,
    minimum_working_set_size: usize,
    maximum_working_set_size: usize,
    active_process_limit: u32,
    affinity: usize,
    priority_class: u32,
    scheduling_class: u32,
}

#[repr(C)]
struct IoCounters {
    read_operation_count: u64,
    write_operation_count: u64,
    other_operation_count: u64,
    read_transfer_count: u64,
    write_transfer_count: u64,
    other_transfer_count: u64,
}

#[repr(C)]
struct JobObjectExtendedLimitInformation {
    basic: JobObjectBasicLimitInformation,
    io_info: IoCounters,
    process_memory_limit: usize,
    job_memory_limit: usize,
    peak_process_memory_used: usize,
    peak_job_memory_used: usize,
}

unsafe extern "system" {
    fn CreateJobObjectW(sa: *mut std::ffi::c_void, name: *const u16) -> *mut std::ffi::c_void;
    fn SetInformationJobObject(
        job: *mut std::ffi::c_void,
        info_class: i32,
        info: *mut std::ffi::c_void,
        info_len: u32,
    ) -> i32;
    fn OpenProcess(access: u32, inherit: i32, pid: u32) -> *mut std::ffi::c_void;
    fn AssignProcessToJobObject(job: *mut std::ffi::c_void, process: *mut std::ffi::c_void) -> i32;
    fn CloseHandle(h: *mut std::ffi::c_void) -> i32;
}

const JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE: u32 = 0x2000;
const JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS: i32 = 9;
const PROCESS_ALL_ACCESS: u32 = 0x001F0FFF;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

#[tauri::command]
fn open_url(app: tauri::AppHandle, url: String) -> Result<(), String> {
    
    if !(url.starts_with("https://") || url.starts_with("http://")) {
        return Err("invalid url".into());
    }
    
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url(url, None::<&str>)
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn set_app_theme(window: tauri::Window, theme: String) -> Result<(), String> {
    match theme.as_str() {
        "light" => window.set_theme(Some(tauri::Theme::Light)).map_err(|e| e.to_string()),
        "dark" => window.set_theme(Some(tauri::Theme::Dark)).map_err(|e| e.to_string()),
        _ => window.set_theme(None).map_err(|e| e.to_string()),
    }
}



#[tauri::command]
fn read_ws_token(app_handle: tauri::AppHandle) -> Result<String, String> {
    
    let data_dir = app_handle
        .path()
        .app_data_dir()
        .or_else(|_| {
            if cfg!(target_os = "windows") {
                std::env::var("APPDATA")
                    .map(|appdata| std::path::PathBuf::from(appdata).join("MagNum"))
                    .map_err(|e| e.to_string())
            } else {
                std::env::var("HOME")
                    .map(|home| std::path::PathBuf::from(home).join(".magnum"))
                    .map_err(|e| e.to_string())
            }
        })
        .map_err(|e| format!("Failed to resolve data dir: {}", e))?;

    let token_file = data_dir.join(".ws-token");

    
    if !token_file.exists() {
        return Err(format!("Token file not found: {:?}", token_file));
    }

    
    let token = std::fs::read_to_string(&token_file)
        .map_err(|e| format!("Failed to read token file: {}", e))?;

    let trimmed = token.trim().to_string();

    
    if trimmed.len() != 64 || !trimmed.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err("Invalid token format".to_string());
    }

    Ok(trimmed)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        
        .plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.unminimize();
                let _ = window.set_focus();
            }
        }))
        .plugin(tauri_plugin_opener::init())
 .plugin(tauri_plugin_updater::Builder::new().build())
 .plugin(tauri_plugin_process::init())
        .manage(AppState {
            server: Mutex::new(None),
            job: Mutex::new(0),
        })
        .setup(|app| {
            let resource_dir = app.path().resource_dir().expect("resource dir");
            let backend_dir = resource_dir.join("backend");

            let data_dir = app.path().app_data_dir().expect("app data dir");
            std::fs::create_dir_all(&data_dir).expect("create data dir");

            
            let job_handle = unsafe { CreateJobObjectW(std::ptr::null_mut(), std::ptr::null()) };
            if !job_handle.is_null() {
                let mut info: JobObjectExtendedLimitInformation = unsafe { std::mem::zeroed() };
                info.basic.limit_flags = JOB_OBJECT_LIMIT_KILL_ON_JOB_CLOSE;
                unsafe {
                    SetInformationJobObject(
                        job_handle,
                        JOB_OBJECT_EXTENDED_LIMIT_INFORMATION_CLASS,
                        &mut info as *mut _ as *mut std::ffi::c_void,
                        std::mem::size_of::<JobObjectExtendedLimitInformation>() as u32,
                    );
                }
            }
            let state = app.state::<AppState>();
            *state.job.lock().unwrap() = job_handle as usize;

            let node_exe = backend_dir.join("node.exe");
            let cdp_port = std::env::var("MAGNUM_CDP_PORT").unwrap_or_else(|_| "9222".into());
            let child = Command::new(&node_exe)
                .arg("server.js")
                .current_dir(&backend_dir)
                .env("MAGNUM_DATA_DIR", &data_dir)
                .env("MAGNUM_CDP_PORT", &cdp_port)
                .creation_flags(CREATE_NO_WINDOW)
                .spawn()
                .expect("failed to spawn node server");

            
            if !job_handle.is_null() {
                let pid = child.id();
                let proc_handle = unsafe { OpenProcess(PROCESS_ALL_ACCESS, 0, pid) };
                if !proc_handle.is_null() {
                    unsafe { AssignProcessToJobObject(job_handle, proc_handle) };
                    unsafe { CloseHandle(proc_handle) };
                }
            }

            *state.server.lock().unwrap() = Some(child);
            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::Destroyed = event {
                let state = window.state::<AppState>();
                let pid = {
                    let mut guard = state.server.lock().unwrap();
                    if let Some(child) = guard.as_mut() {
                        let p = child.id();
                        let _ = child.kill();
                        Some(p)
                    } else {
                        None
                    }
                };
                if let Some(p) = pid {
                    let _ = std::process::Command::new("taskkill")
                        .args(["/PID", &p.to_string(), "/T", "/F"])
                        .creation_flags(CREATE_NO_WINDOW)
                        .spawn();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![greet, set_app_theme, open_url, read_ws_token])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
