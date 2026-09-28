# Zeitmaschine - concept

**A 1980s/90s dial-up world you can hold in your hand: modem, mailbox and telephone
network - simulated, playable, and built to show how it all worked.**

Many of us grew up with the screech of a modem, with *WarGames*, *Hackers* and
*Whiz Kids*, with mailboxes, the moonlight tariff and 2400 baud. Zeitmaschine turns
that memory into something you can touch - and learn from. Every chirp of the
handshake is a protocol step; here you can hear it, see it and read why it happens.

The spirit is that of good hardware replicas such as the [PiDP-11](https://obsolescence.dev/pdp11.html)
(a PDP-11 front panel recreated around a Raspberry Pi - well worth building yourself): authentic enough to be fun, useful in practice, and above
all a way to learn. Zeitmaschine is not related to it - it applies the same idea to modems,
mailboxes and the telephone network.

## Principles

1. **Authentic, not approximate.** Real frequencies, baud rates, framings and
   sequences. Where something is simplified, the documentation says so.
2. **Learn by touching.** Every screen can explain itself: the wiki in the BBS,
   spectrogram, constellation and bit stream in the simulator, LEDs on the stick.
3. **Self-contained.** A single-file web app without CDNs, a server without npm
   dependencies, one installer that brings everything it needs.
4. **Safe by default.** Made for the home network. The gateway only dials numbers
   from the phonebook (no open proxy), SSH is never reachable from the hotspot,
   the USB link never changes the host's internet connection.
5. **Open.** Free to use, change, share - and to sell as a kit.
6. **Nods, not copies.** See the easter egg policy below.

## What exists (1.5)

| Part | What it does |
|---|---|
| SIM-56 web simulator | Synthesises real modem signals (Bell 103 to V.90, fax) with spectrogram, IQ plane, LEDs, AT commands, war dialer |
| Zeitmaschine BBS | ANSI mailbox with wiki, oneliners, node list, speed demo, simulated Zmodem |
| Telnet + WebSocket server | Same BBS for terminals and the simulator; optional line-speed emulation |
| Gateway | Dials real BBSes on the internet from a phonebook, at your emulated speed |
| Stick (Pi Zero 2 W) | SSH and serial console over USB, modem LEDs, show-mode hotspot with captive portal, S.A.S. login banner |
| Installer | One command, bundled Node.js, update and uninstall |
| Hardware | Parts list, wiring diagram, perfboard layout, two parametric 3D-printable cases (stick, desk modem), build guide (en/de) |

## Where it is going

### ZM-OS: a small world to explore
The stick gets a world of its own to explore,
reachable by telnet, serial console and the web simulator:

- **A simulated telephone exchange** with fictional subscribers: dial tone, ringing,
  busy lines, announcements - the network the war dialer "scans".
- **An S.A.S.-style test console** for that exchange: check simulated lines, measure
  loop resistance, place test calls. Everything is fictional; nothing touches a real line.
- **A small Unix-like shell** with man pages that explain the technology.
- **FidoNet-style mail** between sticks, door games, more systems to find.

### AT modem over USB
The stick's serial port speaks the Hayes command set. Retro computers and terminal
programs dial with `ATDT` and reach the BBS, the gateway or ZM-OS.

### Sound on the stick
A MAX98357A amplifier with a small speaker becomes the modem speaker: the stick screeches
when someone calls.

### Web admin
Configuration, phonebook, hotspot, LED test and logs in the browser, password-protected,
reachable only via USB and the home network.

### Hardware
Parts list, wiring diagram, KiCad schematic, a small carrier board for LEDs and speaker,
a parametric 3D-printable case (OpenSCAD) with a labelled front panel.

### Documentation (English and German)
Build guide, user guide, and the background: why the modem screeches, how the
telephone network worked, what BBS culture was.

## Easter egg policy

The films, series and documentaries that shaped this project - *WarGames*, *Hackers*,
*Takedown*, *Antitrust* ("Startup"), *The Matrix*, *Whiz Kids*, *Mr. Robot*, *Blackhat*,
*23 - Nichts ist so wie es scheint*, *The KGB, the Computer and Me* and
*The Cuckoo's Egg* - are welcome as inspiration.

- **Real history is fair game** - told in our own words: the KGB hack of the late 1980s,
  Clifford Stoll's honeypot, the 2600 Hz tone, Pacific Bell's SAS.
- **Fiction: allusions, not quotations.** Situations, moods, numbers and jokes that fans
  recognise - but no copied dialogue, no logos, no stills, no character or product names
  from the originals. That keeps the project safe to publish and to sell as a kit.
- **Captive portal themes are harmless pranks.** They never ask for passwords, never
  collect data and never imitate real services.

### Backlog of ideas

| Inspiration | Idea (original content) |
|---|---|
| WarGames | CASSANDRA (exists); a synthetic voice greeting with our own words; the machine that learns from tic-tac-toe |
| Takedown / SAS | S.A.S. banner and line board (exist); the test console in ZM-OS |
| The Cuckoo's Egg, KGB documentary, 23 | Wiki chapter on the real story; a honeypot account with tempting "secret" files - opening them starts a teleprinter that logs your session; a tiny accounting error in the logs as the first clue |
| Phone phreaking | A 2600 Hz whistle and a "blue box" in the simulator that the simulated exchange reacts to - with the history behind it |
| Hackers | A trace-the-intruder mini game on a fictional mainframe |
| The Matrix | Digital rain as terminal screensaver; a ringing phone as the way out of a door game |
| Whiz Kids | A talking home computer with a speech synthesiser |
| Mr. Robot, Blackhat | Hidden files and a fake root shell that tell a small original story |

## Licensing

| What | License | Commercial use / kits |
|---|---|---|
| Software | MIT | yes, keep the license notice |
| Hardware (schematics, PCB, case) | CERN-OHL-P-2.0 | yes, keep the notice |
| Documentation, ANSI art, sounds | CC BY 4.0 | yes, with attribution |

Anyone may build, change and sell kits. We would love to hear about it.

## Roadmap

| Milestone | Content | Status |
|---|---|---|
| M1 Foundation | all-in-one installer, license, this concept | done (1.3) |
| M2 Documentation | build guide (en/de) done; user guide and background next | in progress (1.4) |
| M3 Hardware | parts list, wiring diagram, perfboard layout, stick and desk-modem cases done; KiCad schematic and carrier PCB next | in progress (1.5) |
| M4 Web admin | configuration in the browser | planned |
| M5 AT modem + speaker | Hayes over USB serial, sound on the stick | planned |
| M6 ZM-OS 1 | simulated exchange, S.A.S. test console, shell with man pages | planned |
| M7 Easter eggs | from the backlog, captive portal themes | planned |
| M8 GitHub release | repository, CI tests, release archives, contribution guide | planned |
