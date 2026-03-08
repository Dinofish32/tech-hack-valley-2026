// ─────────────────────────────────────────────────────────────────────────────
// Puls8 — USB Dongle Firmware
// Role: Bridge between PC (USB Serial) and headband (ESP-NOW)
//
// Setup order:
//   1. Flash pulse_firmware.ino to the HEADBAND ESP32
//   2. Open Serial Monitor on headband — copy its MAC address
//   3. Paste MAC into HEADBAND_MAC below
//   4. Flash this sketch to the DONGLE ESP32 (plugged into PC)
// ─────────────────────────────────────────────────────────────────────────────
#include <Arduino.h>
#include <esp_now.h>
#include <WiFi.h>

// ── Set this to the headband's MAC address (printed on headband Serial) ──────
//10:51:DB:0E:0E:30
uint8_t HEADBAND_MAC[6] = { 0x10, 0x51, 0xDB, 0x0E, 0x0E, 0x30 };

// ── Packet config (must match packetSchema.js) ────────────────────────────
const int PACKET_LEN = 8;

// ── Serial baud — must match SerialTransport.js ───────────────────────────
const int BAUD = 115200;

// ── Internal ─────────────────────────────────────────────────────────────────
esp_now_peer_info_t peer;
uint8_t rxBuf[32];   // incoming Serial buffer
int rxLen = 0;

bool validateChecksum(uint8_t* buf) {
  uint8_t xorVal = 0;
  for (int i = 0; i < 7; i++) xorVal ^= buf[i];
  return xorVal == buf[7];
}

void onSent(const uint8_t* mac, esp_now_send_status_t status) {
  // Uncomment for debug:
  // Serial.println(status == ESP_NOW_SEND_SUCCESS ? "[ESP-NOW] OK" : "[ESP-NOW] FAIL");
}

void setup() {
  Serial.begin(BAUD);
  Serial.println("[Dongle] Starting...");

  WiFi.mode(WIFI_STA);
  WiFi.disconnect();

  if (esp_now_init() != ESP_OK) {
    Serial.println("[Dongle] ESP-NOW init failed");
    return;
  }

  esp_now_register_send_cb(onSent);

  memcpy(peer.peer_addr, HEADBAND_MAC, 6);
  peer.channel = 1;
  peer.encrypt = false;

  if (esp_now_add_peer(&peer) != ESP_OK) {
    Serial.println("[Dongle] Failed to add peer — check MAC address");
    return;
  }

  Serial.print("[Dongle] Ready. Targeting headband: ");
  for (int i = 0; i < 6; i++) {
    if (i) Serial.print(":");
    Serial.printf("%02X", HEADBAND_MAC[i]);
  }
  Serial.println();
}

void loop() {
  // Drain incoming Serial bytes into buffer
  while (Serial.available() > 0 && rxLen < (int)sizeof(rxBuf)) {
    rxBuf[rxLen++] = Serial.read();
  }

  // Process all complete packets in the buffer
  while (rxLen >= PACKET_LEN) {
    if (validateChecksum(rxBuf)) {
      // Valid packet — send via ESP-NOW
      esp_now_send(HEADBAND_MAC, rxBuf, PACKET_LEN);
      // Shift buffer
      rxLen -= PACKET_LEN;
      memmove(rxBuf, rxBuf + PACKET_LEN, rxLen);
    } else {
      // Bad checksum — drop 1 byte and try to re-sync
      rxLen--;
      memmove(rxBuf, rxBuf + 1, rxLen);
    }
  }
}
