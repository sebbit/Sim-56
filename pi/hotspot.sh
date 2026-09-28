#!/usr/bin/env bash
# Show mode: Wi-Fi becomes a hotspot with captive portal (phones land on the modem simulator).
# While it is on, the Pi leaves your home Wi-Fi; SSH stays available over USB.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Please run with sudo."; exit 1; }
case "${1:-status}" in
  on)
    nmcli con up zm-hotspot
    nft -f - <<'NFT'
table ip zm_hotspot
delete table ip zm_hotspot
table ip zm_hotspot {
  chain pre { type nat hook prerouting priority dstnat; iifname "wlan0" tcp dport 80 redirect to :8056; }
  chain in  { type filter hook input priority filter; iifname "wlan0" tcp dport 22 drop; }
}
NFT
    echo "Hotspot is on: $(nmcli -g 802-11-wireless.ssid con show zm-hotspot)"
    echo "Guests: web http://10.42.0.1 (captive portal), telnet 10.42.0.1 2323. SSH only via USB." ;;
  off)
    nft delete table ip zm_hotspot 2>/dev/null || true
    nmcli con down zm-hotspot 2>/dev/null || true
    nmcli device connect wlan0 >/dev/null 2>&1 || true     # back to the home Wi-Fi profile
    echo "Hotspot is off." ;;
  status)
    nmcli -t -f NAME,DEVICE con show --active
    nft list table ip zm_hotspot >/dev/null 2>&1 && echo "captive portal: active" || echo "captive portal: inactive" ;;
  *) echo "usage: zm-hotspot on|off|status"; exit 1 ;;
esac
