'use strict';
/*
 * Modem front-panel LEDs on GPIO, driven through the kernel "gpio-led" overlay:
 * each LED appears as /sys/class/leds/zm-<name>/brightness. No dependencies.
 * If no such LEDs exist (e.g. on a normal server), everything here is a no-op.
 */
const fs = require('fs');
const path = require('path');

const DIR = process.env.LED_DIR || '/sys/class/leds';
const NAMES = ['hs', 'aa', 'cd', 'oh', 'rd', 'sd', 'tr', 'mr'];
const leds = {};
for (const n of NAMES){
  const f = path.join(DIR, 'zm-' + n, 'brightness');
  if (fs.existsSync(f)) leds[n] = {f, on: null, until: 0};
}
const enabled = Object.keys(leds).length > 0;
let getState = () => ({});
let timer = null, test = null;

function write(n, on){
  const l = leds[n];
  if (!l || l.on === on) return;
  l.on = on;
  try { fs.writeFileSync(l.f, on ? '1' : '0'); } catch { /* permission or hardware issue: stay silent */ }
}
// RD/SD: keep the LED flickering for a moment after each byte, like a real modem
function pulse(n, ms = 60){ const l = leds[n]; if (l) l.until = Date.now() + ms; }
function tick(){
  const s = getState(), now = Date.now();
  for (const n of NAMES){
    if (!leds[n]) continue;
    if (n === 'rd' || n === 'sd') write(n, now < leds[n].until && Math.random() < 0.75);
    else write(n, !!s[n]);
  }
}
function start(stateFn){
  if (!enabled) return false;
  getState = stateFn;
  // power-on self test: a light sweeps across the panel and back
  const seq = [...NAMES, ...NAMES.slice(0, -1).reverse()];
  let i = 0;
  test = setInterval(() => {
    for (const n of NAMES) write(n, false);
    if (i < seq.length) write(seq[i++], true);
    else { clearInterval(test); test = null; timer = setInterval(tick, 25); }
  }, 70);
  return true;
}
function stop(){
  if (test) clearInterval(test);
  if (timer) clearInterval(timer);
  for (const n of NAMES) write(n, false);
}
module.exports = {enabled, start, stop, pulse, found: () => Object.keys(leds)};
