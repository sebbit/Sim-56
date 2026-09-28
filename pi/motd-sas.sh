#!/bin/bash
# Zeitmaschine: S.A.S. login banner with live status (run by pam_motd at SSH login)
APP="@PREFIX@"
[ -r "$APP/sas-logo.ans" ] && cat "$APP/sas-logo.ans"
d=$'\e[1;30m'; g=$'\e[0;32m'; w=$'\e[1;37m'; y=$'\e[1;33m'; r=$'\e[0m'
printf '%s          SWITCHED ACCESS SERVICES  ·  Nachbau für die Zeitmaschine%s\n' "$d" "$r"
printf '%s  ────────────────────────────────────────────────────────────────────────%s\n' "$d" "$r"
row(){ printf "  ${g}%-11s${w}%s${r}\n" "$1" "$2"; }
model=$(tr -d '\0' 2>/dev/null </proc/device-tree/model)
row SYSTEM "$(hostname)${model:+  ($model)}"
row LAUFZEIT "$(awk '{s=int($1); d=int(s/86400); h=int(s%86400/3600); m=int(s%3600/60); if (d) printf "%d Tage, ", d; printf "%d h %02d min", h, m}' /proc/uptime)   Last $(cut -d' ' -f1-3 /proc/loadavg)"
t=$(awk '{printf "%.1f °C", $1/1000}' /sys/class/thermal/thermal_zone0/temp 2>/dev/null) && [ -n "$t" ] && row TEMPERATUR "$t"
port=$(sed -n 's/^HTTP_PORT=//p' "$APP/config.env" 2>/dev/null | tail -1 | tr -d '"'); port=${port:-8056}
info=$(curl -s --max-time 1 "http://127.0.0.1:$port/api/info" 2>/dev/null)
if [ -n "$info" ]; then
  row BBS "$(printf '%s' "$info" | python3 -c 'import json, sys
j = json.load(sys.stdin); n = j["nodes"]
s = "v%s · %d von %d Leitungen belegt" % (j["version"], len(n), j["max"])
if n: s += " · " + ", ".join("L%02d %s" % (x["node"], x["name"] or "...") for x in n)
print(s)')"
  row GATEWAY "$(printf '%s' "$info" | python3 -c 'import json, sys; print("%d Nummern im Telefonbuch" % len(json.load(sys.stdin).get("phonebook", [])))')"
else
  row BBS "${y}keine Antwort auf Port $port${r}"
fi
if command -v nmcli >/dev/null; then
  if nmcli -t -f NAME con show --active 2>/dev/null | grep -qx zm-hotspot; then row HOTSPOT "an ($(nmcli -g 802-11-wireless.ssid con show zm-hotspot))"; else row HOTSPOT aus; fi
fi
row MONITOR "0 überwachte Leitungen. Und das bleibt auch so."
echo
