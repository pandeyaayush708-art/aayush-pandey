import React, { useMemo, useState } from 'react';
import { Activity, AlertTriangle, HeartPulse, Plus, Stethoscope } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { HealthRecordType } from '../types/dairy';
import {
  evaluateCowActivityBaseline,
  formatDateTime,
  formatShortDate,
  getTodayISO,
} from '../utils/calculations';
import { EmptyState, Modal, StatusBadge } from '../components/ui/MotionPrimitives';
import { TrendAreaChart } from '../components/ui/Charts';

export const HealthMonitoringPage: React.FC = () => {
  const { db, addHealthRecord, addActivityReading, pushToast } = useFarm();
  const activeCows = db.cows.filter((c) => c.status !== 'Archived');
  const today = getTodayISO();

  const [selectedCow, setSelectedCow] = useState<string>(activeCows[0]?.id || '');
  const [healthModalOpen, setHealthModalOpen] = useState(false);
  const [activityModalOpen, setActivityModalOpen] = useState(false);

  const [healthForm, setHealthForm] = useState({
    cowId: activeCows[0]?.id || '',
    date: today,
    type: 'Observation' as HealthRecordType,
    symptoms: '',
    unusualBehaviour: '',
    vetName: '',
    vaccinationDetails: '',
    recommendations: '',
    followUpDate: '',
    requiresInspection: false,
    notes: '',
  });

  const [activityForm, setActivityForm] = useState({
    cowId: activeCows[0]?.id || '',
    activityIndex: '',
    source: 'Manual' as 'Manual' | 'Demo',
    notes: '',
  });

  const activityBaseline = useMemo(() => {
    if (!selectedCow) return null;
    return evaluateCowActivityBaseline(
      selectedCow,
      db.activityReadings,
      db.settings.activityChangeThresholdPercent
    );
  }, [selectedCow, db.activityReadings, db.settings.activityChangeThresholdPercent]);

  const cowActivityList = useMemo(() => {
    return db.activityReadings
      .filter((a) => a.cowId === selectedCow)
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }, [db.activityReadings, selectedCow]);

  const filteredHealthRecords = useMemo(() => {
    return [...db.healthRecords]
      .filter((h) => !selectedCow || h.cowId === selectedCow)
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [db.healthRecords, selectedCow]);

  const handleSaveHealth = (e: React.FormEvent) => {
    e.preventDefault();
    if (!healthForm.cowId) {
      pushToast('Select a cow first.', 'error');
      return;
    }
    if (!healthForm.symptoms && !healthForm.unusualBehaviour && !healthForm.vaccinationDetails && !healthForm.notes) {
      pushToast('Enter symptoms, vaccination details, or observation notes.', 'warning');
      return;
    }
    addHealthRecord(healthForm);
    setSelectedCow(healthForm.cowId);
    setHealthModalOpen(false);
    setHealthForm((p) => ({
      ...p,
      symptoms: '',
      unusualBehaviour: '',
      vaccinationDetails: '',
      recommendations: '',
      notes: '',
      requiresInspection: false,
    }));
  };

  const handleSaveActivity = (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseFloat(activityForm.activityIndex);
    if (!activityForm.cowId || isNaN(val) || val < 0) {
      pushToast('Enter a valid non-negative activity index.', 'error');
      return;
    }
    addActivityReading({
      cowId: activityForm.cowId,
      timestamp: new Date().toISOString(),
      activityIndex: Math.round(val),
      source: activityForm.source,
      notes: activityForm.notes.trim(),
    });
    setSelectedCow(activityForm.cowId);
    setActivityModalOpen(false);
    setActivityForm((p) => ({ ...p, activityIndex: '', notes: '' }));
  };

  return (
    <div className="space-y-6">
      {/* Disclaimer & Top Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[#E4E1D8] bg-white px-4 py-3">
        <div className="text-xs text-[#5C6660]">
          <strong className="text-[#1F2421]">Clinical Notice:</strong> Observations and activity baselines support herd monitoring only and never diagnose disease.
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedCow}
            onChange={(e) => setSelectedCow(e.target.value)}
            className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-semibold"
          >
            {activeCows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.name} ({c.status})
              </option>
            ))}
          </select>
          <button
            onClick={() => {
              setActivityForm((p) => ({ ...p, cowId: selectedCow || activeCows[0]?.id || '' }));
              setActivityModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#1F2421] hover:bg-[#FAF8F4] whitespace-nowrap"
          >
            <Activity className="h-3.5 w-3.5 text-[#2D6A4F]" /> Log Activity
          </button>
          <button
            onClick={() => {
              setHealthForm((p) => ({ ...p, cowId: selectedCow || activeCows[0]?.id || '' }));
              setHealthModalOpen(true);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1B4332] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F] whitespace-nowrap"
          >
            <Plus className="h-3.5 w-3.5" /> Add Health Record
          </button>
        </div>
      </div>

      {/* Activity Sensor & Baseline Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-base font-bold text-[#1F2421]">
                Activity Baseline ({selectedCow || 'Select Cow'})
              </h2>
              <p className="text-xs text-[#7A827E]">
                Supports future MPU6050 collar telemetry · Currently{' '}
                {db.hardwareState.sensors.mpu6050Connected
                  ? 'MPU6050 Connected'
                  : 'MPU6050 Disconnected (Manual / Demo readings only)'}
              </p>
            </div>
            <StatusBadge tone={db.hardwareState.sensors.mpu6050Connected ? 'success' : 'neutral'}>
              {db.hardwareState.sensors.mpu6050Connected ? 'Live Sensor' : 'Manual / Demo'}
            </StatusBadge>
          </div>

          {activityBaseline ? (
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                <span className="text-[11px] text-[#5C6660]">Current Index</span>
                <p className="mt-1 font-display text-lg font-bold tabular-nums text-[#1F2421]">
                  {activityBaseline.latest.activityIndex}
                </p>
                <span className="text-[11px] text-[#7A827E]">{activityBaseline.latest.source}</span>
              </div>
              <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                <span className="text-[11px] text-[#5C6660]">Cow Baseline</span>
                <p className="mt-1 font-display text-lg font-bold tabular-nums text-[#1F2421]">
                  {activityBaseline.baseline}
                </p>
                <span className="text-[11px] text-[#7A827E]">Prior readings avg</span>
              </div>
              <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                <span className="text-[11px] text-[#5C6660]">Difference</span>
                <p
                  className={`mt-1 font-display text-lg font-bold tabular-nums ${
                    activityBaseline.isUnusual ? 'text-[#B45309]' : 'text-[#1B4332]'
                  }`}
                >
                  {activityBaseline.difference > 0 ? '+' : ''}
                  {activityBaseline.difference} ({activityBaseline.percentDifference}%)
                </p>
                <span className="text-[11px] text-[#7A827E]">
                  {activityBaseline.isUnusual ? 'Unusual change flagged' : 'Within baseline'}
                </span>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#7A827E]">
              At least 3 activity readings are required to compute a personal baseline for {selectedCow}.
            </p>
          )}

          <TrendAreaChart
            data={[...cowActivityList]
              .reverse()
              .map((a) => ({
                label: formatShortDate(a.timestamp.slice(0, 10)),
                value: a.activityIndex,
              }))}
            unit="idx"
            height={175}
          />
        </div>

        {/* Cows Requiring Inspection + Follow-ups */}
        <div className="lg:col-span-5 rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#1F2421]">
              Cows Requiring Inspection
            </h2>
            <Stethoscope className="h-4 w-4 text-[#B45309]" />
          </div>
          {activeCows.filter((c) => c.requiresHealthInspection || c.status === 'Under Observation')
            .length === 0 ? (
            <EmptyState
              title="No pending health inspections"
              description="Cows flagged for observation or follow-up will appear here."
            />
          ) : (
            <div className="space-y-2.5">
              {activeCows
                .filter((c) => c.requiresHealthInspection || c.status === 'Under Observation')
                .map((c) => (
                  <button
                    key={c.id}
                    onClick={() => setSelectedCow(c.id)}
                    className={`w-full text-left rounded-md border p-3 text-xs transition ${
                      selectedCow === c.id
                        ? 'border-[#2D6A4F] bg-[#EBF5EE]'
                        : 'border-[#F3D9A4] bg-[#FEF6E7]'
                    }`}
                  >
                    <div className="flex items-center justify-between font-semibold text-[#1F2421]">
                      <span>
                        {c.id} — {c.name}
                      </span>
                      <StatusBadge tone="warning">{c.status}</StatusBadge>
                    </div>
                    <p className="mt-1 text-[#5C6660]">{c.notes}</p>
                  </button>
                ))}
            </div>
          )}

          <div className="border-t border-[#E4E1D8] pt-3">
            <h3 className="text-xs font-semibold text-[#5C6660] mb-2">
              Recent Activity Log ({selectedCow})
            </h3>
            <div className="divide-y divide-[#F0EDE5] max-h-40 overflow-y-auto text-xs">
              {cowActivityList.slice(0, 6).map((a) => (
                <div key={a.id} className="py-1.5 flex items-center justify-between">
                  <span className="text-[#5C6660] tabular-nums">
                    {formatDateTime(a.timestamp)} · {a.source}
                  </span>
                  <span className="font-semibold tabular-nums">{a.activityIndex}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Health History Table */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white">
        <div className="border-b border-[#E4E1D8] px-5 py-3 flex items-center justify-between">
          <h3 className="font-display text-sm font-bold text-[#1F2421]">
            Health Observations, Vet Visits & Vaccinations ({selectedCow})
          </h3>
          <HeartPulse className="h-4 w-4 text-[#2D6A4F]" />
        </div>

        {filteredHealthRecords.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No health records logged"
              description="Record daily health observations, veterinary visits, or vaccination history."
              action={
                <button
                  onClick={() => setHealthModalOpen(true)}
                  className="rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white"
                >
                  Add Health Record
                </button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[#E4E1D8]">
            {filteredHealthRecords.map((h) => (
              <div key={h.id} className="p-4 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-sm font-bold text-[#1F2421]">
                      {h.cowId} · {h.type}
                    </span>
                    <span className="text-[#7A827E] tabular-nums">{h.date}</span>
                    {h.vetName && <span className="text-[#5C6660]">· Vet: {h.vetName}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {h.followUpDate && (
                      <span className="text-[#5C6660] tabular-nums">
                        Follow-up: {h.followUpDate}
                      </span>
                    )}
                    {h.requiresInspection && (
                      <StatusBadge tone="warning">
                        <AlertTriangle className="h-3 w-3" /> Inspection Required
                      </StatusBadge>
                    )}
                  </div>
                </div>
                {h.symptoms && (
                  <p className="text-[#3F4742]">
                    <strong>Visible Symptoms:</strong> {h.symptoms}
                  </p>
                )}
                {h.unusualBehaviour && (
                  <p className="text-[#3F4742]">
                    <strong>Unusual Behaviour:</strong> {h.unusualBehaviour}
                  </p>
                )}
                {h.vaccinationDetails && (
                  <p className="text-[#1B4332]">
                    <strong>Vaccination:</strong> {h.vaccinationDetails}
                  </p>
                )}
                {h.recommendations && (
                  <p className="text-[#5C6660]">
                    <strong>Vet Recommendations:</strong> {h.recommendations}
                  </p>
                )}
                {h.notes && <p className="text-[#7A827E]">Notes: {h.notes}</p>}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Health Record Modal */}
      <Modal
        open={healthModalOpen}
        onClose={() => setHealthModalOpen(false)}
        title="Record Health Observation / Vet Visit"
        subtitle="Health notes track herd care and follow-ups; they do not generate medical diagnoses."
      >
        <form onSubmit={handleSaveHealth} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Cow *</label>
              <select
                value={healthForm.cowId}
                onChange={(e) => setHealthForm((p) => ({ ...p, cowId: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              >
                {activeCows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Record Type</label>
              <select
                value={healthForm.type}
                onChange={(e) =>
                  setHealthForm((p) => ({ ...p, type: e.target.value as HealthRecordType }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              >
                <option value="Observation">Daily Observation</option>
                <option value="Vet Visit">Veterinary Visit</option>
                <option value="Vaccination">Vaccination</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Date</label>
              <input
                type="date"
                value={healthForm.date}
                onChange={(e) => setHealthForm((p) => ({ ...p, date: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Visible Symptoms
              </label>
              <input
                type="text"
                value={healthForm.symptoms}
                onChange={(e) => setHealthForm((p) => ({ ...p, symptoms: e.target.value }))}
                placeholder="e.g. Reduced feed intake, nasal discharge"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Unusual Behaviour
              </label>
              <input
                type="text"
                value={healthForm.unusualBehaviour}
                onChange={(e) => setHealthForm((p) => ({ ...p, unusualBehaviour: e.target.value }))}
                placeholder="e.g. Isolated from herd"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Veterinarian Name
              </label>
              <input
                type="text"
                value={healthForm.vetName}
                onChange={(e) => setHealthForm((p) => ({ ...p, vetName: e.target.value }))}
                placeholder="Dr. ..."
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Follow-Up Date
              </label>
              <input
                type="date"
                value={healthForm.followUpDate}
                onChange={(e) => setHealthForm((p) => ({ ...p, followUpDate: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
          </div>

          {healthForm.type === 'Vaccination' && (
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Vaccination Details & Batch
              </label>
              <input
                type="text"
                value={healthForm.vaccinationDetails}
                onChange={(e) =>
                  setHealthForm((p) => ({ ...p, vaccinationDetails: e.target.value }))
                }
                placeholder="Vaccine name, dose, batch number"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-[#3F4742] mb-1">
              Veterinary Recommendations
            </label>
            <input
              type="text"
              value={healthForm.recommendations}
              onChange={(e) => setHealthForm((p) => ({ ...p, recommendations: e.target.value }))}
              className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F4742] mb-1">Daily Notes</label>
            <textarea
              rows={2}
              value={healthForm.notes}
              onChange={(e) => setHealthForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-[#3F4742]">
            <input
              type="checkbox"
              checked={healthForm.requiresInspection}
              onChange={(e) =>
                setHealthForm((p) => ({ ...p, requiresInspection: e.target.checked }))
              }
            />
            Flag cow as requiring veterinary / physical inspection
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setHealthModalOpen(false)}
              className="rounded-md border border-[#E4E1D8] px-4 py-2 text-sm font-medium text-[#3F4742]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D6A4F]"
            >
              Save Record
            </button>
          </div>
        </form>
      </Modal>

      {/* Log Manual / Demo Activity Reading Modal */}
      <Modal
        open={activityModalOpen}
        onClose={() => setActivityModalOpen(false)}
        title="Log Activity Reading"
        subtitle="MPU6050 collar hardware is disconnected; entries are labelled as Manual or Demo."
      >
        <form onSubmit={handleSaveActivity} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Cow *</label>
              <select
                value={activityForm.cowId}
                onChange={(e) => setActivityForm((p) => ({ ...p, cowId: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              >
                {activeCows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Activity Index (units/hr) *
              </label>
              <input
                type="number"
                required
                min={0}
                value={activityForm.activityIndex}
                onChange={(e) => setActivityForm((p) => ({ ...p, activityIndex: e.target.value }))}
                placeholder="e.g. 145"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#3F4742] mb-1">Reading Type</label>
            <select
              value={activityForm.source}
              onChange={(e) =>
                setActivityForm((p) => ({ ...p, source: e.target.value as 'Manual' | 'Demo' }))
              }
              className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
            >
              <option value="Manual">Manual Observation</option>
              <option value="Demo">Demo Test Reading</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-[#3F4742] mb-1">Notes</label>
            <input
              type="text"
              value={activityForm.notes}
              onChange={(e) => setActivityForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setActivityModalOpen(false)}
              className="rounded-md border border-[#E4E1D8] px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white"
            >
              Save Activity Reading
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
