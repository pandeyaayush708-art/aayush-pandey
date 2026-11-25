/**
 * Separate Hardware Communication Layer for DairyMitra AI 2.0
 *
 * Architecture:
 * - Arduino Uno has NO built-in Wi-Fi.
 * - Supported real-world connections:
 *   1. Web Serial API (Chromium browsers over USB directly to Arduino Uno)
 *   2. Local Serial-Bridge service (Node.js/Python script reading COM/ttyUSB and serving JSON over HTTP)
 *   3. Future ESP32 Wi-Fi telemetry endpoint using the same JSON contract
 *
 * Strict rule: Demo / Manual Test readings are NEVER labelled as live hardware readings.
 */

export interface ArduinoTelemetryPayload {
  temperatureC?: number;
  humidityPercent?: number;
  waterDistanceCm?: number;
  rfidTag?: string;
  activityIndex?: number;
  cowId?: string;
  pumpRelayState?: 'ON' | 'OFF';
  timestamp?: string;
}

export function isWebSerialSupported(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator;
}

export async function connectArduinoWebSerial(
  onPayload: (payload: ArduinoTelemetryPayload) => void,
  onDisconnect: (reason: string) => void
): Promise<{
  portLabel: string;
  sendCommand: (cmd: string) => Promise<void>;
  disconnect: () => Promise<void>;
}> {
  if (!isWebSerialSupported()) {
    throw new Error(
      'Web Serial API is not supported in this browser. Use Chrome/Edge over USB or the Local Serial Bridge.'
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const navSerial = (navigator as any).serial;
  const port = await navSerial.requestPort();
  await port.open({ baudRate: 9600 });

  const decoder = new TextDecoderStream();
  const inputDone = port.readable.pipeTo(decoder.writable);
  const reader = decoder.readable.getReader();

  const encoder = new TextEncoderStream();
  const outputDone = port.writable.pipeTo(encoder.writable);
  const writer = encoder.writable.getWriter();

  let keepReading = true;
  let buffer = '';

  (async () => {
    try {
      while (keepReading) {
        const { value, done } = await reader.read();
        if (done) break;
        if (value) {
          buffer += value;
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed) continue;
            try {
              const json = JSON.parse(trimmed) as ArduinoTelemetryPayload;
              onPayload({ ...json, timestamp: new Date().toISOString() });
            } catch {
              // Ignore non-JSON serial lines
            }
          }
        }
      }
    } catch (err) {
      onDisconnect(err instanceof Error ? err.message : 'Serial connection closed.');
    }
  })();

  return {
    portLabel: 'Arduino Uno USB Serial (9600 baud)',
    sendCommand: async (cmd: string) => {
      await writer.write(cmd.trim() + '\n');
    },
    disconnect: async () => {
      keepReading = false;
      try {
        await reader.cancel();
        await inputDone.catch(() => {});
        await writer.close();
        await outputDone.catch(() => {});
        await port.close();
      } catch {
        // ignore close errors
      }
    },
  };
}

export async function fetchBridgeTelemetry(bridgeUrl: string): Promise<ArduinoTelemetryPayload> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const res = await fetch(bridgeUrl, { signal: controller.signal });
    if (!res.ok) throw new Error(`Bridge returned HTTP ${res.status}`);
    const data = (await res.json()) as ArduinoTelemetryPayload;
    return { ...data, timestamp: data.timestamp || new Date().toISOString() };
  } finally {
    clearTimeout(timeout);
  }
}

export const ARDUINO_UNO_SKETCH = `// DairyMitra AI 2.0 — Arduino Uno USB Serial Telemetry Sketch
// Hardware: DHT11 (Pin 2), HC-SR04 (Trig 7, Echo 8), Relay (Pin 4)
// NOTE: Never drive a DC pump directly from Arduino GPIO. Use a relay/MOSFET module + external supply.

#include <DHT.h>
#define DHTPIN 2
#define DHTTYPE DHT11
#define TRIG_PIN 7
#define ECHO_PIN 8
#define PUMP_RELAY_PIN 4

DHT dht(DHTPIN, DHTTYPE);
bool pumpState = false;

void setup() {
  Serial.begin(9600);
  dht.begin();
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(PUMP_RELAY_PIN, OUTPUT);
  digitalWrite(PUMP_RELAY_PIN, LOW);
}

void loop() {
  if (Serial.available()) {
    String cmd = Serial.readStringUntil('\\n');
    cmd.trim();
    if (cmd == "PUMP_ON") {
      pumpState = true;
      digitalWrite(PUMP_RELAY_PIN, HIGH);
    } else if (cmd == "PUMP_OFF") {
      pumpState = false;
      digitalWrite(PUMP_RELAY_PIN, LOW);
    }
  }

  float hum = dht.readHumidity();
  float temp = dht.readTemperature();

  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long duration = pulseIn(ECHO_PIN, HIGH, 30000);
  float distCm = duration > 0 ? (duration * 0.0343) / 2.0 : -1;

  if (!isnan(temp) && !isnan(hum)) {
    Serial.print("{\\"temperatureC\\":"); Serial.print(temp, 1);
    Serial.print(",\\"humidityPercent\\":"); Serial.print(hum, 1);
    if (distCm >= 0) {
      Serial.print(",\\"waterDistanceCm\\":"); Serial.print(distCm, 1);
    }
    Serial.print(",\\"pumpRelayState\\":\\"");
    Serial.print(pumpState ? "ON" : "OFF");
    Serial.println("\\"}");
  }
  delay(2000);
}`;
