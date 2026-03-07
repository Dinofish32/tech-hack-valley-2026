#include <WebSocketsClient.h>
#include <WiFi.h>

// ── User config — set before flashing ─────────────────────────────────────
const char* SSID     = "YOUR_WIFI";
const char* PASSWORD = "YOUR_PASS";
const char* PC_IP    = "192.168.1.x";
const int   WS_PORT  = 8765;

// ── Motor / LED GPIO pins ──────────────────────────────────────────────────
// Adjust to actual GPIO numbers on your board
const int PIN_N = 5;   // North motor
const int PIN_E = 18;  // East motor
const int PIN_S = 19;  // South motor
const int PIN_W = 21;  // West motor

// ── PWM config (ESP32 LEDC) ────────────────────────────────────────────────
const int PWM_FREQ       = 5000;
const int PWM_RESOLUTION = 8;    // 8-bit: 0-255
const int CH_N = 0, CH_E = 1, CH_S = 2, CH_W = 3;

// ── Failsafe ───────────────────────────────────────────────────────────────
const unsigned long FAILSAFE_MS = 300;  // all off if no packet for 300ms
unsigned long lastPacketMs = 0;

// ── Motor command state ────────────────────────────────────────────────────
unsigned long motorOffAt = 0;  // millis() when motors should turn off

WebSocketsClient wsClient;

void allOff() {
  ledcWrite(CH_N, 0);
  ledcWrite(CH_E, 0);
  ledcWrite(CH_S, 0);
  ledcWrite(CH_W, 0);
}

void handlePacket(uint8_t* payload, size_t length) {
  if (length != 8) return;

  // Verify XOR checksum (bytes 0-6 XOR == byte 7)
  uint8_t xorVal = 0;
  for (int i = 0; i < 7; i++) xorVal ^= payload[i];
  if (xorVal != payload[7]) return;  // drop invalid packet

  uint8_t intensityN  = payload[0];
  uint8_t intensityE  = payload[1];
  uint8_t intensityS  = payload[2];
  uint8_t intensityW  = payload[3];
  uint8_t waveformId  = payload[4];
  uint16_t durationMs = ((uint16_t)payload[5] << 8) | payload[6];

  // STOP command
  if (waveformId == 0xFF) {
    allOff();
    motorOffAt = 0;
    return;
  }

  // Drive motors
  ledcWrite(CH_N, intensityN);
  ledcWrite(CH_E, intensityE);
  ledcWrite(CH_S, intensityS);
  ledcWrite(CH_W, intensityW);

  motorOffAt = millis() + durationMs;
  lastPacketMs = millis();
}

void webSocketEvent(WStype_t type, uint8_t* payload, size_t length) {
  switch (type) {
    case WStype_CONNECTED:
      Serial.println("[WS] Connected to PC");
      lastPacketMs = millis();
      break;
    case WStype_DISCONNECTED:
      Serial.println("[WS] Disconnected");
      allOff();
      break;
    case WStype_BIN:
      handlePacket(payload, length);
      break;
    default:
      break;
  }
}

void setup() {
  Serial.begin(115200);

  // Configure PWM channels
  ledcSetup(CH_N, PWM_FREQ, PWM_RESOLUTION);
  ledcSetup(CH_E, PWM_FREQ, PWM_RESOLUTION);
  ledcSetup(CH_S, PWM_FREQ, PWM_RESOLUTION);
  ledcSetup(CH_W, PWM_FREQ, PWM_RESOLUTION);
  ledcAttachPin(PIN_N, CH_N);
  ledcAttachPin(PIN_E, CH_E);
  ledcAttachPin(PIN_S, CH_S);
  ledcAttachPin(PIN_W, CH_W);
  allOff();

  // Connect to Wi-Fi
  WiFi.begin(SSID, PASSWORD);
  Serial.print("[WiFi] Connecting");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("\n[WiFi] Connected: " + WiFi.localIP().toString());

  // Connect to PC WebSocket server
  wsClient.begin(PC_IP, WS_PORT, "/");
  wsClient.onEvent(webSocketEvent);
  wsClient.setReconnectInterval(3000);

  lastPacketMs = millis();
}

void loop() {
  wsClient.loop();

  unsigned long now = millis();

  // Turn off motors after duration expires
  if (motorOffAt > 0 && now >= motorOffAt) {
    allOff();
    motorOffAt = 0;
  }

  // Failsafe: all off if no packet for FAILSAFE_MS
  if ((now - lastPacketMs) > FAILSAFE_MS) {
    allOff();
    lastPacketMs = now;  // reset to avoid repeated calls
  }
}
