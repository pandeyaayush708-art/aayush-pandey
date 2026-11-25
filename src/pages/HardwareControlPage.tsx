import React, { useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Code2,
  Cpu,
  Monitor,
  Plug,
  RefreshCw,
  Unplug,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { ARDUINO_UNO_SKETCH, isWebSerialSupported } from '../services/hardwareService';
import { HardwareMode } from '../types/dairy';
import { formatDateTime, formatTemp } from '../utils/calculations';
import { Modal, StatusBadge } from '../components/ui/MotionPrimitives';

export const HardwareControlPage: React.FC = () => {
  const {
    db,
    setHardwareMode,
    connectSerialArduino,
    disconnectSerialArduino,
    pollLocalBridgeOnce,
    updateHardwareConfig,
    pushToast,
  } = useFarm();

  const [sketchOpen, setSketchOpen] = useState(false);

  const latestEnv = db.environmentReadings[db.environmentReadings.length - 1];
  const latestWater = db.waterReadings[db.waterReadings.length - 1];

  const isHighTemp = latestEnv
    ? latestEnv.temperatureC >= db.settings.highTemperatureThresholdC
    : false;
  const isLowWater = latestWater
    ? latestWater.waterPercent <= db.settings.lowWaterThresholdPercent
    : false;
  const isCritical =
    (db.hardwareState.mode === 'Live Hardware Mode' &&
      db.hardwareState.connectionStatus !== 'Connected') ||
    (latestWater ? latestWater.waterPercent <= 15 : false);
  const isWarning = !isCritical && (isHighTemp || isLowWater);

  const ledState: 'Normal' | 'Warning' | 'Critical' = isCritical
    ? 'Critical'
    : isWarning
    ? 'Warning'
    : 'Normal';

  const buzzerActive =
    (isLowWater && db.hardwareState.buzzerRules.lowWaterWarning) ||
    (isHighTemp && db.hardwareState.buzzerRules.highTemperatureWarning) ||
    (db.hardwareState.mode === 'Live Hardware Mode' &&
      db.hardwareState.connectionStatus !== 'Connected' &&
      db.hardwareState.buzzerRules.hardwareFailureWarning);

  const lcdWarningLine = isCritical
    ? 'CRITICAL: CHECK SYS'
    : isLowWater
    ? 'WARN: LOW WATER'
    : isHighTemp
    ? 'WARN: HIGH TEMP'
    : 'STATUS: NORMAL';

  const toggleBuzzerRule = (key: keyof typeof db.hardwareState.buzzerRules) => {
    updateHardwareConfig({
      buzzerRules: {
        ...db.hardwareState.buzzerRules,
        [key]: !db.hardwareState.buzzerRules[key],
      },
    });
    pushToast('Updated physical buzzer alert configuration.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Architecture & Mode Switcher */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Cpu className="h-5 w-5 text-[#1B4332]" />
              <h2 className="font-display text-base font-bold text-[#1F2421]">
                Arduino Uno Hardware Control & Communication Layer
              </h2>
            </div>
            <p className="mt-1 text-xs text-[#5C6660]">
              Arduino Uno does not have built-in Wi-Fi. Connect via Laptop USB Serial (Web Serial API), a Local Serial-Bridge HTTP service, or a future ESP32 telemetry node. Simulated readings are never labelled as live hardware.
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-1">
            {(['Demo Mode', 'Manual Test Mode', 'Live Hardware Mode'] as HardwareMode[]).map(
              (m) => (
                <button
                  key={m}
                  onClick={() => setHardwareMode(m)}
                  className={`rounded px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                    db.hardwareState.mode === m
                      ? 'bg-[#1B4332] text-white'
                      : 'text-[#5C6660] hover:text-[#1F2421]'
                  }`}
                >
                  {m}
                </button>
              )
            )}
          </div>
        </div>

        {/* Connection Status & Live Bridge Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
            <span className="text-[11px] text-[#5C6660]">Controller Status</span>
            <div className="mt-1.5">
              <StatusBadge
                tone={
                  db.hardwareState.connectionStatus === 'Connected'
                    ? 'success'
                    : db.hardwareState.connectionStatus === 'Stale Data'
                    ? 'warning'
                    : 'danger'
                }
                liveTelemetry={db.hardwareState.connectionStatus === 'Connected'}
              >
                {db.hardwareState.connectionStatus}
              </StatusBadge>
            </div>
          </div>
          <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
            <span className="text-[11px] text-[#5C6660]">Active Mode</span>
            <p className="mt-1 font-display text-sm font-bold text-[#1F2421]">
              {db.hardwareState.mode}
            </p>
            <p className="text-[11px] text-[#7A827E] truncate">
              {db.hardwareState.serialPortLabel || 'No physical serial port bound'}
            </p>
          </div>
          <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
            <span className="text-[11px] text-[#5C6660]">Last Received Reading</span>
            <p className="mt-1 text-xs font-semibold text-[#1F2421] tabular-nums">
              {formatDateTime(db.hardwareState.lastReadingTimestamp)}
            </p>
          </div>
          <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3 flex flex-col justify-between gap-2">
            <div className="flex flex-wrap gap-1.5">
              {db.hardwareState.connectionStatus === 'Connected' ? (
                <button
                  onClick={() => void disconnectSerialArduino()}
                  className="inline-flex items-center gap-1 rounded bg-[#B91C1C] px-2.5 py-1.5 text-[11px] font-semibold text-white whitespace-nowrap"
                >
                  <Unplug className="h-3 w-3" /> Disconnect
                </button>
              ) : (
                <button
                  onClick={() => void connectSerialArduino()}
                  className="inline-flex items-center gap-1 rounded bg-[#1B4332] px-2.5 py-1.5 text-[11px] font-semibold text-white hover:bg-[#2D6A4F] whitespace-nowrap"
                >
                  <Plug className="h-3 w-3" /> USB Serial
                </button>
              )}
              <button
                onClick={() => void pollLocalBridgeOnce()}
                className="inline-flex items-center gap-1 rounded border border-[#E4E1D8] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#3F4742] hover:bg-[#FAF8F4] whitespace-nowrap"
              >
                <RefreshCw className="h-3 w-3" /> Poll Bridge
              </button>
              <button
                onClick={() => setSketchOpen(true)}
                className="inline-flex items-center gap-1 rounded border border-[#E4E1D8] bg-white px-2.5 py-1.5 text-[11px] font-semibold text-[#3F4742] hover:bg-[#FAF8F4] whitespace-nowrap"
              >
                <Code2 className="h-3 w-3" /> Sketch
              </button>
            </div>
            {!isWebSerialSupported() && (
              <span className="text-[10px] text-[#92400E]">
                Web Serial requires Chrome/Edge; use Local Bridge on this browser.
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Sensor & Actuator Matrix + Live Telemetry Values */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-6 rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <h3 className="font-display text-sm font-bold text-[#1F2421]">
            Sensor & Actuator Availability Matrix
          </h3>
          <div className="grid grid-cols-2 gap-2.5 text-xs">
            {[
              ['DHT11 Temp & Humidity', db.hardwareState.sensors.dht11Connected],
              ['HC-SR04 Ultrasonic Water', db.hardwareState.sensors.ultrasonicConnected],
              ['RFID Tag Reader', db.hardwareState.sensors.rfidConnected],
              ['MPU6050 Activity Sensor', db.hardwareState.sensors.mpu6050Connected],
              ['Water Pump Relay Module', db.hardwareState.sensors.pumpRelayConnected],
              ['Ventilation Fan Relay', db.hardwareState.sensors.fanRelayConfigured],
              ['Milk Diverter Servo', db.hardwareState.sensors.servoDiverterConnected],
              ['16x2 I2C LCD Display', db.hardwareState.sensors.lcdConnected],
            ].map(([name, connected]) => (
              <div
                key={String(name)}
                className="flex items-center justify-between rounded border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2"
              >
                <span className="text-[#3F4742] truncate pr-2">{name}</span>
                <StatusBadge tone={connected ? 'success' : 'neutral'}>
                  {connected ? 'Ready' : 'Offline'}
                </StatusBadge>
              </div>
            ))}
          </div>

          <div className="border-t border-[#E4E1D8] pt-3 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
            <div>
              <span className="text-[#7A827E]">Temp ({latestEnv?.source || 'N/A'})</span>
              <p className="font-bold tabular-nums">
                {latestEnv ? formatTemp(latestEnv.temperatureC, db.settings.temperatureUnit) : '—'}
              </p>
            </div>
            <div>
              <span className="text-[#7A827E]">Humidity</span>
              <p className="font-bold tabular-nums">
                {latestEnv ? `${latestEnv.humidityPercent}%` : '—'}
              </p>
            </div>
            <div>
              <span className="text-[#7A827E]">Water Tank</span>
              <p className="font-bold tabular-nums">
                {latestWater ? `${latestWater.waterPercent}%` : '—'}
              </p>
            </div>
            <div>
              <span className="text-[#7A827E]">Pump / Servo</span>
              <p className="font-bold tabular-nums">
                {db.hardwareState.pumpCommandedState} / {db.hardwareState.diverterServoAngle}°
              </p>
            </div>
          </div>
        </div>

        {/* LCD, LEDs & Buzzer Physical Indicator Panel */}
        <div className="lg:col-span-6 rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Monitor className="h-4 w-4 text-[#1B4332]" />
              <h3 className="font-display text-sm font-bold text-[#1F2421]">
                Physical Indicators: LCD, Status LEDs & Buzzer
              </h3>
            </div>
            <StatusBadge tone={db.settings.physicalIndicatorsEnabled ? 'success' : 'neutral'}>
              {db.settings.physicalIndicatorsEnabled ? 'Firmware Linked' : 'Preview Only'}
            </StatusBadge>
          </div>

          {/* 16x2 LCD Preview */}
          <div className="rounded-md border-2 border-[#3F4742] bg-[#1D2B1F] p-3.5 font-mono text-xs text-[#B7F0B1] tracking-wider shadow-inner">
            <div className="flex justify-between">
              <span>
                T:{latestEnv ? `${latestEnv.temperatureC}C` : '--'} H:
                {latestEnv ? `${latestEnv.humidityPercent}%` : '--'}
              </span>
              <span>W:{latestWater ? `${latestWater.waterPercent}%` : '--'}</span>
            </div>
            <div className="mt-1 flex justify-between">
              <span>PUMP:{db.hardwareState.pumpCommandedState}</span>
              <span>{lcdWarningLine}</span>
            </div>
          </div>

          {/* LED Indicators */}
          <div className="grid grid-cols-3 gap-2 text-xs">
            {(
              [
                ['Normal', ledState === 'Normal', 'bg-[#2D6A4F]'],
                ['Warning', ledState === 'Warning', 'bg-[#D97706]'],
                ['Critical', ledState === 'Critical', 'bg-[#DC2626]'],
              ] as const
            ).map(([label, active, dotColor]) => (
              <div
                key={label}
                className={`flex items-center gap-2 rounded border px-3 py-2 ${
                  active
                    ? 'border-[#1F2421] bg-[#FAF8F4] font-semibold text-[#1F2421]'
                    : 'border-[#E4E1D8] text-[#7A827E]'
                }`}
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    active ? dotColor : 'bg-[#D5D0C3]'
                  }`}
                />
                <span>{label} LED</span>
              </div>
            ))}
          </div>

          {/* Buzzer Warning Rules */}
          <div className="border-t border-[#E4E1D8] pt-3 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-1.5 font-semibold text-[#1F2421]">
                <BellRing className="h-3.5 w-3.5 text-[#B45309]" /> Buzzer Warning Rules
              </span>
              <span className="text-[11px] text-[#5C6660]">
                Logical state: {buzzerActive ? 'Triggered' : 'Silent'}
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
              <label className="flex items-center gap-2 rounded border border-[#E4E1D8] px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={db.hardwareState.buzzerRules.lowWaterWarning}
                  onChange={() => toggleBuzzerRule('lowWaterWarning')}
                />
                <span>Low Water</span>
              </label>
              <label className="flex items-center gap-2 rounded border border-[#E4E1D8] px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={db.hardwareState.buzzerRules.highTemperatureWarning}
                  onChange={() => toggleBuzzerRule('highTemperatureWarning')}
                />
                <span>High Temp</span>
              </label>
              <label className="flex items-center gap-2 rounded border border-[#E4E1D8] px-2.5 py-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={db.hardwareState.buzzerRules.hardwareFailureWarning}
                  onChange={() => toggleBuzzerRule('hardwareFailureWarning')}
                />
                <span>HW Failure</span>
              </label>
            </div>
            <p className="text-[11px] text-[#7A827E]">
              Actual physical LCD/LED/Buzzer actuation is enabled only when Arduino firmware & connection are active in Settings.
            </p>
          </div>
        </div>
      </div>

      {/* Hardware Event History */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white">
        <div className="border-b border-[#E4E1D8] px-5 py-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-[#1F2421]">Hardware Event History</h3>
          <CheckCircle2 className="h-4 w-4 text-[#2D6A4F]" />
        </div>
        <div className="divide-y divide-[#F0EDE5] max-h-64 overflow-y-auto text-xs">
          {db.hardwareLogs.map((log) => (
            <div key={log.id} className="px-5 py-2.5 flex items-center justify-between gap-4">
              <div>
                <span className="font-semibold text-[#1F2421]">{log.source}: </span>
                <span className="text-[#3F4742]">{log.message}</span>
              </div>
              <span className="text-[11px] text-[#7A827E] tabular-nums whitespace-nowrap">
                {formatDateTime(log.timestamp)}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Arduino Sketch Modal */}
      <Modal
        open={sketchOpen}
        onClose={() => setSketchOpen(false)}
        title="Arduino Uno Serial Telemetry Sketch"
        subtitle="Upload this sketch to Arduino Uno and connect via USB Serial (9600 baud) or a local serial-bridge."
        maxWidthClass="max-w-2xl"
      >
        <pre className="rounded-md bg-[#1F2421] p-4 text-[11px] text-[#EBF5EE] overflow-x-auto font-mono leading-relaxed">
          {ARDUINO_UNO_SKETCH}
        </pre>
      </Modal>
    </div>
  );
};
