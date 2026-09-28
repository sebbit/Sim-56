# Parts list / Teileliste

Two variants share the same carrier board / Zwei Varianten, gleiche Trägerplatine:
**Stick** (USB-A adapter, `case/case.scad`) · **Desk modem / Tischmodem** (micro-USB cable, `case/desk.scad`).

| # | Part / Bauteil | Qty | Specification / Spezifikation | Notes / Hinweise |
|---|---|---|---|---|
| 1 | Raspberry Pi Zero 2 W (WH) | 1 | "WH" = GPIO header already soldered | Zero W (v1) works, but see README (Node.js) |
| 2 | microSD card | 1 | 16 GB, class A1 | 8 GB is enough |
| 3a | *Stick:* USB-A Addon Board V1.1 | 1 | pogo pins, Pi-sized 65 × 30 mm, 4 screws + 8 nuts | e.g. BerryBase 157072; case defaults fit it (`adapter_*` in `case.scad`) |
| 3b | *Desk:* micro-USB data cable | 1 | micro-B to USB-A or USB-C, **data**, not charge-only | goes into the Pi's port marked **USB** |
| 4 | 2×20 male header, 2.54 mm | 1 | **needed if the Pi has none** (Zero 2 W without "H") | soldered onto the Pi, long pins up |
| 5 | 2×20 female header, 2.54 mm | 1 | 8.5 mm body | stack height Pi → carrier ≈ 11 mm (`standoff`) |
| 6 | Perfboard, 2.54 mm | 1 | cut to about 66 × 30 mm | |
| 7 | LED 3 mm, amber | 1 | HS | diffused looks best |
| 8 | LED 3 mm, red | 6 | AA CD OH RD SD TR | |
| 9 | LED 3 mm, green | 1 | MR | |
| 10 | LED spacer 3 mm (or longer legs) | 8 | lifts the LED body 3 mm | (`led_base` in case.scad) |
| 11 | Resistor 1 kΩ, **1/8 W, small body (0204)** | 8 | lie flat over 2 holes; 470 Ω for dim LEDs | standing 1/4 W resistors are too tall for the lid |
| 12 | Standoff M2.5, 11 mm, female-female | 4 | between Pi and carrier | *stick:* screwed onto the adapter kit's screws |
| 13 | Screw M2.5, from below | 4 | *Stick:* the adapter kit's nylon screws, heads under the adapter · *Desk:* M2.5 × 12 through the floor | stick: screw must reach ~4 mm above the Pi |
| 14 | Screw M2.5 × 5 | 4 | carrier board onto the standoffs | |
| 15 | Wire, insulated, thin | ~1 m | 0.14 mm² or 30 AWG wire-wrap | several colours help |
| 16 | 3D-printed case | 1 | *Stick:* `case/bottom.stl` + `case/lid.stl` · *Desk:* `case/desk-bottom.stl` + `case/desk-lid.stl` | PLA or PETG |
| *Optional: modem speaker* | | | | |
| 17 | MAX98357A I²S amplifier breakout | 1 | 3.3 V logic, 5 V supply | |
| 18 | Speaker, 4–8 Ω, 0.5–1 W | 1 | *Stick:* Ø 20 mm, ≤ 4 mm tall, glued onto the carrier · *Desk:* Ø 28 mm, ≤ 6 mm tall, in the lid's holder ring | |
| 19 | *Desk:* rubber feet (optional) | 4 | Ø 8 mm | on the printed feet |

**Tools / Werkzeug:** soldering iron, solder, side cutters, 2.5–2.8 mm drill (by hand is fine),
multimeter, small screwdriver, 3D printer (or a print service).
