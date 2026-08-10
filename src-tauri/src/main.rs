
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    #[cfg(target_os = "linux")]
    {

        if std::env::var("GDK_BACKEND").is_err() {
            if let Ok(desktop) = std::env::var("XDG_CURRENT_DESKTOP") {
                if desktop.to_uppercase().contains("KDE") {
                    std::env::set_var("GDK_BACKEND", "x11");
                }
            }
        }


        if std::env::var("WEBKIT_DISABLE_DMABUF_RENDERER").is_err() {
            std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
        }


        gtk::glib::log_set_default_handler(|log_domain, log_level, message| {
            if log_domain == Some("libayatana-appindicator")
                || message.contains("libayatana-appindicator is deprecated")
            {
                return;
            }
            gtk::glib::log_default_handler(log_domain, log_level, Some(message));
        });
    }

    flarevpn_lib::run()
}
