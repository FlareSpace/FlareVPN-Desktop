#!/bin/sh
set -e


for file in /usr/bin/sing-box* /usr/bin/flarevpn* /usr/lib/flare*/sing-box* /usr/lib/com.flare.vpn/sing-box*; do
    if [ -f "$file" ]; then
        chmod +x "$file" || true
    fi
done


for file in /usr/bin/sing-box* /usr/bin/flarevpn* /usr/lib/flare*/sing-box* /usr/lib/com.flare.vpn/sing-box*; do
    if [ -f "$file" ]; then
        setcap 'cap_net_admin,cap_net_raw+ep' "$file" || true
    fi
done

exit 0

