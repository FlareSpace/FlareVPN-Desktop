#!/bin/sh
set -e






for file in /usr/lib/flarevpn/sing-box*; do
    if [ -f "$file" ]; then
        setcap 'cap_net_admin,cap_net_raw+ep' "$file" || true
    fi
done


if [ -f "/usr/bin/flarevpn" ]; then
    setcap 'cap_net_admin,cap_net_raw+ep' "/usr/bin/flarevpn" || true
fi

exit 0
