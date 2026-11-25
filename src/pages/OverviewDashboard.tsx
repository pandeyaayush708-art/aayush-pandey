import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Cpu,
  Droplets,
  HeartPulse,
  Pill,
  Tag,
  Thermometer,
  Waves,
} from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import {
  evaluateCowMilkBaseline,
  formatDateTime,
  formatShortDate,
  formatTemp,
  getDaysAgoISO,
  getTodayISO,
  isWithdrawalActive,
  round2,
} from '../utils/calculations';
import { AnimatedNumber, StatusBadge } from '../components/ui/MotionPrimitives';
import { TrendAreaChart } from '../components/ui/Charts';

export const OverviewDashboard: React.FC = () => {
  const { db, setActivePage, setSelectedCowId } = useFarm();
  const [rangeDays, setRangeDays] = useState<7 | 14 | 30>(14);
  const [selectedDate, setSelectedDate] = useState<string>(getTodayISO());

  const nonArchivedCows = db.cows.filter((c) => c.status !== 'Archived');
  const activeCows = nonArchivedCows.filter((c) => c.status === 'Active');

  const milkSelectedDay = db.milkRecords.filter((r) => r.date === selectedDate);
  const totalMilkSelected = round2(milkSelectedDay.reduce((s, r) => s + r.totalLitres, 0));
  const avgPerCowSelected = milkSelectedDay.length
    ? round2(totalMilkSelected / milkSelectedDay.length)
    : 0;

  const weekStart = getDaysAgoISO(6);
  const monthStart = getDaysAgoISO(29);
  const weeklyMilk = round2(
    db.milkRecords.filter((r) => r.date >= weekStart).reduce((s, r) => s + r.totalLitres, 0)
  );
  const monthlyMilk = round2(
    db.milkRecords.filter((r) => r.date >= monthStart).reduce((s, r) => s + r.totalLitres, 0)
  );

  const unusualMilkCows = useMemo(
    () =>
      nonArchivedCows
        .map((c) =>
          evaluateCowMilkBaseline(c.id, db.milkRecords, db.settings.milkChangeThresholdPercent)
        )
        .filter((x) => x && x.isUnusual),
    [nonArchivedCows, db.milkRecords, db.settings.milkChangeThresholdPercent]
  );

  const cowsNeedingInspection = nonArchivedCows.filter(
    (c) => c.requiresHealthInspection || c.status === 'Under Observation'
  );
  const activeWithdrawals = db.treatments.filter((t) => isWithdrawalActive(t));

  const latestEnv = db.environmentReadings[db.environmentReadings.length - 1];
  const latestWater = db.waterReadings[db.waterReadings.length - 1];

  const chartData = useMemo(() => {
    const arr: { label: string; value: number }[] = [];
    for (let i = rangeDays - 1; i >= 0; i--) {
      const d = getDaysAgoISO(i);
      const sum = round2(
        db.milkRecords.filter((r) => r.date === d).reduce((s, r) => s + r.totalLitres, 0)
      );
      arr.push({ label: formatShortDate(d), value: sum });
    }
    return arr;
  }, [db.milkRecords, rangeDays]);

  const recentAlerts = db.alerts.slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Filter & Date Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-[#E4E1D8] bg-white px-4 py-3">
        <div className="text-xs text-[#5C6660]">
          Farm summary for <span className="font-semibold text-[#1F2421]">{selectedDate}</span>
          <span className="mx-1.5" aria-hidden="true">
            ·
          </span>
          <span>{db.settings.location}</span>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <label className="text-xs text-[#5C6660]" htmlFor="dash-date">
            Date
          </label>
          <input
            id="dash-date"
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-2.5 py-1.5 text-xs font-medium text-[#1F2421]"
          />
          <div className="flex rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-0.5 text-xs">
            {([7, 14, 30] as const).map((d) => (
              <button
                key={d}
                onClick={() => setRangeDays(d)}
                className={`rounded px-2.5 py-1 font-medium transition whitespace-nowrap ${
                  rangeDays === d ? 'bg-[#1B4332] text-white' : 'text-[#5C6660] hover:text-[#1F2421]'
                }`}
              >
                {d} Days
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <button
          onClick={() => setActivePage('cows')}
          className="text-left rounded-lg border border-[#E4E1D8] bg-white p-4 hover:border-[#2D6A4F] transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C6660]">Herd Population</span>
            <Tag className="h-4 w-4 text-[#2D6A4F]" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#1F2421] tabular-nums">
            <AnimatedNumber value={nonArchivedCows.length} />{' '}
            <span className="text-sm font-normal text-[#5C6660]">registered</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#5C6660]">
            <span>{activeCows.length} active cows</span>
            <span className="inline-flex items-center gap-1 text-[#2D6A4F] group-hover:translate-x-0.5 transition">
              View herd <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </button>

        <button
          onClick={() => setActivePage('milk')}
          className="text-left rounded-lg border border-[#E4E1D8] bg-white p-4 hover:border-[#2D6A4F] transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C6660]">Selected Day Milk Yield</span>
            <Droplets className="h-4 w-4 text-[#2D6A4F]" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#1B4332] tabular-nums">
            <AnimatedNumber value={totalMilkSelected} decimals={1} suffix=" L" />
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#5C6660]">
            <span className="tabular-nums">Avg {avgPerCowSelected} L / cow</span>
            <span className="inline-flex items-center gap-1 text-[#2D6A4F] group-hover:translate-x-0.5 transition">
              Milk log <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </button>

        <button
          onClick={() => setActivePage('milk')}
          className="text-left rounded-lg border border-[#E4E1D8] bg-white p-4 hover:border-[#2D6A4F] transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C6660]">Weekly & Monthly Yield</span>
            <Droplets className="h-4 w-4 text-[#7C9A5B]" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#1F2421] tabular-nums">
            <AnimatedNumber value={weeklyMilk} decimals={1} suffix=" L" />
            <span className="ml-1.5 text-xs font-medium text-[#7A827E]">(7d)</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#5C6660]">
            <span className="tabular-nums">30-day total: {monthlyMilk} L</span>
            <span className="inline-flex items-center gap-1 text-[#2D6A4F] group-hover:translate-x-0.5 transition">
              Baselines <ArrowRight className="h-3 w-3" />
            </span>
          </div>
        </button>

        <button
          onClick={() => setActivePage('treatments')}
          className="text-left rounded-lg border border-[#E4E1D8] bg-white p-4 hover:border-[#2D6A4F] transition group"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C6660]">Withdrawals & Inspections</span>
            <Pill className="h-4 w-4 text-[#B45309]" />
          </div>
          <div className="mt-2 font-display text-2xl font-bold text-[#1F2421] tabular-nums">
            <AnimatedNumber value={activeWithdrawals.length} />{' '}
            <span className="text-sm font-normal text-[#5C6660]">active withdrawal(s)</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-xs text-[#5C6660]">
            <span className="tabular-nums">
              {unusualMilkCows.length} yield change · {cowsNeedingInspection.length} health review
            </span>
            <ArrowRight className="h-3 w-3 text-[#2D6A4F]" />
          </div>
        </button>
      </div>

      {/* Middle Split: Production Trend Chart + Telemetry Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        <div className="lg:col-span-2 rounded-lg border border-[#E4E1D8] bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-display text-base font-bold text-[#1F2421]">
                Farm Milk Production Trend ({rangeDays} Days)
              </h2>
              <p className="text-xs text-[#7A827E]">
                Aggregated daily litres across all recorded cows
              </p>
            </div>
            <button
              onClick={() => setActivePage('reports')}
              className="text-xs font-semibold text-[#2D6A4F] hover:underline whitespace-nowrap"
            >
              Open Reports
            </button>
          </div>
          <TrendAreaChart data={chartData} unit="L" />
        </div>

        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5 flex flex-col justify-between space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#1F2421]">
              Barn & Hardware Status
            </h2>
            <StatusBadge
              tone={
                db.hardwareState.mode === 'Live Hardware Mode' &&
                db.hardwareState.connectionStatus === 'Connected'
                  ? 'success'
                  : 'warning'
              }
              liveTelemetry={
                db.hardwareState.mode === 'Live Hardware Mode' &&
                db.hardwareState.connectionStatus === 'Connected'
              }
            >
              {db.hardwareState.mode}
            </StatusBadge>
          </div>

          <div className="space-y-2.5">
            <button
              onClick={() => setActivePage('environment')}
              className="w-full flex items-center justify-between rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3 hover:border-[#2D6A4F] text-left"
            >
              <div className="flex items-center gap-2.5">
                <Thermometer className="h-4 w-4 text-[#2D6A4F]" />
                <div>
                  <p className="text-xs text-[#5C6660]">
                    Barn Climate · {latestEnv?.source || 'No Data'}
                  </p>
                  <p className="text-sm font-bold text-[#1F2421] tabular-nums">
                    {latestEnv
                      ? `${formatTemp(latestEnv.temperatureC, db.settings.temperatureUnit)} · ${
                          latestEnv.humidityPercent
                        }% RH`
                      : 'No reading'}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-[#7A827E]" />
            </button>

            <button
              onClick={() => setActivePage('water')}
              className="w-full flex items-center justify-between rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3 hover:border-[#2D6A4F] text-left"
            >
              <div className="flex items-center gap-2.5">
                <Waves className="h-4 w-4 text-[#2D6A4F]" />
                <div>
                  <p className="text-xs text-[#5C6660]">
                    Water Tank · {latestWater?.source || 'No Data'}
                  </p>
                  <p className="text-sm font-bold text-[#1F2421] tabular-nums">
                    {latestWater
                      ? `${latestWater.waterPercent}% (${latestWater.estimatedLitres} L)`
                      : 'N/A'}{' '}
                    · Pump {db.hardwareState.pumpCommandedState}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-[#7A827E]" />
            </button>

            <button
              onClick={() => setActivePage('hardware')}
              className="w-full flex items-center justify-between rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3 hover:border-[#2D6A4F] text-left"
            >
              <div className="flex items-center gap-2.5">
                <Cpu className="h-4 w-4 text-[#1B4332]" />
                <div>
                  <p className="text-xs text-[#5C6660]">Arduino Uno Controller</p>
                  <p className="text-sm font-bold text-[#1F2421]">
                    {db.hardwareState.connectionStatus}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-[#7A827E]" />
            </button>
          </div>

          <div className="grid grid-cols-2 gap-2.5 pt-1">
            <button
              onClick={() => setActivePage('milk')}
              className="rounded-md bg-[#1B4332] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F] whitespace-nowrap"
            >
              Log Milk Entry
            </button>
            <button
              onClick={() => setActivePage('safety')}
              className="rounded-md border border-[#E4E1D8] bg-white px-3 py-2 text-xs font-semibold text-[#1F2421] hover:bg-[#FAF8F4] whitespace-nowrap"
            >
              Milk Safety Check
            </button>
          </div>
        </div>
      </div>

      {/* Bottom Row: Attention Cows, Recent Alerts, Recent Farm Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Cows needing review */}
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-bold text-[#1F2421]">
              Cows Flagged for Review
            </h3>
            <HeartPulse className="h-4 w-4 text-[#B45309]" />
          </div>
          <div className="space-y-2.5">
            {unusualMilkCows.map((cmp) => {
              if (!cmp) return null;
              const cow = db.cows.find((c) => c.id === cmp.cowId);
              return (
                <button
                  key={cmp.cowId}
                  onClick={() => {
                    setSelectedCowId(cmp.cowId);
                    setActivePage('milk');
                  }}
                  className="w-full text-left rounded-md border border-[#F3D9A4] bg-[#FEF6E7] p-3 hover:border-[#B45309]"
                >
                  <div className="flex items-center justify-between text-xs font-semibold text-[#92400E]">
                    <span>
                      {cmp.cowId} ({cow?.name}) · Unusual Yield
                    </span>
                    <span className="tabular-nums">{cmp.percentDifference}%</span>
                  </div>
                  <p className="mt-1 text-[11px] text-[#78350F] tabular-nums">
                    {cmp.currentLitres} L vs {cmp.previousAverage} L baseline · {cmp.latestDate}
                  </p>
                </button>
              );
            })}
            {cowsNeedingInspection.map((c) => (
              <button
                key={c.id}
                onClick={() => {
                  setSelectedCowId(c.id);
                  setActivePage('health');
                }}
                className="w-full text-left rounded-md border border-[#E4E1D8] bg-[#FAF8F4] p-3 hover:border-[#2D6A4F]"
              >
                <div className="flex items-center justify-between text-xs font-semibold text-[#1F2421]">
                  <span>
                    {c.id} ({c.name})
                  </span>
                  <StatusBadge tone="warning">Inspection Required</StatusBadge>
                </div>
                <p className="mt-1 text-[11px] text-[#5C6660] truncate">{c.notes}</p>
              </button>
            ))}
            {unusualMilkCows.length === 0 && cowsNeedingInspection.length === 0 && (
              <p className="text-xs text-[#7A827E]">No cows currently flagged for review.</p>
            )}
          </div>
        </div>

        {/* Recent Alerts */}
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-display text-sm font-bold text-[#1F2421]">Recent Alerts</h3>
            <button
              onClick={() => setActivePage('alerts')}
              className="text-xs font-medium text-[#2D6A4F] hover:underline whitespace-nowrap"
            >
              View all ({db.alerts.length})
            </button>
          </div>
          <div className="space-y-2.5">
            {recentAlerts.map((a) => (
              <button
                key={a.id}
                onClick={() => setActivePage('alerts')}
                className="w-full text-left rounded-md border border-[#E4E1D8] p-3 hover:bg-[#FAF8F4]"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-xs font-semibold text-[#1F2421] truncate">
                    <AlertTriangle
                      className={`h-3.5 w-3.5 shrink-0 ${
                        a.severity === 'Critical' ? 'text-[#B91C1C]' : 'text-[#B45309]'
                      }`}
                    />
                    <span className="truncate">{a.title}</span>
                  </span>
                  <StatusBadge
                    tone={
                      a.status === 'Resolved'
                        ? 'success'
                        : a.severity === 'Critical'
                        ? 'danger'
                        : 'warning'
                    }
                  >
                    {a.status}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-[11px] text-[#5C6660] line-clamp-2">{a.explanation}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Recent Farm Activity Timeline */}
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
          <h3 className="font-display text-sm font-bold text-[#1F2421] mb-3">
            Recent Farm Activity
          </h3>
          <div className="space-y-3 divide-y divide-[#F0EDE5]">
            {db.timeline.slice(0, 6).map((item, idx) => (
              <div key={item.id} className={idx > 0 ? 'pt-2.5' : ''}>
                <div className="flex items-center justify-between text-[11px] text-[#7A827E]">
                  <span className="font-semibold text-[#2D6A4F]">{item.module}</span>
                  <span className="tabular-nums">{formatDateTime(item.timestamp)}</span>
                </div>
                <p className="mt-0.5 text-xs text-[#1F2421]">{item.summary}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
