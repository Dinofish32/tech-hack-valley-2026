// ─────────────────────────────────────────────────────────────────────────────
// Puls8 — Headband Firmware (ESP-NOW receiver)
//
// On first boot, open Serial Monitor and copy the MAC address printed.
// Paste it into HEADBAND_MAC in dongle.ino, then flash the dongle.
// ─────────────────────────────────────────────────────────────────────────────
#include <esp_now.h>
#include <WiFi.h>

// ── Motor GPIO pins — adjust to your wiring ───────────────────────────────
const int PIN_N = 5;
const int PIN_E = 18;
const int PIN_S = 19;
const int PIN_W = 21;

// ── PWM (ESP32 LEDC) ─────────────────────────────────────────────────────
const int PWM_FREQ       = 5000;
const int PWM_RESOLUTION = 8;   // 8-bit: 0–255
const int CH_N = 0, CH_E = 1, CH_S = 2, CH_W = 3;

// ── Failsafe: motors off if no packet received for this long ─────────────
const unsigned long FAILSAFE_MS = 500;

// ── State ─────────────────────────────────────────────────────────────────
unsigned long lastPacketMs = 0;
unsigned long motorOffAt   = 0;

// ── Helpers ───────────────────────────────────────────────────────────────
void allOff() {
  ledcWrite(CH_N, 0);
  ledcWrite(CH_E, 0);
  ledcWrite(CH_S, 0);
  ledcWrite(CH_W, 0);
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

  // 0xFF = STOP command
  if (waveformId == 0xFF) {
    allOff();
    motorOffAt = 0;
    return;
  }

  ledcWrite(CH_N, data[0]);
  ledcWrite(CH_E, data[1]);
  ledcWrite(CH_S, data[2]);
  ledcWrite(CH_W, data[3]);

  motorOffAt   = millis() + durationMs;
  lastPacketMs = millis();
}

// ── ESP-NOW receive callback ──────────────────────────────────────────────
// Note: if you get a compile error here, your ESP32 Arduino core is >= 3.0
// Replace the signature with:
//   void onReceive(const esp_now_recv_info_t *info, const uint8_t *data, int len)
void onReceive(const uint8_t* mac, const uint8_t* data, int len) {
  handlePacket(data, len);
}

// ── Setup ─────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // PWM setup
  ledcSetup(CH_N, PWM_FREQ, PWM_RESOLUTION); ledcAttachPin(PIN_N, CH_N);
  ledcSetup(CH_E, PWM_FREQ, PWM_RESOLUTION); ledcAttachPin(PIN_E, CH_E);
  ledcSetup(CH_S, PWM_FREQ, PWM_RESOLUTION); ledcAttachPin(PIN_S, CH_S);
  ledcSetup(CH_W, PWM_FREQ, PWM_RESOLUTION); ledcAttachPin(PIN_W, CH_W);
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

// ── Loop ─────────────────────────────────────────────────────────────────
void loop() {
  unsigned long now = millis();

  // Turn motors off when their duration expires
  if (motorOffAt > 0 && now >= motorOffAt) {
    allOff();
    motorOffAt = 0;
  }

  // Failsafe: if the PC stops sending for too long, kill motors
  if ((now - lastPacketMs) > FAILSAFE_MS) {
    allOff();
    lastPacketMs = now;
  }
}
