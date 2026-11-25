import React, { useMemo, useState } from 'react';
import {
  Archive,
  Camera,
  Edit2,
  Plus,
  Radio,
  Search,
  Trash2,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { Cow, CowStatus } from '../types/dairy';
import {
  formatDateTime,
  formatShortDate,
  getCowMilkStats,
  isWithdrawalActive,
} from '../utils/calculations';
import { ConfirmDialog, EmptyState, Modal, StatusBadge } from '../components/ui/MotionPrimitives';
import { TrendAreaChart } from '../components/ui/Charts';

type ProfileTab = 'overview' | 'milk' | 'health' | 'activity' | 'treatments' | 'alerts';

export const CowManagementPage: React.FC = () => {
  const {
    db,
    selectedCowId,
    setSelectedCowId,
    addCow,
    updateCow,
    deleteOrArchiveCow,
    createManualAlert,
    pushToast,
    setActivePage,
  } = useFarm();

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<CowStatus | 'ALL'>('ALL');
  const [profileTab, setProfileTab] = useState<ProfileTab>('overview');
  const [rfidInput, setRfidInput] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingCow, setEditingCow] = useState<Cow | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ cow: Cow; hard: boolean } | null>(null);

  const [formState, setFormState] = useState({
    id: '',
    name: '',
    rfidTag: '',
    breed: 'Gir',
    dateOfBirth: '2022-01-01',
    status: 'Active' as CowStatus,
    lactationNumber: 1,
    requiresHealthInspection: false,
    notes: '',
    photoDataUrl: '',
  });

  const filteredCows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.cows.filter((c) => {
      const matchSearch =
        !q ||
        c.id.toLowerCase().includes(q) ||
        c.name.toLowerCase().includes(q) ||
        c.rfidTag.toLowerCase().includes(q) ||
        c.breed.toLowerCase().includes(q);
      const matchStatus = statusFilter === 'ALL' ? c.status !== 'Archived' : c.status === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [db.cows, search, statusFilter]);

  const activeCow =
    db.cows.find((c) => c.id === selectedCowId) || filteredCows[0] || null;

  const openAddModal = () => {
    setEditingCow(null);
    const nextNum = 101 + db.cows.length;
    setFormState({
      id: `C-${nextNum}`,
      name: '',
      rfidTag: `RF-001048${nextNum}`,
      breed: 'Gir',
      dateOfBirth: '2022-01-01',
      status: 'Active',
      lactationNumber: 1,
      requiresHealthInspection: false,
      notes: '',
      photoDataUrl: '',
    });
    setFormOpen(true);
  };

  const openEditModal = (cow: Cow) => {
    setEditingCow(cow);
    setFormState({
      id: cow.id,
      name: cow.name,
      rfidTag: cow.rfidTag,
      breed: cow.breed,
      dateOfBirth: cow.dateOfBirth,
      status: cow.status,
      lactationNumber: cow.lactationNumber,
      requiresHealthInspection: cow.requiresHealthInspection,
      notes: cow.notes,
      photoDataUrl: cow.photoDataUrl || '',
    });
    setFormOpen(true);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800 * 1024) {
      pushToast('Image exceeds 800 KB limit for local storage.', 'warning');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setFormState((p) => ({ ...p, photoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSaveCow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formState.id.trim() || !formState.name.trim()) {
      pushToast('Cow ID and Name are required.', 'error');
      return;
    }
    const normalizedId = formState.id.trim().toUpperCase();
    const normalizedRfid = formState.rfidTag.trim().toUpperCase();
    if (!editingCow && db.cows.some((c) => c.id.toUpperCase() === normalizedId)) {
      pushToast(`Cow ID ${normalizedId} already exists.`, 'error');
      return;
    }
    if (
      normalizedRfid &&
      db.cows.some(
        (c) => c.rfidTag.toUpperCase() === normalizedRfid && c.id !== editingCow?.id
      )
    ) {
      pushToast(`RFID Tag ${normalizedRfid} is already assigned to another cow.`, 'error');
      return;
    }

    if (editingCow) {
      updateCow({
        ...editingCow,
        ...formState,
        id: normalizedId,
        rfidTag: normalizedRfid,
      });
      setSelectedCowId(normalizedId);
    } else {
      addCow({
        ...formState,
        id: normalizedId,
        rfidTag: normalizedRfid,
      });
      setSelectedCowId(normalizedId);
    }
    setFormOpen(false);
  };

  const handleRfidIdentify = (e: React.FormEvent) => {
    e.preventDefault();
    const tag = rfidInput.trim().toUpperCase();
    if (!tag) return;
    const match = db.cows.find((c) => c.rfidTag.toUpperCase() === tag && c.status !== 'Archived');
    if (match) {
      setSelectedCowId(match.id);
      pushToast(`RFID ${tag} identified cow ${match.id} (${match.name}).`, 'success');
    } else {
      createManualAlert({
        title: `Unknown RFID Tag Scanned (${tag})`,
        category: 'Unknown RFID',
        timestamp: new Date().toISOString(),
        severity: 'Critical',
        explanation: `Tag "${tag}" is not assigned to any registered cow in Cow Management.`,
      });
      pushToast(`Unknown RFID tag "${tag}" — Alert generated.`, 'error');
    }
  };

  const milkStats = activeCow ? getCowMilkStats(activeCow.id, db.milkRecords) : null;
  const cowHealth = activeCow
    ? db.healthRecords
        .filter((h) => h.cowId === activeCow.id)
        .sort((a, b) => b.date.localeCompare(a.date))
    : [];
  const cowActivity = activeCow
    ? db.activityReadings
        .filter((a) => a.cowId === activeCow.id)
        .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    : [];
  const cowTreatments = activeCow
    ? db.treatments
        .filter((t) => t.cowId === activeCow.id)
        .sort((a, b) => b.startDate.localeCompare(a.startDate))
    : [];
  const cowAlerts = activeCow ? db.alerts.filter((a) => a.cowId === activeCow.id) : [];

  return (
    <div className="space-y-5">
      {/* Top Action & RFID Identification Bar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 flex flex-wrap items-center gap-2.5 rounded-lg border border-[#E4E1D8] bg-white p-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#7A827E]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by Cow ID, name, RFID, or breed..."
              className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] pl-9 pr-3 py-1.5 text-sm focus:border-[#2D6A4F] focus:outline-none"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as CowStatus | 'ALL')}
            className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-sm"
          >
            <option value="ALL">All Active Herd</option>
            <option value="Active">Active</option>
            <option value="Dry">Dry</option>
            <option value="Under Observation">Under Observation</option>
            <option value="Archived">Archived</option>
          </select>
          <button
            onClick={openAddModal}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] whitespace-nowrap"
          >
            <Plus className="h-4 w-4" /> Register Cow
          </button>
        </div>

        {/* RFID Status & Identification Test */}
        <form
          onSubmit={handleRfidIdentify}
          className="rounded-lg border border-[#E4E1D8] bg-white p-3 flex flex-col justify-between gap-2"
        >
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-semibold text-[#1F2421]">
              <Radio className="h-3.5 w-3.5 text-[#2D6A4F]" /> RFID Reader
            </span>
            <StatusBadge tone={db.hardwareState.sensors.rfidConnected ? 'success' : 'neutral'}>
              {db.hardwareState.sensors.rfidConnected
                ? 'RFID Connected'
                : 'RFID Disconnected (Manual Mode)'}
            </StatusBadge>
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={rfidInput}
              onChange={(e) => setRfidInput(e.target.value)}
              placeholder="Scan or test tag (e.g. RF-00104821)"
              className="flex-1 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-2.5 py-1.5 text-xs"
            />
            <button
              type="submit"
              className="rounded-md border border-[#2D6A4F] px-3 py-1.5 text-xs font-semibold text-[#1B4332] hover:bg-[#EBF5EE] whitespace-nowrap"
            >
              Identify
            </button>
          </div>
        </form>
      </div>

      {/* Master-Detail Workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Herd Directory List */}
        <div className="lg:col-span-4 rounded-lg border border-[#E4E1D8] bg-white overflow-hidden">
          <div className="border-b border-[#E4E1D8] px-4 py-3 flex items-center justify-between">
            <span className="text-xs font-semibold text-[#5C6660]">
              Registered Cows ({filteredCows.length})
            </span>
            <span className="text-[11px] text-[#7A827E]">Click to inspect</span>
          </div>
          <div className="divide-y divide-[#E4E1D8] max-h-[660px] overflow-y-auto">
            {filteredCows.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  title="No matching cows"
                  description="Adjust your search filter or register a new cow."
                  action={
                    <button
                      onClick={openAddModal}
                      className="rounded-md bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white"
                    >
                      Register Cow
                    </button>
                  }
                />
              </div>
            ) : (
              filteredCows.map((cow) => {
                const selected = activeCow?.id === cow.id;
                const onWithdrawal = db.treatments.some(
                  (t) => t.cowId === cow.id && isWithdrawalActive(t)
                );
                return (
                  <button
                    key={cow.id}
                    onClick={() => setSelectedCowId(cow.id)}
                    className={`w-full text-left px-4 py-3 flex items-center justify-between transition ${
                      selected
                        ? 'bg-[#EBF5EE] text-[#1B4332]'
                        : 'hover:bg-[#FAF8F4]'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-display text-sm font-bold text-[#1F2421]">
                          {cow.id}
                        </span>
                        <span className="text-sm font-medium text-[#3F4742] truncate">
                          {cow.name}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-[#7A827E] truncate">
                        {cow.breed} · {cow.rfidTag}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                      <StatusBadge
                        tone={
                          cow.status === 'Active'
                            ? 'success'
                            : cow.status === 'Under Observation'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {cow.status}
                      </StatusBadge>
                      {onWithdrawal && <StatusBadge tone="danger">Withdrawal</StatusBadge>}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Individual Cow Profile */}
        <div className="lg:col-span-8 rounded-lg border border-[#E4E1D8] bg-white p-5">
          {!activeCow ? (
            <EmptyState
              title="Select a cow to view profile"
              description="Choose any cow from the directory or register a new cow."
            />
          ) : (
            <div className="space-y-5">
              {/* Profile Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#E4E1D8] pb-4">
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-lg border border-[#E4E1D8] bg-[#FAF8F4] overflow-hidden flex items-center justify-center text-sm font-bold text-[#1B4332]">
                    {activeCow.photoDataUrl ? (
                      <img
                        src={activeCow.photoDataUrl}
                        alt={activeCow.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      activeCow.id
                    )}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="font-display text-xl font-bold text-[#1F2421]">
                        {activeCow.id} — {activeCow.name}
                      </h2>
                      <StatusBadge
                        tone={
                          activeCow.status === 'Active'
                            ? 'success'
                            : activeCow.status === 'Under Observation'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {activeCow.status}
                      </StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-[#5C6660]">
                      {activeCow.breed} · DOB {activeCow.dateOfBirth} ({activeCow.ageYears} yrs) ·
                      RFID {activeCow.rfidTag}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => openEditModal(activeCow)}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E1D8] px-3 py-1.5 text-xs font-medium text-[#3F4742] hover:bg-[#FAF8F4] whitespace-nowrap"
                  >
                    <Edit2 className="h-3.5 w-3.5" /> Edit
                  </button>
                  {activeCow.status !== 'Archived' && (
                    <button
                      onClick={() => setConfirmAction({ cow: activeCow, hard: false })}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E1D8] px-3 py-1.5 text-xs font-medium text-[#92400E] hover:bg-[#FEF6E7] whitespace-nowrap"
                    >
                      <Archive className="h-3.5 w-3.5" /> Archive
                    </button>
                  )}
                  <button
                    onClick={() => setConfirmAction({ cow: activeCow, hard: true })}
                    className="inline-flex items-center gap-1.5 rounded-md border border-[#F5C2C2] px-3 py-1.5 text-xs font-medium text-[#B91C1C] hover:bg-[#FDECEC] whitespace-nowrap"
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                  </button>
                </div>
              </div>

              {/* Profile Section Tabs */}
              <div className="flex flex-wrap gap-1 border-b border-[#E4E1D8] pb-2">
                {(
                  [
                    ['overview', 'Overview'],
                    ['milk', `Milk Production (${milkStats?.count || 0})`],
                    ['health', `Health (${cowHealth.length})`],
                    ['activity', `Activity (${cowActivity.length})`],
                    ['treatments', `Treatments (${cowTreatments.length})`],
                    ['alerts', `Alerts (${cowAlerts.length})`],
                  ] as const
                ).map(([tabId, label]) => (
                  <button
                    key={tabId}
                    onClick={() => setProfileTab(tabId)}
                    className={`rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
                      profileTab === tabId
                        ? 'bg-[#1B4332] text-white'
                        : 'text-[#5C6660] hover:bg-[#FAF8F4] hover:text-[#1F2421]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Tab 1: Overview */}
              {profileTab === 'overview' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                      <span className="text-[11px] text-[#5C6660]">Avg Milk / Day</span>
                      <p className="mt-1 font-display text-lg font-bold text-[#1B4332] tabular-nums">
                        {milkStats?.avgAll || 0} L
                      </p>
                    </div>
                    <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                      <span className="text-[11px] text-[#5C6660]">7-Day Average</span>
                      <p className="mt-1 font-display text-lg font-bold text-[#1F2421] tabular-nums">
                        {milkStats?.avg7Day || 0} L
                      </p>
                    </div>
                    <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                      <span className="text-[11px] text-[#5C6660]">Lactation Cycle</span>
                      <p className="mt-1 font-display text-lg font-bold text-[#1F2421] tabular-nums">
                        #{activeCow.lactationNumber}
                      </p>
                    </div>
                    <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                      <span className="text-[11px] text-[#5C6660]">Inspection Flag</span>
                      <p className="mt-1 font-display text-sm font-bold text-[#1F2421]">
                        {activeCow.requiresHealthInspection ? 'Required' : 'Normal'}
                      </p>
                    </div>
                  </div>
                  <div className="rounded-md border border-[#E4E1D8] p-3.5">
                    <h4 className="text-xs font-semibold text-[#5C6660]">Manager Notes</h4>
                    <p className="mt-1 text-sm text-[#1F2421]">
                      {activeCow.notes || 'No notes recorded.'}
                    </p>
                  </div>
                </div>
              )}

              {/* Tab 2: Milk Production */}
              {profileTab === 'milk' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-[#5C6660]">
                      Total recorded: <strong className="tabular-nums">{milkStats?.totalAll || 0} L</strong> · 30d avg:{' '}
                      <strong className="tabular-nums">{milkStats?.avg30Day || 0} L/day</strong>
                    </p>
                    <button
                      onClick={() => setActivePage('milk')}
                      className="text-xs font-semibold text-[#2D6A4F] hover:underline"
                    >
                      Open Milk Entry Page
                    </button>
                  </div>
                  <TrendAreaChart
                    data={(milkStats?.records || [])
                      .slice(0, 14)
                      .reverse()
                      .map((r) => ({ label: formatShortDate(r.date), value: r.totalLitres }))}
                    unit="L"
                    height={170}
                  />
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E4E1D8] text-[#5C6660]">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 pr-3 text-right">Morning (L)</th>
                          <th className="py-2 pr-3 text-right">Evening (L)</th>
                          <th className="py-2 pr-3 text-right">Total (L)</th>
                          <th className="py-2">Notes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F0EDE5]">
                        {(milkStats?.records || []).slice(0, 10).map((r) => (
                          <tr key={r.id}>
                            <td className="py-2 pr-3 font-medium tabular-nums">{r.date}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{r.morningLitres}</td>
                            <td className="py-2 pr-3 text-right tabular-nums">{r.eveningLitres}</td>
                            <td className="py-2 pr-3 text-right font-semibold text-[#1B4332] tabular-nums">
                              {r.totalLitres}
                            </td>
                            <td className="py-2 text-[#5C6660]">{r.notes || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Tab 3: Health */}
              {profileTab === 'health' && (
                <div className="space-y-3">
                  {cowHealth.length === 0 ? (
                    <EmptyState
                      title="No health records for this cow"
                      description="Add observations, vet visits, or vaccinations from Health Monitoring."
                      action={
                        <button
                          onClick={() => setActivePage('health')}
                          className="rounded-md bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white"
                        >
                          Go to Health Monitoring
                        </button>
                      }
                    />
                  ) : (
                    cowHealth.map((h) => (
                      <div key={h.id} className="rounded-md border border-[#E4E1D8] p-3.5 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#1F2421]">
                            {h.type} · {h.date}
                          </span>
                          {h.requiresInspection && (
                            <StatusBadge tone="warning">Inspection Required</StatusBadge>
                          )}
                        </div>
                        <p className="mt-1.5 text-[#3F4742]">
                          <strong>Symptoms:</strong> {h.symptoms || 'None'}
                        </p>
                        {h.recommendations && (
                          <p className="mt-1 text-[#5C6660]">
                            <strong>Recommendations:</strong> {h.recommendations}
                          </p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* Tab 4: Activity */}
              {profileTab === 'activity' && (
                <div className="space-y-3">
                  {cowActivity.length === 0 ? (
                    <EmptyState
                      title="No activity readings recorded"
                      description="Log manual activity or demo readings from Health Monitoring."
                    />
                  ) : (
                    <>
                      <TrendAreaChart
                        data={[...cowActivity]
                          .reverse()
                          .map((a) => ({ label: formatShortDate(a.timestamp.slice(0, 10)), value: a.activityIndex }))}
                        unit="idx"
                        height={160}
                      />
                      <div className="divide-y divide-[#E4E1D8] text-xs">
                        {cowActivity.slice(0, 8).map((a) => (
                          <div key={a.id} className="py-2 flex items-center justify-between">
                            <span className="tabular-nums text-[#5C6660]">
                              {formatDateTime(a.timestamp)} · {a.source}
                            </span>
                            <span className="font-semibold tabular-nums text-[#1F2421]">
                              Index {a.activityIndex}
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Tab 5: Treatments */}
              {profileTab === 'treatments' && (
                <div className="space-y-3">
                  {cowTreatments.length === 0 ? (
                    <EmptyState
                      title="No treatment records"
                      description="No medicines or withdrawal periods have been logged for this cow."
                    />
                  ) : (
                    cowTreatments.map((t) => {
                      const active = isWithdrawalActive(t);
                      return (
                        <div key={t.id} className="rounded-md border border-[#E4E1D8] p-3.5 text-xs">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="font-semibold text-[#1F2421]">
                              {t.treatmentName} · {t.medicineName}
                            </span>
                            <StatusBadge
                              tone={!t.isComplete ? 'danger' : active ? 'warning' : 'success'}
                            >
                              {!t.isComplete
                                ? 'Incomplete'
                                : active
                                ? 'Withdrawal Active'
                                : 'Completed'}
                            </StatusBadge>
                          </div>
                          <p className="mt-1 text-[#5C6660] tabular-nums">
                            Started {t.startDate} {t.startTime} · Vet: {t.veterinarianName || 'Missing'} ·
                            Withdrawal ends:{' '}
                            {t.expectedWithdrawalEndISO
                              ? formatDateTime(t.expectedWithdrawalEndISO)
                              : 'Not set'}
                          </p>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {/* Tab 6: Alerts */}
              {profileTab === 'alerts' && (
                <div className="space-y-2.5">
                  {cowAlerts.length === 0 ? (
                    <EmptyState
                      title="No alerts for this cow"
                      description="Alerts triggered by yield changes, treatments, or health flags will appear here."
                    />
                  ) : (
                    cowAlerts.map((a) => (
                      <div key={a.id} className="rounded-md border border-[#E4E1D8] p-3 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-semibold text-[#1F2421]">{a.title}</span>
                          <StatusBadge tone={a.status === 'Resolved' ? 'success' : 'warning'}>
                            {a.status}
                          </StatusBadge>
                        </div>
                        <p className="mt-1 text-[#5C6660]">{a.explanation}</p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Add / Edit Cow Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingCow ? `Edit Cow ${editingCow.id}` : 'Register New Cow'}
        subtitle="Changes immediately propagate across milk production, health, treatments, and milk safety."
      >
        <form onSubmit={handleSaveCow} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Cow ID *</label>
              <input
                type="text"
                required
                disabled={Boolean(editingCow)}
                value={formState.id}
                onChange={(e) => setFormState((p) => ({ ...p, id: e.target.value }))}
                placeholder="e.g. C-111"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm disabled:opacity-60"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Cow Name *</label>
              <input
                type="text"
                required
                value={formState.name}
                onChange={(e) => setFormState((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Surabhi"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">RFID Tag Number</label>
              <input
                type="text"
                value={formState.rfidTag}
                onChange={(e) => setFormState((p) => ({ ...p, rfidTag: e.target.value }))}
                placeholder="RF-00104831"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Breed</label>
              <input
                type="text"
                value={formState.breed}
                onChange={(e) => setFormState((p) => ({ ...p, breed: e.target.value }))}
                placeholder="Gir, Sahiwal, HF Cross..."
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Date of Birth</label>
              <input
                type="date"
                value={formState.dateOfBirth}
                onChange={(e) => setFormState((p) => ({ ...p, dateOfBirth: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Status</label>
              <select
                value={formState.status}
                onChange={(e) =>
                  setFormState((p) => ({ ...p, status: e.target.value as CowStatus }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              >
                <option value="Active">Active</option>
                <option value="Dry">Dry</option>
                <option value="Under Observation">Under Observation</option>
                <option value="Archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Lactation Number
              </label>
              <input
                type="number"
                min={0}
                max={15}
                value={formState.lactationNumber}
                onChange={(e) =>
                  setFormState((p) => ({ ...p, lactationNumber: Number(e.target.value) || 0 }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Cow Photograph (Optional)
              </label>
              <label className="flex cursor-pointer items-center gap-2 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-xs text-[#3F4742] hover:border-[#2D6A4F]">
                <Camera className="h-4 w-4 text-[#2D6A4F]" />
                <span>{formState.photoDataUrl ? 'Change Photo' : 'Upload Photo'}</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          <label className="flex items-center gap-2 text-xs text-[#3F4742]">
            <input
              type="checkbox"
              checked={formState.requiresHealthInspection}
              onChange={(e) =>
                setFormState((p) => ({ ...p, requiresHealthInspection: e.target.checked }))
              }
            />
            Flag cow for health inspection
          </label>

          <div>
            <label className="block text-xs font-medium text-[#3F4742] mb-1">Notes</label>
            <textarea
              rows={2}
              value={formState.notes}
              onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))}
              className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setFormOpen(false)}
              className="rounded-md border border-[#E4E1D8] px-4 py-2 text-sm font-medium text-[#3F4742]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="rounded-md bg-[#1B4332] px-4 py-2 text-sm font-semibold text-white hover:bg-[#2D6A4F]"
            >
              {editingCow ? 'Save Changes' : 'Register Cow'}
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(confirmAction)}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction) {
            deleteOrArchiveCow(confirmAction.cow.id, confirmAction.hard);
          }
        }}
        title={
          confirmAction?.hard
            ? `Delete ${confirmAction.cow.id} (${confirmAction.cow.name})?`
            : `Archive ${confirmAction?.cow.id} (${confirmAction?.cow.name})?`
        }
        message={
          confirmAction?.hard
            ? 'Permanently deleting this cow will also remove all associated milk, health, and treatment records. This action cannot be undone.'
            : 'Archiving removes this cow from active herd counts while preserving historical milk and treatment records.'
        }
        confirmLabel={confirmAction?.hard ? 'Delete Permanently' : 'Archive Cow'}
        danger={Boolean(confirmAction?.hard)}
      />
    </div>
  );
};
