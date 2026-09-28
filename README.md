# Sim-56 Zeitmaschine

A small, self-hosted 90s-style mailbox you can call two ways:

- **Telnet** – with any terminal (`telnet`, SyncTERM, NetRunner, …)
- **SIM-56 web modem simulator** – the browser dials, handshakes with synthesized
  modem audio (V.90 … Bell 103), and then talks to the same BBS over a WebSocket.
  Every byte is rendered at the emulated line speed, audible as FSK on 300/1200 baud lines.

Callers from both sides share the same system: they see each other on the node list
and write on the same oneliner wall.

Version: see `VERSION`. Zero dependencies, Node.js >= 18.

## Layout

```
server.js                  telnet + HTTP + WebSocket server
bbs.js                     BBS engine: menus, wiki, ANSI art, oneliners
leds.js                    modem LEDs on GPIO (no-op without hardware)
pi/                        Raspberry Pi Zero 2 W stick: USB gadget, hotspot, banner (see pi/README.md)
docs/CONCEPT.md            vision, principles, roadmap, easter egg policy, licensing
docs/en/ docs/de/          guides in English and German (build guide / Bauanleitung)
hardware/                  parts list, wiring diagram, perfboard layout, 3D-printable case
LICENSE                    MIT
public/index.html          SIM-56 web modem simulator (single file, no CDN)
install.sh                 all-in-one installer (brings its own Node.js)
start.sh stop.sh           manual start/stop without systemd
config.env.example         configuration (copied to config.env by install.sh)
phonebook.json.example     gateway phonebook (copied to phonebook.json by install.sh)
data/                      runtime data (oneliners.json)
logs/ run/ runtime/        log file, PID file, bundled Node.js
```

## Documentation

| | English | Deutsch |
|---|---|---|
| Build the stick | [docs/en/build.md](docs/en/build.md) | [docs/de/bauanleitung.md](docs/de/bauanleitung.md) |
| Hardware files | [hardware/](hardware/README.md) | [hardware/](hardware/README.md) |
| Concept and roadmap | [docs/CONCEPT.md](docs/CONCEPT.md) | |

## Install

One command, nothing else needed (Node.js is downloaded, checksum-verified and kept
private to the installation in `runtime/`):

```sh
tar xzf zeitmaschine-<version>.tar.gz && cd zeitmaschine
sudo ./install.sh              # installs to /opt/zeitmaschine as a systemd service
sudo ./install.sh --stick      # Raspberry Pi Zero 2 W: also USB gadget, LEDs, hotspot, banner
sudo ./install.sh --motd       # S.A.S. login banner on this machine
sudo ./install.sh --uninstall  # remove the service, keep config and data (--purge: everything)
```

Updating: unpack a newer release and run its `install.sh` again. `config.env`,
`phonebook.json` and `data/` are kept. Supported: Debian, Ubuntu, Raspberry Pi OS
(and other systemd distributions with apt, dnf or pacman) on x86_64, arm64, armv7;
armv6 (Pi Zero W) works with an unofficial, end-of-life Node.js build.
Without systemd, use `start.sh` / `stop.sh`.

Defaults: web on port `8056`, telnet on port `2323`.

## Connect

- Browser: `http://<host>:8056/` – the simulator detects the server and shows
  "Gegenstelle: Server-BBS". Dial any number (e.g. `ATDT0191011`); after CONNECT
  you are on the BBS. Switch the selector to "eingebaut" to use the offline BBS
  built into the page.
- Telnet: `telnet <host> 2323`. On connect you choose the charset
  (`U` = UTF-8 for normal terminals, `C` = CP437 for SyncTERM/NetRunner) and an
  optional line-speed emulation (300 … 56000 bit/s or unthrottled).

## Telnet gateway (phonebook)

The BBS can dial out to real BBSes on the internet and pass the connection through,
at the caller's emulated line speed:

- **Web modem:** dial a phonebook number directly (or click it in the "Telefonbuch"
  bar under the controls). After the handshake you are on the remote BBS.
  When it hangs up you get `NO CARRIER`.
- **Inside the BBS:** menu `[T] Telefonbuch`, type a number. When the remote side
  hangs up you return to the Zeitmaschine menu. To leave early: Enter, then `~.`

The gateway only connects to entries in `phonebook.json` (never to arbitrary hosts),
so the server cannot be abused as an open proxy. The file is re-read on every dial;
edits need no restart.

```json
[
  {"number": "1988", "name": "Vertrauen", "desc": "Heimat von Synchronet", "host": "vert.synchro.net", "port": 23}
]
```

The shipped entries come from public BBS lists (Telnet BBS Guide, Synchronet wiki)
and may change over time. Remote systems are expected to speak CP437/ANSI.
The gateway answers telnet negotiation as an 80x25 ANSI terminal (TTYPE, NAWS);
the web terminal answers cursor-position requests (`ESC[6n`) itself, telnet callers'
terminals do the same.

## Configuration (`config.env`)

| Variable          | Default            | Meaning                                         |
|-------------------|--------------------|-------------------------------------------------|
| `BBS_NAME`        | Zeitmaschine BBS   | name shown on the telnet banner and in the web UI |
| `HTTP_PORT`       | 8056               | web simulator + WebSocket                        |
| `TELNET_PORT`     | 2323               | telnet                                           |
| `BIND`            | 0.0.0.0            | listen address (use 127.0.0.1 behind a proxy)    |
| `MAX_NODES`       | 16                 | concurrent callers                               |
| `MAX_PER_IP`      | 3                  | concurrent callers per IP                        |
| `IDLE_MINUTES`    | 15                 | hang up after inactivity                         |
| `SESSION_MINUTES` | 60                 | maximum call length                              |
| `TRUST_PROXY`     | 0                  | 1 = use X-Forwarded-For for the per-IP limit     |
| `DATA_DIR`        | ./data             | where oneliners.json is stored                   |
| `PHONEBOOK`       | ./phonebook.json   | gateway phonebook                                |
| `CAPTIVE`         | 0                  | 1 = unknown URLs redirect to the simulator (hotspot captive portal) |
| `LED_DIR`         | /sys/class/leds    | where the `zm-*` LEDs live                       |

## Reverse proxy (optional, nginx)

The page uses relative URLs (`api/info`, `ws`), so it also works under a sub-path.

```nginx
location /bbs/ {
    proxy_pass http://127.0.0.1:8056/;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_read_timeout 3700s;
}
```

Telnet cannot go through an HTTP proxy; forward TCP port 2323 directly if you want it public.

## Security notes

- Telnet is unencrypted by design. Expose it only where that is acceptable
  (e.g. LAN/VLAN, or forward just the port you want public).
- User input is filtered (no control/escape sequences), names are limited to
  20 characters, oneliners to 60 characters and 3 per call; the wall keeps the
  latest 500 entries.
- Per-IP and total node limits, idle and session timeouts are enforced.
- The HTTP server only serves `index.html`, `api/info` and the WebSocket.
- Outgoing gateway connections go only to phonebook entries; `api/info` publishes
  numbers and names, not hosts.

## WebSocket protocol (`/ws`)

Binary frames carry terminal bytes (CP437) in both directions. Text frames carry JSON:

| Direction        | Message                                        |
|------------------|------------------------------------------------|
| client → server  | `{"type":"hello","number":"1988","rate":2400,"rateLabel":"2400","cps":240,"arq":true}` (first message; a phonebook number connects straight to the gateway) |
| client → server  | `{"type":"zmodem-done","ok":true}`              |
| server → client  | `{"type":"flush"}` drop pending output          |
| server → client  | `{"type":"demo","cps":30,"b64":"…"}` output at a forced speed (speed demo) |
| server → client  | `{"type":"zmodem","file":{"name":"…","size":123}}` start download dialog |
| server → client  | `{"type":"hangup"}` carrier drops after pending output |

The server does not throttle web callers; the simulator emulates the line speed.
Telnet callers are throttled server-side if they chose a speed.

## Known limitations

- Zmodem downloads are simulated and only available through the web simulator;
  telnet callers get a notice instead.
- The offline BBS inside `index.html` and `bbs.js` share content but are separate
  copies; the server edition adds the node list and the oneliner wall.

## License

Software: MIT (see `LICENSE`). Hardware designs: CERN-OHL-P-2.0. Documentation, ANSI art
and sounds: CC BY 4.0. Commercial use - including selling kits - is explicitly welcome.
See `docs/CONCEPT.md`.
