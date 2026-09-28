#!/usr/bin/env bash
# Zeitmaschine - all-in-one installer (brings its own Node.js, nothing else needed)
#
#   sudo ./install.sh               install or update
#   sudo ./install.sh --stick       also set up the Raspberry Pi Zero 2 W stick
#                                   (USB gadget, LEDs, hotspot, login banner)
#   sudo ./install.sh --motd        S.A.S. login banner on this machine
#   sudo ./install.sh --uninstall   remove the service, keep config and data
#   sudo ./install.sh --purge       remove everything
#
# Options: --prefix DIR (default /opt/zeitmaschine), --no-service, --no-stick
# Mirrors:  NODE_MIRROR=..., NODE_MIRROR_ARMV6=...
set -euo pipefail

PREFIX=/opt/zeitmaschine
SVC=zeitmaschine
SVC_USER=zeitmaschine
NODE_MIN=18
NODE_MIRROR="${NODE_MIRROR:-https://nodejs.org/dist}"
NODE_MIRROR_ARMV6="${NODE_MIRROR_ARMV6:-https://unofficial-builds.nodejs.org/download/release}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ARGS="$*"
STICK=ask; MOTD=0; MODE=install; PURGE=0; NO_SERVICE=0; NEED_REBOOT=0

while [ $# -gt 0 ]; do
  case "$1" in
    --prefix) PREFIX="${2:?--prefix needs a directory}"; shift ;;
    --stick) STICK=yes ;;
    --no-stick) STICK=no ;;
    --motd) MOTD=1 ;;
    --no-service) NO_SERVICE=1 ;;
    --uninstall) MODE=uninstall ;;
    --purge) MODE=uninstall; PURGE=1 ;;
    -h|--help) sed -n '2,14p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *) echo "Unknown option: $1 (see --help)"; exit 1 ;;
  esac
  shift
done

if [ -t 1 ]; then B=$'\e[1m'; G=$'\e[1;32m'; Y=$'\e[1;33m'; R=$'\e[1;31m'; N=$'\e[0m'; else B=; G=; Y=; R=; N=; fi
step(){ echo; echo "${B}== $*${N}"; }
ok(){ echo "${G}✓${N} $*"; }
warn(){ echo "${Y}!${N} $*"; }
die(){ echo "${R}✗ $*${N}" >&2; exit 1; }

[ "$(id -u)" -eq 0 ] || die "Please run with sudo: sudo $0 $ARGS"
[ "$(uname -s)" = Linux ] || die "Linux only."
HAS_SYSTEMD=0; [ -d /run/systemd/system ] && HAS_SYSTEMD=1
MODEL=$(tr -d '\0' 2>/dev/null </proc/device-tree/model || true)

# ---------------------------------------------------------------- uninstall
if [ "$MODE" = uninstall ]; then
  step "Uninstall"
  if [ $HAS_SYSTEMD = 1 ]; then
    systemctl disable --now "$SVC" >/dev/null 2>&1 || true
    rm -f "/etc/systemd/system/$SVC.service"; systemctl daemon-reload
  fi
  [ -f "$PREFIX/run/server.pid" ] && kill "$(cat "$PREFIX/run/server.pid")" 2>/dev/null || true
  if [ -f /etc/systemd/system/zm-gadget.service ] || [ -f /etc/update-motd.d/20-zeitmaschine-sas ]; then
    [ -x "$PREFIX/pi/stick.sh" ] && PREFIX="$PREFIX" "$PREFIX/pi/stick.sh" --remove || true
  fi
  if [ $PURGE = 1 ]; then
    rm -rf "$PREFIX"; userdel "$SVC_USER" 2>/dev/null || true
    ok "Everything removed."
  else
    ok "Service removed. Config and data stay in $PREFIX (use --purge to delete them)."
  fi
  exit 0
fi

echo "${B}Zeitmaschine $(cat "$SRC/VERSION") installer${N}  ${MODEL:+· $MODEL}"

# ---------------------------------------------------------------- prerequisites
step "Prerequisites"
missing=()
for c in curl tar xz python3 sha256sum; do command -v "$c" >/dev/null || missing+=("$c"); done
if [ ${#missing[@]} -gt 0 ]; then
  echo "Installing: ${missing[*]}"
  if command -v apt-get >/dev/null; then
    apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq curl ca-certificates tar xz-utils python3 coreutils >/dev/null
  elif command -v dnf >/dev/null; then dnf install -y -q curl tar xz python3 coreutils
  elif command -v pacman >/dev/null; then pacman -Sy --noconfirm --needed curl tar xz python coreutils
  else die "Please install these tools first: ${missing[*]}"; fi
fi
ok "curl, tar, xz, python3"

# ---------------------------------------------------------------- node.js (bundled, private copy)
step "Node.js"
case "$(uname -m)" in
  x86_64) NARCH=x64 ;; aarch64|arm64) NARCH=arm64 ;; armv7l) NARCH=armv7l ;; armv6l) NARCH=armv6l ;;
  *) die "Unsupported CPU: $(uname -m)" ;;
esac
MIRROR="$NODE_MIRROR"
if [ "$NARCH" = armv6l ]; then
  MIRROR="$NODE_MIRROR_ARMV6"
  warn "ARMv6 (Pi Zero W / Pi 1): only unofficial Node.js builds exist and the newest one is end-of-life."
  warn "It works, but a Pi Zero 2 W is recommended."
fi
RT="$PREFIX/runtime/node"
NODE=""
install_node(){
  local want tmp f
  want=$(curl -fsSL --max-time 20 "$MIRROR/index.json" | python3 -c '
import json, sys
arch = "linux-" + sys.argv[1]
rel = [r for r in json.load(sys.stdin) if arch in r.get("files", [])]
lts = [r for r in rel if r.get("lts")]
print((lts or rel)[0]["version"] if (lts or rel) else "")' "$NARCH") || return 1
  [ -n "$want" ] || return 1
  if [ "$("$RT/bin/node" -v 2>/dev/null || true)" = "$want" ]; then ok "Node.js $want (already installed)"; return 0; fi
  tmp=$(mktemp -d); f="node-$want-linux-$NARCH.tar.xz"
  echo "Downloading Node.js $want for linux-$NARCH ..."
  curl -fSL --progress-bar "$MIRROR/$want/$f" -o "$tmp/$f" || { rm -rf "$tmp"; return 1; }
  curl -fsSL "$MIRROR/$want/SHASUMS256.txt" -o "$tmp/SHASUMS256.txt" || { rm -rf "$tmp"; return 1; }
  (cd "$tmp" && grep " $f\$" SHASUMS256.txt | sha256sum -c --quiet -) || { rm -rf "$tmp"; die "Checksum mismatch for $f - aborting."; }
  rm -rf "$RT.new"; mkdir -p "$RT.new"
  tar -xJf "$tmp/$f" -C "$RT.new" --strip-components=1
  rm -rf "$RT"; mv "$RT.new" "$RT"; rm -rf "$tmp"
  ok "Node.js $want installed to $RT (checksum verified)"
}
mkdir -p "$PREFIX"
if install_node; then
  NODE="$RT/bin/node"
elif [ -x "$RT/bin/node" ]; then
  NODE="$RT/bin/node"; warn "No connection to $MIRROR - keeping the installed $("$NODE" -v)."
elif command -v node >/dev/null && [ "$(node -p 'process.versions.node.split(".")[0]')" -ge $NODE_MIN ]; then
  NODE="$(command -v node)"; warn "No connection to $MIRROR - using the system Node.js $("$NODE" -v)."
else
  die "Could not download Node.js from $MIRROR and no usable Node.js ($NODE_MIN+) is installed."
fi

# ---------------------------------------------------------------- program files
step "Program files -> $PREFIX"
if [ "$(cd "$SRC" && pwd -P)" != "$(cd "$PREFIX" && pwd -P)" ]; then
  for f in server.js bbs.js leds.js VERSION README.md LICENSE install.sh start.sh stop.sh config.env.example phonebook.json.example; do
    [ -f "$SRC/$f" ] && install -m 644 "$SRC/$f" "$PREFIX/$f"
  done
  chmod 755 "$PREFIX/install.sh" "$PREFIX/start.sh" "$PREFIX/stop.sh"
  for d in public pi docs; do [ -d "$SRC/$d" ] && { rm -rf "$PREFIX/$d"; cp -r "$SRC/$d" "$PREFIX/$d"; }; done
  chmod 755 "$PREFIX"/pi/*.sh 2>/dev/null || true
  # take over settings from an older in-place installation (versions up to 1.2)
  for f in config.env phonebook.json; do [ -f "$SRC/$f" ] && [ ! -f "$PREFIX/$f" ] && cp "$SRC/$f" "$PREFIX/$f"; done
  [ -f "$SRC/data/oneliners.json" ] && [ ! -f "$PREFIX/data/oneliners.json" ] && { mkdir -p "$PREFIX/data"; cp "$SRC/data/oneliners.json" "$PREFIX/data/"; }
fi
[ -f "$PREFIX/config.env" ] || cp "$PREFIX/config.env.example" "$PREFIX/config.env"
[ -f "$PREFIX/phonebook.json" ] || cp "$PREFIX/phonebook.json.example" "$PREFIX/phonebook.json"
mkdir -p "$PREFIX/data" "$PREFIX/logs" "$PREFIX/run"
id "$SVC_USER" >/dev/null 2>&1 || useradd --system --home-dir "$PREFIX" --no-create-home --shell /usr/sbin/nologin "$SVC_USER"
chown -R "$SVC_USER": "$PREFIX/data" "$PREFIX/logs" "$PREFIX/run"
"$NODE" -e "process.stdout.write(require('$PREFIX/bbs.js').sasLogo(false).replace(/\r\n/g, '\n'))" > "$PREFIX/sas-logo.ans"
ok "Version $(cat "$PREFIX/VERSION"), settings in $PREFIX/config.env"

# ---------------------------------------------------------------- stick features (Pi Zero 2 W)
if [ "$STICK" = ask ]; then
  STICK=no
  if [[ "$MODEL" == *"Zero 2"* ]] && [ -t 0 ]; then
    read -rp "Raspberry Pi Zero 2 W detected. Set up the stick (USB gadget, LEDs, hotspot, login banner)? [y/N] " a
    [[ "$a" =~ ^[yYjJ] ]] && STICK=yes
  fi
fi
if [ "$STICK" = yes ]; then
  step "Stick features"
  PREFIX="$PREFIX" SVC_USER="$SVC_USER" NODE="$NODE" "$PREFIX/pi/stick.sh"
  NEED_REBOOT=1
elif [ "$MOTD" = 1 ]; then
  step "Login banner"
  PREFIX="$PREFIX" "$PREFIX/pi/stick.sh" --motd-only
fi

# ---------------------------------------------------------------- service
set -a; . "$PREFIX/config.env"; set +a
HTTP_PORT="${HTTP_PORT:-8056}"; TELNET_PORT="${TELNET_PORT:-2323}"
if [ $NO_SERVICE = 0 ] && [ $HAS_SYSTEMD = 1 ]; then
  step "Service"
  cat > "/etc/systemd/system/$SVC.service" <<UNIT
[Unit]
Description=Zeitmaschine (BBS, web modem simulator, telnet gateway)
After=network.target

[Service]
Type=simple
User=$SVC_USER
WorkingDirectory=$PREFIX
EnvironmentFile=$PREFIX/config.env
ExecStart=$NODE $PREFIX/server.js
Restart=on-failure
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=$PREFIX/data $PREFIX/logs
PrivateTmp=true

[Install]
WantedBy=multi-user.target
UNIT
  systemctl daemon-reload
  systemctl enable "$SVC" >/dev/null 2>&1
  systemctl restart "$SVC"
  for _ in 1 2 3 4 5 6 7 8 9 10; do curl -fs --max-time 1 "http://127.0.0.1:$HTTP_PORT/api/info" >/dev/null && break; sleep 0.5; done
  if curl -fs --max-time 1 "http://127.0.0.1:$HTTP_PORT/api/info" >/dev/null; then ok "Service $SVC is running"
  else warn "Service did not answer on port $HTTP_PORT:"; journalctl -u "$SVC" -n 15 --no-pager || true; fi
elif [ $NO_SERVICE = 0 ]; then
  warn "No systemd found. Start manually: $PREFIX/start.sh (stop: $PREFIX/stop.sh)"
fi

# ---------------------------------------------------------------- summary
step "Done"
ips=$(hostname -I 2>/dev/null | tr ' ' '\n' | grep -E '^[0-9]+\.' | head -3 | tr '\n' ' ')
for ip in ${ips:-127.0.0.1}; do echo "  web:    http://$ip:$HTTP_PORT/        telnet: $ip $TELNET_PORT"; done
echo "  config: $PREFIX/config.env   phonebook: $PREFIX/phonebook.json"
echo "  update: unpack a newer release and run its install.sh again"
[ $NEED_REBOOT = 1 ] && echo && echo "${Y}Reboot once to activate the stick features: sudo reboot${N}"
exit 0
