// Zeitmaschine SIM-56 stick case - parametric, OpenSCAD 2021.01+
// Defaults fit the common "USB-A Addon Board V1.1" (pogo pins, Pi-sized, sold e.g. by BerryBase):
// the USB-A plug is soldered to the adapter's OUTER face at the end opposite the microSD card.
// Stack: nylon screws from below (heads under the adapter) -> spacer nut -> Pi -> 11 mm
// female-female standoffs screwed onto the screw ends -> carrier board. The stack rests in
// the floor, posts under the lid hold it down. No screws through the floor.
// Stack (bottom to top): case floor -> USB stick adapter -> Pi Zero 2 W ->
// 11 mm standoffs -> carrier board with 8 LEDs and speaker -> lid.
//
// Export:  openscad -D 'part="bottom"' -o bottom.stl case.scad
//          openscad -D 'part="lid"'    -o lid.stl    case.scad
// License: CERN-OHL-P-2.0
part = "assembly";            // "bottom", "lid", "assembly"

/* [Printer] */
wall    = 1.8;
floor_t = 1.6;
lid_t   = 2.0;
clr     = 0.4;                // clearance around the boards
lip_clr = 0.25;               // lid lip fit: bigger = looser
$fn     = 48;

/* [Boards] */
pi_l = 65; pi_w = 30; pcb_t = 1.6;
pi_holes = [[3.5, 3.5], [61.5, 3.5], [3.5, 26.5], [61.5, 26.5]];
sd_space       = 3;           // room for the microSD card at the left end
adapter_extra  = 1;           // room between the Pi's right edge and the wall (V1.1: board ends with the Pi)
plug_h         = 4.5;         // USB-A plug thickness, below the adapter board
head_h         = 2;           // screw heads / nuts under the adapter
adapter_under  = 3.6;         // adapter bottom -> Pi bottom (V1.1: PCB 1.6 + spacer nut 2)
standoff       = 11;          // Pi top -> carrier board bottom (header stack)
carrier_l      = 66;          // carrier board length

/* [Front panel] */
led_d     = 3.2;              // 3 mm LEDs, press fit
led_base  = 3;                // LED body stands this far above the carrier (spacer or longer legs)
led_h     = 5.3;              // LED body height
led_proud = 1.0;              // LED domes stick out of the lid
led_pitch = 5.08;           // 2 holes on 2.54 mm perfboard
led_x0    = 26.15;            // first LED (grid column 7), from the Pi's left edge
led_y     = 13.8;             // between grid rows 15.07 (anode) and 12.53 (cathode)
labels    = ["HS", "AA", "CD", "OH", "RD", "SD", "TR", "MR"];
label_y   = 7.6;
title     = "ZEITMASCHINE SIM-56";
engrave   = 0.6;
font      = "Liberation Sans:style=Bold";

/* [Speaker] */
speaker    = true;
spk_d      = 20;              // e.g. 20 mm micro speaker, 8 ohm
spk_h      = 4;
spk_xy     = [12.5, 12.5];      // centre, relative to the Pi's left/bottom edge
bump_h     = 0;               // raised grille (> 0 needs supports when printing)

/* [Openings] */
usb_w = 12.8; usb_h = 5.2;    // USB-A plug at the right end (snug, locates the stick)
sd_w  = 13; sd_h  = 3.2;      // microSD slot at the left end
sd_y  = 15;                   // microSD centre, from the Pi's bottom edge

// ------------------------------------------------------------------ derived
x0 = clr + sd_space;                          // Pi origin inside the case
y0 = clr;
in_l = sd_space + pi_l + adapter_extra + 2 * clr;
in_w = pi_w + 2 * clr;
z_adapter = floor_t + plug_h + 0.3;           // the plug nearly rests on the floor
z_pi      = z_adapter + adapter_under;
z_carrier = z_pi + pcb_t + standoff;
z_ledtop  = z_carrier + pcb_t + led_base + led_h;
H         = z_ledtop - led_proud;             // lid top, LED domes stick out
H_bottom  = H - lid_t;
out_l = in_l + 2 * wall; out_w = in_w + 2 * wall;
r_corner = 3;
usb_zc = z_adapter - plug_h / 2;              // plug on the adapter's outer face
sd_zc  = z_pi - 0.9;

module rbox(l, w, h, r){
  hull() for (x = [r, l - r], y = [r, w - r]) translate([x, y, 0]) cylinder(r = r, h = h);
}

// ------------------------------------------------------------------ bottom shell
module bottom(){
  difference(){
    rbox(out_l, out_w, H_bottom, r_corner);
    translate([wall, wall, floor_t]) cube([in_l, in_w, H]);
    // USB-A plug, right end
    translate([out_l - wall - 1, wall + in_w / 2 - usb_w / 2, usb_zc - usb_h / 2]) cube([wall + 2, usb_w, usb_h]);
    // microSD, left end
    translate([-1, wall + y0 + sd_y - sd_w / 2, sd_zc - sd_h / 2]) cube([wall + 2, sd_w, sd_h]);
    // vents on both long sides, level with the SoC
    for (i = [0:3], y = [-1, out_w - wall - 1]) translate([wall + x0 + 20 + i * 5, y, z_pi + pcb_t + 2]) cube([2, wall + 2, 7]);
  }
  // rests carrying the stack: round pockets take the screw heads / nuts under the adapter
  rest_h = z_adapter - head_h - floor_t + 1;
  for (p = pi_holes) translate([wall + x0 + p[0], wall + y0 + p[1], floor_t - 0.01]) difference(){
    cylinder(d = 7, h = rest_h);
    translate([0, 0, rest_h - 1]) cylinder(d = 6, h = 2);
  }
}

// ------------------------------------------------------------------ lid
module lid(){
  lip_d = 2.5; lip_t = 1.2;
  sx = wall + x0 + spk_xy[0]; sy = wall + y0 + spk_xy[1];
  difference(){
    union(){
      translate([0, 0, H - lid_t]) rbox(out_l, out_w, lid_t, r_corner);
      // lip that slides into the bottom shell
      translate([wall + lip_clr, wall + lip_clr, H - lid_t - lip_d]) difference(){
        cube([in_l - 2 * lip_clr, in_w - 2 * lip_clr, lip_d + 0.01]);
        translate([lip_t, lip_t, -1]) cube([in_l - 2 * lip_clr - 2 * lip_t, in_w - 2 * lip_clr - 2 * lip_t, lip_d + 2]);
      }
      // posts that press the stack down (onto the carrier's screw heads)
      post_len = (H - lid_t) - (z_carrier + pcb_t + 1.8 + 0.2);
      for (p = pi_holes) translate([wall + x0 + p[0], wall + y0 + p[1], H - lid_t - post_len]) cylinder(d = 4.2, h = post_len + 0.01);
      // raised speaker grille
      if (speaker && bump_h > 0) translate([sx, sy, H - 0.01]) cylinder(d1 = spk_d + 5, d2 = spk_d + 2, h = bump_h);
    }
    // LED holes + engraved labels
    for (i = [0:len(labels) - 1]) {
      lx = wall + x0 + led_x0 + i * led_pitch;
      translate([lx, wall + y0 + led_y, H - lid_t - 1]) cylinder(d = led_d, h = lid_t + 2);
      translate([lx, wall + y0 + label_y, H - engrave]) linear_extrude(engrave + 1)
        text(labels[i], size = 2.2, font = font, halign = "center", valign = "center", spacing = 0.92);
    }
    // title along the header edge
    translate([wall + x0 + led_x0 + (len(labels) - 1) * led_pitch / 2, wall + y0 + 24.5, H - engrave])
      linear_extrude(engrave + 1) text(title, size = 2.8, font = font, halign = "center", valign = "center");
    if (speaker) {
      // cavity for the speaker body
      spk_cav = (z_carrier + pcb_t + spk_h + 0.5) - (H - lid_t);   // only if the speaker reaches into the lid
      if (spk_cav > 0) translate([sx, sy, H - lid_t - 1]) cylinder(d = spk_d + 1, h = spk_cav + 1);
      // decorative ring around the grille
      translate([sx, sy, H - engrave]) difference(){ cylinder(d = spk_d + 2.4, h = engrave + 1); cylinder(d = spk_d + 1.0, h = engrave + 1); }
      // grille holes, hex pattern
      for (gx = [-3:3], gy = [-3:3]) {
        px = gx * 2.6 + (gy % 2) * 1.3; py = gy * 2.25;
        if (px * px + py * py < pow(spk_d / 2 - 2, 2)) translate([sx + px, sy + py, H - lid_t - 1]) cylinder(d = 1.5, h = lid_t + bump_h + 2, $fn = 12);
      }
    }
  }
}

// ------------------------------------------------------------------ preview of the boards
module boards(){
  color("darkgreen") translate([wall + x0, wall + y0, z_adapter]) cube([pi_l, pi_w, pcb_t]);
  color("green")     translate([wall + x0, wall + y0, z_pi]) cube([pi_l, pi_w, pcb_t]);
  color("silver")    translate([wall + x0 + pi_l - 4, wall + in_w / 2 - 6, z_adapter - plug_h]) cube([19, 12, plug_h]);
  for (p = pi_holes) color("white") translate([wall + x0 + p[0], wall + y0 + p[1], z_pi + pcb_t]) cylinder(d = 4.5, h = standoff);
  color("tan")       translate([wall + x0, wall + y0, z_carrier]) cube([carrier_l, pi_w, pcb_t]);
  for (i = [0:7]) color(i == 0 ? "orange" : i == 7 ? "lime" : "red")
    translate([wall + x0 + led_x0 + i * led_pitch, wall + y0 + led_y, z_carrier + pcb_t + led_base]) cylinder(d = 3, h = led_h);
  if (speaker) color("dimgray") translate([wall + x0 + spk_xy[0], wall + y0 + spk_xy[1], z_carrier + pcb_t]) cylinder(d = spk_d, h = spk_h);
}

if (part == "bottom") bottom();
else if (part == "lid") translate([0, out_w, H]) rotate([180, 0, 0]) lid();   // print upside down
else { bottom(); boards(); translate([0, 0, 8]) lid(); }
echo(str("Case outside: ", out_l, " x ", out_w, " x ", H, " mm; material above the speaker: ", H - (z_carrier + pcb_t + spk_h + 0.5), " mm"));
