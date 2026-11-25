import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  Edit2,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { MilkRecord } from '../types/dairy';
import {
  evaluateCowMilkBaseline,
  exportToCSV,
  formatShortDate,
  getCowMilkStats,
  getDaysAgoISO,
  getTodayISO,
  round2,
} from '../utils/calculations';
import { ConfirmDialog, EmptyState, Modal, StatusBadge } from '../components/ui/MotionPrimitives';
import { BarComparisonChart, TrendAreaChart } from '../components/ui/Charts';

export const MilkProductionPage: React.FC = () => {
  const {
    db,
    upsertMilkRecord,
    deleteMilkRecord,
    saveUnusualMilkReview,
    pushToast,
  } = useFarm();

  const activeCows = db.cows.filter((c) => c.status !== 'Archived');
  const today = getTodayISO();

  // Filters
  const [search, setSearch] = useState('');
  const [filterCow, setFilterCow] = useState('ALL');
  const [filterDate, setFilterDate] = useState('');
  const [analysisCowId, setAnalysisCowId] = useState<string>(activeCows[0]?.id || '');

  // Entry form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<MilkRecord | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MilkRecord | null>(null);
  const [observationDrafts, setObservationDrafts] = useState<Record<string, string>>({});

  const [formState, setFormState] = useState({
    cowId: activeCows[0]?.id || '',
    date: today,
    morningLitres: '',
    eveningLitres: '',
    additionalLitres: '0',
    notes: '',
  });

  // Aggregated farm metrics
  const farmMetrics = useMemo(() => {
    const todayRecs = db.milkRecords.filter((r) => r.date === today);
    const todayTotal = round2(todayRecs.reduce((s, r) => s + r.totalLitres, 0));
    const weekStart = getDaysAgoISO(6);
    const monthStart = getDaysAgoISO(29);
    const weekTotal = round2(
      db.milkRecords.filter((r) => r.date >= weekStart).reduce((s, r) => s + r.totalLitres, 0)
    );
    const monthTotal = round2(
      db.milkRecords.filter((r) => r.date >= monthStart).reduce((s, r) => s + r.totalLitres, 0)
    );
    const avgPerCowToday = todayRecs.length ? round2(todayTotal / todayRecs.length) : 0;

    return { todayTotal, weekTotal, monthTotal, avgPerCowToday, todayCount: todayRecs.length };
  }, [db.milkRecords, today]);

  // Baseline analysis across all non-archived cows
  const baselineAlerts = useMemo(() => {
    return activeCows
      .map((c) => ({
        cow: c,
        cmp: evaluateCowMilkBaseline(c.id, db.milkRecords, db.settings.milkChangeThresholdPercent),
      }))
      .filter((x) => x.cmp && x.cmp.isUnusual);
  }, [activeCows, db.milkRecords, db.settings.milkChangeThresholdPercent]);

  const selectedCowStats = useMemo(() => {
    if (!analysisCowId) return null;
    return {
      stats: getCowMilkStats(analysisCowId, db.milkRecords),
      baseline: evaluateCowMilkBaseline(
        analysisCowId,
        db.milkRecords,
        db.settings.milkChangeThresholdPercent
      ),
    };
  }, [analysisCowId, db.milkRecords, db.settings.milkChangeThresholdPercent]);

  const filteredRecords = useMemo(() => {
    const q = search.trim().toLowerCase();
    return [...db.milkRecords]
      .filter((r) => {
        const cow = db.cows.find((c) => c.id === r.cowId);
        const matchSearch =
          !q ||
          r.cowId.toLowerCase().includes(q) ||
          (cow?.name.toLowerCase().includes(q) ?? false) ||
          r.notes.toLowerCase().includes(q);
        const matchCow = filterCow === 'ALL' || r.cowId === filterCow;
        const matchDate = !filterDate || r.date === filterDate;
        return matchSearch && matchCow && matchDate;
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.cowId.localeCompare(b.cowId));
  }, [db.milkRecords, db.cows, search, filterCow, filterDate]);

  const openNewEntry = () => {
    setEditingRecord(null);
    setFormState({
      cowId: activeCows[0]?.id || '',
      date: today,
      morningLitres: '',
      eveningLitres: '',
      additionalLitres: '0',
      notes: '',
    });
    setFormOpen(true);
  };

  const openEditEntry = (r: MilkRecord) => {
    setEditingRecord(r);
    setFormState({
      cowId: r.cowId,
      date: r.date,
      morningLitres: String(r.morningLitres),
      eveningLitres: String(r.eveningLitres),
      additionalLitres: String(r.additionalLitres),
      notes: r.notes,
    });
    setFormOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const m = parseFloat(formState.morningLitres || '0');
    const ev = parseFloat(formState.eveningLitres || '0');
    const add = parseFloat(formState.additionalLitres || '0');
    if (!formState.cowId || !formState.date) {
      pushToast('Please select a cow and date.', 'error');
      return;
    }
    if (isNaN(m) || isNaN(ev) || isNaN(add) || m < 0 || ev < 0 || add < 0) {
      pushToast('Milk quantities must be valid non-negative numbers.', 'error');
      return;
    }
    if (m + ev + add === 0) {
      pushToast('Enter at least one non-zero milk quantity.', 'warning');
      return;
    }

    upsertMilkRecord({
      id: editingRecord?.id,
      cowId: formState.cowId,
      date: formState.date,
      morningLitres: m,
      eveningLitres: ev,
      additionalLitres: add,
      notes: formState.notes.trim(),
    });
    setAnalysisCowId(formState.cowId);
    setFormOpen(false);
  };

  const handleExportCSV = () => {
    exportToCSV(
      `dairymitra-milk-records-${today}.csv`,
      ['Date', 'Cow ID', 'Cow Name', 'Morning (L)', 'Evening (L)', 'Additional (L)', 'Total (L)', 'Notes'],
      filteredRecords.map((r) => {
        const cow = db.cows.find((c) => c.id === r.cowId);
        return [
          r.date,
          r.cowId,
          cow?.name || '',
          r.morningLitres,
          r.eveningLitres,
          r.additionalLitres,
          r.totalLitres,
          r.notes,
        ];
      })
    );
    pushToast('Exported filtered milk records to CSV.', 'success');
  };

  // Bar chart of today's output by cow
  const todayByCowChart = activeCows
    .filter((c) => c.status !== 'Dry')
    .map((c) => {
      const rec = db.milkRecords.find((r) => r.cowId === c.id && r.date === today);
      const cmp = evaluateCowMilkBaseline(
        c.id,
        db.milkRecords,
        db.settings.milkChangeThresholdPercent
      );
      return {
        label: c.id,
        value: rec?.totalLitres || 0,
        highlight: Boolean(cmp?.isUnusual),
      };
    });

  return (
    <div className="space-y-6">
      {/* Farm-Wide Milk Summary Strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-4">
          <span className="text-xs text-[#5C6660]">Today Total Milk</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#1B4332] tabular-nums">
            {farmMetrics.todayTotal} L
          </p>
          <p className="mt-1 text-[11px] text-[#7A827E] tabular-nums">
            Across {farmMetrics.todayCount} cows today
          </p>
        </div>
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-4">
          <span className="text-xs text-[#5C6660]">Avg Production / Cow Today</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#1F2421] tabular-nums">
            {farmMetrics.avgPerCowToday} L
          </p>
          <p className="mt-1 text-[11px] text-[#7A827E]">Recorded active milkers</p>
        </div>
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-4">
          <span className="text-xs text-[#5C6660]">Weekly Production (7d)</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#1F2421] tabular-nums">
            {farmMetrics.weekTotal} L
          </p>
          <p className="mt-1 text-[11px] text-[#7A827E]">Rolling 7-day aggregate</p>
        </div>
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-4">
          <span className="text-xs text-[#5C6660]">Monthly Production (30d)</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#1F2421] tabular-nums">
            {farmMetrics.monthTotal} L
          </p>
          <p className="mt-1 text-[11px] text-[#7A827E]">
            Alert threshold ±{db.settings.milkChangeThresholdPercent}%
          </p>
        </div>
      </div>

      {/* Individual Milk Yield Analysis & Unusual-Change Review */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-7 rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="font-display text-base font-bold text-[#1F2421]">
                Individual Cow Yield Baseline
              </h2>
              <p className="text-xs text-[#7A827E]">
                Compares latest daily yield against cow&apos;s own recent average (not a clinical diagnosis)
              </p>
            </div>
            <select
              value={analysisCowId}
              onChange={(e) => setAnalysisCowId(e.target.value)}
              className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-semibold"
            >
              {activeCows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name}
                </option>
              ))}
            </select>
          </div>

          {selectedCowStats?.baseline ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                <span className="text-[11px] text-[#5C6660]">Current ({selectedCowStats.baseline.latestDate})</span>
                <p className="mt-1 font-display text-lg font-bold tabular-nums text-[#1F2421]">
                  {selectedCowStats.baseline.currentLitres} L
                </p>
              </div>
              <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                <span className="text-[11px] text-[#5C6660]">Previous Avg</span>
                <p className="mt-1 font-display text-lg font-bold tabular-nums text-[#1F2421]">
                  {selectedCowStats.baseline.previousAverage} L
                </p>
              </div>
              <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                <span className="text-[11px] text-[#5C6660]">Difference</span>
                <p
                  className={`mt-1 font-display text-lg font-bold tabular-nums ${
                    selectedCowStats.baseline.isUnusual ? 'text-[#B45309]' : 'text-[#1B4332]'
                  }`}
                >
                  {selectedCowStats.baseline.differenceLitres > 0 ? '+' : ''}
                  {selectedCowStats.baseline.differenceLitres} L (
                  {selectedCowStats.baseline.percentDifference}%)
                </p>
              </div>
              <div className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3">
                <span className="text-[11px] text-[#5C6660]">7d / 30d Avg</span>
                <p className="mt-1 font-display text-sm font-bold tabular-nums text-[#1F2421]">
                  {selectedCowStats.stats.avg7Day} L / {selectedCowStats.stats.avg30Day} L
                </p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[#7A827E]">
              Log at least 3 daily entries for this cow to compute its historical baseline.
            </p>
          )}

          <TrendAreaChart
            data={(selectedCowStats?.stats.records || [])
              .slice(0, 14)
              .reverse()
              .map((r) => ({ label: formatShortDate(r.date), value: r.totalLitres }))}
            unit="L"
            height={180}
          />
        </div>

        {/* Unusual Change Alerts & Review Panel */}
        <div className="lg:col-span-5 rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#1F2421]">
              Unusual Yield Review Queue
            </h2>
            <StatusBadge tone={baselineAlerts.length > 0 ? 'warning' : 'success'}>
              {baselineAlerts.length} Flagged
            </StatusBadge>
          </div>
          <p className="text-xs text-[#5C6660]">
            Yield fluctuations are flagged for human inspection only. Never use yield changes alone as a veterinary diagnosis.
          </p>

          <div className="space-y-3 max-h-[300px] overflow-y-auto">
            {baselineAlerts.length === 0 && db.unusualMilkReviews.length === 0 ? (
              <EmptyState
                title="No unusual yield changes"
                description="All cows are producing within their configured baseline range."
              />
            ) : (
              baselineAlerts.map(({ cow, cmp }) => {
                if (!cmp) return null;
                const existingRev = db.unusualMilkReviews.find(
                  (r) => r.cowId === cow.id && r.date === cmp.latestDate
                );
                const draftText =
                  observationDrafts[`${cow.id}-${cmp.latestDate}`] ??
                  existingRev?.observations ??
                  '';
                return (
                  <div
                    key={`${cow.id}-${cmp.latestDate}`}
                    className={`rounded-md border p-3 text-xs space-y-2 ${
                      existingRev?.resolved
                        ? 'border-[#C5DEC9] bg-[#F7FBF8]'
                        : 'border-[#F3D9A4] bg-[#FEF6E7]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-1.5 font-semibold text-[#1F2421]">
                        {existingRev?.resolved ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-[#1B4332]" />
                        ) : (
                          <AlertTriangle className="h-3.5 w-3.5 text-[#B45309]" />
                        )}
                        {cow.id} ({cow.name}) · {cmp.latestDate}
                      </span>
                      <span className="font-bold tabular-nums text-[#92400E]">
                        {cmp.currentLitres} L vs {cmp.previousAverage} L ({cmp.percentDifference}%)
                      </span>
                    </div>
                    <input
                      type="text"
                      value={draftText}
                      onChange={(e) =>
                        setObservationDrafts((p) => ({
                          ...p,
                          [`${cow.id}-${cmp.latestDate}`]: e.target.value,
                        }))
                      }
                      placeholder="Add observation notes (e.g., feed check, parlour stress)..."
                      className="w-full rounded border border-[#E4E1D8] bg-white px-2.5 py-1.5 text-xs"
                    />
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-[#5C6660]">
                        {existingRev?.resolved ? 'Resolved' : 'Pending human review'}
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            saveUnusualMilkReview({
                              id: existingRev?.id,
                              cowId: cow.id,
                              date: cmp.latestDate,
                              currentLitres: cmp.currentLitres,
                              baselineLitres: cmp.previousAverage,
                              percentDifference: cmp.percentDifference,
                              observations: draftText,
                              resolved: false,
                            })
                          }
                          className="rounded border border-[#E4E1D8] bg-white px-2.5 py-1 font-medium text-[#3F4742] hover:bg-[#FAF8F4]"
                        >
                          Save Note
                        </button>
                        {!existingRev?.resolved && (
                          <button
                            onClick={() =>
                              saveUnusualMilkReview({
                                id: existingRev?.id,
                                cowId: cow.id,
                                date: cmp.latestDate,
                                currentLitres: cmp.currentLitres,
                                baselineLitres: cmp.previousAverage,
                                percentDifference: cmp.percentDifference,
                                observations: draftText,
                                resolved: true,
                              })
                            }
                            className="rounded bg-[#1B4332] px-2.5 py-1 font-semibold text-white hover:bg-[#2D6A4F]"
                          >
                            Mark Resolved
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Today Cow-Wise Comparison Chart */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-display text-sm font-bold text-[#1F2421]">
              Today&apos;s Cow-Wise Milk Output ({today})
            </h3>
            <p className="text-xs text-[#7A827E]">
              Amber bars indicate unusual deviation exceeding ±{db.settings.milkChangeThresholdPercent}%
            </p>
          </div>
        </div>
        <BarComparisonChart data={todayByCowChart} unit="L" height={175} />
      </div>

      {/* Milk Records Toolbar & Table */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E4E1D8] p-4">
          <div className="flex flex-wrap items-center gap-2.5 flex-1">
            <div className="relative min-w-[200px] flex-1 max-w-xs">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#7A827E]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search cow or notes..."
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] pl-9 pr-3 py-1.5 text-sm"
              />
            </div>
            <select
              value={filterCow}
              onChange={(e) => setFilterCow(e.target.value)}
              className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-sm"
            >
              <option value="ALL">All Cows</option>
              {activeCows.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.id} — {c.name}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-sm"
            />
            {filterDate && (
              <button
                onClick={() => setFilterDate('')}
                className="text-xs font-medium text-[#2D6A4F] hover:underline"
              >
                Clear date
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E1D8] bg-white px-3 py-2 text-xs font-semibold text-[#3F4742] hover:bg-[#FAF8F4] whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
            <button
              onClick={openNewEntry}
              className="inline-flex items-center gap-1.5 rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] whitespace-nowrap"
            >
              <Plus className="h-4 w-4" /> Record Milk
            </button>
          </div>
        </div>

        {filteredRecords.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No milk records found"
              description="Try clearing filters or log a new morning/evening milking record."
              action={
                <button
                  onClick={openNewEntry}
                  className="rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white"
                >
                  Log First Entry
                </button>
              }
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Cow</th>
                  <th className="py-2.5 px-4 text-right">Morning (L)</th>
                  <th className="py-2.5 px-4 text-right">Evening (L)</th>
                  <th className="py-2.5 px-4 text-right">Extra (L)</th>
                  <th className="py-2.5 px-4 text-right">Daily Total (L)</th>
                  <th className="py-2.5 px-4">Notes</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {filteredRecords.slice(0, 50).map((r) => {
                  const cow = db.cows.find((c) => c.id === r.cowId);
                  return (
                    <tr key={r.id} className="hover:bg-[#FAF8F4]">
                      <td className="py-2.5 px-4 tabular-nums font-medium">{r.date}</td>
                      <td className="py-2.5 px-4 font-semibold text-[#1F2421]">
                        {r.cowId} · {cow?.name || 'Unknown'}
                      </td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{r.morningLitres}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{r.eveningLitres}</td>
                      <td className="py-2.5 px-4 text-right tabular-nums">{r.additionalLitres}</td>
                      <td className="py-2.5 px-4 text-right font-bold text-[#1B4332] tabular-nums">
                        {r.totalLitres}
                      </td>
                      <td className="py-2.5 px-4 text-[#5C6660] max-w-[220px] truncate">
                        {r.notes || '—'}
                      </td>
                      <td className="py-2.5 px-4 text-right whitespace-nowrap">
                        <button
                          onClick={() => openEditEntry(r)}
                          className="rounded p-1 text-[#5C6660] hover:bg-[#E4E1D8]/50 hover:text-[#1F2421]"
                          title="Edit record"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(r)}
                          className="ml-1 rounded p-1 text-[#B91C1C] hover:bg-[#FDECEC]"
                          title="Delete record"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add/Edit Milk Record Modal */}
      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editingRecord ? 'Edit Milk Record' : 'Record Cow Milk Yield'}
        subtitle="Daily totals and unusual-change alerts recalculate automatically."
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Cow *</label>
              <select
                value={formState.cowId}
                disabled={Boolean(editingRecord)}
                onChange={(e) => setFormState((p) => ({ ...p, cowId: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              >
                {activeCows.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.id} — {c.name} ({c.status})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Date *</label>
              <input
                type="date"
                required
                value={formState.date}
                onChange={(e) => setFormState((p) => ({ ...p, date: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Morning Milk (Litres)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formState.morningLitres}
                onChange={(e) => setFormState((p) => ({ ...p, morningLitres: e.target.value }))}
                placeholder="e.g. 6.5"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Evening Milk (Litres)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formState.eveningLitres}
                onChange={(e) => setFormState((p) => ({ ...p, eveningLitres: e.target.value }))}
                placeholder="e.g. 5.5"
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Additional Session (Litres)
              </label>
              <input
                type="number"
                step="0.1"
                min="0"
                value={formState.additionalLitres}
                onChange={(e) => setFormState((p) => ({ ...p, additionalLitres: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div className="flex flex-col justify-end rounded-md border border-[#E4E1D8] bg-[#EBF5EE] px-3 py-2">
              <span className="text-[11px] text-[#1B4332]">Calculated Daily Total</span>
              <span className="font-display text-lg font-bold text-[#1B4332] tabular-nums">
                {round2(
                  (parseFloat(formState.morningLitres || '0') || 0) +
                    (parseFloat(formState.eveningLitres || '0') || 0) +
                    (parseFloat(formState.additionalLitres || '0') || 0)
                )}{' '}
                L
              </span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#3F4742] mb-1">Notes</label>
            <textarea
              rows={2}
              value={formState.notes}
              onChange={(e) => setFormState((p) => ({ ...p, notes: e.target.value }))}
              placeholder="Optional milking remarks..."
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
              Save Milk Record
            </button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteMilkRecord(deleteTarget.id);
        }}
        title="Delete Milk Record?"
        message={`Remove the milk entry for ${deleteTarget?.cowId} on ${deleteTarget?.date} (${deleteTarget?.totalLitres} L)?`}
        confirmLabel="Delete Record"
        danger
      />
    </div>
  );
};
