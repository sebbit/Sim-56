'use strict';
/*
 * Zeitmaschine BBS server
 *  - Telnet (raw TCP) for classic terminals (SyncTERM, NetRunner, telnet)
 *  - WebSocket (/ws) for the SIM-56 web modem simulator
 *  - HTTP: serves the simulator (public/index.html) and /api/info
 * Zero dependencies, Node.js >= 18.
 */
const net = require('net');
const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const {StringDecoder} = require('string_decoder');
const BBS = require('./bbs');
const LED = require('./leds');

const VERSION = fs.readFileSync(path.join(__dirname, 'VERSION'), 'utf8').trim();
const CFG = {
  name: process.env.BBS_NAME || 'Zeitmaschine BBS',
  httpPort: +(process.env.HTTP_PORT || 8056),
  telnetPort: +(process.env.TELNET_PORT || 2323),
  bind: process.env.BIND || '0.0.0.0',
  maxNodes: +(process.env.MAX_NODES || 16),
  maxPerIp: +(process.env.MAX_PER_IP || 3),
  idleMin: +(process.env.IDLE_MINUTES || 15),
  sessionMin: +(process.env.SESSION_MINUTES || 60),
  trustProxy: process.env.TRUST_PROXY === '1',
  dataDir: process.env.DATA_DIR || path.join(__dirname, 'data'),
  captive: process.env.CAPTIVE === '1',
};
const PUBLIC = path.join(__dirname, 'public');
const PHONEBOOK_FILE = process.env.PHONEBOOK || path.join(__dirname, 'phonebook.json');
const IAC = 255, DONT = 254, DO = 253, WONT = 252, WILL = 251, SB = 250, SE = 240, ECHO = 1, SGA = 3, TTYPE = 24, NAWS = 31, BINARY = 0;
const log = (...a) => console.log(new Date().toISOString(), ...a);

/* ---------- oneliner store (JSON file, atomic write) ---------- */
const OL_FILE = path.join(CFG.dataDir, 'oneliners.json');
let oneliners = [];
try { oneliners = JSON.parse(fs.readFileSync(OL_FILE, 'utf8')); if (!Array.isArray(oneliners)) oneliners = []; } catch { oneliners = []; }
function saveOneliners(){
  fs.mkdirSync(CFG.dataDir, {recursive: true});
  const tmp = OL_FILE + '.tmp';
  fs.writeFile(tmp, JSON.stringify(oneliners, null, 1), e => { if (e) log('oneliner save failed:', e.message); else fs.rename(tmp, OL_FILE, () => {}); });
}
const store = {
  list: () => oneliners.slice(-14),
  count: () => oneliners.length,
  add(name, text){ oneliners.push({name, text, at: Date.now()}); if (oneliners.length > 500) oneliners = oneliners.slice(-500); saveOneliners(); },
};

/* ---------- phonebook: the only destinations the gateway will connect to ---------- */
const digits = x => String(x || '').replace(/\D/g, '');
function loadPhonebook(){
  try {
    const raw = JSON.parse(fs.readFileSync(PHONEBOOK_FILE, 'utf8'));
    return (Array.isArray(raw) ? raw : []).filter(e => e && digits(e.number) && typeof e.host === 'string' && /^[A-Za-z0-9.-]{1,253}$/.test(e.host))
      .map(e => ({number: digits(e.number), name: String(e.name || e.host).slice(0, 30), desc: String(e.desc || '').slice(0, 44),
                  host: e.host, port: Math.max(1, Math.min(65535, +e.port || 23))}));
  } catch { return []; }
}
const findEntry = number => loadPhonebook().find(e => e.number === digits(number));

/* ---------- sessions / nodes ---------- */
const nodes = new Map();
const freeNode = () => { for (let i = 1; i <= CFG.maxNodes; i++) if (!nodes.has(i)) return i; return 0; };
const perIp = ip => [...nodes.values()].filter(s => s.ip === ip).length;

class Session {
  constructor(via, ip, transport){
    this.via = via; this.ip = ip; this.t = transport;
    this.node = freeNode(); nodes.set(this.node, this);
    this.name = ''; this.since = Date.now(); this.lastInput = Date.now();
    this.enc = 'cp437'; this.cps = 0; this.q = []; this.carry = 0;
    this.hangPending = false; this.closed = false; this.stage = 'host'; this.zmDone = null;
    this.dec = new StringDecoder('utf8');
    this.info = {rate: 0, rateLabel: '?', cps: 1000, arq: true, desc: ''};
    this.host = BBS.bbsHost();
    this.env = this.makeEnv();
    this.timer = setInterval(() => this.pump(), 20);
    log(`node ${this.node} connect ${via} ${ip}`);
  }
  makeEnv(){
    const s = this;
    return {
      get info(){ return s.info; },
      get node(){ return s.node; },
      get canDownload(){ return s.via === 'web'; },
      out: (text, opts) => s.write(text, opts),
      flush: () => s.flush(),
      hang: () => { s.hangPending = true; },
      download: (file, done) => {
        if (s.via !== 'web'){ done(false); return; }
        s.zmDone = done; s.t.control({type: 'zmodem', file: {name: file.name, size: file.size}});
      },
      setName: n => { s.name = n; log(`node ${s.node} is "${n}"`); },
      nodes: () => [...nodes.values()].filter(x => !x.closed).sort((a, b) => a.node - b.node)
        .map(x => ({node: x.node, name: x.name, since: x.since, via: x.gw ? `unterwegs: ${x.gw.name}` : x.via === 'web' ? `Web-Modem ${x.info.rateLabel}` : `Telnet ${x.info.rateLabel}`})),
      oneliners: store,
      phonebook: () => loadPhonebook().map(({number, name, desc}) => ({number, name, desc})),
      gateway: number => { const e = findEntry(number); if (!e) return false; s.startGateway(e, false); return true; },
    };
  }
  encode(text){ return this.enc === 'utf8' ? Buffer.from(text, 'utf8') : Buffer.from(BBS.enc437(text), 'latin1'); }
  write(text, opts){
    if (this.closed) return;
    if (opts && opts.cps){
      // speed demo: the web client throttles itself, telnet is throttled here
      if (this.via === 'web') this.t.control({type: 'demo', cps: opts.cps, b64: this.encode(text).toString('base64')});
      else this.q.push({buf: this.encode(text), cps: opts.cps});
      return;
    }
    this.q.push({buf: this.encode(text), cps: this.cps});
  }
  flush(){ this.q = []; this.carry = 0; if (this.via === 'web') this.t.control({type: 'flush'}); }
  pump(){
    if (this.closed) return;
    let budget = null;
    while (this.q.length){
      const c = this.q[0];
      if (!c.cps){ this.t.write(c.buf); LED.pulse('sd'); this.q.shift(); continue; }
      if (budget === null){ this.carry += c.cps * 0.02; budget = Math.floor(this.carry); this.carry -= budget; }
      if (budget <= 0) break;
      const n = Math.min(budget, c.buf.length);
      this.t.write(c.buf.subarray(0, n)); LED.pulse('sd'); budget -= n;
      if (n === c.buf.length) this.q.shift(); else { c.buf = c.buf.subarray(n); break; }
    }
    if (!this.q.length){
      this.carry = 0;
      if (this.hangPending){
        this.hangPending = false;
        if (this.via === 'web') this.t.control({type: 'hangup'});
        setTimeout(() => this.close('hangup'), 400);
      }
    }
    const now = Date.now();
    if (!this.hangPending && !this.closing){
      if (now - this.lastInput > CFG.idleMin * 60000){ this.closing = true; this.flush(); this.write('\r\n\r\n  Zu lange keine Eingabe - die Box legt auf.\r\n'); this.hangPending = true; }
      else if (now - this.since > CFG.sessionMin * 60000){ this.closing = true; this.flush(); this.write(`\r\n\r\n  Deine ${CFG.sessionMin} Minuten sind um. Bis zum nächsten Anruf!\r\n`); this.hangPending = true; }
    }
  }
  input(ch){
    if (this.closed) return;
    this.lastInput = Date.now();
    if (this.stage === 'charset'){
      const k = ch.toUpperCase();
      if (k !== 'U' && k !== 'C') return;
      this.enc = k === 'U' ? 'utf8' : 'cp437';
      this.write(k + '\r\n\r\nModemgeschwindigkeit nachbilden?\r\n  [1] 300  [2] 1200  [3] 2400  [4] 9600  [5] 14400  [6] 33600  [7] 56000\r\n  [0] nein, volle Telnet-Geschwindigkeit\r\nWahl: ');
      this.stage = 'speed'; return;
    }
    if (this.stage === 'speed'){
      const i = '01234567'.indexOf(ch); if (i < 0) return;
      const r = [0, 300, 1200, 2400, 9600, 14400, 33600, 56000][i];
      this.cps = r / 10;
      this.info = r ? {rate: r, rateLabel: String(r), cps: r / 10, arq: true, desc: `Telnet, gebremst auf ${r} bit/s, etwa ${r / 10} Zeichen/s`}
                    : {rate: 115200, rateLabel: 'ungebremst', cps: 11520, arq: true, desc: 'Telnet, ungebremst'};
      this.write(ch + '\r\n'); this.stage = 'host';
      this.host.start(this.env); return;
    }
    if (this.stage === 'gateway'){ this.gwInput(ch); return; }
    try { this.host.key(ch, this.env); } catch (e){ log(`node ${this.node} host error:`, e.stack || e); }
  }
  writeRaw(buf){ // bytes from a remote BBS (CP437); transcode for UTF-8 callers
    if (this.closed) return;
    if (this.enc === 'utf8'){ let t = ''; for (const b of buf) t += BBS.dec437(b); buf = Buffer.from(t, 'utf8'); }
    this.q.push({buf, cps: this.cps});
  }

  /* ----- telnet gateway (outdial) ----- */
  startGateway(entry, direct){
    this.stage = 'gateway';
    const g = this.gw = {sock: null, st: 0, sb: [], cmd: 0, name: entry.name, open: false, err: '', esc: 1, answered: new Set(), direct};
    this.write(`\r\n\x1b[0;1;30m  Gateway: wähle ${entry.name} (${entry.host}:${entry.port}) ...\x1b[0m\r\n` +
               (direct ? '' : '\x1b[0;1;30m  Trennen: Enter, dann ~.\x1b[0m\r\n'));
    const sock = g.sock = net.connect({host: entry.host, port: entry.port});
    sock.setNoDelay(true);
    const to = setTimeout(() => { if (!g.open){ g.err = 'Zeitüberschreitung'; sock.destroy(); } }, 15000);
    sock.on('connect', () => { g.open = true; clearTimeout(to); log(`node ${this.node} gateway -> ${entry.host}:${entry.port}`); });
    sock.on('data', d => { if (this.gw === g) this.gwData(d); });
    sock.on('error', e => { g.err = e.code || e.message; });
    sock.on('close', () => { clearTimeout(to); if (this.gw === g) this.gwClosed(); });
  }
  gwSend(bytes){ const g = this.gw; if (g && g.open && !g.sock.destroyed) g.sock.write(Buffer.from(bytes)); }
  gwData(d){
    const g = this.gw, out = [];
    for (const b of d){
      switch (g.st){
        case 0: if (b === IAC) g.st = 1; else out.push(b); break;
        case 1:
          if (b === IAC){ out.push(IAC); g.st = 0; }
          else if (b === SB){ g.sb = []; g.st = 5; }
          else if (b >= WILL && b <= DONT){ g.cmd = b; g.st = 2; }
          else g.st = 0;
          break;
        case 2: this.gwNegotiate(g.cmd, b); g.st = 0; break;
        case 5: if (b === IAC) g.st = 6; else if (g.sb.length < 64) g.sb.push(b); break;
        case 6: if (b === SE){ this.gwSub(g.sb); g.st = 0; } else { if (b === IAC) g.sb.push(IAC); g.st = 5; } break;
      }
    }
    if (out.length) this.writeRaw(Buffer.from(out));
  }
  gwNegotiate(cmd, opt){
    const g = this.gw, key = cmd + ':' + opt;
    if (g.answered.has(key)) return;          // answer each request once: no negotiation loops
    g.answered.add(key);
    if (cmd === WILL) this.gwSend([IAC, [BINARY, ECHO, SGA].includes(opt) ? DO : DONT, opt]);
    else if (cmd === DO){
      if ([BINARY, SGA, TTYPE, NAWS].includes(opt)){
        this.gwSend([IAC, WILL, opt]);
        if (opt === NAWS) this.gwSend([IAC, SB, NAWS, 0, 80, 0, 25, IAC, SE]);   // 80x25
      } else this.gwSend([IAC, WONT, opt]);
    }
  }
  gwSub(sb){ if (sb[0] === TTYPE && sb[1] === 1) this.gwSend([IAC, SB, TTYPE, 0, ...Buffer.from('ANSI'), IAC, SE]); }
  gwInput(ch){
    const g = this.gw; if (!g) return;
    if (g.esc === 2){ g.esc = 0; if (ch === '.'){ this.write('\r\n'); g.sock.destroy(); return; } this.gwChar('~'); }
    else if (g.esc === 1 && ch === '~'){ g.esc = 2; return; }
    g.esc = ch === '\r' ? 1 : 0;
    this.gwChar(ch);
  }
  gwChar(ch){
    const b = BBS.enc437(ch).charCodeAt(0);
    this.gwSend(b === 13 ? [13, 0] : b === IAC ? [IAC, IAC] : [b]);
  }
  gwClosed(){
    const g = this.gw; this.gw = null;
    if (this.closed) return;
    log(`node ${this.node} gateway closed (${g.open ? 'remote' : g.err || 'no connection'})`);
    this.write(`\x1b[0m\r\n\r\n  ${g.open ? `Verbindung zu ${g.name} beendet.` : `${g.name} antwortet nicht (${g.err || 'keine Verbindung'}).`}\r\n`);
    if (g.direct){ this.hangPending = true; return; }
    this.stage = 'host';
    this.host.resume(this.env);
  }
  inputByte(b){
    LED.pulse('rd');
    if (this.enc === 'utf8'){ for (const ch of this.dec.write(Buffer.from([b]))) this.input(ch); }
    else this.input(BBS.dec437(b));
  }
  close(why){
    if (this.closed) return;
    this.closed = true; clearInterval(this.timer); nodes.delete(this.node);
    if (this.gw){ try { this.gw.sock.destroy(); } catch {} this.gw = null; }
    try { this.t.close(); } catch {}
    log(`node ${this.node} disconnect (${why || 'closed'})`);
  }
}

/* ---------- telnet ---------- */
function escapeIAC(buf){
  if (!buf.includes(IAC)) return buf;
  const out = []; for (const b of buf){ out.push(b); if (b === IAC) out.push(IAC); }
  return Buffer.from(out);
}
const telnetServer = net.createServer(sock => {
  const ip = sock.remoteAddress || '?';
  if (!freeNode() || perIp(ip) >= CFG.maxPerIp){ sock.end('\r\nAlle Knoten sind belegt. Bitte später wieder anrufen.\r\n'); return; }
  sock.setNoDelay(true);
  const transport = {write: b => { if (!sock.destroyed) sock.write(escapeIAC(b)); }, control: () => {}, close: () => sock.end()};
  sock.write(Buffer.from([IAC, WILL, ECHO, IAC, WILL, SGA, IAC, DO, SGA]));
  const s = new Session('telnet', ip, transport);
  s.stage = 'charset';
  s.info.desc = 'Telnet';
  sock.write(`\r\n${CFG.name.toUpperCase()} - Telnet-Knoten ${s.node}\r\n\r\nZeichensatz?\r\n  [U] UTF-8  (normale Terminals, z. B. telnet unter Linux/macOS)\r\n  [C] CP437  (SyncTERM, NetRunner, echte DOS-Terminals)\r\nWahl: `);
  let st = 0, lastCR = false;
  sock.on('data', d => {
    for (const b of d){
      if (st === 0){
        if (b === IAC){ st = 1; continue; }
        if (b === 13){ lastCR = true; s.inputByte(13); continue; }
        if ((b === 10 || b === 0) && lastCR){ lastCR = false; continue; }
        lastCR = false;
        s.inputByte(b === 10 ? 13 : b === 127 ? 8 : b);
      } else if (st === 1){
        if (b === IAC){ st = 0; s.inputByte(IAC); }
        else if (b === SB) st = 3;
        else if (b >= 251 && b <= 254) st = 2;
        else st = 0;
      } else if (st === 2) st = 0;
      else if (st === 3){ if (b === IAC) st = 4; }
      else if (st === 4){ st = b === SE ? 0 : 3; }
    }
  });
  sock.on('close', () => s.close('socket closed'));
  sock.on('error', () => {});
});

/* ---------- websocket (RFC 6455, minimal) ---------- */
function wsAccept(req, sock){
  const key = req.headers['sec-websocket-key'];
  if (!key || String(req.headers.upgrade || '').toLowerCase() !== 'websocket'){ sock.destroy(); return; }
  const ip = CFG.trustProxy && req.headers['x-forwarded-for'] ? String(req.headers['x-forwarded-for']).split(',')[0].trim() : (sock.remoteAddress || '?');
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  sock.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  sock.setNoDelay(true);
  const send = (op, payload) => {
    if (sock.destroyed) return;
    const len = payload.length; let hdr;
    if (len < 126) hdr = Buffer.from([0x80 | op, len]);
    else if (len < 65536){ hdr = Buffer.alloc(4); hdr[0] = 0x80 | op; hdr[1] = 126; hdr.writeUInt16BE(len, 2); }
    else { hdr = Buffer.alloc(10); hdr[0] = 0x80 | op; hdr[1] = 127; hdr.writeBigUInt64BE(BigInt(len), 2); }
    sock.write(Buffer.concat([hdr, payload]));
  };
  let closed = false;
  const transport = {
    write: b => send(2, b),
    control: o => send(1, Buffer.from(JSON.stringify(o))),
    close: () => { if (closed) return; closed = true; send(8, Buffer.from([0x03, 0xE8])); sock.end(); },
  };
  let buf = Buffer.alloc(0), frag = [], fragOp = 0, sess = null;
  const onMsg = (op, pl) => {
    if (op === 1){
      let m; try { m = JSON.parse(pl.toString('utf8')); } catch { return; }
      if (m.type === 'hello' && !sess){
        if (!freeNode() || perIp(ip) >= CFG.maxPerIp){
          transport.write(Buffer.from('\r\nAlle Knoten sind belegt. Bitte später wieder anrufen.\r\n', 'latin1'));
          transport.control({type: 'hangup'}); setTimeout(() => transport.close(), 300); return;
        }
        const cps = Math.max(1, Math.min(10000, Math.round(+m.cps || 240)));
        const label = String(m.rateLabel || '').replace(/[^0-9/]/g, '').slice(0, 10) || '?';
        sess = new Session('web', ip, transport);
        sess.info = {rate: +m.rate || cps * 10, rateLabel: label, cps, arq: !!m.arq, desc: `Web-Modem mit ${label} bit/s, etwa ${cps} Zeichen/s`};
        const entry = m.number ? findEntry(m.number) : null;
        if (entry) sess.startGateway(entry, true); else sess.host.start(sess.env);
      } else if (m.type === 'zmodem-done' && sess && sess.zmDone){
        const d = sess.zmDone; sess.zmDone = null; d(!!m.ok);
      }
    } else if (op === 2 && sess){
      for (const b of pl) sess.inputByte(b);
    }
  };
  sock.on('data', d => {
    buf = Buffer.concat([buf, d]);
    if (buf.length > 1 << 20){ sock.destroy(); return; }
    while (buf.length >= 2){
      const fin = buf[0] & 0x80, op = buf[0] & 0x0f, masked = buf[1] & 0x80;
      let len = buf[1] & 0x7f, off = 2;
      if (len === 126){ if (buf.length < 4) return; len = buf.readUInt16BE(2); off = 4; }
      else if (len === 127){ if (buf.length < 10) return; const big = buf.readBigUInt64BE(2); if (big > 65536n){ sock.destroy(); return; } len = Number(big); off = 10; }
      if (!masked){ sock.destroy(); return; }
      if (buf.length < off + 4 + len) return;
      const mask = buf.subarray(off, off + 4), pl = Buffer.from(buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < pl.length; i++) pl[i] ^= mask[i & 3];
      buf = buf.subarray(off + 4 + len);
      if (op === 8){ transport.close(); return; }
      if (op === 9){ send(10, pl); continue; }
      if (op === 10) continue;
      if (op === 0){ frag.push(pl); if (fin){ onMsg(fragOp, Buffer.concat(frag)); frag = []; } continue; }
      if (!fin){ fragOp = op; frag = [pl]; continue; }
      onMsg(op, pl);
    }
  });
  sock.on('close', () => { closed = true; if (sess) sess.close('websocket closed'); });
  sock.on('error', () => {});
}

/* ---------- http ---------- */
const httpServer = http.createServer((req, res) => {
  const p = new URL(req.url, 'http://local').pathname;
  const hdr = {'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'Cache-Control': 'no-store'};
  if (req.method !== 'GET' && req.method !== 'HEAD'){ res.writeHead(405, hdr); res.end(); return; }
  if (p.endsWith('/api/info')){
    res.writeHead(200, {...hdr, 'Content-Type': 'application/json; charset=utf-8'});
    res.end(JSON.stringify({zeitmaschine: true, name: CFG.name, version: VERSION, telnetPort: CFG.telnetPort, max: CFG.maxNodes,
      nodes: [...nodes.values()].map(s => ({node: s.node, name: s.name, via: s.via})),
      phonebook: loadPhonebook().map(({number, name, desc}) => ({number, name, desc}))}));
    return;
  }
  if (p.endsWith('/') || p.endsWith('/index.html')){
    fs.readFile(path.join(PUBLIC, 'index.html'), (e, data) => {
      if (e){ res.writeHead(500, hdr); res.end('index.html missing'); return; }
      res.writeHead(200, {...hdr, 'Content-Type': 'text/html; charset=utf-8'}); res.end(req.method === 'HEAD' ? undefined : data);
    });
    return;
  }
  if (CFG.captive){ res.writeHead(302, {...hdr, Location: '/'}); res.end(); return; }   // hotspot guests land on the simulator
  res.writeHead(404, {...hdr, 'Content-Type': 'text/plain; charset=utf-8'}); res.end('404');
});
httpServer.on('upgrade', (req, sock) => {
  if (!new URL(req.url, 'http://local').pathname.endsWith('/ws')){ sock.destroy(); return; }
  wsAccept(req, sock);
});

/* ---------- start / stop ---------- */
telnetServer.on('error', e => { log('telnet error:', e.message); process.exit(1); });
httpServer.on('error', e => { log('http error:', e.message); process.exit(1); });
telnetServer.listen(CFG.telnetPort, CFG.bind, () => log(`telnet listening on ${CFG.bind}:${CFG.telnetPort}`));
httpServer.listen(CFG.httpPort, CFG.bind, () => log(`http/ws listening on ${CFG.bind}:${CFG.httpPort} (v${VERSION})`));

let shuttingDown = false;
if (LED.start(() => {
  const list = [...nodes.values()].filter(s => !s.closed);
  return {
    mr: true,                                                   // modem ready: server runs
    aa: !shuttingDown,                                          // auto answer: accepting calls
    oh: list.length > 0,                                        // off hook: somebody is connected
    cd: list.some(s => s.stage !== 'charset' && s.stage !== 'speed'),   // carrier: caller is past the login questions
    hs: list.some(s => s.info.rate >= 9600),                    // high speed caller
    tr: list.some(s => s.gw && s.gw.open),                      // gateway is dialled out
  };
})) log(`front panel LEDs: ${LED.found().join(' ')}`);

function shutdown(sig){
  shuttingDown = true;
  log(`${sig}: shutting down`);
  for (const s of nodes.values()){ s.flush(); s.cps = 0; s.write('\r\n\r\n  Der Sysop fährt die Box herunter. Bis bald!\r\n'); s.pump(); s.close('shutdown'); }
  telnetServer.close(); httpServer.close();
  setTimeout(() => { LED.stop(); process.exit(0); }, 300);
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
