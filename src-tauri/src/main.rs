// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {
        // Fix for WebKitGTK 2.42+ surfaceless EGL display allocation failure (EGL_BAD_ALLOC) and AppImage sandbox
        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }
        if std::env::var("WEBKIT_FORCE_SANDBOX").is_err() {
            std::env::set_var("WEBKIT_FORCE_SANDBOX", "0");
        }
    }

    flarevpn_lib::run()
}
