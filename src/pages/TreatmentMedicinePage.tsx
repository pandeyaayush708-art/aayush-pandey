import React, { useMemo, useState } from 'react';
import { AlertCircle, CheckCircle2, Clock, Edit2, Pill, Plus, Trash2 } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { TreatmentRecord, WithdrawalUnit } from '../types/dairy';
import {
  computeWithdrawalEndISO,
  formatDateTime,
  getTodayISO,
  isUpcomingWithdrawalCompletion,
  isWithdrawalActive,
} from '../utils/calculations';
import { ConfirmDialog, EmptyState, Modal, StatusBadge } from '../components/ui/MotionPrimitives';

type TreatmentTab = 'all' | 'active' | 'upcoming' | 'incomplete' | 'completed';

export const TreatmentMedicinePage: React.FC = () => {
  const { db, upsertTreatment, deleteTreatment, pushToast } = useFarm();
  const activeCows = db.cows.filter((c) => c.status !== 'Archived');
  const today = getTodayISO();

  const [tab, setTab] = useState<TreatmentTab>('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<TreatmentRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<TreatmentRecord | null>(null);

  const [form, setForm] = useState({
    cowId: activeCows[0]?.id || '',
    treatmentName: '',
    medicineName: '',
    startDate: today,
    startTime: '08:00',
    veterinarianName: '',
    vetVerificationInfo: '',
    vetVerified: false,
    withdrawalDurationValue: '',
    withdrawalDurationUnit: 'hours' as WithdrawalUnit,
    notes: '',
  });

  const categorized = useMemo(() => {
    const active = db.treatments.filter((t) => isWithdrawalActive(t));
    const upcoming = db.treatments.filter((t) => isUpcomingWithdrawalCompletion(t));
    const incomplete = db.treatments.filter((t) => !t.isComplete);
    const completed = db.treatments.filter((t) => t.isComplete && !isWithdrawalActive(t));
    return { active, upcoming, incomplete, completed };
  }, [db.treatments]);

  const displayedList = useMemo(() => {
    const base =
      tab === 'active'
        ? categorized.active
        : tab === 'upcoming'
        ? categorized.upcoming
        : tab === 'incomplete'
        ? categorized.incomplete
        : tab === 'completed'
        ? categorized.completed
        : db.treatments;
    return [...base].sort((a, b) => b.startDate.localeCompare(a.startDate));
  }, [tab, categorized, db.treatments]);

  const openNew = () => {
    setEditing(null);
    setForm({
      cowId: activeCows[0]?.id || '',
      treatmentName: '',
      medicineName: '',
      startDate: today,
      startTime: '08:00',
      veterinarianName: '',
      vetVerificationInfo: '',
      vetVerified: false,
      withdrawalDurationValue: '', // Intentionally blank — never prefill or invent withdrawal duration
      withdrawalDurationUnit: 'hours',
      notes: '',
    });
    setModalOpen(true);
  };

  const openEdit = (t: TreatmentRecord) => {
    setEditing(t);
    setForm({
      cowId: t.cowId,
      treatmentName: t.treatmentName,
      medicineName: t.medicineName,
      startDate: t.startDate,
      startTime: t.startTime,
      veterinarianName: t.veterinarianName,
      vetVerificationInfo: t.vetVerificationInfo,
      vetVerified: t.vetVerified,
      withdrawalDurationValue:
        t.withdrawalDurationValue !== null ? String(t.withdrawalDurationValue) : '',
      withdrawalDurationUnit: t.withdrawalDurationUnit,
      notes: t.notes,
    });
    setModalOpen(true);
  };

  const previewEndISO = computeWithdrawalEndISO(
    form.startDate,
    form.startTime,
    form.withdrawalDurationValue ? parseFloat(form.withdrawalDurationValue) : null,
    form.withdrawalDurationUnit
  );

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.cowId || !form.treatmentName.trim() || !form.medicineName.trim()) {
      pushToast('Cow, treatment name, and medicine name are required.', 'error');
      return;
    }
    const durVal = form.withdrawalDurationValue.trim()
      ? parseFloat(form.withdrawalDurationValue)
      : null;
    if (durVal !== null && (isNaN(durVal) || durVal <= 0)) {
      pushToast('Withdrawal duration must be a positive number.', 'error');
      return;
    }

    upsertTreatment({
      id: editing?.id,
      cowId: form.cowId,
      treatmentName: form.treatmentName.trim(),
      medicineName: form.medicineName.trim(),
      startDate: form.startDate,
      startTime: form.startTime,
      veterinarianName: form.veterinarianName.trim(),
      vetVerificationInfo: form.vetVerificationInfo.trim(),
      vetVerified: form.vetVerified,
      withdrawalDurationValue: durVal,
      withdrawalDurationUnit: form.withdrawalDurationUnit,
      notes: form.notes.trim(),
    });
    setModalOpen(false);
  };

  return (
    <div className="space-y-6">
      {/* Safety Rule Banner + Add CTA */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[#E4E1D8] bg-white px-4 py-3">
        <p className="text-xs text-[#5C6660]">
          <strong className="text-[#1F2421]">Withdrawal Policy:</strong> DairyMitra AI never guesses medicine withdrawal durations. Enter the exact veterinarian-prescribed duration; incomplete records trigger fail-safe milk diversion.
        </p>
        <button
          onClick={openNew}
          className="inline-flex items-center gap-1.5 rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] whitespace-nowrap shrink-0"
        >
          <Plus className="h-4 w-4" /> Add Treatment
        </button>
      </div>

      {/* Summary Counters */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={() => setTab('active')}
          className="text-left rounded-lg border border-[#E4E1D8] bg-white p-4 hover:border-[#2D6A4F]"
        >
          <span className="text-xs text-[#5C6660]">Active Withdrawals</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#991B1B] tabular-nums">
            {categorized.active.length}
          </p>
          <span className="text-[11px] text-[#7A827E]">Must be diverted from main tank</span>
        </button>
        <button
          onClick={() => setTab('upcoming')}
          className="text-left rounded-lg border border-[#E4E1D8] bg-white p-4 hover:border-[#2D6A4F]"
        >
          <span className="text-xs text-[#5C6660]">Ending Within 24h</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#B45309] tabular-nums">
            {categorized.upcoming.length}
          </p>
          <span className="text-[11px] text-[#7A827E]">Upcoming completion checks</span>
        </button>
        <button
          onClick={() => setTab('incomplete')}
          className="text-left rounded-lg border border-[#E4E1D8] bg-white p-4 hover:border-[#2D6A4F]"
        >
          <span className="text-xs text-[#5C6660]">Incomplete / Unverified</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#B45309] tabular-nums">
            {categorized.incomplete.length}
          </p>
          <span className="text-[11px] text-[#7A827E]">Requires vet verification</span>
        </button>
        <button
          onClick={() => setTab('completed')}
          className="text-left rounded-lg border border-[#E4E1D8] bg-white p-4 hover:border-[#2D6A4F]"
        >
          <span className="text-xs text-[#5C6660]">Completed Treatments</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#1B4332] tabular-nums">
            {categorized.completed.length}
          </p>
          <span className="text-[11px] text-[#7A827E]">Withdrawal period elapsed</span>
        </button>
      </div>

      {/* Tabs & Records */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white">
        <div className="flex flex-wrap items-center gap-1 border-b border-[#E4E1D8] p-3">
          {(
            [
              ['all', `All Records (${db.treatments.length})`],
              ['active', `Active Withdrawal (${categorized.active.length})`],
              ['upcoming', `Upcoming End (${categorized.upcoming.length})`],
              ['incomplete', `Incomplete / Needs Verification (${categorized.incomplete.length})`],
              ['completed', `Completed (${categorized.completed.length})`],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                tab === id
                  ? 'bg-[#1B4332] text-white'
                  : 'text-[#5C6660] hover:bg-[#FAF8F4] hover:text-[#1F2421]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {displayedList.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No treatment records in this category"
              description="Add a treatment record with veterinarian verification and prescribed withdrawal hours or days."
              action={
                <button
                  onClick={openNew}
                  className="rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white"
                >
                  Add Treatment Record
                </button>
              }
            />
          </div>
        ) : (
          <div className="divide-y divide-[#E4E1D8]">
            {displayedList.map((t) => {
              const cow = db.cows.find((c) => c.id === t.cowId);
              const active = isWithdrawalActive(t);
              const upcoming = isUpcomingWithdrawalCompletion(t);
              return (
                <div
                  key={t.id}
                  className="p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <Pill className="h-4 w-4 text-[#2D6A4F]" />
                      <span className="font-display text-sm font-bold text-[#1F2421]">
                        {t.cowId} ({cow?.name || 'Unknown'}) · {t.treatmentName}
                      </span>
                      {!t.isComplete ? (
                        <StatusBadge tone="danger">
                          <AlertCircle className="h-3 w-3" /> Incomplete / Verification Needed
                        </StatusBadge>
                      ) : active ? (
                        <StatusBadge tone="danger">
                          <Clock className="h-3 w-3" />{' '}
                          {upcoming ? 'Withdrawal Ending <24h' : 'Withdrawal Active'}
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="success">
                          <CheckCircle2 className="h-3 w-3" /> Completed
                        </StatusBadge>
                      )}
                    </div>
                    <p className="text-xs text-[#3F4742]">
                      <strong>Medicine:</strong> {t.medicineName} · <strong>Started:</strong>{' '}
                      <span className="tabular-nums">
                        {t.startDate} {t.startTime}
                      </span>{' '}
                      · <strong>Vet:</strong> {t.veterinarianName || 'Missing'} (
                      {t.vetVerified ? t.vetVerificationInfo || 'Verified' : 'Unverified'})
                    </p>
                    <p className="text-xs text-[#5C6660] tabular-nums">
                      <strong>Prescribed Withdrawal:</strong>{' '}
                      {t.withdrawalDurationValue
                        ? `${t.withdrawalDurationValue} ${t.withdrawalDurationUnit}`
                        : 'Not entered (fail-safe diversion active)'}{' '}
                      · <strong>Expected End:</strong>{' '}
                      {t.expectedWithdrawalEndISO
                        ? formatDateTime(t.expectedWithdrawalEndISO)
                        : 'Cannot calculate until duration is entered'}
                    </p>
                    {t.notes && <p className="text-xs text-[#7A827E]">Notes: {t.notes}</p>}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => openEdit(t)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#E4E1D8] px-3 py-1.5 text-xs font-medium text-[#3F4742] hover:bg-[#FAF8F4] whitespace-nowrap"
                    >
                      <Edit2 className="h-3.5 w-3.5" /> Edit / Verify
                    </button>
                    <button
                      onClick={() => setDeleteTarget(t)}
                      className="inline-flex items-center gap-1 rounded-md border border-[#F5C2C2] px-3 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FDECEC] whitespace-nowrap"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Add/Edit Treatment Modal */}
      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? 'Edit & Verify Treatment Record' : 'Add Treatment & Withdrawal Record'}
        subtitle="Enter exact veterinarian-prescribed withdrawal duration. Leaving duration or verification blank marks the record incomplete."
      >
        <form onSubmit={handleSave} className="space-y-3.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Cow *</label>
              <select
                value={form.cowId}
                onChange={(e) => setForm((p) => ({ ...p, cowId: e.target.value }))}
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
                Treatment Name *
              </label>
              <input
                type="text"
                required
                value={form.treatmentName}
                onChange={(e) => setForm((p) => ({ ...p, treatmentName: e.target.value }))}
                placeholder="e.g. Mastitis Support"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Medicine Name *
              </label>
              <input
                type="text"
                required
                value={form.medicineName}
                onChange={(e) => setForm((p) => ({ ...p, medicineName: e.target.value }))}
                placeholder="Prescribed medicine name"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Veterinarian Name
              </label>
              <input
                type="text"
                value={form.veterinarianName}
                onChange={(e) => setForm((p) => ({ ...p, veterinarianName: e.target.value }))}
                placeholder="Dr. ..."
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Start Date *</label>
              <input
                type="date"
                required
                value={form.startDate}
                onChange={(e) => setForm((p) => ({ ...p, startDate: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Start Time *</label>
              <input
                type="time"
                required
                value={form.startTime}
                onChange={(e) => setForm((p) => ({ ...p, startTime: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Vet-Prescribed Withdrawal Duration
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  min={1}
                  step="1"
                  value={form.withdrawalDurationValue}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, withdrawalDurationValue: e.target.value }))
                  }
                  placeholder="Enter vet duration"
                  className="flex-1 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
                />
                <select
                  value={form.withdrawalDurationUnit}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      withdrawalDurationUnit: e.target.value as WithdrawalUnit,
                    }))
                  }
                  className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-2.5 py-2 text-sm"
                >
                  <option value="hours">Hours</option>
                  <option value="days">Days</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Vet Verification Reference
              </label>
              <input
                type="text"
                value={form.vetVerificationInfo}
                onChange={(e) => setForm((p) => ({ ...p, vetVerificationInfo: e.target.value }))}
                placeholder="Reg # or prescription ID"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-[#1F2421]">
            <input
              type="checkbox"
              checked={form.vetVerified}
              onChange={(e) => setForm((p) => ({ ...p, vetVerified: e.target.checked }))}
            />
            Verified against veterinarian prescription
          </label>

          <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-xs">
            <span className="text-[#5C6660]">Calculated Expected Withdrawal End: </span>
            <strong className="text-[#1F2421] tabular-nums">
              {previewEndISO
                ? formatDateTime(previewEndISO)
                : 'Not available (enter start date/time and vet-prescribed duration)'}
            </strong>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F4742] mb-1">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
              className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="rounded-md border border-[#E4E1D8] px-4 py-2 text-sm font-medium"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D6A4F]"
            >
              Save Treatment
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteTreatment(deleteTarget.id);
        }}
        title="Delete Treatment Record?"
        message={`Remove treatment "${deleteTarget?.treatmentName}" for ${deleteTarget?.cowId}?`}
        confirmLabel="Delete"
        danger
      />
    </div>
  );
};
