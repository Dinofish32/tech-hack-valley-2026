// ─────────────────────────────────────────────────────────────────────────────
// Puls8 — Headband Firmware (ESP-NOW receiver)
//
// On first boot, open Serial Monitor and copy the MAC address printed.
// Paste it into HEADBAND_MAC in dongle.ino, then flash the dongle.
//
// Pin layout (per direction):
//   [0] = footstep GPIO, [1] = gunshot GPIO
// ─────────────────────────────────────────────────────────────────────────────
#include <esp_now.h>
#include <WiFi.h>

// ── LED GPIO pins [footstep, gunshot] ─────────────────────────────────────
const int PIN_N[2] = {  6,  7 };
const int PIN_S[2] = { 18, 19 };
const int PIN_E[2] = {  2,  3 };
const int PIN_W[2] = {  4,  5 };

// 4 LEDC channels (0–3), one per direction — ESP32-C6 only has 6 channels total
// Each channel is dynamically re-attached to footstep or gunshot pin as needed
// Channel 0=N, 1=E, 2=S, 3=W
int activePin[4] = { PIN_N[0], PIN_E[0], PIN_S[0], PIN_W[0] };

// ── waveformId values (must match packetSchema.js WAVEFORM_IDS) ───────────
const uint8_t WF_GUNSHOT  = 0x00;
const uint8_t WF_FOOTSTEP = 0x01;
const uint8_t WF_STOP     = 0xFF;

// ── PWM (ESP32 LEDC, core 3.x API) ───────────────────────────────────────
const int PWM_FREQ       = 5000;
const int PWM_RESOLUTION = 8;   // 8-bit: 0–255
// Channels 0–7, one per pin
// N_foot=0, N_gun=1, S_foot=2, S_gun=3, E_foot=4, E_gun=5, W_foot=6, W_gun=7

// ── Failsafe: motors off if no packet received for this long ──────────────
const unsigned long FAILSAFE_MS = 500;

// ── State ─────────────────────────────────────────────────────────────────
unsigned long lastPacketMs = 0;
unsigned long motorOffAt   = 0;

// ── Helpers ───────────────────────────────────────────────────────────────
void allOff() {
  for (int i = 0; i < 4; i++) ledcWrite(activePin[i], 0);
}

// Drive one direction channel, re-attaching to the correct pin if needed
void driveDir(int dirCh, const int pins[2], int typeCh, uint8_t val) {
  int newPin = pins[typeCh];
  if (activePin[dirCh] != newPin) {
    ledcWrite(activePin[dirCh], 0);
    ledcDetach(activePin[dirCh]);
    ledcAttachChannel(newPin, PWM_FREQ, PWM_RESOLUTION, dirCh);
    activePin[dirCh] = newPin;
  }
  ledcWrite(newPin, val);
}

const char* waveformName(uint8_t id) {
  switch (id) {
    case WF_GUNSHOT:  return "GUNSHOT";
    case WF_FOOTSTEP: return "FOOTSTEP";
    case WF_STOP:     return "STOP";
    default:          return "UNKNOWN";
  }
}

void handlePacket(const uint8_t* data, int len) {
  if (len != 8) return;

  // Verify XOR checksum (bytes 0–6 XOR == byte 7)
  uint8_t xorVal = 0;
  for (int i = 0; i < 7; i++) xorVal ^= data[i];
  if (xorVal != data[7]) {
    Serial.println("[Headband] Bad checksum, dropping packet");
    return;
  }

  uint8_t  waveformId = data[4];
  uint16_t durationMs = ((uint16_t)data[5] << 8) | data[6];

  // Log every received packet
  Serial.printf("[PKT] type=%-9s  N=%3d E=%3d S=%3d W=%3d  dur=%dms\n",
    waveformName(waveformId),
    data[0], data[1], data[2], data[3],
    durationMs
  );

  // STOP: kill all LEDs immediately
  if (waveformId == WF_STOP) {
    allOff();
    motorOffAt = 0;
    lastPacketMs = millis();
    return;
  }

  // Channel: GUNSHOT uses index 1 pins, everything else uses index 0
  int ch = (waveformId == WF_GUNSHOT) ? 1 : 0;

  // Drive direction LEDs with PWM intensity from packet
  allOff();
  driveDir(0, PIN_N, ch, data[0]);
  driveDir(1, PIN_E, ch, data[1]);
  driveDir(2, PIN_S, ch, data[2]);
  driveDir(3, PIN_W, ch, data[3]);

  // Schedule auto-off after duration
  motorOffAt = millis() + durationMs;
  lastPacketMs = millis();
}

// ── ESP-NOW receive callback (core 3.x signature) ─────────────────────────
void onReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len) {
  handlePacket(data, len);
}

// ── Setup ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(3000);

  // PWM setup — 4 channels (0–3), one per direction, starting on footstep pins
  ledcAttachChannel(PIN_N[0], PWM_FREQ, PWM_RESOLUTION, 0);
  ledcAttachChannel(PIN_E[0], PWM_FREQ, PWM_RESOLUTION, 1);
  ledcAttachChannel(PIN_S[0], PWM_FREQ, PWM_RESOLUTION, 2);
  ledcAttachChannel(PIN_W[0], PWM_FREQ, PWM_RESOLUTION, 3);
  allOff();

  // ESP-NOW — STA mode, no AP connection needed
  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println("[Headband] ESP-NOW init failed");
    return;
  }

  esp_now_register_recv_cb(onReceive);

  // Print MAC so you can paste it into dongle.ino
  Serial.print("[Headband] MAC: ");
  Serial.println(WiFi.macAddress());
  Serial.println("[Headband] Waiting for packets...");

  lastPacketMs = millis();
}

// ── Loop ──────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // Turn motors off when their duration expires
  if (motorOffAt > 0 && now >= motorOffAt) {
    allOff();
    motorOffAt = 0;
  }

  // Failsafe: if PC stops sending for too long, kill motors
  if ((now - lastPacketMs) > FAILSAFE_MS) {
    allOff();
    lastPacketMs = now;
  }
}
