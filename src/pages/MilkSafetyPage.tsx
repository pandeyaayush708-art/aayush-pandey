import React, { useState } from 'react';
import { AlertOctagon, CheckCircle2, Radio, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { MilkSafetyEvent } from '../types/dairy';
import { formatDateTime } from '../utils/calculations';
import { EmptyState, StatusBadge } from '../components/ui/MotionPrimitives';

export const MilkSafetyPage: React.FC = () => {
  const { db, executeMilkSafetyCheck } = useFarm();
  const activeCows = db.cows.filter((c) => c.status !== 'Archived');

  const [selectedCowOrTag, setSelectedCowOrTag] = useState<string>(activeCows[0]?.id || 'C-101');
  const [customInput, setCustomInput] = useState<string>('');
  const [lastResult, setLastResult] = useState<MilkSafetyEvent | null>(
    db.safetyEvents[0] || null
  );

  const handleRunCheck = (identifier: string, method: 'RFID Simulation' | 'Manual Check') => {
    if (!identifier.trim()) return;
    const ev = executeMilkSafetyCheck(identifier.trim(), method);
    setLastResult(ev);
  };

  const statusTone = (status: MilkSafetyEvent['status']) => {
    if (status === 'Approved by record checks') return 'success';
    if (
      status === 'Withdrawal active' ||
      status === 'Unknown cow' ||
      status === 'Missing treatment information'
    )
      return 'danger';
    return 'warning';
  };

  return (
    <div className="space-y-6">
      {/* Critical Non-Chemical Disclaimer */}
      <div className="rounded-lg border border-[#F3D9A4] bg-[#FEF6E7] px-4 py-3 text-xs text-[#78350F]">
        <strong>Important Safety Boundary:</strong> This module is a{' '}
        <strong>record-based withdrawal reminder and diversion routing system</strong>. It is{' '}
        <strong>NOT</strong> an antibiotic-residue detector, chemical milk analyser, or guarantee of milk safety. Standard farm & dairy quality testing remains mandatory.
      </div>

      {/* Interactive Check & Servo Diverter Logic */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Check Runner */}
        <div className="lg:col-span-6 rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-bold text-[#1F2421]">
                Milking Bay Identification & Record Check
              </h2>
              <p className="text-xs text-[#7A827E]">
                Simulates RFID / manual cow check before opening collection route
              </p>
            </div>
            <StatusBadge tone={db.hardwareState.sensors.rfidConnected ? 'success' : 'neutral'}>
              {db.hardwareState.sensors.rfidConnected ? 'RFID Connected' : 'RFID Disconnected'}
            </StatusBadge>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Select Registered Cow
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedCowOrTag}
                  onChange={(e) => setSelectedCowOrTag(e.target.value)}
                  className="flex-1 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
                >
                  {activeCows.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.id} — {c.name} (RFID: {c.rfidTag})
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => handleRunCheck(selectedCowOrTag, 'Manual Check')}
                  className="rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] whitespace-nowrap"
                >
                  Run Safety Check
                </button>
              </div>
            </div>

            <div className="border-t border-[#E4E1D8] pt-3">
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Simulate RFID Scan (Test Known or Unknown Tag)
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="Enter RFID tag (e.g. RF-00104824 or UNKNOWN-999)"
                  className="flex-1 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
                />
                <button
                  onClick={() => handleRunCheck(customInput, 'RFID Simulation')}
                  className="inline-flex items-center gap-1.5 rounded-md border border-[#2D6A4F] px-3.5 py-2 text-xs font-semibold text-[#1B4332] hover:bg-[#EBF5EE] whitespace-nowrap"
                >
                  <Radio className="h-3.5 w-3.5" /> Simulate Scan
                </button>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                <span className="text-[#7A827E]">Quick tests:</span>
                <button
                  onClick={() => handleRunCheck('C-101', 'RFID Simulation')}
                  className="underline text-[#2D6A4F]"
                >
                  C-101 (Approved)
                </button>
                <button
                  onClick={() => handleRunCheck('C-104', 'RFID Simulation')}
                  className="underline text-[#991B1B]"
                >
                  C-104 (Withdrawal)
                </button>
                <button
                  onClick={() => handleRunCheck('C-107', 'RFID Simulation')}
                  className="underline text-[#B45309]"
                >
                  C-107 (Incomplete)
                </button>
                <button
                  onClick={() => handleRunCheck('RF-UNKNOWN-88', 'RFID Simulation')}
                  className="underline text-[#991B1B]"
                >
                  Unknown RFID
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Decision & Servo Diverter Concept Display */}
        <div className="lg:col-span-6 rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#1F2421]">
              Routing Decision & Servo Diverter State
            </h2>
            <StatusBadge tone={db.hardwareState.diverterServoAngle === 0 ? 'success' : 'danger'}>
              Servo Angle: {db.hardwareState.diverterServoAngle}° (
              {db.hardwareState.sensors.servoDiverterConnected ? 'Hardware' : 'Simulated'})
            </StatusBadge>
          </div>

          {lastResult ? (
            <div className="space-y-3">
              <div
                className={`rounded-md border p-4 ${
                  lastResult.status === 'Approved by record checks'
                    ? 'border-[#C5DEC9] bg-[#EBF5EE]'
                    : 'border-[#F5C2C2] bg-[#FDECEC]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 font-display text-sm font-bold text-[#1F2421]">
                    {lastResult.status === 'Approved by record checks' ? (
                      <ShieldCheck className="h-5 w-5 text-[#1B4332]" />
                    ) : (
                      <ShieldAlert className="h-5 w-5 text-[#991B1B]" />
                    )}
                    <span>{lastResult.status}</span>
                  </div>
                  <StatusBadge tone={statusTone(lastResult.status)}>{lastResult.route}</StatusBadge>
                </div>
                <p className="mt-2 text-xs text-[#3F4742]">{lastResult.reason}</p>
                <p className="mt-1.5 text-[11px] text-[#5C6660] tabular-nums">
                  Tag/Cow: {lastResult.cowId || lastResult.rfidTag} · {formatDateTime(lastResult.timestamp)} ·{' '}
                  {lastResult.checkedBy}
                </p>
              </div>

              {/* 7-Step Fail-Safe Logic Visualization */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div
                  className={`rounded border p-2.5 ${
                    db.hardwareState.diverterServoAngle === 0
                      ? 'border-[#2D6A4F] bg-[#EBF5EE] font-semibold text-[#1B4332]'
                      : 'border-[#E4E1D8] bg-[#FAF8F4] text-[#7A827E]'
                  }`}
                >
                  <CheckCircle2 className="inline h-3.5 w-3.5 mr-1" /> 0° · Main Collection Route
                </div>
                <div
                  className={`rounded border p-2.5 ${
                    db.hardwareState.diverterServoAngle === 90
                      ? 'border-[#B91C1C] bg-[#FDECEC] font-semibold text-[#991B1B]'
                      : 'border-[#E4E1D8] bg-[#FAF8F4] text-[#7A827E]'
                  }`}
                >
                  <AlertOctagon className="inline h-3.5 w-3.5 mr-1" /> 90° · Separate Diversion Route
                </div>
              </div>
            </div>
          ) : (
            <EmptyState
              title="No milk safety checks run yet"
              description="Select a cow or simulate an RFID scan to evaluate treatment and withdrawal rules."
            />
          )}
        </div>
      </div>

      {/* Fail-safe Rules Reference & History Table */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white">
        <div className="border-b border-[#E4E1D8] px-5 py-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-[#1F2421]">
            Milk Safety & Diversion Event History ({db.safetyEvents.length})
          </h3>
          <span className="text-[11px] text-[#7A827E]">
            Fail-safe defaults to Diversion / Hold whenever data or hardware is uncertain
          </span>
        </div>

        {db.safetyEvents.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No safety events logged"
              description="Run a milk safety check above to record routing decisions."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Cow / RFID</th>
                  <th className="py-2.5 px-4">Check Status</th>
                  <th className="py-2.5 px-4">Diverter Route</th>
                  <th className="py-2.5 px-4">Mode / Source</th>
                  <th className="py-2.5 px-4">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {db.safetyEvents.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[#FAF8F4]">
                    <td className="py-2.5 px-4 tabular-nums whitespace-nowrap">
                      {formatDateTime(ev.timestamp)}
                    </td>
                    <td className="py-2.5 px-4 font-semibold">
                      {ev.cowId ? `${ev.cowId} (${ev.rfidTag})` : ev.rfidTag}
                    </td>
                    <td className="py-2.5 px-4">
                      <StatusBadge tone={statusTone(ev.status)}>{ev.status}</StatusBadge>
                    </td>
                    <td className="py-2.5 px-4 font-medium">{ev.route}</td>
                    <td className="py-2.5 px-4 text-[#5C6660]">
                      {ev.checkedBy} · {ev.hardwareMode}
                    </td>
                    <td className="py-2.5 px-4 text-[#5C6660] max-w-sm">{ev.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
