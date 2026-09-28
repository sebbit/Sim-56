#!/usr/bin/env python3
"""Zeitmaschine stick - generates the wiring schematic and the perfboard layout as SVG.

    python3 generate.py            -> schematic.svg, carrier.svg

Single source of truth for the pin assignment (must match pi/stick.sh and case.scad).
License: CERN-OHL-P-2.0
"""
from pathlib import Path

HERE = Path(__file__).parent

PINS = {1: '3V3', 2: '5V', 3: 'GPIO2', 4: '5V', 5: 'GPIO3', 6: 'GND', 7: 'GPIO4', 8: 'GPIO14', 9: 'GND', 10: 'GPIO15',
        11: 'GPIO17', 12: 'GPIO18', 13: 'GPIO27', 14: 'GND', 15: 'GPIO22', 16: 'GPIO23', 17: '3V3', 18: 'GPIO24',
        19: 'GPIO10', 20: 'GND', 21: 'GPIO9', 22: 'GPIO25', 23: 'GPIO11', 24: 'GPIO8', 25: 'GND', 26: 'GPIO7',
        27: 'ID_SD', 28: 'ID_SC', 29: 'GPIO5', 30: 'GND', 31: 'GPIO6', 32: 'GPIO12', 33: 'GPIO13', 34: 'GND',
        35: 'GPIO19', 36: 'GPIO16', 37: 'GPIO26', 38: 'GPIO20', 39: 'GND', 40: 'GPIO21'}
# name, GPIO, header pin, colour, meaning
LEDS = [('HS', 5, 29, '#e8a100', 'high-speed caller'), ('AA', 6, 31, '#d62828', 'auto answer'),
        ('CD', 13, 33, '#d62828', 'carrier detect'), ('OH', 16, 36, '#d62828', 'off hook'),
        ('RD', 17, 11, '#d62828', 'receive data'), ('SD', 22, 15, '#d62828', 'send data'),
        ('TR', 23, 16, '#d62828', 'gateway dialled out'), ('MR', 24, 18, '#2a9d3a', 'modem ready')]
AUDIO = [('BCLK', 18, 12), ('LRC', 19, 35), ('DIN', 21, 40)]
LED_GND_PIN, AMP_GND_PIN, AMP_5V_PIN = 25, 6, 4

NET = {}
for n, g, p, c, _ in LEDS: NET[p] = (f'LED_{n}', c)
for s, g, p in AUDIO: NET[p] = (f'I2S_{s}', '#1d6fd1')
NET[AMP_5V_PIN] = ('+5V', '#e0701b'); NET[LED_GND_PIN] = ('GND', '#222'); NET[AMP_GND_PIN] = ('GND', '#222')

FONT = "font-family='DejaVu Sans Mono,Menlo,Consolas,monospace'"


def svg(w, h, body):
    return (f"<svg xmlns='http://www.w3.org/2000/svg' width='{w}' height='{h}' viewBox='0 0 {w} {h}'>"
            f"<rect width='{w}' height='{h}' fill='#fbfaf6'/>{body}</svg>\n")


def t(x, y, s, size=12, anchor='start', color='#222', weight='normal'):
    return f"<text x='{x}' y='{y}' font-size='{size}' text-anchor='{anchor}' fill='{color}' font-weight='{weight}' {FONT}>{s}</text>"


# ------------------------------------------------------------------ schematic
def schematic():
    W, H = 1040, 800
    b = [t(24, 36, 'ZEITMASCHINE SIM-56 STICK · WIRING', 18, weight='bold'),
         t(24, 56, 'Raspberry Pi Zero 2 W GPIO header (top view, pin 1 = 3V3) · net labels connect by name', 12, color='#666')]
    cx, y0, dy = 300, 100, 22
    b.append(f"<rect x='{cx - 110}' y='{y0 - 16}' width='220' height='{20 * dy + 10}' rx='4' fill='#eee' stroke='#555'/>")
    for pin in range(1, 41):
        row, odd = (pin - 1) // 2, pin % 2 == 1
        x, y = (cx - 20 if odd else cx + 20), y0 + row * dy
        used = pin in NET
        col = NET[pin][1] if used else '#999'
        b.append(f"<circle cx='{x}' cy='{y - 4}' r='6' fill='{col if used else '#fff'}' stroke='{col}'/>")
        b.append(t(x, y, str(pin), 7, 'middle', '#fff' if used else '#666'))
        if odd:
            b.append(t(cx - 32, y, PINS[pin], 11, 'end', '#222' if used else '#999'))
            if used: b.append(f"<line x1='{cx - 170}' y1='{y - 4}' x2='{cx - 110}' y2='{y - 4}' stroke='{col}' stroke-width='2'/>"
                              + t(cx - 176, y, NET[pin][0], 12, 'end', col, 'bold'))
        else:
            b.append(t(cx + 32, y, PINS[pin], 11, 'start', '#222' if used else '#999'))
            if used: b.append(f"<line x1='{cx + 110}' y1='{y - 4}' x2='{cx + 170}' y2='{y - 4}' stroke='{col}' stroke-width='2'/>"
                              + t(cx + 176, y, NET[pin][0], 12, 'start', col, 'bold'))
    # LED channels
    lx, ly0, ldy = 620, 104, 54
    b.append(t(lx - 10, 84, '8 × front-panel LED (3 mm)', 13, weight='bold'))
    for i, (n, g, p, c, meaning) in enumerate(LEDS):
        y = ly0 + i * ldy
        b.append(t(lx, y + 4, f'LED_{n}', 12, 'start', c, 'bold'))
        b.append(f"<path d='M{lx + 62} {y} H{lx + 90}' stroke='#222' stroke-width='1.5'/>")
        b.append(f"<rect x='{lx + 90}' y='{y - 6}' width='36' height='12' fill='#fff' stroke='#222' stroke-width='1.5'/>" + t(lx + 108, y - 10, '1 kΩ', 10, 'middle'))
        b.append(f"<path d='M{lx + 126} {y} H{lx + 160}' stroke='#222' stroke-width='1.5'/>")
        b.append(f"<path d='M{lx + 160} {y - 9} L{lx + 176} {y} L{lx + 160} {y + 9} Z' fill='{c}' stroke='#222' stroke-width='1.5'/>"
                 f"<path d='M{lx + 176} {y - 9} V{y + 9}' stroke='#222' stroke-width='2'/>"
                 f"<path d='M{lx + 166} {y - 11} l6 -7 m-2 0 h2 v2 M{lx + 172} {y - 10} l6 -7 m-2 0 h2 v2' stroke='{c}' fill='none' stroke-width='1.2'/>")
        b.append(f"<path d='M{lx + 176} {y} H{lx + 204} V{y + 10} M{lx + 196} {y + 10} H{lx + 212} M{lx + 199} {y + 13} H{lx + 209} M{lx + 202} {y + 16} H{lx + 206}' stroke='#222' stroke-width='1.5' fill='none'/>")
        b.append(t(lx + 226, y - 2, n, 12, 'start', c, 'bold') + t(lx + 226, y + 12, meaning, 10, 'start', '#555'))
    b.append(t(lx, ly0 + 8 * ldy - 8, 'anode (long leg) → resistor → GPIO · cathode (flat side) → GND', 10, color='#666'))
    # amplifier
    ax, ay = 620, 612
    b.append(t(ax - 10, ay - 20, 'Modem speaker (optional)', 13, weight='bold'))
    b.append(f"<rect x='{ax + 80}' y='{ay}' width='130' height='150' rx='4' fill='#e8f0fb' stroke='#1d6fd1' stroke-width='1.5'/>"
             + t(ax + 145, ay + 18, 'MAX98357A', 12, 'middle', '#1d6fd1', 'bold') + t(ax + 145, ay + 32, 'I²S amp', 10, 'middle', '#1d6fd1'))
    amp = [('VIN', '+5V', '#e0701b'), ('GND', 'GND', '#222'), ('DIN', 'I2S_DIN', '#1d6fd1'), ('BCLK', 'I2S_BCLK', '#1d6fd1'),
           ('LRC', 'I2S_LRC', '#1d6fd1'), ('GAIN', 'open (9 dB)', '#999'), ('SD', 'open (mono L+R)', '#999')]
    for k, (pn, net, c) in enumerate(amp):
        y = ay + 50 + k * 14
        b.append(f"<path d='M{ax + 60} {y - 4} H{ax + 80}' stroke='{c}' stroke-width='1.5'/>" + t(ax + 86, y, pn, 10, 'start', '#1d6fd1')
                 + t(ax + 56, y, net, 10, 'end', c, 'bold'))
    sx = ax + 290
    b.append(f"<path d='M{ax + 210} {ay + 70} H{sx - 10} M{ax + 210} {ay + 100} H{sx - 10}' stroke='#222' stroke-width='1.5'/>"
             + t(ax + 218, ay + 66, '+', 11) + t(ax + 218, ay + 96, '−', 11)
             + f"<rect x='{sx - 10}' y='{ay + 64}' width='12' height='42' fill='#ddd' stroke='#222'/>"
             f"<path d='M{sx + 2} {ay + 64} L{sx + 26} {ay + 48} V{ay + 122} L{sx + 2} {ay + 106} Z' fill='#ddd' stroke='#222'/>"
             + t(sx + 8, ay + 142, '4–8 Ω, 20 mm', 10, 'middle', '#555'))
    b.append(t(24, 630, 'Notes', 13, weight='bold'))
    notes = ['1 kΩ at 3.3 V gives about 1–1.5 mA per LED: enough', 'for bright LEDs, gentle on the GPIOs. Dim LEDs:',
             'use 470 Ω. Keep GPIO 2/3 (I²C) and 14/15 (UART)', 'free. The amp gets 5 V from pin 4, its logic runs',
             'at 3.3 V levels. Enable it with dtoverlay=max98357a.']
    for k, s in enumerate(notes): b.append(t(24, 650 + k * 16, s, 11, color='#444'))
    return svg(W, H, ''.join(b))


# ------------------------------------------------------------------ perfboard layout (top view)
def carrier():
    s, m = 10, 40                        # px per mm, margin
    L, Wd = 66, 30
    W, H = int(L * s + 2 * m + 360), int(Wd * s + 2 * m + 110)
    X = lambda x: m + x * s
    Y = lambda y: m + 50 + (Wd - y) * s
    col = lambda i: 8.37 + 2.54 * i       # header pin 1 column = grid origin
    row = lambda j: 25.23 - 2.54 * j      # j = 0: odd header row, j = -1: even row (board edge)
    pinpos = lambda p: (col((p - 1) // 2), row(0 if p % 2 else -1))
    b = [t(m, 30, 'ZEITMASCHINE SIM-56 · CARRIER BOARD (perfboard 2.54 mm, top view)', 17, weight='bold'),
         t(m, 50, 'Pi below: female 2×20 header on the UNDERSIDE. Insulated wires on top, bent leads (bare) underneath. Dashed = underside.', 12, color='#666')]
    b.append(f"<rect x='{X(0)}' y='{Y(Wd)}' width='{L * s}' height='{Wd * s}' rx='6' fill='#e9d6ae' stroke='#8a6d3b' stroke-width='2'/>")
    for i in range(-3, 27):
        for j in range(-1, 10):
            x, y = col(i), row(j)
            if 0.8 < x < L - 0.8 and 0.8 < y < Wd - 0.8:
                b.append(f"<circle cx='{X(x):.1f}' cy='{Y(y):.1f}' r='3' fill='#fbfaf6' stroke='#c2a878'/>")
    for hx, hy in [(3.5, 3.5), (61.5, 3.5), (3.5, 26.5), (61.5, 26.5)]:
        b.append(f"<circle cx='{X(hx)}' cy='{Y(hy)}' r='14' fill='#fbfaf6' stroke='#555' stroke-width='2'/>" + t(X(hx), Y(hy) + 4, 'M2.5', 9, 'middle', '#555'))
    # header (underside)
    b.append(f"<rect x='{X(col(0)) - 16}' y='{Y(row(-1)) - 16}' width='{19 * 2.54 * s + 32:.0f}' height='{2.54 * s + 32:.0f}' fill='none' stroke='#333' stroke-dasharray='6 4' stroke-width='1.5'/>")
    b.append(t(X(col(19)) + 16, Y(row(-1)) - 22, '2×20 female header (underside)', 10, 'end', '#333'))
    for p in range(1, 41):
        x, y = pinpos(p)
        c = NET[p][1] if p in NET else '#777'
        shape = f"<rect x='{X(x) - 5}' y='{Y(y) - 5}' width='10' height='10' fill='{c}'/>" if p == 1 else f"<circle cx='{X(x)}' cy='{Y(y)}' r='4.5' fill='{c}'/>"
        b.append(shape)
    b.append(t(X(col(0)) + 12, Y(row(0)) + 20, '▲ pin 1 (square)', 10, 'start', '#333') + t(X(col(0)) - 6, Y(row(-1)) - 22, 'pin 2 = 5V, board edge ▼', 10, 'start', '#777'))
    # speaker (on top, glued) and amp (underside)
    b.append(f"<circle cx='{X(12.5)}' cy='{Y(12.5)}' r='{10 * s}' fill='rgba(80,80,80,.12)' stroke='#555' stroke-dasharray='3 3'/>"
             + t(X(12.5), Y(12.5) + 4, 'speaker Ø20 (top, glued)', 10, 'middle', '#444'))
    ax0, ax1, ay0, ay1 = col(7) - 1.4, col(7) + 17.8 - 1.4, row(9) - 1.2, row(9) - 1.2 + 19.3
    b.append(f"<rect x='{X(ax0)}' y='{Y(ay1)}' width='{(ax1 - ax0) * s}' height='{(ay1 - ay0) * s}' fill='rgba(29,111,209,.08)' stroke='#1d6fd1' stroke-dasharray='6 4' stroke-width='1.5'/>"
             + t(X((ax0 + ax1) / 2), Y(ay1) + 16, 'MAX98357A (underside)', 10, 'middle', '#1d6fd1'))
    amp_pins = ['LRC', 'BCLK', 'DIN', 'GAIN', 'SD', 'GND', 'VIN']
    amp_xy = {n: (col(7 + k), row(9)) for k, n in enumerate(amp_pins)}
    for n, (x, y) in amp_xy.items():
        b.append(f"<circle cx='{X(x)}' cy='{Y(y)}' r='4.5' fill='#1d6fd1'/>" + t(X(x), Y(y) + 17, n, 8, 'middle', '#1d6fd1'))
    # wires: point-to-point, insulated (curves), bare jumpers (straight grey)
    def wire(p0, p1, c, bend=0.0):
        (x0, y0), (x1, y1) = p0, p1
        mx, my = (X(x0) + X(x1)) / 2 + bend, (Y(y0) + Y(y1)) / 2 - abs(X(x1) - X(x0)) * 0.12
        return f"<path d='M{X(x0):.1f} {Y(y0):.1f} Q{mx:.1f} {my:.1f} {X(x1):.1f} {Y(y1):.1f}' stroke='{c}' stroke-width='2.4' fill='none' opacity='.9'/>"
    def jumper(p0, p1):
        return f"<path d='M{X(p0[0]):.1f} {Y(p0[1]):.1f} L{X(p1[0]):.1f} {Y(p1[1]):.1f}' stroke='#8a8a8a' stroke-width='3' stroke-linecap='round'/>"
    gnd_y = row(6)
    for k, (n, g, p, c, _) in enumerate(LEDS):
        i = 7 + 2 * k; x = col(i)
        b.append(f"<path d='M{X(x)} {Y(row(1))} V{Y(row(3))}' stroke='#9a9a9a' stroke-width='2'/>"
                 f"<rect x='{X(x) - 6}' y='{Y(row(1)) + 7}' width='12' height='{2 * 2.54 * s - 14:.0f}' rx='4' fill='#f3e3c0' stroke='#8a6d3b'/>"
                 f"<path d='M{X(x) - 6} {Y(row(1)) + 14} h12 M{X(x) - 6} {Y(row(1)) + 20} h12 M{X(x) - 6} {Y(row(1)) + 26} h12' stroke='#a52' stroke-width='2'/>")
        b.append(jumper((x, row(3)), (x, row(4))))
        b.append(jumper((x, row(5)), (x, gnd_y)))
        b.append(f"<circle cx='{X(x)}' cy='{Y(13.8)}' r='15' fill='{c}' stroke='#222' stroke-width='1.5'/>"
                 f"<path d='M{X(x) - 15} {Y(12.53) + 5} h30' stroke='#222' stroke-width='2'/>" + t(X(x), Y(13.8) + 4, n, 10, 'middle', '#fff', 'bold'))
        b.append(wire(pinpos(p), (x, row(1)), c, bend=(k - 3.5) * 8))
    b.append(jumper((col(7), gnd_y), (col(21), gnd_y)) + jumper((col(12), gnd_y), (col(12), row(0))))
    b.append(t(X(col(14)), Y(gnd_y) + 18, 'GND bus → pin 25', 10, 'middle', '#555'))
    b.append(wire(pinpos(AMP_5V_PIN), amp_xy['VIN'], '#e0701b', 30) + wire(pinpos(AMP_GND_PIN), amp_xy['GND'], '#222', 20)
             + wire(pinpos(12), amp_xy['BCLK'], '#1d6fd1', -10) + wire(pinpos(35), amp_xy['LRC'], '#1d6fd1', -40)
             + wire(pinpos(40), amp_xy['DIN'], '#1d6fd1', -60))
    # legend
    lx, ly = X(L) + 30, Y(Wd) + 10
    leg = [('#d62828', 'GPIO → resistor (insulated wire)'), ('#1d6fd1', 'I²S to the amplifier'), ('#e0701b', '5 V (pin 4)'),
           ('#222', 'GND'), ('#8a8a8a', 'bare jumper on the underside of the leads')]
    for k, (c, s_) in enumerate(leg):
        b.append(f"<path d='M{lx} {ly + k * 22} h24' stroke='{c}' stroke-width='3'/>" + t(lx + 32, ly + k * 22 + 4, s_, 10))
    notes = ['Resistors 1/8 W (0204) LIE FLAT, 2 holes:', 'standing ones do not fit under the lid.', 'LED: anode (long leg) up to the resistor,', 'cathode (flat) down to the GND bus.', 'LED bodies 3 mm above the board (spacer).',
             'Drill the 4 M2.5 holes (not on grid).', 'Board size about 66 × 30 mm.']
    for k, s_ in enumerate(notes): b.append(t(lx, ly + 130 + k * 16, s_, 10, color='#444'))
    return svg(W, H, ''.join(b))


if __name__ == '__main__':
    (HERE / 'schematic.svg').write_text(schematic(), encoding='utf-8')
    (HERE / 'carrier.svg').write_text(carrier(), encoding='utf-8')
    print('wrote schematic.svg, carrier.svg')
