# ============================================================
# Smart Waste Classifier - Micro:bit Firmware (MicroPython)
# ============================================================
# Hardware:
#   - Servo Motor  -> Pin 8  (PWM, 0deg = close / 90deg = open)
#   - ZX-RGB3C LED -> Pin 16 (NeoPixel WS2812, 1 unit)
#
# Protocol (USB Serial @ 115200 baud):
#   Receive:  OPEN:YELLOW\n | OPEN:GREEN\n | OPEN:RED\n | OPEN:BLUE\n | PING\n
#   Send:     STATUS:COLOR:OPENED\n | STATUS:COLOR:CLOSED\n | PONG\n | READY\n
#
# Flash guide: https://python.microbit.org/ -> Load this file
# ============================================================

from microbit import *
import neopixel
import utime

# ---- Hardware Configuration ----
SERVO_PIN     = pin8
LED_PIN       = pin16
LED_COUNT     = 3         # Number of LEDs on ZX-RGB3C module
AUTO_CLOSE_MS = 4000      # Auto-close delay (milliseconds)

# ---- NeoPixel Setup ----
np = neopixel.NeoPixel(LED_PIN, LED_COUNT)

# ---- Waste type colors (R, G, B) ----
COLORS = {
    'YELLOW': (255, 180,   0),
    'GREEN':  (  0, 200,   0),
    'RED':    (220,   0,   0),
    'BLUE':   (  0,  80, 255),
    'OFF':    (  0,   0,   0),
}

# ---- LED Matrix icons per bin type ----
ICONS = {
    'YELLOW': Image("00000:"
                    "09090:"
                    "09990:"
                    "09090:"
                    "00000"),
    'GREEN':  Image("00900:"
                    "09990:"
                    "09090:"
                    "00900:"
                    "09990"),
    'RED':    Image("09090:"
                    "09090:"
                    "00900:"
                    "09090:"
                    "09090"),
    'BLUE':   Image("09990:"
                    "09090:"
                    "09090:"
                    "09090:"
                    "09990"),
}

# ---- State variables ----
current_color   = None
is_open         = False
open_start_time = 0


def set_servo(angle):
    """Control Servo: 0deg = closed, 90deg = open"""
    SERVO_PIN.set_analog_period_microseconds(20000)
    pulse_us = 1000 + int(angle / 180.0 * 1000)
    duty = int((pulse_us / 20000.0) * 1023)
    SERVO_PIN.write_analog(duty)


def servo_open():
    set_servo(90)


def servo_close():
    set_servo(0)
    utime.sleep_ms(300)
    SERVO_PIN.write_digital(0)


def set_led(color_name):
    rgb = COLORS.get(color_name, COLORS['OFF'])
    for i in range(LED_COUNT):
        np[i] = rgb
    np.show()


def open_bin(color):
    global current_color, is_open, open_start_time
    current_color   = color
    is_open         = True
    open_start_time = utime.ticks_ms()
    servo_open()
    set_led(color)
    if color in ICONS:
        display.show(ICONS[color])
    else:
        display.show(Image.YES)
    uart.write("STATUS:" + color + ":OPENED\n")


def close_bin():
    global is_open, current_color
    if not is_open:
        return
    color         = current_color
    is_open       = False
    current_color = None
    servo_close()
    set_led('OFF')
    display.show(Image.YES)
    utime.sleep_ms(600)
    display.clear()
    uart.write("STATUS:" + color + ":CLOSED\n")


def handle_command(cmd):
    cmd = cmd.strip().upper()
    if cmd == "PING":
        uart.write("PONG\n")
    elif cmd.startswith("OPEN:"):
        color = cmd[5:]
        if color in COLORS and color != 'OFF':
            if is_open:
                close_bin()
                utime.sleep_ms(500)
            open_bin(color)
        else:
            uart.write("ERROR:UNKNOWN_COLOR:" + color + "\n")
    elif cmd == "CLOSE":
        close_bin()
    elif cmd == "STATUS":
        state = ("OPEN:" + current_color) if is_open else "CLOSED"
        uart.write("STATUS:" + state + "\n")


# ---- SETUP ----
uart.init(baudrate=115200)
servo_close()
set_led('OFF')
display.scroll("READY", delay=80)
uart.write("READY\n")

# ---- MAIN LOOP ----
rx_buffer = ""
while True:
    if uart.any():
        try:
            data = uart.read(32)
            if data:
                rx_buffer += data.decode('utf-8')
                while '\n' in rx_buffer:
                    line, rx_buffer = rx_buffer.split('\n', 1)
                    if line.strip():
                        handle_command(line)
        except Exception:
            rx_buffer = ""
    if is_open:
        elapsed = utime.ticks_diff(utime.ticks_ms(), open_start_time)
        if elapsed >= AUTO_CLOSE_MS:
            close_bin()
    utime.sleep_ms(10)
