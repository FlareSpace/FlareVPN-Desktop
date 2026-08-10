#!/bin/sh
set -e


for file in /usr/bin/sing-box* /usr/bin/flarevpn* /usr/lib/flare*/sing-box* /usr/lib/com.flare.vpn/sing-box*; do
    if [ -f "$file" ]; then
        chown root:root "$file" || true
        chmod 4755 "$file" || true
        setcap 'cap_net_admin,cap_net_raw+ep' "$file" || true
    fi
done


if [ -d "/etc/polkit-1/rules.d" ]; then
    cat << 'EOF' > /etc/polkit-1/rules.d/10-flarevpn-resolved.rules
polkit.addRule(function(action, subject) {
    if ((action.id == "org.freedesktop.resolve1.set-link-dns" ||
         action.id == "org.freedesktop.resolve1.set-link-domains" ||
         action.id == "org.freedesktop.resolve1.set-link-default-route" ||
         action.id == "org.freedesktop.resolve1.set-link-llmnr" ||
         action.id == "org.freedesktop.resolve1.set-link-mdns" ||
         action.id == "org.freedesktop.resolve1.set-link-dnsovertls") &&
        subject.local && subject.active) {
        return polkit.Result.YES;
    }
});
EOF
    chmod 644 /etc/polkit-1/rules.d/10-flarevpn-resolved.rules || true
fi

exit 0
