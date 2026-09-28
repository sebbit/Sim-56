# Zeitmaschine stick: Raspberry Pi Zero 2 W

Step-by-step build guide: [docs/en/build.md](../docs/en/build.md) · [docs/de/bauanleitung.md](../docs/de/bauanleitung.md).
Wiring and case: [hardware/](../hardware/README.md).

The BBS as a USB stick: powered by the PC, SSH over USB, a serial console,
modem LEDs on GPIO, a show-mode Wi-Fi hotspot, and pins reserved for a modem speaker.

## Hardware

- Raspberry Pi Zero 2 W with a USB-A stick hat on the **USB data (OTG) port**
- 8 LEDs, each with a 1 kΩ resistor: GPIO → resistor → LED anode, LED cathode → GND

| LED | Meaning                              | GPIO | Pin |
|-----|--------------------------------------|------|-----|
| HS  | high-speed caller (>= 9600 bit/s)    | 5    | 29  |
| AA  | auto answer: accepting calls         | 6    | 31  |
| CD  | carrier: caller past login questions | 13   | 33  |
| OH  | off hook: somebody is connected      | 16   | 36  |
| RD  | receive data (flickers)              | 17   | 11  |
| SD  | send data (flickers)                 | 22   | 15  |
| TR  | gateway dialled out                  | 23   | 16  |
| MR  | modem ready: server runs             | 24   | 18  |

GND pins: 6, 9, 14, 20, 25, 30, 34, 39. Different pins: set `LED_PINS` when running setup,
e.g. `sudo LED_PINS="hs:5 aa:6 ..." ./pi/setup-pi.sh`.

Kept free on purpose: GPIO 2/3 (I²C), 14/15 (UART), 18/19/21 (I²S for the speaker).

### Modem speaker (later)

A MAX98357A I²S amplifier breakout with a small 4–8 Ω speaker:
BCLK → GPIO 18 (pin 12), LRC → GPIO 19 (pin 35), DIN → GPIO 21 (pin 40), VIN → 5 V (pin 2), GND → GND.
Then uncomment `#dtoverlay=max98357a` in `/boot/firmware/config.txt` and reboot.
(Server-side sound is planned, see docs/CONCEPT.md.)

## SD card

Raspberry Pi Imager → device *Raspberry Pi Zero 2 W* → *Raspberry Pi OS Lite (64-bit)*.
In the OS customisation set hostname `zeitmaschine`, your user, your home Wi-Fi and
**enable SSH with your public key**.

## Setup (once, on the Pi)

```sh
scp zeitmaschine-<version>.tar.gz <user>@zeitmaschine.local:
ssh <user>@zeitmaschine.local
tar xzf zeitmaschine-<version>.tar.gz && cd zeitmaschine
sudo ./install.sh --stick       # optional: HOTSPOT_SSID=... HOTSPOT_PSK=... in front
sudo reboot
```

The installer brings the current Node.js LTS (official arm64 build, checksum-verified),
installs everything to `/opt/zeitmaschine` as a systemd service (user `zeitmaschine`) and
configures the USB gadget, the LEDs, the hotspot profile and the S.A.S. login banner
(SSH and serial console). Run it again from a newer release to update.
`sudo ./install.sh --uninstall` removes the service and undoes the stick changes.

## Using the stick

Plug it into a PC. After ~30 s:

- **SSH over USB:** `ssh <user>@10.55.0.1` (or `@zeitmaschine.local`).
  The PC gets an address from the stick but **no default route and no DNS**, so its
  own internet connection is not affected.
- **Web / telnet over USB:** `http://10.55.0.1:8056/`, `telnet 10.55.0.1 2323`
- **Serial console:** Linux `screen /dev/ttyACM0`, macOS `screen /dev/tty.usbmodem*`,
  Windows: the new COM port in PuTTY.
- Linux and macOS support the USB Ethernet (CDC-ECM) natively. Windows does not;
  there use the serial console or the Wi-Fi.

### Show mode: hotspot with captive portal

```sh
sudo zm-hotspot on      # Wi-Fi becomes the hotspot (default SSID "31337", open)
sudo zm-hotspot off     # back to your home Wi-Fi
sudo zm-hotspot status
```

Phones that join the hotspot get the "sign in to network" page, which is the modem
simulator. Guests reach web (port 80) and telnet (2323); SSH is blocked on the hotspot
and stays available over USB. While the hotspot is on, the Pi is not in your home Wi-Fi
and the gateway has no internet.

## Troubleshooting

- LEDs dark: `ls /sys/class/leds` should list `zm-*`; check `journalctl -u zeitmaschine`
  for "front panel LEDs".
- No `usb0` on the PC: the stick hat must use the data port; check `systemctl status zm-gadget`.
- Undo boot changes: `/boot/firmware/config.txt.zm-backup` is the original.
