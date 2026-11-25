import React, { useState } from 'react';
import { Power, Waves } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { PumpState } from '../types/dairy';
import { formatDateTime } from '../utils/calculations';
import { ConfirmDialog, EmptyState, StatusBadge } from '../components/ui/MotionPrimitives';
import { TrendAreaChart } from '../components/ui/Charts';

export const WaterManagementPage: React.FC = () => {
  const {
    db,
    recordWaterReading,
    commandPump,
    setPumpMode,
    updateSettings,
    pushToast,
  } = useFarm();

  const latest = db.waterReadings[db.waterReadings.length - 1];
  const [testPct, setTestPct] = useState('20');
  const [lowThresh, setLowThresh] = useState(String(db.settings.lowWaterThresholdPercent));
  const [autoStart, setAutoStart] = useState(String(db.settings.autoPumpStartBelowPercent));
  const [autoStop, setAutoStop] = useState(String(db.settings.autoPumpStopAbovePercent));
  const [confirmPump, setConfirmPump] = useState<PumpState | null>(null);

  const tankStatus = !latest
    ? 'Unknown'
    : latest.waterPercent <= 15
    ? 'Critical Low'
    : latest.waterPercent <= db.settings.lowWaterThresholdPercent
    ? 'Low Warning'
    : latest.waterPercent >= 90
    ? 'Full'
    : 'Normal';

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    const low = parseInt(lowThresh, 10);
    const start = parseInt(autoStart, 10);
    const stop = parseInt(autoStop, 10);
    if (isNaN(low) || isNaN(start) || isNaN(stop) || start >= stop) {
      pushToast('Ensure Auto-Start threshold is lower than Auto-Stop threshold.', 'error');
      return;
    }
    updateSettings({
      ...db.settings,
      lowWaterThresholdPercent: low,
      autoPumpStartBelowPercent: start,
      autoPumpStopAbovePercent: stop,
    });
  };

  const handleManualWaterTest = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(testPct);
    if (isNaN(val) || val < 0 || val > 100) {
      pushToast('Water percentage must be between 0 and 100.', 'error');
      return;
    }
    recordWaterReading(val, 'Manual Test');
  };

  const chartData = db.waterReadings.slice(-16).map((w) => ({
    label: new Date(w.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: w.waterPercent,
  }));

  return (
    <div className="space-y-6">
      {/* Electrical Hardware Safety Notice */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white px-4 py-3 text-xs text-[#5C6660]">
        <strong className="text-[#1F2421]">Hardware Circuitry Requirement:</strong> Never connect a DC water pump directly to an Arduino GPIO pin. Use an optocoupled relay / MOSFET driver with an external power supply and flyback diode.{' '}
        {!db.settings.pumpFlowSensorInstalled &&
          'No physical flow sensor is installed, so pump feedback distinguishes Commanded State from Physically Verified State.'}
      </div>

      {/* Tank Level Visual + Pump Controls */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-5 rounded-lg border border-[#E4E1D8] bg-white p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[#1F2421]">
                Water Tank Level (Ultrasonic)
              </h2>
              <p className="text-xs text-[#7A827E]">
                Source: {latest?.source || 'No Data'} · Capacity {db.settings.tankCapacityLitres} L
              </p>
            </div>
            <StatusBadge
              tone={
                tankStatus === 'Critical Low'
                  ? 'danger'
                  : tankStatus === 'Low Warning'
                  ? 'warning'
                  : 'success'
              }
            >
              {tankStatus}
            </StatusBadge>
          </div>

          {/* Clean Tank Gauge */}
          <div className="flex items-center gap-6 py-2">
            <div className="relative h-40 w-24 shrink-0 rounded-lg border-2 border-[#C5DEC9] bg-[#FAF8F4] overflow-hidden flex items-end">
              <div
                className={`w-full transition-all duration-500 ${
                  (latest?.waterPercent ?? 0) <= db.settings.lowWaterThresholdPercent
                    ? 'bg-[#B45309]/80'
                    : 'bg-[#2D6A4F]/85'
                }`}
                style={{ height: `${latest?.waterPercent ?? 0}%` }}
              />
              <span className="absolute inset-0 flex items-center justify-center font-display text-lg font-bold text-[#1F2421] tabular-nums drop-shadow-sm">
                {latest ? `${latest.waterPercent}%` : '—'}
              </span>
            </div>

            <div className="space-y-2 text-xs">
              <div>
                <span className="text-[#7A827E]">Estimated Volume</span>
                <p className="font-display text-xl font-bold text-[#1F2421] tabular-nums">
                  {latest ? `${latest.estimatedLitres} L` : '—'}
                </p>
              </div>
              <div>
                <span className="text-[#7A827E]">Sensor Distance to Surface</span>
                <p className="font-mono text-sm font-semibold text-[#3F4742] tabular-nums">
                  {latest ? `${latest.distanceCm} cm` : '—'}
                </p>
              </div>
              <div>
                <span className="text-[#7A827E]">Last Reading</span>
                <p className="text-[11px] text-[#5C6660] tabular-nums">
                  {latest ? formatDateTime(latest.timestamp) : 'No reading'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Pump Command & Automation Panel */}
        <div className="lg:col-span-7 rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#1F2421]">
                Pump Relay Control ({db.hardwareState.mode})
              </h2>
              <p className="text-xs text-[#7A827E]">
                Prevents conflicting commands · Confirmation required before manual switching
              </p>
            </div>
            <div className="flex rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-0.5 text-xs">
              {(['AUTO', 'MANUAL'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setPumpMode(m)}
                  className={`rounded px-3 py-1 font-semibold transition ${
                    db.hardwareState.pumpMode === m
                      ? 'bg-[#1B4332] text-white'
                      : 'text-[#5C6660] hover:text-[#1F2421]'
                  }`}
                >
                  {m} Mode
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3.5">
              <span className="text-[11px] text-[#5C6660]">Commanded Pump State</span>
              <div className="mt-1 flex items-center gap-2">
                <Power
                  className={`h-4 w-4 ${
                    db.hardwareState.pumpCommandedState === 'ON'
                      ? 'text-[#1B4332]'
                      : 'text-[#7A827E]'
                  }`}
                />
                <span className="font-display text-lg font-bold text-[#1F2421]">
                  {db.hardwareState.pumpCommandedState}
                </span>
              </div>
            </div>
            <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3.5">
              <span className="text-[11px] text-[#5C6660]">Physically Verified State</span>
              <p className="mt-1 font-display text-sm font-bold text-[#3F4742]">
                {db.settings.pumpFlowSensorInstalled
                  ? db.hardwareState.pumpCommandedState
                  : 'Unverified (No Flow Sensor)'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <button
              disabled={db.hardwareState.pumpCommandedState === 'ON'}
              onClick={() => setConfirmPump('ON')}
              className="rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] disabled:opacity-45 whitespace-nowrap"
            >
              Command Pump ON
            </button>
            <button
              disabled={db.hardwareState.pumpCommandedState === 'OFF'}
              onClick={() => setConfirmPump('OFF')}
              className="rounded-md border border-[#B91C1C] bg-white px-4 py-2 text-xs font-semibold text-[#B91C1C] hover:bg-[#FDECEC] disabled:opacity-45 whitespace-nowrap"
            >
              Command Pump OFF
            </button>
            <span className="text-[11px] text-[#7A827E]">
              {db.hardwareState.pumpMode === 'AUTO'
                ? `Auto rule: ON ≤ ${db.settings.autoPumpStartBelowPercent}%, OFF ≥ ${db.settings.autoPumpStopAbovePercent}%`
                : 'Manual control active'}
            </span>
          </div>

          <div className="border-t border-[#E4E1D8] pt-3">
            <h3 className="text-xs font-semibold text-[#5C6660] mb-2">
              Water-Level History (%)
            </h3>
            <TrendAreaChart data={chartData} unit="%" height={150} />
          </div>
        </div>
      </div>

      {/* Threshold Config & Manual Test Reading */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveThresholds}
          className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-3"
        >
          <h3 className="font-display text-sm font-bold text-[#1F2421]">
            Low-Water & Auto-Pump Thresholds
          </h3>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Low Warning (%)
              </label>
              <input
                type="number"
                min={5}
                max={95}
                value={lowThresh}
                onChange={(e) => setLowThresh(e.target.value)}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Auto Start (%)
              </label>
              <input
                type="number"
                min={5}
                max={90}
                value={autoStart}
                onChange={(e) => setAutoStart(e.target.value)}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Auto Stop (%)
              </label>
              <input
                type="number"
                min={10}
                max={100}
                value={autoStop}
                onChange={(e) => setAutoStop(e.target.value)}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
          >
            Save Water Thresholds
          </button>
        </form>

        <form
          onSubmit={handleManualWaterTest}
          className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-3"
        >
          <h3 className="font-display text-sm font-bold text-[#1F2421]">
            Manual Test Water Reading
          </h3>
          <p className="text-xs text-[#5C6660]">
            Inject a test tank percentage to verify low-water alert generation. Labelled as Manual Test.
          </p>
          <div className="flex gap-2">
            <input
              type="number"
              min={0}
              max={100}
              value={testPct}
              onChange={(e) => setTestPct(e.target.value)}
              className="flex-1 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
            />
            <button
              type="submit"
              className="rounded-md border border-[#2D6A4F] px-4 py-2 text-xs font-semibold text-[#1B4332] hover:bg-[#EBF5EE] whitespace-nowrap"
            >
              Log Test Level
            </button>
          </div>
        </form>
      </div>

      {/* Pump Activity History */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white">
        <div className="border-b border-[#E4E1D8] px-5 py-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-[#1F2421]">Pump Activity History</h3>
          <Waves className="h-4 w-4 text-[#2D6A4F]" />
        </div>
        {db.pumpLogs.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No pump activity recorded"
              description="Manual or automatic pump commands will appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Command</th>
                  <th className="py-2.5 px-4">Mode</th>
                  <th className="py-2.5 px-4">Physical State</th>
                  <th className="py-2.5 px-4">Result</th>
                  <th className="py-2.5 px-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {db.pumpLogs.slice(0, 20).map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-4 tabular-nums">{formatDateTime(log.timestamp)}</td>
                    <td className="py-2 px-4 font-bold">{log.commandedState}</td>
                    <td className="py-2 px-4">{log.mode}</td>
                    <td className="py-2 px-4 text-[#5C6660]">{log.verifiedState}</td>
                    <td className="py-2 px-4">
                      <StatusBadge tone={log.success ? 'success' : 'danger'}>
                        {log.success ? 'Sent' : 'Failed'}
                      </StatusBadge>
                    </td>
                    <td className="py-2 px-4 text-[#5C6660]">{log.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(confirmPump)}
        onClose={() => setConfirmPump(null)}
        onConfirm={() => {
          if (confirmPump) {
            void commandPump(
              confirmPump,
              'MANUAL',
              `Manual operator command (${db.hardwareState.mode})`
            );
          }
        }}
        title={`Command Pump ${confirmPump}?`}
        message={
          db.hardwareState.mode === 'Live Hardware Mode'
            ? `This will send PUMP_${confirmPump} over the connected Arduino relay channel. Confirm relay and water line are clear.`
            : `In ${db.hardwareState.mode}, this simulates commanding the pump ${confirmPump} and logs the event.`
        }
        confirmLabel={`Turn Pump ${confirmPump}`}
        danger={confirmPump === 'OFF'}
      />
    </div>
  );
};
