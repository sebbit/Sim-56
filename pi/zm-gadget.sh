#!/usr/bin/env bash
# USB composite gadget via configfs: CDC-ECM Ethernet (usb0) + CDC-ACM serial (ttyGS0).
# Linux and macOS use both out of the box; Windows 10/11 gets the serial port as COMx.
set -euo pipefail
G=/sys/kernel/config/usb_gadget/zeitmaschine
modprobe libcomposite
[ -d "$G" ] && exit 0
mkdir -p "$G" && cd "$G"
echo 0x1d6b > idVendor          # Linux Foundation
echo 0x0104 > idProduct         # Multifunction Composite Gadget
echo 0x0100 > bcdDevice
echo 0x0200 > bcdUSB
echo 0xEF > bDeviceClass        # composite with interface association
echo 0x02 > bDeviceSubClass
echo 0x01 > bDeviceProtocol
mkdir -p strings/0x409
serial=$(tr -d '\0' </proc/device-tree/serial-number 2>/dev/null | tail -c 8 || true)
echo "zm${serial:-0001}" > strings/0x409/serialnumber
echo "Zeitmaschine" > strings/0x409/manufacturer
echo "SIM-56 Modem" > strings/0x409/product
mkdir -p configs/c.1/strings/0x409
echo "Ethernet + Serial" > configs/c.1/strings/0x409/configuration
echo 250 > configs/c.1/MaxPower
mkdir -p functions/ecm.usb0 functions/acm.GS0
echo "02:5a:4d:00:00:01" > functions/ecm.usb0/dev_addr    # fixed MACs: the PC keeps
echo "02:5a:4d:00:00:02" > functions/ecm.usb0/host_addr   # the same interface every time
ln -s functions/ecm.usb0 configs/c.1/
ln -s functions/acm.GS0 configs/c.1/
ls /sys/class/udc > UDC
