#!/usr/bin/env bash
# Zeitmaschine stick features for a Raspberry Pi Zero 2 W. Called by install.sh:
#   stick.sh              USB gadget (SSH over USB + serial console), LEDs, hotspot, login banner
#   stick.sh --motd-only  only the S.A.S. login banner (works on any Debian-like system)
#   stick.sh --remove     undo everything this script changed
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Please run with sudo."; exit 1; }
PREFIX="${PREFIX:-/opt/zeitmaschine}"
SVC_USER="${SVC_USER:-zeitmaschine}"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BOOT=/boot/firmware; [ -d "$BOOT" ] || BOOT=/boot
CONFIG_TXT="$BOOT/config.txt"; CMDLINE="$BOOT/cmdline.txt"
HOTSPOT_SSID="${HOTSPOT_SSID:-31337}"
HOTSPOT_PSK="${HOTSPOT_PSK:-}"                        # empty = open hotspot (show mode)
LED_PINS="${LED_PINS:-hs:5 aa:6 cd:13 oh:16 rd:17 sd:22 tr:23 mr:24}"
USB_IP=10.55.0.1
ok(){ echo "✓ $*"; }

boot_block(){  # $1 = pins or "" (empty removes the block)
  python3 - "$CONFIG_TXT" "$1" <<'PY'
import re, sys
path, pins = sys.argv[1], sys.argv[2].split()
s = open(path).read()
s = re.sub(r'\n# >>> zeitmaschine.*?# <<< zeitmaschine\n', '\n', s, flags=re.S)
if pins:
    block = ['', '# >>> zeitmaschine (managed by install.sh, edits inside get replaced)', '[all]',
             'dtoverlay=dwc2,dr_mode=peripheral']
    for p in pins:
        name, gpio = p.split(':')
        block.append(f'dtoverlay=gpio-led,gpio={gpio},label=zm-{name},trigger=none')
    block += ['# Modem speaker later: MAX98357A I2S amp on GPIO 18/19/21, then uncomment:',
              '#dtoverlay=max98357a', '# <<< zeitmaschine', '']
    s = s.rstrip('\n') + '\n' + '\n'.join(block)
open(path, 'w').write(s)
PY
}

banner(){
  install -m 755 "$HERE/motd-sas.sh" /etc/update-motd.d/20-zeitmaschine-sas
  sed -i "s#@PREFIX@#$PREFIX#" /etc/update-motd.d/20-zeitmaschine-sas
  [ -f /etc/motd.zm-backup ] || cp /etc/motd /etc/motd.zm-backup 2>/dev/null || true
  : > /etc/motd
  ok "S.A.S. banner on SSH login"
}

if [ "${1:-}" = "--motd-only" ]; then banner; exit 0; fi

if [ "${1:-}" = "--remove" ]; then
  [ -f "$CONFIG_TXT" ] && boot_block ""
  [ -f "$CMDLINE" ] && sed -i 's/ modules-load=dwc2//' "$CMDLINE"
  systemctl disable zm-gadget.service serial-getty@ttyGS0.service >/dev/null 2>&1 || true
  rm -f /etc/systemd/system/zm-gadget.service /usr/local/sbin/zm-gadget.sh /usr/local/sbin/zm-hotspot \
        /etc/udev/rules.d/99-zeitmaschine-leds.rules /etc/NetworkManager/dnsmasq-shared.d/zeitmaschine.conf \
        /etc/update-motd.d/20-zeitmaschine-sas
  command -v nmcli >/dev/null && { nmcli con delete zm-usb >/dev/null 2>&1 || true; nmcli con delete zm-hotspot >/dev/null 2>&1 || true; }
  [ -f /etc/motd.zm-backup ] && mv /etc/motd.zm-backup /etc/motd
  [ -f /etc/issue.zm-backup ] && mv /etc/issue.zm-backup /etc/issue
  ok "Stick features removed (reboot to finish)"
  exit 0
fi

command -v nmcli >/dev/null || { echo "NetworkManager (nmcli) is required (Raspberry Pi OS Bookworm or newer)."; exit 1; }
[ -f "$CONFIG_TXT" ] && [ -f "$CMDLINE" ] || { echo "Boot files not found in $BOOT."; exit 1; }

DEBIAN_FRONTEND=noninteractive apt-get install -y -qq nftables avahi-daemon alsa-utils openssh-server >/dev/null
ok "packages: nftables, avahi, alsa-utils, openssh"

# boot config: USB device mode + LEDs (original kept as config.txt.zm-backup)
[ -f "$CONFIG_TXT.zm-backup" ] || cp "$CONFIG_TXT" "$CONFIG_TXT.zm-backup"
boot_block "$LED_PINS"
grep -q 'modules-load=dwc2' "$CMDLINE" || sed -i '1 s/$/ modules-load=dwc2/' "$CMDLINE"
ok "boot config: USB gadget mode, LEDs on $LED_PINS"

# LEDs may be switched by the service user
cat > /etc/udev/rules.d/99-zeitmaschine-leds.rules <<RULE
SUBSYSTEM=="leds", KERNEL=="zm-*", RUN+="/bin/chgrp $SVC_USER /sys%p/brightness", RUN+="/bin/chmod g+w /sys%p/brightness"
RULE
udevadm control --reload

# USB gadget: Ethernet (SSH over USB) + serial console
install -m 755 "$HERE/zm-gadget.sh" /usr/local/sbin/zm-gadget.sh
cat > /etc/systemd/system/zm-gadget.service <<'UNIT'
[Unit]
Description=Zeitmaschine USB gadget (CDC-ECM Ethernet + CDC-ACM serial)
After=sys-kernel-config.mount
Before=NetworkManager.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/local/sbin/zm-gadget.sh

[Install]
WantedBy=multi-user.target
UNIT
nmcli con delete zm-usb >/dev/null 2>&1 || true
nmcli con add type ethernet ifname usb0 con-name zm-usb autoconnect yes \
  ipv4.method shared ipv4.addresses "$USB_IP/24" ipv6.method link-local >/dev/null
mkdir -p /etc/NetworkManager/dnsmasq-shared.d
cat > /etc/NetworkManager/dnsmasq-shared.d/zeitmaschine.conf <<'CONF'
# USB link: the PC only gets an address - no default route, no DNS,
# so its own internet connection stays untouched.
dhcp-option=tag:usb0,option:router
dhcp-option=tag:usb0,option:dns-server
# Hotspot: every name resolves to the Pi (captive portal -> modem simulator)
address=/#/10.42.0.1
CONF
systemctl daemon-reload
systemctl enable ssh zm-gadget.service serial-getty@ttyGS0.service >/dev/null 2>&1
ok "USB: SSH/web/telnet on $USB_IP, serial console"

# hotspot profile (off until: sudo zm-hotspot on)
nmcli con delete zm-hotspot >/dev/null 2>&1 || true
nmcli con add type wifi ifname wlan0 con-name zm-hotspot autoconnect no ssid "$HOTSPOT_SSID" \
  802-11-wireless.mode ap 802-11-wireless.band bg ipv4.method shared ipv4.addresses 10.42.0.1/24 >/dev/null
if [ -n "$HOTSPOT_PSK" ]; then
  [ ${#HOTSPOT_PSK} -ge 8 ] || { echo "HOTSPOT_PSK needs at least 8 characters."; exit 1; }
  nmcli con modify zm-hotspot wifi-sec.key-mgmt wpa-psk wifi-sec.psk "$HOTSPOT_PSK"
fi
install -m 755 "$HERE/hotspot.sh" /usr/local/sbin/zm-hotspot
if grep -q '^CAPTIVE=' "$PREFIX/config.env"; then sed -i 's/^CAPTIVE=.*/CAPTIVE=1/' "$PREFIX/config.env"; else echo 'CAPTIVE=1' >> "$PREFIX/config.env"; fi
ok "hotspot '$HOTSPOT_SSID' ready (sudo zm-hotspot on|off)"

# login banners: SSH (motd) and serial console (issue)
banner
[ -f /etc/issue.zm-backup ] || cp /etc/issue /etc/issue.zm-backup
{ cat "$PREFIX/sas-logo.ans"; printf '\n  \e[1;30mS.A.S. · serielle Konsole · \\n (\\l)\e[0m\n\n'; } > /etc/issue
ok "S.A.S. banner on the serial console"
