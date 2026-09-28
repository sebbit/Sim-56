# Build guide: the Zeitmaschine stick

![The finished stick](../../hardware/case/preview-assembly.png)

You are building a USB stick that is a small modem: a Raspberry Pi Zero 2 W running the
Zeitmaschine BBS, eight modem lamps like a real 90s modem and, if you like, a speaker.
Plug it into a PC: the USB port powers it, and the same cable gives you SSH, the web
simulator and telnet.

**Stack, bottom to top:** case floor → USB adapter → Pi Zero 2 W → 11 mm standoffs →
carrier board (LEDs, resistors, optional amplifier and speaker) → lid.

**Two form factors, same electronics:**

| | Stick | Desk modem |
|---|---|---|
| Look | USB stick with an LED bar | small 90s desktop modem, 118 × 46 × 28 mm |
| Connection | plugs straight into the PC (USB-A Addon Board V1.1) | micro-USB cable at the rear |
| Speaker | 20 mm | 28 mm under a slotted grille |
| Files | `case/case.scad`, `bottom.stl`, `lid.stl` | `case/desk.scad`, `desk-bottom.stl`, `desk-lid.stl` |

![Desk modem](../../hardware/case/desk-preview-assembly.png)

The desk modem needs no USB adapter: the cable goes into the Pi's port marked **USB**
(not PWR). It carries power and the network, exactly like the stick.

**Time:** about 2–3 hours plus about 3 hours of printing.
**Difficulty:** simple through-hole soldering on perfboard, no SMD.

## 1. Parts and tools

The full list is in [`hardware/BOM.md`](../../hardware/BOM.md). The drawings:

- Wiring diagram: [`hardware/wiring/schematic.svg`](../../hardware/wiring/schematic.svg)
- Perfboard layout: [`hardware/wiring/carrier.svg`](../../hardware/wiring/carrier.svg)

## 2. Software first

Get the stick running before you solder. That way you know the Pi and the USB adapter
work, and you can test the LEDs right away.

1. **Write the SD card:** Raspberry Pi Imager → device *Raspberry Pi Zero 2 W* →
   *Raspberry Pi OS Lite (64-bit)*. In the settings: hostname `zeitmaschine`, your user,
   your Wi-Fi and **SSH with your public key**.
2. **Boot the Pi** (on a normal power supply or already on the USB adapter) and wait until
   it shows up: `ssh <user>@zeitmaschine.local`
3. **Install:**
   ```sh
   scp zeitmaschine-<version>.tar.gz <user>@zeitmaschine.local:
   ssh <user>@zeitmaschine.local
   tar xzf zeitmaschine-<version>.tar.gz && cd zeitmaschine
   sudo ./install.sh --stick
   sudo reboot
   ```
4. **Test:** plug the stick into a PC, wait about 30 seconds, then `ssh <user>@10.55.0.1`.
   The S.A.S. login banner appears. Open `http://10.55.0.1:8056/` and place a call.

Everything works without the carrier board; the LEDs simply stay dark.

## 3. Carrier board

![Perfboard layout](../../hardware/wiring/carrier.svg)

### 3.0 Header on the Pi
If your Pi has no GPIO header yet (Zero 2 W without "H"), solder the 2×20 male header first:
short side through the Pi, long pins up. Solder the two outer pins, check the fit, then the rest.

### 3.1 Cut and drill
1. Cut the perfboard to about **66 × 30 mm**.
2. **Trick for perfect alignment:** plug the female header onto the Pi's header and lay the
   perfboard on top so the header's legs go through the holes. The grid now sits exactly
   above the Pi.
3. Mark the Pi's four mounting holes from below with a pointed pen and drill them
   **2.5–2.8 mm**. They are not on the grid; that is expected.

### 3.2 Female header
The 2×20 female header sits on the **underside**; you solder on top. Pin 1 is the square
pad in the layout. The 5 V pins (2 and 4) are at the board edge.

### 3.3 Resistors, LEDs, ground
1. **Resistors** lie flat, one in the column above its LED, two holes long. Use small 1/8 W
   parts (0204 body): standing resistors are too tall for the lid.
2. **LEDs:** long leg (anode) up towards the resistor, flat side (cathode) down. The LED body
   stands **3 mm above the board**: use spacers or a 3 mm strip of card while soldering.
   Later the domes are pushed into the lid holes.
3. **Ground bus:** a bare wire in the row below the LEDs joins all cathodes and runs up the
   column between HS and AA to **pin 25 (GND)**.
4. Join each resistor's lower end to its LED anode with a short bare piece (a cut-off leg).

### 3.4 Wiring
Thin insulated wires from each GPIO pin to the top of its resistor:

| LED | Colour | GPIO | Pin | Meaning |
|---|---|---|---|---|
| HS | amber | 5 | 29 | high-speed caller (9600 bit/s and up) |
| AA | red | 6 | 31 | auto answer: accepting calls |
| CD | red | 13 | 33 | carrier: caller is past the login questions |
| OH | red | 16 | 36 | off hook: somebody is connected |
| RD | red | 17 | 11 | receive data (flickers) |
| SD | red | 22 | 15 | send data (flickers) |
| TR | red | 23 | 16 | gateway dialled out |
| MR | green | 24 | 18 | modem ready: server runs |

Keep free: GPIO 2/3 (I²C), 14/15 (UART) and 18/19/21 (for the speaker).

### 3.5 Check before power
- Multimeter: **no short between 5 V (pin 2/4) and GND (pin 6/25).**
- Every GPIO pin must reach exactly its own LED through its resistor.
- 5 V must never reach a GPIO. The GPIOs are 3.3 V only.

## 4. Speaker (optional)

1. Place the **MAX98357A** on the **underside** (dashed in the layout), push its pins
   through and solder them on top.
2. Wire: VIN → pin 4 (5 V), GND → pin 6, BCLK → pin 12, LRC → pin 35, DIN → pin 40.
   Leave GAIN and SD open (9 dB, mono mix of both channels).
3. **Stick:** glue the 20 mm speaker onto the marked spot on top.
   **Desk modem:** press the 28 mm speaker into the holder ring under the lid.
   Then connect it to + / − of the amplifier.
4. On the Pi, enable the line `#dtoverlay=max98357a` in `/boot/firmware/config.txt`
   (remove the hash), reboot and test: `speaker-test -c 1 -t sine -f 1000 -l 1`

The stick screeching by itself when someone calls comes in a later version.

## 5. Print the case

- Stick: `hardware/case/bottom.stl` and `lid.stl` · Desk modem: `desk-bottom.stl` and `desk-lid.stl`
- PLA or PETG, 0.2 mm layers, 3 walls, 15–20 % infill, **no supports**
- The lid STL is already oriented top-down on the bed, which makes the engraved labels crisp.
- Retro tip: fill the engravings with acrylic paint or a wax crayon and wipe off.

Different USB adapter, LEDs or speaker? The dimensions are at the top of
`hardware/case/case.scad`. OpenSCAD prints the outside size and the space above the speaker.

## 6. Assembly

1. **Stick:** insert the adapter kit's nylon screws **from below** (heads under the adapter),
   with one nut as spacer to the Pi as usual. Screw the **11 mm standoffs** onto the thread
   ends sticking out above the Pi. The stack rests with screw heads and USB plug in the
   floor pockets, the plug pokes through its opening. The four posts under the lid press it
   down later. Nothing is screwed through the floor.
   **Desk modem:** **M2.5 × 12** through the floor straight into Pi and standoffs; the Pi's
   micro-USB ports face the rear wall.
2. Plug the carrier board onto the header and fix it to the standoffs with **M2.5 × 5**.
3. Put the lid on, guiding the LED domes into their holes. It holds by press fit.
   Too tight or too loose: adjust `lip_clr` in `case.scad` and reprint the lid.

## 7. First power-on

Plug the stick into a PC:

1. A **light sweep** runs across and back (self test).
2. Then **MR** and **AA** stay on: the board is ready.
3. Call it, from the web simulator or `telnet 10.55.0.1 2323`: **OH** and **CD** come on,
   **RD/SD** flicker with every character, **HS** lights from 9600 bit/s.
4. Dial a real BBS from the phonebook: **TR** stays lit while the gateway is out.

## 8. Troubleshooting

| Problem | Fix |
|---|---|
| One LED stays dark | check polarity (long leg to the resistor). Test: `echo 1 \| sudo tee /sys/class/leds/zm-mr/brightness` |
| No LED reacts | `ls /sys/class/leds` must list `zm-*`; look for "front panel LEDs" in `journalctl -u zeitmaschine` |
| Wrong LED lights | two wires swapped, compare with the table |
| No `usb0` on the PC | the USB adapter must use the data port; `systemctl status zm-gadget` |
| Lid too tight | increase `lip_clr` (e.g. 0.35) |

## Safety
- Solder only without power.
- Never put 5 V on a GPIO: the Pi's pins are not 5 V tolerant.
- Check for shorts before the first power-on (section 3.5).
