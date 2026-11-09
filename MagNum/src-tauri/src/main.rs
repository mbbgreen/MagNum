
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::net::TcpListener;


fn get_free_port() -> u16 {
    
    TcpListener::bind("127.0.0.1:0")
        .and_then(|listener| listener.local_addr())
        .map(|addr| addr.port())
        .unwrap_or(9222)
}

fn main() {
    let cdp_port = get_free_port();

    
    unsafe {
        
        std::env::set_var("MAGNUM_CDP_PORT", cdp_port.to_string());

        
        std::env::set_var(
            "WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS",
            format!("--remote-debugging-port={}", cdp_port),
        );
    }

    magnum_lib::run()
}
