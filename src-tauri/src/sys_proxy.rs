

#[cfg(target_os = "windows")]
pub fn enable_system_proxy(host: &str, port: u16) -> Result<(), String> {
    use std::process::Command;
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let proxy_str = format!("{}:{}", host, port);

    let _ = Command::new("reg")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "add",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
            "/v",
            "ProxyEnable",
            "/t",
            "REG_DWORD",
            "/d",
            "1",
            "/f",
        ])
        .output();

    let _ = Command::new("reg")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "add",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
            "/v",
            "ProxyServer",
            "/t",
            "REG_SZ",
            "/d",
            &proxy_str,
            "/f",
        ])
        .output();


    #[link(name = "wininet")]
    extern "system" {
        fn InternetSetOptionW(
            h_internet: *mut std::ffi::c_void,
            dw_option: u32,
            lp_buffer: *mut std::ffi::c_void,
            dw_buffer_length: u32,
        ) -> i32;
    }
    unsafe {
        const INTERNET_OPTION_SETTINGS_CHANGED: u32 = 39;
        const INTERNET_OPTION_REFRESH: u32 = 37;
        InternetSetOptionW(std::ptr::null_mut(), INTERNET_OPTION_SETTINGS_CHANGED, std::ptr::null_mut(), 0);
        InternetSetOptionW(std::ptr::null_mut(), INTERNET_OPTION_REFRESH, std::ptr::null_mut(), 0);
    }
    Ok(())
}

#[cfg(target_os = "windows")]
pub fn disable_system_proxy() -> Result<(), String> {
    use std::process::Command;
    use std::os::windows::process::CommandExt;
    const CREATE_NO_WINDOW: u32 = 0x08000000;

    let _ = Command::new("reg")
        .creation_flags(CREATE_NO_WINDOW)
        .args([
            "add",
            "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings",
            "/v",
            "ProxyEnable",
            "/t",
            "REG_DWORD",
            "/d",
            "0",
            "/f",
        ])
        .output();

    #[link(name = "wininet")]
    extern "system" {
        fn InternetSetOptionW(
            h_internet: *mut std::ffi::c_void,
            dw_option: u32,
            lp_buffer: *mut std::ffi::c_void,
            dw_buffer_length: u32,
        ) -> i32;
    }
    unsafe {
        const INTERNET_OPTION_SETTINGS_CHANGED: u32 = 39;
        const INTERNET_OPTION_REFRESH: u32 = 37;
        InternetSetOptionW(std::ptr::null_mut(), INTERNET_OPTION_SETTINGS_CHANGED, std::ptr::null_mut(), 0);
        InternetSetOptionW(std::ptr::null_mut(), INTERNET_OPTION_REFRESH, std::ptr::null_mut(), 0);
    }
    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn enable_system_proxy(host: &str, port: u16) -> Result<(), String> {
    use std::process::Command;
    let port_str = port.to_string();


    let _ = Command::new("gsettings")
        .args(["set", "org.gnome.system.proxy", "mode", "manual"])
        .output();
    let _ = Command::new("gsettings")
        .args(["set", "org.gnome.system.proxy.http", "host", host])
        .output();
    let _ = Command::new("gsettings")
        .args(["set", "org.gnome.system.proxy.http", "port", &port_str])
        .output();
    let _ = Command::new("gsettings")
        .args(["set", "org.gnome.system.proxy.https", "host", host])
        .output();
    let _ = Command::new("gsettings")
        .args(["set", "org.gnome.system.proxy.https", "port", &port_str])
        .output();
    let _ = Command::new("gsettings")
        .args(["set", "org.gnome.system.proxy.socks", "host", host])
        .output();
    let _ = Command::new("gsettings")
        .args(["set", "org.gnome.system.proxy.socks", "port", &port_str])
        .output();


    let proxy_url = format!("http://{}:{}", host, port);
    let _ = Command::new("kwriteconfig5")
        .args(["--file", "kioslaverc", "--group", "Proxy Settings", "--key", "ProxyType", "1"])
        .output();
    let _ = Command::new("kwriteconfig5")
        .args(["--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpProxy", &proxy_url])
        .output();

    let _ = Command::new("kwriteconfig6")
        .args(["--file", "kioslaverc", "--group", "Proxy Settings", "--key", "ProxyType", "1"])
        .output();
    let _ = Command::new("kwriteconfig6")
        .args(["--file", "kioslaverc", "--group", "Proxy Settings", "--key", "httpProxy", &proxy_url])
        .output();

    Ok(())
}

#[cfg(not(target_os = "windows"))]
pub fn disable_system_proxy() -> Result<(), String> {
    use std::process::Command;
    let _ = Command::new("gsettings")
        .args(["set", "org.gnome.system.proxy", "mode", "none"])
        .output();
    let _ = Command::new("kwriteconfig5")
        .args(["--file", "kioslaverc", "--group", "Proxy Settings", "--key", "ProxyType", "0"])
        .output();
    let _ = Command::new("kwriteconfig6")
        .args(["--file", "kioslaverc", "--group", "Proxy Settings", "--key", "ProxyType", "0"])
        .output();
    Ok(())
}
