// Zeitmaschine SIM-56 desk modem - a small 90s-style desktop modem, OpenSCAD 2021.01+
// Same carrier board as the stick. The Pi is connected by a micro-USB cable
// (its "USB" data port powers it and carries the network) - no USB adapter needed.
//
// Export:  openscad -D 'part="bottom"' -o desk-bottom.stl desk.scad
//          openscad -D 'part="lid"'    -o desk-lid.stl    desk.scad
// License: CERN-OHL-P-2.0
part = "assembly";            // "bottom", "lid", "assembly"

/* [Printer] */
wall    = 2.2;
floor_t = 2.0;
lid_t   = 2.4;
clr     = 0.4;
lip_clr = 0.25;
$fn     = 48;

/* [Size] */
out_l    = 118;               // width
out_d    = 46;                // depth
r_corner = 5;
feet_h   = 1.5;

/* [Boards] */
pi_l = 65; pi_w = 30; pcb_t = 1.6;
pi_holes = [[3.5, 3.5], [61.5, 3.5], [3.5, 26.5], [61.5, 26.5]];
boss_h   = 3;
standoff = 11;
sd_space = 1.5;               // gap between the Pi's SD end and the left wall
usb_x    = 41.4;              // micro-USB "USB" (data) port centre, from the Pi's left edge
pwr_x    = 54.0;              // micro-USB "PWR" port centre
port_w   = 12; port_h = 8;    // openings for cable plugs
sd_w = 13; sd_h = 3.2; sd_y = 15;

/* [Front panel] */
led_d = 3.2; led_base = 3; led_h = 5.3; led_proud = 1.0;
led_pitch = 5.08; led_x0 = 26.15; led_y = 13.8;      // Pi coordinates, same as the stick
labels = ["HS", "AA", "CD", "OH", "RD", "SD", "TR", "MR"];
engrave = 0.6;
font = "Liberation Sans:style=Bold";

/* [Speaker] */
speaker = true;
spk_d = 28;                   // 28 mm, 8 ohm, up to ~6 mm tall
spk_xy = [96, 21];            // centre in case coordinates

// ------------------------------------------------------------------ derived
in_l = out_l - 2 * wall; in_d = out_d - 2 * wall;
pi_x0 = wall + clr + sd_space;              // Pi's left edge
rear_in = wall + in_d - clr;                // the Pi's port edge faces the rear wall
PX = function(px) pi_x0 + px;               // Pi -> case coordinates
PY = function(py) rear_in - py;
z_pi      = floor_t + boss_h;
z_carrier = z_pi + pcb_t + standoff;
z_ledtop  = z_carrier + pcb_t + led_base + led_h;
H         = z_ledtop - led_proud;
H_bottom  = H - lid_t;
led_cx    = PX(led_x0 + (len(labels) - 1) * led_pitch / 2);

module rbox(l, w, h, r){ hull() for (x = [r, l - r], y = [r, w - r]) translate([x, y, 0]) cylinder(r = r, h = h); }
module rrect2d(l, w, r){ offset(r) offset(-r) square([l, w]); }

module bottom(){
  difference(){
    union(){
      rbox(out_l, out_d, H_bottom, r_corner);
      for (x = [12, out_l - 12], y = [10, out_d - 10]) translate([x, y, -feet_h]) cylinder(d = 9, h = feet_h + 0.01);
    }
    translate([wall, wall, floor_t]) cube([in_l, in_d, H]);
    // cable openings at the rear: USB (data + power) and PWR
    for (px = [usb_x, pwr_x]) translate([PX(px) - port_w / 2, out_d - wall - 1, z_pi + pcb_t + 1.4 - port_h / 2]) cube([port_w, wall + 2, port_h]);
    // microSD, left side
    translate([-1, PY(sd_y) - sd_w / 2, z_pi - 0.9 - sd_h / 2]) cube([wall + 2, sd_w, sd_h]);
    // screws from below (M2.5), heads recessed
    for (p = pi_holes) translate([PX(p[0]), PY(p[1]), -feet_h - 1]) {
      cylinder(d = 2.8, h = floor_t + boss_h + feet_h + 2);
      cylinder(d = 5.2, h = feet_h + 1 + 1.0);
    }
    // engraved port labels on the rear wall
    for (a = [[usb_x, "USB"], [pwr_x, "PWR"]]) translate([PX(a[0]), out_d - engrave, z_pi + pcb_t + 1.4 + port_h / 2 + 2.2]) rotate([90, 0, 180])
      linear_extrude(engrave + 1) text(a[1], size = 2.6, font = font, halign = "center", valign = "center");
    // side vents
    for (i = [0:5]) translate([out_l - wall - 1, 12 + i * 4, floor_t + 4]) cube([wall + 2, 2, H_bottom - floor_t - 8]);
  }
  for (p = pi_holes) translate([PX(p[0]), PY(p[1]), floor_t - 0.01]) difference(){
    cylinder(d = 6, h = boss_h);
    translate([0, 0, -1]) cylinder(d = 2.8, h = boss_h + 2);
  }
}

module lid(){
  lip_d = 2.5; lip_t = 1.2;
  difference(){
    union(){
      translate([0, 0, H - lid_t]) rbox(out_l, out_d, lid_t, r_corner);
      translate([wall + lip_clr, wall + lip_clr, H - lid_t - lip_d]) difference(){
        cube([in_l - 2 * lip_clr, in_d - 2 * lip_clr, lip_d + 0.01]);
        translate([lip_t, lip_t, -1]) cube([in_l - 2 * lip_clr - 2 * lip_t, in_d - 2 * lip_clr - 2 * lip_t, lip_d + 2]);
      }
      if (speaker) translate([spk_xy[0], spk_xy[1], H - lid_t - 3]) difference(){      // speaker holder ring
        cylinder(d = spk_d + 3.2, h = 3.01); translate([0, 0, -1]) cylinder(d = spk_d + 0.6, h = 5);
      }
    }
    // LEDs, labels and the dark "window" frame around them
    for (i = [0:len(labels) - 1]) {
      lx = PX(led_x0 + i * led_pitch);
      translate([lx, PY(led_y), H - lid_t - 1]) cylinder(d = led_d, h = lid_t + 2);
      translate([lx, PY(led_y) - 6.2, H - engrave]) linear_extrude(engrave + 1)
        text(labels[i], size = 2.2, font = font, halign = "center", valign = "center", spacing = 0.92);
    }
    translate([led_cx - 23, PY(led_y) - 10, H - engrave]) linear_extrude(engrave + 1) difference(){
      rrect2d(46, 14.5, 2); translate([0.8, 0.8]) rrect2d(44.4, 12.9, 1.4);
    }
    // name plate
    translate([led_cx, 8.5, H - engrave]) linear_extrude(engrave + 1)
      text("ZEITMASCHINE  SIM-56", size = 4.2, font = font, halign = "center", valign = "center");
    // rear ribs, like the classic desk modems
    for (i = [0:2]) translate([8, out_d - 6.5 - i * 2.2, H - engrave]) cube([out_l - 16, 1.1, engrave + 1]);
    // speaker grille: horizontal slots
    if (speaker) for (j = [-4:4]) {
      w = 2 * sqrt(max(0, pow(spk_d / 2 - 1, 2) - pow(j * 2.6, 2)));
      if (w > 3) translate([spk_xy[0] - w / 2, spk_xy[1] + j * 2.6 - 0.65, H - lid_t - 1]) cube([w, 1.3, lid_t + 2]);
    }
  }
}

module boards(){
  color("green") translate([PX(0), PY(pi_w), z_pi]) cube([pi_l, pi_w, pcb_t]);
  color("tan")   translate([PX(0), PY(pi_w), z_carrier]) cube([66, pi_w, pcb_t]);
  for (i = [0:7]) color(i == 0 ? "orange" : i == 7 ? "lime" : "red")
    translate([PX(led_x0 + i * led_pitch), PY(led_y), z_carrier + pcb_t + led_base]) cylinder(d = 3, h = led_h);
  color("silver") for (px = [usb_x, pwr_x]) translate([PX(px) - 4, rear_in - 5, z_pi + pcb_t]) cube([8, 5.5, 2.6]);
  if (speaker) color("dimgray") translate([spk_xy[0], spk_xy[1], H - lid_t - 5]) cylinder(d = spk_d, h = 5);
}

if (part == "bottom") translate([0, 0, feet_h]) bottom();
else if (part == "lid") translate([0, out_d, H]) rotate([180, 0, 0]) lid();
else { bottom(); boards(); translate([0, 0, 10]) lid(); }
echo(str("Desk modem outside: ", out_l, " x ", out_d, " x ", H + feet_h, " mm"));
