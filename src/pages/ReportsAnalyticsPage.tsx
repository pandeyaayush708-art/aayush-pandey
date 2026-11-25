import React, { useMemo, useState } from 'react';
import { Download, Printer } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import {
  evaluateCowMilkBaseline,
  exportToCSV,
  formatDateTime,
  formatShortDate,
  formatTemp,
  getDaysAgoISO,
  getTodayISO,
  isWithdrawalActive,
  round2,
} from '../utils/calculations';
import { BarComparisonChart, TrendAreaChart } from '../components/ui/Charts';
import { StatusBadge } from '../components/ui/MotionPrimitives';

type ReportTab = 'milk' | 'cowwise' | 'health_treatment' | 'env_water' | 'safety_alerts';

export const ReportsAnalyticsPage: React.FC = () => {
  const { db, pushToast } = useFarm();
  const today = getTodayISO();

  const [tab, setTab] = useState<ReportTab>('milk');
  const [fromDate, setFromDate] = useState(getDaysAgoISO(13));
  const [toDate, setToDate] = useState(today);
  const [cowFilter, setCowFilter] = useState('ALL');

  const activeCows = db.cows.filter((c) => c.status !== 'Archived');

  const filteredMilk = useMemo(() => {
    return db.milkRecords
      .filter(
        (r) =>
          r.date >= fromDate &&
          r.date <= toDate &&
          (cowFilter === 'ALL' || r.cowId === cowFilter)
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [db.milkRecords, fromDate, toDate, cowFilter]);

  const dailyTotals = useMemo(() => {
    const map = new Map<string, number>();
    filteredMilk.forEach((r) => {
      map.set(r.date, round2((map.get(r.date) || 0) + r.totalLitres));
    });
    return Array.from(map.entries()).map(([date, total]) => ({
      date,
      label: formatShortDate(date),
      value: total,
    }));
  }, [filteredMilk]);

  const cowWiseSummary = useMemo(() => {
    return activeCows
      .filter((c) => cowFilter === 'ALL' || c.id === cowFilter)
      .map((c) => {
        const recs = filteredMilk.filter((r) => r.cowId === c.id);
        const total = round2(recs.reduce((s, r) => s + r.totalLitres, 0));
        const avg = recs.length ? round2(total / recs.length) : 0;
        const cmp = evaluateCowMilkBaseline(
          c.id,
          db.milkRecords,
          db.settings.milkChangeThresholdPercent
        );
        return { cow: c, days: recs.length, total, avg, cmp };
      });
  }, [activeCows, cowFilter, filteredMilk, db.milkRecords, db.settings.milkChangeThresholdPercent]);

  const handleExportCurrentReport = () => {
    if (tab === 'milk' || tab === 'cowwise') {
      exportToCSV(
        `dairymitra-milk-report-${fromDate}-to-${toDate}.csv`,
        ['Date', 'Cow ID', 'Morning (L)', 'Evening (L)', 'Additional (L)', 'Total (L)', 'Notes'],
        filteredMilk.map((r) => [
          r.date,
          r.cowId,
          r.morningLitres,
          r.eveningLitres,
          r.additionalLitres,
          r.totalLitres,
          r.notes,
        ])
      );
    } else if (tab === 'health_treatment') {
      exportToCSV(
        `dairymitra-treatments-${today}.csv`,
        ['Cow ID', 'Treatment', 'Medicine', 'Start', 'Vet', 'Verified', 'Withdrawal End'],
        db.treatments
          .filter((t) => cowFilter === 'ALL' || t.cowId === cowFilter)
          .map((t) => [
            t.cowId,
            t.treatmentName,
            t.medicineName,
            `${t.startDate} ${t.startTime}`,
            t.veterinarianName,
            t.vetVerified ? 'Yes' : 'No',
            t.expectedWithdrawalEndISO || 'Incomplete',
          ])
      );
    } else if (tab === 'env_water') {
      exportToCSV(
        `dairymitra-environment-water-${today}.csv`,
        ['Timestamp', 'Temperature (C)', 'Humidity (%)', 'Source'],
        db.environmentReadings.map((e) => [e.timestamp, e.temperatureC, e.humidityPercent, e.source])
      );
    } else {
      exportToCSV(
        `dairymitra-safety-alerts-${today}.csv`,
        ['Timestamp', 'Cow/RFID', 'Status', 'Route', 'Reason'],
        db.safetyEvents.map((s) => [
          s.timestamp,
          s.cowId || s.rfidTag,
          s.status,
          s.route,
          s.reason,
        ])
      );
    }
    pushToast('Report exported to CSV.', 'success');
  };

  return (
    <div className="space-y-6">
      {/* Filter & Export Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#E4E1D8] bg-white p-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#5C6660]">From:</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-2.5 py-1.5 text-xs"
            />
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-[#5C6660]">To:</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-2.5 py-1.5 text-xs"
            />
          </div>
          <select
            value={cowFilter}
            onChange={(e) => setCowFilter(e.target.value)}
            className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-medium"
          >
            <option value="ALL">All Cows</option>
            {activeCows.map((c) => (
              <option key={c.id} value={c.id}>
                {c.id} — {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExportCurrentReport}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E1D8] bg-white px-3 py-1.5 text-xs font-semibold text-[#3F4742] hover:bg-[#FAF8F4] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" /> Export CSV
          </button>
          <button
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 rounded-md bg-[#1B4332] px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F] whitespace-nowrap"
          >
            <Printer className="h-3.5 w-3.5" /> Print Report
          </button>
        </div>
      </div>

      {/* Report Tabs */}
      <div className="no-print flex flex-wrap gap-1 rounded-lg border border-[#E4E1D8] bg-white p-2">
        {(
          [
            ['milk', 'Daily / Weekly / Monthly Milk'],
            ['cowwise', 'Cow-Wise & Unusual Yield'],
            ['health_treatment', 'Health & Withdrawal History'],
            ['env_water', 'Climate, Water & Pump'],
            ['safety_alerts', 'Safety & Alerts History'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`rounded-md px-3 py-1.5 text-xs font-semibold transition whitespace-nowrap ${
              tab === id ? 'bg-[#1B4332] text-white' : 'text-[#5C6660] hover:bg-[#FAF8F4]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab 1: Daily/Weekly/Monthly Milk */}
      {tab === 'milk' && (
        <div className="space-y-5">
          <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="font-display text-base font-bold text-[#1F2421]">
                  Milk Production Report ({fromDate} to {toDate})
                </h2>
                <p className="text-xs text-[#7A827E] tabular-nums">
                  Total in range: {round2(filteredMilk.reduce((s, r) => s + r.totalLitres, 0))} L ·{' '}
                  {filteredMilk.length} cow-day entries
                </p>
              </div>
            </div>
            <TrendAreaChart data={dailyTotals} unit="L" height={210} />
          </div>

          <div className="rounded-lg border border-[#E4E1D8] bg-white overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4 text-right">Total Farm Yield (L)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {[...dailyTotals].reverse().map((d) => (
                  <tr key={d.date}>
                    <td className="py-2 px-4 font-medium tabular-nums">{d.date}</td>
                    <td className="py-2 px-4 text-right font-bold text-[#1B4332] tabular-nums">
                      {d.value} L
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: Cow-Wise & Unusual Changes */}
      {tab === 'cowwise' && (
        <div className="space-y-5">
          <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
            <h2 className="font-display text-base font-bold text-[#1F2421] mb-3">
              Average Daily Yield by Cow (L/day)
            </h2>
            <BarComparisonChart
              data={cowWiseSummary.map((c) => ({
                label: c.cow.id,
                value: c.avg,
                highlight: Boolean(c.cmp?.isUnusual),
              }))}
              unit="L/d"
            />
          </div>

          <div className="rounded-lg border border-[#E4E1D8] bg-white overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Cow</th>
                  <th className="py-2.5 px-4">Breed</th>
                  <th className="py-2.5 px-4 text-right">Days Logged</th>
                  <th className="py-2.5 px-4 text-right">Total (L)</th>
                  <th className="py-2.5 px-4 text-right">Average (L/d)</th>
                  <th className="py-2.5 px-4">Latest Baseline Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {cowWiseSummary.map((row) => (
                  <tr key={row.cow.id}>
                    <td className="py-2.5 px-4 font-semibold">
                      {row.cow.id} · {row.cow.name}
                    </td>
                    <td className="py-2.5 px-4 text-[#5C6660]">{row.cow.breed}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{row.days}</td>
                    <td className="py-2.5 px-4 text-right font-semibold tabular-nums">{row.total}</td>
                    <td className="py-2.5 px-4 text-right tabular-nums">{row.avg}</td>
                    <td className="py-2.5 px-4">
                      {row.cmp?.isUnusual ? (
                        <StatusBadge tone="warning">
                          Unusual ({row.cmp.percentDifference}%)
                        </StatusBadge>
                      ) : (
                        <StatusBadge tone="success">Steady</StatusBadge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Health & Treatments */}
      {tab === 'health_treatment' && (
        <div className="space-y-5">
          <div className="rounded-lg border border-[#E4E1D8] bg-white overflow-x-auto">
            <div className="border-b border-[#E4E1D8] px-5 py-3">
              <h3 className="font-display text-sm font-bold text-[#1F2421]">
                Treatment & Withdrawal Reminder History
              </h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Cow</th>
                  <th className="py-2.5 px-4">Treatment & Medicine</th>
                  <th className="py-2.5 px-4">Start</th>
                  <th className="py-2.5 px-4">Withdrawal End</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {db.treatments
                  .filter((t) => cowFilter === 'ALL' || t.cowId === cowFilter)
                  .map((t) => (
                    <tr key={t.id}>
                      <td className="py-2.5 px-4 font-semibold">{t.cowId}</td>
                      <td className="py-2.5 px-4">
                        {t.treatmentName} · {t.medicineName}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {t.startDate} {t.startTime}
                      </td>
                      <td className="py-2.5 px-4 tabular-nums">
                        {formatDateTime(t.expectedWithdrawalEndISO)}
                      </td>
                      <td className="py-2.5 px-4">
                        <StatusBadge
                          tone={!t.isComplete ? 'danger' : isWithdrawalActive(t) ? 'warning' : 'success'}
                        >
                          {!t.isComplete
                            ? 'Incomplete'
                            : isWithdrawalActive(t)
                            ? 'Withdrawal Active'
                            : 'Completed'}
                        </StatusBadge>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-[#E4E1D8] bg-white overflow-x-auto">
            <div className="border-b border-[#E4E1D8] px-5 py-3">
              <h3 className="font-display text-sm font-bold text-[#1F2421]">
                Health Observation & Vet Visit Report
              </h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Cow</th>
                  <th className="py-2.5 px-4">Type</th>
                  <th className="py-2.5 px-4">Findings & Recommendations</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {db.healthRecords
                  .filter((h) => cowFilter === 'ALL' || h.cowId === cowFilter)
                  .map((h) => (
                    <tr key={h.id}>
                      <td className="py-2.5 px-4 tabular-nums">{h.date}</td>
                      <td className="py-2.5 px-4 font-semibold">{h.cowId}</td>
                      <td className="py-2.5 px-4">{h.type}</td>
                      <td className="py-2.5 px-4 text-[#3F4742]">
                        {h.symptoms} {h.recommendations ? `· ${h.recommendations}` : ''}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Climate, Water & Pump */}
      {tab === 'env_water' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
            <h3 className="font-display text-sm font-bold text-[#1F2421] mb-3">
              Barn Temperature & Humidity Log
            </h3>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3 text-right">Temp</th>
                    <th className="py-2 px-3 text-right">Humidity</th>
                    <th className="py-2 px-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EDE5]">
                  {[...db.environmentReadings].reverse().map((e) => (
                    <tr key={e.id}>
                      <td className="py-2 px-3 tabular-nums">{formatDateTime(e.timestamp)}</td>
                      <td className="py-2 px-3 text-right font-semibold tabular-nums">
                        {formatTemp(e.temperatureC, db.settings.temperatureUnit)}
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{e.humidityPercent}%</td>
                      <td className="py-2 px-3 text-[#5C6660]">{e.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
            <h3 className="font-display text-sm font-bold text-[#1F2421] mb-3">
              Water Tank & Pump Activity Log
            </h3>
            <div className="overflow-x-auto max-h-80">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                    <th className="py-2 px-3">Time</th>
                    <th className="py-2 px-3 text-right">Level</th>
                    <th className="py-2 px-3 text-right">Litres</th>
                    <th className="py-2 px-3">Source</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F0EDE5]">
                  {[...db.waterReadings].reverse().map((w) => (
                    <tr key={w.id}>
                      <td className="py-2 px-3 tabular-nums">{formatDateTime(w.timestamp)}</td>
                      <td className="py-2 px-3 text-right font-semibold tabular-nums">
                        {w.waterPercent}%
                      </td>
                      <td className="py-2 px-3 text-right tabular-nums">{w.estimatedLitres} L</td>
                      <td className="py-2 px-3 text-[#5C6660]">{w.source}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 5: Safety & Alerts History */}
      {tab === 'safety_alerts' && (
        <div className="space-y-5">
          <div className="rounded-lg border border-[#E4E1D8] bg-white overflow-x-auto">
            <div className="border-b border-[#E4E1D8] px-5 py-3">
              <h3 className="font-display text-sm font-bold text-[#1F2421]">
                Milk Segregation Event History
              </h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Cow / Tag</th>
                  <th className="py-2.5 px-4">Status</th>
                  <th className="py-2.5 px-4">Route</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {db.safetyEvents.map((s) => (
                  <tr key={s.id}>
                    <td className="py-2 px-4 tabular-nums">{formatDateTime(s.timestamp)}</td>
                    <td className="py-2 px-4 font-semibold">{s.cowId || s.rfidTag}</td>
                    <td className="py-2 px-4">{s.status}</td>
                    <td className="py-2 px-4">{s.route}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="rounded-lg border border-[#E4E1D8] bg-white overflow-x-auto">
            <div className="border-b border-[#E4E1D8] px-5 py-3">
              <h3 className="font-display text-sm font-bold text-[#1F2421]">Alert History</h3>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Date & Time</th>
                  <th className="py-2.5 px-4">Alert</th>
                  <th className="py-2.5 px-4">Severity</th>
                  <th className="py-2.5 px-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {db.alerts.map((a) => (
                  <tr key={a.id}>
                    <td className="py-2 px-4 tabular-nums">{formatDateTime(a.timestamp)}</td>
                    <td className="py-2 px-4 font-medium">{a.title}</td>
                    <td className="py-2 px-4">{a.severity}</td>
                    <td className="py-2 px-4">{a.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
