'use strict';
/*
 * Zeitmaschine BBS - shared BBS engine (content, ANSI art, menus).
 * Used by server.js for telnet and WebSocket callers. No dependencies.
 */
function mulberry32(a){return function(){a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296;};}

/* ================= CP437 ================= */
const CP437_HI = 'ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒáíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■\u00a0';
const CP_ENC = new Map(); for (let i = 0; i < 128; i++) CP_ENC.set(CP437_HI[i], 128 + i);
function enc437(s){ let o = ''; for (const ch of s){ const c = ch.charCodeAt(0); if (c < 128) o += ch; else { const b = CP_ENC.get(ch); o += String.fromCharCode(b === undefined ? 63 : b); } } return o; }
const dec437 = code => code < 128 ? String.fromCharCode(code) : CP437_HI[code - 128];

/* ================= ANSI HELPERS ================= */
const CLS = '\x1b[2J\x1b[H', R0 = '\x1b[0m';
const sg = (f, b = 0) => `\x1b[0;${f > 7 ? '1;' : ''}${30 + (f & 7)};${40 + (b & 7)}m`;
const visLen = s => s.replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '').length;
const padV = (s, w) => s + ' '.repeat(Math.max(0, w - visLen(s)));
function plainText(s){
  return s.replace(/\x1b\[2J/g, '\r\n').replace(/\x1b\[[0-9;?]*[A-Za-z]/g, '')
    .replace(/[═─]/g, '-').replace(/[║│]/g, '|').replace(/[╔╗╚╝┌┐└┘├┤┬┴┼╠╣╦╩╬]/g, '+')
    .replace(/[█▓▀▄▌▐]/g, '#').replace(/[▒░]/g, ':');
}
function fmtDur(sec){
  const s = Math.round(sec);
  if (s < 60) return s + ' s';
  const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60), x = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')} h` : `${m}:${String(x).padStart(2, '0')} min`;
}
const fmtNum = n => n.toLocaleString('de-DE');
function bar(l, r){ const inner = ' ' + l + ' '.repeat(Math.max(1, 78 - l.length - r.length)) + r + ' '; return sg(0, 6) + inner.slice(0, 80) + R0 + '\r\n'; }

/* ================= ANSI ART ================= */
const FONT = {
  Z:['#####','   # ','  #  ',' #   ','#####'], E:['#####','#    ','#### ','#    ','#####'], I:['###',' # ',' # ',' # ','###'],
  T:['#####','  #  ','  #  ','  #  ','  #  '], M:['#   #','## ##','# # #','#   #','#   #'], A:[' ### ','#   #','#####','#   #','#   #'],
  S:[' ####','#    ',' ### ','    #','#### '], C:[' ####','#    ','#    ','#    ',' ####'], H:['#   #','#   #','#####','#   #','#   #'],
  N:['#   #','##  #','# # #','#  ##','#   #']};
function logoAnsi(word){
  const rows = ['', '', '', '', ''];
  for (const ch of word){ const gl = FONT[ch]; for (let r = 0; r < 5; r++) rows[r] += gl[r] + ' '; }
  const w = rows[0].length, pad = Math.max(0, Math.floor((80 - w) / 2)), COL = [11, 11, 9, 13, 5];
  let s = '';
  for (let r = 0; r < 5; r++){
    let line = ' '.repeat(pad), cur = -1;
    for (let x = 0; x < w; x++){
      const on = rows[r][x] === '#', sh = !on && r > 0 && x > 0 && rows[r - 1][x - 1] === '#';
      const f = on ? COL[r] : sh ? 8 : -2;
      if (f !== -2 && f !== cur){ line += sg(f); cur = f; }
      line += on ? '█' : sh ? '░' : ' ';
    }
    s += line + R0 + '\r\n';
  }
  return s;
}
function encodeArt(g){
  let s = '';
  for (const row of g){
    let end = 80; while (end > 0 && row[end - 1].c === ' ' && row[end - 1].b === 0) end--;
    let cf = -1, cb = -1;
    for (let x = 0; x < end; x++){
      const c = row[x];
      if (c.b !== cb || (c.c !== ' ' && c.f !== cf)){ s += sg(c.f, c.b); cf = c.f; cb = c.b; }
      s += c.c;
    }
    s += R0 + '\r\n';
  }
  return s;
}
function sunsetAnsi(){
  const g = Array.from({length: 21}, () => Array.from({length: 80}, () => ({c: ' ', f: 7, b: 0})));
  const rnd = mulberry32(1983), HOR = 12;
  const set = (x, y, c, f, b) => { if (x >= 0 && x < 80 && y >= 0 && y < 21){ const k = g[y][x]; k.c = c; k.f = f; if (b !== undefined) k.b = b; } };
  const SKY = [[0,8,' '],[0,8,' '],[0,4,'░'],[0,4,'▒'],[4,5,'░'],[4,5,'▒'],[5,4,'▒'],[5,1,'░'],[5,1,'▒'],[1,5,'▒'],[1,3,'░'],[1,3,'▒']];
  for (let y = 0; y < HOR; y++){ const [b, f, c] = SKY[y]; for (let x = 0; x < 80; x++) set(x, y, c, f, b); }
  for (let i = 0; i < 28; i++){ const x = (rnd() * 80) | 0, y = (rnd() * 4) | 0; set(x, y, rnd() < .3 ? '*' : '·', rnd() < .4 ? 15 : 7); }
  for (let y = 3; y < HOR; y++) for (let x = 20; x < 60; x++){
    const dx = (x + .5 - 40) / 16, dy = (y + .5 - 11.6) / 8.2;
    if (dx * dx + dy * dy > 1) continue;
    if (y <= 6) set(x, y, '█', 11);
    else if (y === 7) set(x, y, '▓', 11, 1);
    else if (y === 8 || y === 10) set(x, y, '█', 9);
    else set(x, y, '▀', y === 9 ? 9 : 13);
  }
  for (let x = 0; x < 80; x++){
    const h = Math.max(0, 1.7 + 1.3 * Math.sin(x * .19 + 1) + .9 * Math.sin(x * .47) + (Math.abs(x - 40) > 17 ? 1 : -1.6));
    const full = Math.floor(h);
    for (let k = 0; k < full; k++) set(x, HOR - 1 - k, '█', 0);
    if (h - full >= .5) set(x, HOR - 1 - full, '▄', 0);
  }
  for (let x = 0; x < 80; x++) set(x, HOR, '▀', 13, 0);
  for (const y of [13, 15, 18]) for (let x = 0; x < 80; x++) set(x, y, '─', y < 15 ? 5 : 13, 0);
  for (let y = HOR + 1; y < 21; y++){
    const sp = 2.2 * (y - HOR + .5);
    for (let k = -18; k <= 18; k++){
      const x = Math.round(40 + k * sp);
      if (x >= 0 && x < 80) set(x, y, k === 0 ? '│' : k < 0 ? '/' : '\\', y < 15 ? 5 : 13, 0);
    }
  }
  return encodeArt(g);
}
const LOGO = logoAnsi('ZEITMASCHINE');
const SUNSET = sunsetAnsi();

/* ================= WIKI ================= */
const WIKI = [
 {k:'1', t:'Die Telefonleitung', l:[
  '# Zwei Drähte und ein Stromkreis',
  'Ein analoger Anschluss ist eine Zweidrahtleitung (a/b-Ader) zur',
  'Vermittlungsstelle. Die legt rund 60 V Gleichspannung an. Hebst du ab,',
  'schließt der Gabelumschalter die Schleife: Es fließen 20-60 mA, und die',
  'Vermittlung weiß, dass jemand wählen will. Am Modem leuchtet dann "OH"',
  '(off hook). Geklingelt wird mit Wechselspannung, in Deutschland 25 Hz.',
  '',
  '# Das Sprachband: 300 bis 3400 Hz',
  'Das Netz ist für Sprache gebaut. Filter lassen nur etwa 300-3400 Hz',
  'durch - alles, was ein Modem sendet, muss in dieses Fenster passen.',
  '>  Pegel',
  '>    |       _____________________________',
  '>    |      /                             \\',
  '>    |     /        nutzbares Band         \\',
  '>    |____/                                 \\_______',
  '>    +----+------+------+------+------+-----+------- Hz',
  '>    0   300   1000   2000   3000  3400  4000',
  'Im Spektrogramm oben siehst du es: über 3,4 kHz bleibt es dunkel.',
  '',
  '# Innen ist das Netz digital',
  'Seit den 80ern tastet die Vermittlungsstelle dein Signal 8000-mal pro',
  'Sekunde ab und speichert jeden Wert als 8-Bit-Zahl: PCM mit 64 kbit/s.',
  'Europa nutzt die A-Law-, Nordamerika die µ-Law-Kennlinie: leise Pegel',
  'werden fein, laute grob aufgelöst - ähnlich wie unser Gehör.',
  'Das Runden auf 256 Stufen erzeugt Quantisierungsrauschen. Nach Shannon',
  'begrenzen Bandbreite und Rauschen eine Strecke mit zwei solchen',
  'Wandlungen auf gut 33 kbit/s. Genau dort endet V.34 (siehe Artikel 5).',
  '',
  '# Echo',
  'Wo die Zweidrahtleitung auf die Vierdrahttechnik trifft (Gabelschal-',
  'tung), wird ein Teil des Signals zurückgeworfen. Für Telefonate gab es',
  'Echosperren, die immer nur eine Richtung durchlassen. Modems senden',
  'aber gleichzeitig in beide Richtungen - deshalb schaltet der 2100-Hz-',
  'Antwortton diese Sperren ab.']},
 {k:'2', t:'Wählen: Scheibe und Töne', l:[
  '# Impulswahl mit der Wählscheibe',
  'Die Scheibe unterbricht beim Zurücklaufen kurz die Schleife: Die "3"',
  'sind drei Unterbrechungen, die "0" sind zehn. Takt: 10 Impulse pro',
  'Sekunde, je 60 ms offen und 40 ms geschlossen. Ein kleiner Fliehkraft-',
  'regler in der Scheibe sorgt für das gleichmäßige Schnurren.',
  'In der Vermittlung zählten früher Hebdrehwähler die Impulse mechanisch',
  'mit - daher das Rattern im Hörer. Ein Modem macht es mit ATDP genauso,',
  'nur öffnet und schließt es die Schleife per Relais.',
  '',
  '# Tonwahl (DTMF)',
  'Jede Taste erzeugt zwei Töne gleichzeitig: einen aus ihrer Zeile und',
  'einen aus ihrer Spalte (Dual Tone Multi Frequency).',
  '>            1209 Hz  1336 Hz  1477 Hz  1633 Hz',
  '>   697 Hz      1        2        3        A',
  '>   770 Hz      4        5        6        B',
  '>   852 Hz      7        8        9        C',
  '>   941 Hz      *        0        #        D',
  'Kein Ton ist ein Vielfaches eines anderen - so löst Sprache kaum ver-',
  'sehentlich eine Ziffer aus. Die Spalte A-D gab es nur in Sonder-',
  'geräten. Ein Ton dauert 40-100 ms: Tonwahl ist viel schneller.',
  '',
  '# Was man danach hört',
  'Wählton: 425 Hz Dauerton (USA: 350 + 440 Hz).',
  'Freiton: 425 Hz, 1 s an, 4 s aus - die Gegenseite klingelt.',
  'Besetztton: 425 Hz, 480 ms an und aus.',
  '"Kein Anschluss": der SIT-Dreiklang, aufsteigend um 950/1400/1800 Hz.',
  'Ein Wardialer wertet genau diese Töne aus - probier es im Simulator.']},
 {k:'3', t:'Modulation: aus Bits werden Töne', l:[
  '# Baud ist nicht bit/s',
  'Baud zählt Symbole pro Sekunde. Wie viele Bits ein Symbol trägt, hängt',
  'davon ab, wie viele Zustände es gibt: 2 Zustände = 1 Bit, 4 = 2 Bit,',
  '16 = 4 Bit. Beispiel V.22bis: 600 Baud x 4 Bit = 2400 bit/s.',
  '"2400 Baud" war also meistens falsch - aber alle haben es gesagt.',
  '',
  '# FSK: Frequenzumtastung',
  'Eine 1 (Mark) ist eine Frequenz, eine 0 (Space) eine andere.',
  '>   Bell 103   Anrufer:      Mark 1270 Hz   Space 1070 Hz',
  '>              Angerufener:  Mark 2225 Hz   Space 2025 Hz',
  '>   V.21       Anrufer:      Mark  980 Hz   Space 1180 Hz',
  '>              Angerufener:  Mark 1650 Hz   Space 1850 Hz',
  'Jede Richtung hat ihr eigenes Band - Vollduplex ganz ohne Echo-',
  'kompensation. Mehr als 1200 Baud passen so aber nicht ins Sprachband.',
  'In der IQ-Anzeige ist FSK ein Zeiger, der je nach Bit links- oder',
  'rechtsherum kreist.',
  '',
  '# PSK und QAM',
  'Statt der Frequenz ändert man Phase und Amplitude eines Trägers.',
  'Jedes Symbol ist ein Punkt in der IQ-Ebene:',
  '>           Q                          Q',
  '>           |                     o  o | o  o',
  '>       o   |   o                 o  o | o  o',
  '>    -------+------- I         --------+-------- I',
  '>       o   |   o                 o  o | o  o',
  '>           |                     o  o | o  o',
  '>    QPSK: 4 Punkte = 2 Bit      16-QAM: 16 Punkte = 4 Bit',
  'Mehr Punkte heißt mehr Bits pro Symbol - aber die Punkte rücken zu-',
  'sammen, und Rauschen verwechselt sie leichter. Deshalb misst ein Modem',
  'zuerst die Leitung und wählt dann Symbolrate und Punktezahl.',
  '',
  '# Pulsformung und Trellis',
  'Harte Sprünge zwischen Symbolen würden das Spektrum verschmieren. Ein',
  'Raised-Cosine-Filter rundet die Übergänge ab, ohne dass sich benach-',
  'barte Symbole im Abtastzeitpunkt stören. Ab V.32 kommt Trellis-',
  'Codierung dazu: Ein Zusatzbit macht nur bestimmte Punktfolgen gültig,',
  'und der Viterbi-Decoder sucht die wahrscheinlichste. Das bringt rund',
  '4 dB - als hätte man das Rauschen mehr als halbiert.']},
 {k:'4', t:'Der Handshake Schritt für Schritt', l:[
  'Das Kreischen dauert 10 bis 20 Sekunden. Jeder Laut hat einen Zweck,',
  'und die Farben im Zeitstrahl des Simulators folgen genau diesen Phasen.',
  '',
  '# 1. ANSam: der hohe Pfeifton (2100 Hz)',
  'Der Angerufene pfeift 2100 Hz: Echosperren im Netz schalten ab. Alle',
  '450 ms springt die Phase um 180 Grad - dann gehen auch die Echokompen-',
  'satoren des Netzes aus, denn die Modems haben eigene, bessere. Die',
  'leichte 15-Hz-Amplitudenmodulation (das "am" in ANSam) bedeutet:',
  'Ich beherrsche V.8.',
  '',
  '# 2. V.8: das Menü (das Zwitschern)',
  'Mit 300 bit/s FSK schickt der Anrufer ein Call Menu (CM): Modulationen',
  'und Protokolle, die er kann. Die Gegenseite antwortet mit dem Joint',
  'Menu (JM), der Schnittmenge. CJ bestätigt.',
  '',
  '# 3. Phase 2: Leitung vermessen (bing-bong)',
  'INFO0-Blöcke (600 bit/s DPSK) tauschen Fähigkeiten aus. Tone A und B',
  'mit Phasenumkehr messen die Laufzeit hin und zurück. Dann L1/L2:',
  '21 Sinustöne gleichzeitig im 150-Hz-Raster. Der Empfänger misst jeden',
  'einzeln und kennt danach Frequenzgang und Rauschabstand der Leitung.',
  'Daraus wählt er Symbolrate (2400-3429 Baud) und Trägerfrequenz.',
  '',
  '# 4. Phase 3: Training (das Rauschen)',
  'Verwürfelte Daten nach bekanntem Muster. Die adaptiven Entzerrer',
  'stellen sich ein, bis sie die Verzerrung der Leitung herausrechnen.',
  'Bei V.90 folgt DIL, das "tschk-tschk": Der Server spielt Testpegel,',
  'der Client lernt, welche PCM-Stufen sauber ankommen.',
  '',
  '# 5. Phase 4: festlegen',
  'MP-Sequenzen legen Datenrate, Trellis-Code und Precoder fest. Dann',
  'kommt B1, das Modem meldet CONNECT - und mit ATM1 wird es still.']},
 {k:'5', t:'V.90: warum 56k selten 56k war', l:[
  '# Der Trick',
  'Ein Internetprovider hängt digital am Netz (ISDN-Primärmultiplex).',
  'Sein Signal wird nie analog gewandelt - er schickt direkt die 8-Bit-',
  'Werte, die sonst die Vermittlungsstelle erzeugen würde. Beim Kunden',
  'werden sie nur einmal in Spannung umgesetzt: exakte Stufen, kein',
  'Quantisierungsrauschen. 8000 Werte/s x 8 Bit = 64 kbit/s, theoretisch.',
  '',
  '# Warum dann nur 56k - und selten mal das?',
  '>  - Auf der Strecke darf nur eine Analog-Wandlung liegen.',
  '>  - Leise Stufen liegen zu dicht beieinander und fallen weg.',
  '>  - In den USA stahl "Robbed-Bit-Signaling" manchmal das 8. Bit.',
  '>  - Die US-Behörde FCC begrenzte die Leistung: max. 53,3 kbit/s.',
  '>  - Die Kupferleitung rauscht: typisch waren 44-50 kbit/s.',
  '',
  '# Die Gegenrichtung',
  'Der Upload ist klassisches V.34 mit höchstens 33,6 kbit/s, denn hier',
  'findet die Wandlung wieder in der Vermittlung statt. Erst V.92 holte',
  'mit PCM-Upstream bis zu 48 kbit/s heraus.',
  '',
  '# DIL: Digital Impairment Learning',
  'Der Server spielt Folgen aller PCM-Stufen, der Client misst, welche',
  'sich sicher unterscheiden lassen. Nur diese kommen ins "Alphabet".',
  'Das ist das pulsierende Knistern kurz vor Ende des Handshakes.',
  'Zwei V.90-Modems bei Privatleuten können so übrigens nicht mitein-',
  'ander reden - eine Seite muss digital angeschlossen sein. Sonst fällt',
  'die Verbindung auf V.34 zurück.']},
 {k:'6', t:'Fehlerkorrektur und Kompression', l:[
  '# Warum?',
  'Ein Knacken auf der Leitung zerstört bei 28800 bit/s gleich Dutzende',
  'Bits. Ohne Korrektur: Zeichensalat im Terminal.',
  '',
  '# MNP und V.42 (LAPM)',
  'Das Modem packt die Daten in Rahmen mit Prüfsumme (CRC). Kommt ein',
  'Rahmen beschädigt an, fordert die Gegenseite ihn neu an. Die Software',
  'am PC merkt davon nichts außer einer kleinen Verzögerung. "ARQ" im',
  'CONNECT steht für Automatic Repeat reQuest.',
  '',
  '# V.42bis: Kompression',
  'Ein Wörterbuchverfahren, verwandt mit LZW: Häufige Zeichenfolgen',
  'werden durch kurze Codes ersetzt. Text und ANSI-Grafik schrumpfen auf',
  'die Hälfte bis ein Viertel. Gepackte Dateien (ZIP) werden nicht klei-',
  'ner - der Chip erkennt das und überträgt sie dann unverändert.',
  'Deshalb stellte man den COM-Port schneller ein als die Leitung, etwa',
  'auf 115200: Das Modem konnte mehr annehmen, als es roh senden konnte.',
  '(Im Simulator ist die Kompression nicht nachgebildet.)',
  '',
  '# In diesem Simulator',
  'Bell 103, V.21 und V.23 laufen ohne Fehlerkorrektur. Mit Leitungs-',
  'rauschen gehen bei Zmodem-Downloads Blöcke kaputt und werden neu',
  'angefordert. Die schnellen Verbindungen haben LAPM - dort kommt bei',
  'Zmodem gar kein Fehler mehr an.']},
 {k:'7', t:'Hayes-Befehle, LEDs, Ergebniscodes', l:[
  '# Befehlsmodus und Datenmodus',
  'Das Modem hängt am seriellen Port. Im Befehlsmodus versteht es Befehle,',
  'die mit AT ("attention") beginnen. Nach CONNECT geht alles durch.',
  'Zurück kommt man mit +++ - aber nur mit einer Sekunde Ruhe davor und',
  'danach (Guard Time). So bricht ein "+++" mitten im Text nichts ab.',
  '',
  '# Die wichtigsten Befehle',
  '>  ATZ        Einstellungen laden    AT&F     Werkseinstellung',
  '>  ATDT123    Tonwahl                ATDP123  Impulswahl',
  '>  ATD..,..   Komma = 2 s Pause      ATH      auflegen',
  '>  ATA        Anruf annehmen         ATO      zurück in die Verbindung',
  '>  ATM0/1/2   Lautsprecher aus / bis CONNECT / immer',
  '>  ATL0-3     Lautstärke             ATS0=2   nach 2x Klingeln abheben',
  '>  ATI        Modem-Info             AT+MS=   Modulation festlegen',
  
  '',
  '# Ergebniscodes',
  'OK, ERROR, CONNECT, RING, BUSY, NO DIALTONE, NO ANSWER, NO CARRIER.',
  '"NO CARRIER" heißt: Die Gegenstelle hat ihren Träger abgeschaltet.',
  '',
  '# Die Lämpchen',
  '>  HS  High Speed      AA  Auto Answer     CD  Carrier Detect',
  '>  OH  Off Hook        RD  Receive Data    SD  Send Data',
  '>  TR  Terminal Ready  MR  Modem Ready',
  'RD und SD flackern bei jedem Zeichen. Bei 300 Baud kann man förmlich',
  'mitlesen.']},
 {k:'8', t:'Dateiübertragung: X-, Y-, Zmodem', l:[
  '# Xmodem (1977)',
  '128-Byte-Blöcke mit einfacher Prüfsumme. Nach jedem Block wartet der',
  'Sender auf ein ACK. Bei langen Laufzeiten verschenkt das viel Zeit.',
  '',
  '# Ymodem',
  '1024-Byte-Blöcke, CRC-16, Dateiname und Größe werden mitgeschickt,',
  'mehrere Dateien am Stück (Batch).',
  '',
  '# Zmodem (1986)',
  'Der Sender schickt ohne Pause. Nur bei einem Fehler meldet sich der',
  'Empfänger mit ZRPOS und der letzten guten Position - der Sender',
  'springt zurück. Dazu CRC-32, Wiederaufnahme abgebrochener Downloads',
  'und Auto-Start: Das Terminal erkennt "**", CAN und "B00" und öffnet',
  'von selbst das Download-Fenster.',
  '>    Sender                 Empfänger',
  '>    ZRQINIT   -------->',
  '>              <--------   ZRINIT',
  '>    ZFILE     -------->',
  '>              <--------   ZRPOS 0',
  '>    ZDATA ... -------->',
  '>    ZEOF      -------->',
  '>              <--------   ZRINIT',
  '>    ZFIN      -------->',
  '>              <--------   ZFIN',
  '>    "OO"      -------->',
  '',
  '# Faustregel',
  'bit/s durch 10 = Zeichen pro Sekunde (8 Datenbits + Start + Stopp).',
  'Rechenbeispiele stehen in Artikel 0.']},
 {k:'9', t:'Fax: das T.30-Protokoll', l:[
  '# Das Fax meldet sich',
  'Der Anrufer piept alle 3 Sekunden mit 1100 Hz (CNG): "Ich bin ein',
  'Fax." Das Zielgerät antwortet mit 2100 Hz (CED).',
  '',
  '# T.30: verhandeln mit 300 bit/s',
  'Beide sprechen abwechselnd V.21 Kanal 2 (1650/1850 Hz) in HDLC-Rahmen:',
  '>  DIS  Angerufener: was ich kann (V.17, V.29, Auflösung, ...)',
  '>  CSI  seine Kennung - die Nummer im Display',
  '>  DCS  Anrufer: so machen wir es',
  '>  TCF  1,5 s Nullen im gewählten Tempo, als Test',
  '>  CFR  "angekommen, los" - sonst FTT: langsamer versuchen',
  'Jeder Rahmen beginnt mit Flags 0x7E (01111110). Damit dieses Muster',
  'nie in den Daten vorkommt, wird nach fünf Einsen eine Null eingefügt:',
  'Bit-Stuffing. Der Empfänger nimmt sie wieder heraus.',
  '',
  '# Die Seite',
  'Eine A4-Zeile hat 1728 Bildpunkte. Sie wird lauflängencodiert',
  '(Modified Huffman: "43 weiß, 5 schwarz, ...") und mit V.29',
  '(9600 bit/s) oder V.17 (14400 bit/s) gesendet. Eine Textseite',
  'dauert so etwa 15 bis 30 Sekunden.',
  '',
  '# Abschluss',
  'EOP (letzte Seite), MCF (Seite in Ordnung), DCN (auflegen). Danach',
  'druckt das Gerät seinen Sendebericht mit "OK".']},
 {k:'0', t:'Bildaufbau und Geschwindigkeit', dyn: true},
];
function speedArticle(info){
  const rows = [['300', 30], ['1200/75', 120], ['2400', 240], ['9600', 960], ['14400', 1440], ['28800', 2880], ['33600', 3360], ['50000', 5000]];
  const l = [
    '# Zeichen pro Sekunde',
    'Ein Zeichen braucht auf der Leitung 10 Bit: Startbit, 8 Datenbits,',
    'Stoppbit. Ein voller Textbildschirm hat 80 x 25 = 2000 Zeichen, mit',
    'ANSI-Farbcodes schnell 4000 Bytes und mehr.',
    '>   Verbindung   Zeichen/s   Bildschirm 4 KB    Datei 1 MB'];
  for (const [n, c] of rows) l.push(`>   ${n.padEnd(12)}${String(c).padStart(9)}   ${fmtDur(4096 / c).padStart(15)}   ${fmtDur(1048576 / c).padStart(11)}`);
  l.push(`Deine Verbindung: ${info.desc}.`,
    'Genau in diesem Tempo ist diese Seite gerade bei dir angekommen.',
    '',
    '# ANSI-Grafik',
    'Escape-Sequenzen (ESC [ ...) setzen Farbe und Cursor. Statt Pixeln',
    'schickt die Box Zeichen: Blockgrafik aus dem IBM-Zeichensatz',
    '(Codepage 437) wie ░▒▓█▀▄ und Rahmen wie ╔═╗║╚╝.',
    'Bei 2400 bit/s sah man jede Zeile entstehen. Viele Boxen hatten des-',
    'halb kleine Logos für langsame und große für schnelle Anrufer - oder',
    'fragten wie diese Box beim Login: "ANSI-Grafik verwenden?"',
    '',
    'Probier es aus: [B] Bildaufbau-Demo im Hauptmenü.');
  return l;
}

class LineIn {
  constructor(max){ this.max = max; this.buf = ''; }
  feed(ch, env){
    if (ch === '\r'){ env.out('\r\n'); const l = this.buf; this.buf = ''; return l; }
    if (ch === '\b' || ch === '\x7f'){ if (this.buf){ this.buf = this.buf.slice(0, -1); env.out('\b \b'); } return null; }
    if (ch < ' ' || ch === '\x1b') return null;
    if (this.buf.length < this.max){ this.buf += ch; env.out(ch); }
    return null;
  }
}
const FILES = [
  {name: 'MODEMFAQ.TXT', size: 18432,  d: 'Modem-FAQ, deutsch'},
  {name: 'ANSIPACK.ZIP', size: 98304,  d: 'ANSI-Art-Sammlung'},
  {name: 'TREIBER.ZIP',  size: 45056,  d: 'Maustreiber'},
  {name: 'NODELIST.ZIP', size: 389120, d: 'FidoNet-Nodeliste'},
  {name: 'LABYRINT.ZIP', size: 626688, d: 'Shareware-Dungeon'}];
const DEMO_RATES = [300, 1200, 2400, 9600, 14400, 33600, 56000];


/* ================= S.A.S. banner ================= */
// Big letters in the style of an old telco test terminal; used for the SSH/serial
// login banner (pi/) and a hidden screen in the BBS.
const BIG = {
  S: [' █████ ', '█     █', '█      ', ' █████ ', '      █', '█     █', ' █████ '],
  A: ['  ███  ', ' █   █ ', '█     █', '█     █', '███████', '█     █', '█     █'],
  '.': ['  ', '  ', '  ', '  ', '  ', '  ', '█ ']};
function sasLogo(withBg = true){
  const rows = Array(7).fill('');
  for (const ch of 'S.A.S.'){ const gl = BIG[ch]; for (let r = 0; r < 7; r++) rows[r] += gl[r] + ' '; }
  const wide = rows.map(r => [...r].map(c => c + c).join(''));      // double width, like on a real terminal
  const w = wide[0].length, pad = Math.max(0, Math.floor((80 - w) / 2)), COL = [10, 10, 10, 10, 2, 2, 2];
  const col = f => withBg ? sg(f) : `\x1b[0;${f > 7 ? '1;' : ''}${30 + (f & 7)}m`;
  let out = '';
  for (let r = 0; r < 7; r++){
    let line = ' '.repeat(pad), cur = -1;
    for (let x = 0; x < w; x++){
      const on = wide[r][x] === '█', sh = !on && r > 0 && x > 1 && wide[r - 1][x - 2] === '█';
      const f = on ? COL[r] : sh ? 8 : -2;
      if (f !== -2 && f !== cur){ line += col(f); cur = f; }
      line += on ? '█' : sh ? '░' : ' ';
    }
    out += line.replace(/\s+$/, '') + R0 + '\r\n';
  }
  return out;
}

/* ================= BBS HOST (server edition) ================= */
/*
 * env contract (provided by server.js per caller):
 *   env.info        {rate, rateLabel, cps, arq, desc}
 *   env.node        node number of this caller
 *   env.out(text, {cps}?)  send Unicode text (encoded per caller: CP437 or UTF-8)
 *   env.flush()     drop pending output (hotkey interrupts screen build)
 *   env.hang()      disconnect once output has drained
 *   env.canDownload whether this caller supports Zmodem (web modem simulator)
 *   env.download(file, done)
 *   env.setName(name), env.nodes(), env.oneliners {list(), count(), add(name, text)}
 */
function bbsHost(){
  const h = {st: 'name', li: new LineIn(20), ansi: true, name: '', art: 0, pg: 0, npages: 0, t0: Date.now(), posted: 0};
  const say = (env, s) => env.out(h.ansi ? s : plainText(s));
  const key = (k, t) => `  ${sg(8)}[${sg(11)}${k}${sg(8)}]${sg(7)} ${t}`;

  function mainMenu(env){
    h.st = 'main';
    const L = 12, IW = 54;
    const bx = t => ' '.repeat(L) + sg(12) + '║' + R0 + padV(t, IW) + sg(12) + '║' + R0 + '\r\n';
    let s = CLS;
    s += h.ansi ? LOGO : '\r\n     Z E I T M A S C H I N E   B B S\r\n';
    s += sg(8) + ' '.repeat(18) + 'die Mailbox, die sich an 1994 erinnert' + R0 + '\r\n\r\n';
    s += ' '.repeat(L) + sg(12) + '╔' + '═'.repeat(IW) + '╗' + R0 + '\r\n';
    s += bx(key('W', 'Wissen: wie Modems funktionieren'));
    s += bx(key('D', 'Dateien herunterladen (Zmodem)'));
    s += bx(key('B', 'Bildaufbau-Demo und ANSI-Galerie'));
    s += bx(key('T', 'Telefonbuch: echte Mailboxen anrufen'));
    s += bx(key('O', 'Oneliner-Wand'));
    s += bx(key('K', 'Knoten: wer ist gerade online'));
    s += bx(key('N', 'Neuigkeiten') + '       ' + key('Z', 'Zeit und Tarif').slice(2));
    s += bx(key('G', 'Gute Nacht (auflegen)'));
    s += ' '.repeat(L) + sg(12) + '╚' + '═'.repeat(IW) + '╝' + R0 + '\r\n\r\n';
    s += `  ${sg(8)}${env.info.desc} · Knoten ${env.node}${R0}\r\n\r\n`;
    s += `  ${sg(15)}Deine Wahl, ${h.name}: ${R0}`;
    say(env, s);
  }
  function wikiList(env){
    h.st = 'wiki';
    let s = CLS + bar('WISSEN', 'Wie Modems funktionieren') + '\r\n';
    for (const a of WIKI) s += `  ${sg(11)}${a.k}${sg(8)}  ${sg(7)}${a.t}${R0}\r\n`;
    s += `\r\n  ${sg(8)}Jede Seite kommt mit deiner Leitungsgeschwindigkeit an.${R0}\r\n`;
    s += `\r\n  ${sg(8)}[Q] Hauptmenü${R0}\r\n\r\n  ${sg(15)}Welcher Artikel? ${R0}`;
    say(env, s);
  }
  function pages(a, env){
    const lines = a.dyn ? speedArticle(env.info) : a.l, per = 20;
    const secs = []; let cur = [];
    for (const ln of lines){ if (ln.startsWith('# ') && cur.length){ secs.push(cur); cur = []; } cur.push(ln); }
    if (cur.length) secs.push(cur);
    const trim = arr => { while (arr.length && arr[arr.length - 1] === '') arr.pop(); while (arr.length && arr[0] === '') arr.shift(); return arr; };
    const out = []; let pg = [];
    for (let sec of secs){
      sec = trim(sec.slice());
      if (pg.length && pg.length + 1 + sec.length > per){ out.push(pg); pg = []; }
      if (pg.length) pg.push('');
      while (sec.length > per - pg.length){ const room = per - pg.length; pg.push(...sec.slice(0, room)); sec = sec.slice(room); out.push(pg); pg = []; }
      pg.push(...sec);
    }
    if (pg.length) out.push(pg);
    return out;
  }
  function showPage(env){
    const a = WIKI[h.art], pg = pages(a, env);
    h.st = 'page'; h.npages = pg.length;
    let s = CLS + bar(`WISSEN ${a.k}`, `Seite ${h.pg + 1}/${pg.length}`);
    s += `${sg(15)}  ${a.t}${R0}\r\n\r\n`;
    for (const ln of pg[h.pg]){
      if (ln.startsWith('# ')) s += `  ${sg(11)}${ln.slice(2)}${R0}\r\n`;
      else if (ln.startsWith('>')) s += `  ${sg(6)}${ln.slice(1)}${R0}\r\n`;
      else s += `  ${sg(7)}${ln}${R0}\r\n`;
    }
    s += h.ansi ? '\x1b[24;1H' : '\r\n';
    s += `  ${sg(8)}[Enter] weiter   [Z] zurück   [Q] Übersicht${R0}`;
    say(env, s);
  }
  function files(env){
    h.st = 'files';
    const c = env.info.cps * 0.97;
    let s = CLS + bar('DATEIEN', 'Download per Zmodem') + '\r\n';
    s += `  ${sg(15)}Nr  Datei           Bytes   Dauer*      Beschreibung${R0}\r\n`;
    s += `  ${sg(8)}${'─'.repeat(64)}${R0}\r\n`;
    FILES.forEach((f, i) => {
      s += `  ${sg(11)} ${i + 1}${sg(7)}  ${f.name.padEnd(13)}${fmtNum(f.size).padStart(8)}   ${sg(14)}${fmtDur(f.size / c).padEnd(10)}${sg(7)}  ${f.d}${R0}\r\n`;
    });
    s += `\r\n  ${sg(8)}* ${env.info.desc}${R0}\r\n`;
    if (!env.canDownload) s += `  ${sg(8)}  Zmodem gibt es derzeit nur über den Web-Modem-Simulator.${R0}\r\n`;
    s += `\r\n  ${sg(8)}[1-5] herunterladen   [Q] Hauptmenü${R0}\r\n\r\n  ${sg(15)}Deine Wahl: ${R0}`;
    say(env, s);
  }
  function demo(env, rate){
    h.st = 'demo';
    const note = rate ? `simuliert mit ${fmtNum(rate)} bit/s` : 'mit deiner Verbindung';
    let s = CLS + SUNSET;
    s += `${sg(8)}  ${fmtNum(enc437(SUNSET).length)} Bytes ANSI, ${note}${R0}\r\n`;
    s += `  ${DEMO_RATES.map((r, i) => `${sg(11)}${i + 1}${sg(7)} ${r}`).join('  ')}  ${sg(8)}Q zurück${R0}`;
    if (rate) env.out(s, {cps: rate / 10}); else env.out(s);
  }
  function wall(env){
    h.st = 'wall';
    const list = env.oneliners.list();
    let s = CLS + bar('ONELINER-WAND', `${env.oneliners.count()} Einträge`) + '\r\n';
    if (!list.length) s += `  ${sg(8)}Noch ist die Wand leer. Sei der Erste!${R0}\r\n`;
    for (const o of list){
      const d = new Date(o.at);
      s += `  ${sg(8)}${d.toLocaleDateString('de-DE', {day: '2-digit', month: '2-digit'})} ${sg(11)}${o.name.slice(0, 14).padEnd(15)}${sg(7)}${o.text}${R0}\r\n`;
    }
    s += `\r\n  ${sg(8)}[E] Eintrag schreiben   [Q] Hauptmenü${R0}\r\n\r\n  ${sg(15)}Deine Wahl: ${R0}`;
    say(env, s);
  }
  function phonebook(env){
    h.st = 'dial'; h.li = new LineIn(12);
    const pb = env.phonebook();
    let s = CLS + bar('TELEFONBUCH', 'Gateway zu echten Mailboxen') + '\r\n';
    s += `  ${sg(7)}Die Box wählt für dich ins Internet hinaus (Telnet) und reicht die\r\n  Verbindung durch - in deinem Leitungstempo.${R0}\r\n\r\n`;
    s += `  ${sg(15)}Nummer    Mailbox                        Info${R0}\r\n`;
    s += `  ${sg(8)}${'─'.repeat(72)}${R0}\r\n`;
    if (!pb.length) s += `  ${sg(8)}Das Telefonbuch ist leer. Der Sysop pflegt es in phonebook.json.${R0}\r\n`;
    for (const e of pb.slice(0, 12)) s += `  ${sg(11)}${e.number.padEnd(10)}${sg(15)}${e.name.padEnd(31)}${sg(7)}${e.desc}${R0}\r\n`;
    s += `\r\n  ${sg(8)}Unterwegs trennen: Enter, dann ~.   Leere Eingabe: zurück${R0}\r\n\r\n  ${sg(15)}Nummer wählen: ${R0}`;
    say(env, s);
  }
  function sasScreen(env){   // easter egg: not in the menu
    h.st = 'wait';
    const busy = new Map(env.nodes().map(n => [n.node, n]));
    let s = CLS + bar('S.A.S.', 'Switched Access Services · Nachbau') + '\r\n' + sasLogo() + '\r\n';
    s += `  ${sg(15)}Leitung  Status    Verbindung                    Teilnehmer${R0}\r\n`;
    s += `  ${sg(8)}${'─'.repeat(70)}${R0}\r\n`;
    for (let i = 1; i <= 6; i++){
      const n = busy.get(i);
      s += n ? `  ${sg(10)}L${String(i).padStart(2, '0')}      BELEGT    ${sg(7)}${n.via.slice(0, 29).padEnd(30)}${sg(15)}${n.name || '...'}${R0}\r\n`
             : `  ${sg(2)}L${String(i).padStart(2, '0')}      frei${R0}\r\n`;
    }
    s += `\r\n  ${sg(8)}Mithörfunktion: nicht vorhanden. Diese Anlage hört nicht mit.   [Taste]${R0}`;
    say(env, s);
  }
  function nodesScreen(env){
    h.st = 'wait';
    let s = CLS + bar('KNOTEN', 'wer ist gerade online') + '\r\n';
    s += `  ${sg(15)}Knoten  Name             Verbindung                  online seit${R0}\r\n`;
    s += `  ${sg(8)}${'─'.repeat(70)}${R0}\r\n`;
    for (const n of env.nodes()){
      const me = n.node === env.node;
      s += `  ${sg(me ? 11 : 7)}${String(n.node).padStart(4)}    ${(n.name || '...').slice(0, 16).padEnd(17)}${n.via.slice(0, 27).padEnd(28)}${fmtDur((Date.now() - n.since) / 1000)}${R0}\r\n`;
    }
    s += `\r\n  ${sg(8)}[Taste] zurück${R0}`;
    say(env, s);
  }
  function news(env){
    h.st = 'wait';
    let s = CLS + bar('NEUIGKEITEN', 'vom Sysop') + '\r\n';
    s += `  ${sg(7)}- Die Box ist jetzt auch per Telnet erreichbar. Wer mit dem Web-Modem\r\n    anruft, landet auf demselben System - schaut mal unter [K].\r\n`;
    s += '  - Neu: die Oneliner-Wand. Bitte freundlich bleiben.\r\n';
    s += '  - Neu: das Telefonbuch [T]. Die Box wählt echte Mailboxen im Internet an.\r\n';
    s += '  - Der Mondscheintarif gilt ab 21 Uhr. Bitte trotzdem nicht nach\r\n    23 Uhr anrufen, das Modem steht neben dem Bett.\r\n';
    s += '  - Wer Diskette 4 von 7 hat: bitte zurückgeben.\r\n';
    s += `  - Im Wissensbereich: zehn Artikel darüber, wie das alles funktioniert.${R0}\r\n`;
    s += `\r\n  ${sg(8)}[Taste] zurück${R0}`;
    say(env, s);
  }
  function time(env){
    h.st = 'wait';
    const d = new Date();
    let s = CLS + bar('ZEIT UND TARIF', `Knoten ${env.node}`) + '\r\n';
    s += `  ${sg(7)}Es ist ${d.toLocaleDateString('de-DE')}, ${d.toLocaleTimeString('de-DE')} Uhr.\r\n\r\n`;
    s += '  Früher zählte jede Minute: Ein Ortsgespräch kostete Einheiten, und\r\n';
    s += '  nachts war es billiger ("Mondscheintarif"). Viele Boxen begrenzten\r\n';
    s += '  deshalb die Zeit pro Anruf - hier sind es großzügige 60 Minuten.\r\n\r\n';
    s += `  Du bist seit ${fmtDur((Date.now() - h.t0) / 1000)} online.${R0}\r\n`;
    s += `\r\n  ${sg(8)}[Taste] zurück${R0}`;
    say(env, s);
  }

  h.start = env => { h.t0 = Date.now(); env.out('\r\n\r\nZEITMASCHINE BBS - Knoten ' + env.node + '\r\n\r\nDein Name: '); };
  h.key = (ch, env) => {
    const k = ch.toUpperCase();
    switch (h.st){
      case 'name': {
        const l = h.li.feed(ch, env); if (l === null) return;
        h.name = l.replace(/[^\p{L}\p{N} ._-]/gu, '').trim().slice(0, 20) || 'Gast';
        env.setName(h.name); h.st = 'ansi';
        env.out(`\r\nHallo ${h.name}!\r\nANSI-Grafik verwenden? [J/N] ${env.info.cps < 60 ? '(bei dieser Geschwindigkeit lieber N) ' : ''}`);
        return;
      }
      case 'ansi':
        if (!k || !'JNY'.includes(k)) return;
        h.ansi = k !== 'N'; env.out(k + '\r\n'); mainMenu(env); return;
      case 'main':
        env.flush();
        if (k === 'W') wikiList(env);
        else if (k === 'D') files(env);
        else if (k === 'B') demo(env, 0);
        else if (k === 'O') wall(env);
        else if (k === 'T') phonebook(env);
        else if (k === 'S') sasScreen(env);
        else if (k === 'K') nodesScreen(env);
        else if (k === 'N') news(env);
        else if (k === 'Z') time(env);
        else if (k === 'G'){ h.st = 'bye'; env.out(`\r\n\r\n  Tschüss ${h.name}, bis zum nächsten Mondscheintarif!\r\n`); env.hang(); }
        else if (ch === '\r') mainMenu(env);
        return;
      case 'wiki': {
        const i = WIKI.findIndex(a => a.k === k);
        if (i >= 0){ env.flush(); h.art = i; h.pg = 0; showPage(env); }
        else if (k === 'Q' || ch === '\x1b'){ env.flush(); mainMenu(env); }
        return;
      }
      case 'page':
        if (ch === '\r' || ch === ' ' || k === 'W'){ env.flush(); if (h.pg + 1 < h.npages){ h.pg++; showPage(env); } else wikiList(env); }
        else if (k === 'Z'){ env.flush(); if (h.pg > 0){ h.pg--; showPage(env); } else wikiList(env); }
        else if (k === 'Q' || ch === '\x1b'){ env.flush(); wikiList(env); }
        return;
      case 'files': {
        const i = +ch - 1;
        if (i >= 0 && i < FILES.length){
          const f = FILES[i];
          if (!env.canDownload){ h.st = 'wait'; env.out(`${ch}\r\n\r\n  ${sg(7)}Zmodem über Telnet ist noch nicht eingebaut. Ruf mit dem\r\n  Web-Modem-Simulator an, dann klappt der Download.${R0}\r\n\r\n  ${sg(8)}[Taste] zurück${R0}`); return; }
          h.st = 'busy';
          env.out(`${ch}\r\n\r\n  ${sg(7)}Sende ${f.name} per Zmodem ...${R0}\r\nrz\r**\x18B00000000000000\r\n`);
          env.download(f, ok => {
            h.st = 'wait';
            env.out(ok ? `\r\n  ${sg(10)}${f.name} ist angekommen: ${fmtNum(f.size)} Bytes.${R0}\r\n\r\n  ${sg(8)}[Taste] zurück${R0}`
                       : `\r\n  ${sg(9)}Übertragung abgebrochen.${R0}\r\n\r\n  ${sg(8)}[Taste] zurück${R0}`);
          });
        } else if (k === 'Q' || ch === '\x1b'){ env.flush(); mainMenu(env); }
        return;
      }
      case 'demo': {
        const i = +ch - 1;
        if (i >= 0 && i < DEMO_RATES.length){ env.flush(); demo(env, DEMO_RATES[i]); }
        else if (k === 'Q' || ch === '\x1b'){ env.flush(); mainMenu(env); }
        return;
      }
      case 'wall':
        if (k === 'E'){
          if (h.posted >= 3){ env.out(`E\r\n  ${sg(9)}Drei Einträge pro Anruf reichen.${R0} `); return; }
          h.st = 'post'; h.li = new LineIn(60);
          env.out(`E\r\n\r\n  ${sg(7)}Dein Oneliner (max. 60 Zeichen):${R0}\r\n  `);
        } else if (k === 'Q' || ch === '\x1b'){ env.flush(); mainMenu(env); }
        return;
      case 'post': {
        const l = h.li.feed(ch, env); if (l === null) return;
        const text = l.replace(/[^\p{L}\p{N}\p{P}\p{Zs}+=<>^|~$]/gu, '').trim().slice(0, 60);
        if (text){ env.oneliners.add(h.name, text); h.posted++; }
        env.flush(); wall(env); return;
      }
      case 'dial': {
        const l = h.li.feed(ch, env); if (l === null) return;
        const n = l.replace(/\D/g, '');
        if (!n){ env.flush(); mainMenu(env); return; }
        h.st = 'online';
        if (!env.gateway(n)){ h.st = 'wait'; env.out(`\r\n  ${sg(9)}Kein Anschluss unter dieser Nummer.${R0}\r\n\r\n  ${sg(8)}[Taste] zurück${R0}`); }
        return;
      }
      case 'wait': env.flush(); mainMenu(env); return;
    }
  };
  h.resume = env => { h.st = 'wait'; env.out(`\r\n  ${sg(10)}Zurück in der Zeitmaschine.${R0}  ${sg(8)}[Taste]${R0}`); };
  return h;
}

module.exports = {bbsHost, enc437, dec437, sasLogo};
