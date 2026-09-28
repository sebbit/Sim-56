# Hardware

| File | Content |
|---|---|
| `BOM.md` | parts list |
| `wiring/schematic.svg` | wiring diagram: GPIO header, 8 LEDs, speaker amplifier |
| `wiring/carrier.svg` | perfboard layout of the carrier board (top view) |
| `wiring/generate.py` | generates both SVGs - the single source of the pin assignment |
| `case/case.scad` | **stick** case, parametric (OpenSCAD 2021.01+), fits the USB-A Addon Board V1.1 |
| `case/bottom.stl`, `case/lid.stl` | stick, ready to print |
| `case/desk.scad` | **desk modem** case: classic 90s look, micro-USB cable at the rear |
| `case/desk-bottom.stl`, `case/desk-lid.stl` | desk modem, ready to print |
| `case/*preview-*.png` | renderings |

Build guide: `docs/en/build.md` (English), `docs/de/bauanleitung.md` (Deutsch).

Regenerate:

```sh
python3 wiring/generate.py
openscad -D 'part="bottom"' -o case/bottom.stl case/case.scad
openscad -D 'part="lid"'    -o case/lid.stl    case/case.scad
openscad -D 'part="bottom"' -o case/desk-bottom.stl case/desk.scad
openscad -D 'part="lid"'    -o case/desk-lid.stl    case/desk.scad
```

More form factors are welcome: the carrier board and the LED positions (in Pi coordinates)
are the common interface - a new case only has to place those.

Different USB adapter, LEDs or speaker? Change the parameters at the top of `case.scad`
(the console shows the outside size and the material left above the speaker).

A KiCad schematic and a real carrier PCB are planned (see `docs/CONCEPT.md`).

License: CERN-OHL-P-2.0.
