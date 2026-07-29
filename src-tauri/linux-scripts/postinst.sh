#!/bin/sh
set -e

# Set capabilities for the sing-box core so it can create TUN interfaces
# and route traffic without requiring the user to run the app via sudo.

# Tauri installs external binaries (sidecars) to /usr/lib/<productName>/
# Iterate over any file starting with sing-box in that directory
for file in /usr/lib/flarevpn/sing-box*; do
    if [ -f "$file" ]; then
        setcap 'cap_net_admin,cap_net_raw+ep' "$file" || true
    fi
done

# Also set capabilities on the main application binary just in case
if [ -f "/usr/bin/flarevpn" ]; then
    setcap 'cap_net_admin,cap_net_raw+ep' "/usr/bin/flarevpn" || true
fi

exit 0
