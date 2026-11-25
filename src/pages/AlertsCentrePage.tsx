import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AlertTriangle, CheckCircle2, Eye, Search } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { AlertCategory, AlertSeverity, AlertStatus } from '../types/dairy';
import { formatDateTime } from '../utils/calculations';
import { EmptyState, StatusBadge } from '../components/ui/MotionPrimitives';

export const AlertsCentrePage: React.FC = () => {
  const { db, updateAlertStatus, setSelectedCowId, setActivePage } = useFarm();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AlertCategory | 'ALL'>('ALL');
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<AlertStatus | 'ALL'>('ALL');
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const categories = Array.from(new Set(db.alerts.map((a) => a.category)));

  const filteredAlerts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.alerts.filter((a) => {
      const matchSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.explanation.toLowerCase().includes(q) ||
        (a.cowId?.toLowerCase().includes(q) ?? false);
      const matchCat = categoryFilter === 'ALL' || a.category === categoryFilter;
      const matchSev = severityFilter === 'ALL' || a.severity === severityFilter;
      const matchStatus = statusFilter === 'ALL' || a.status === statusFilter;
      return matchSearch && matchCat && matchSev && matchStatus;
    });
  }, [db.alerts, search, categoryFilter, severityFilter, statusFilter]);

  const counts = {
    unread: db.alerts.filter((a) => a.status === 'Unread').length,
    critical: db.alerts.filter((a) => a.severity === 'Critical' && a.status !== 'Resolved').length,
    resolved: db.alerts.filter((a) => a.status === 'Resolved').length,
  };

  return (
    <div className="space-y-6">
      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-4">
          <span className="text-xs text-[#5C6660]">Unread Alerts</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#B45309] tabular-nums">
            {counts.unread}
          </p>
        </div>
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-4">
          <span className="text-xs text-[#5C6660]">Open Critical Alerts</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#991B1B] tabular-nums">
            {counts.critical}
          </p>
        </div>
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-4">
          <span className="text-xs text-[#5C6660]">Resolved Alerts</span>
          <p className="mt-1 font-display text-2xl font-bold text-[#1B4332] tabular-nums">
            {counts.resolved}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5 rounded-lg border border-[#E4E1D8] bg-white p-3.5">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-[#7A827E]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search alerts by cow ID, title, or explanation..."
            className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] pl-9 pr-3 py-1.5 text-sm"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as AlertCategory | 'ALL')}
          className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-medium"
        >
          <option value="ALL">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value as AlertSeverity | 'ALL')}
          className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-medium"
        >
          <option value="ALL">All Severities</option>
          <option value="Critical">Critical</option>
          <option value="Warning">Warning</option>
          <option value="Info">Info</option>
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as AlertStatus | 'ALL')}
          className="rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-medium"
        >
          <option value="ALL">All Statuses</option>
          <option value="Unread">Unread</option>
          <option value="Read">Read</option>
          <option value="Reviewed">Reviewed</option>
          <option value="Resolved">Resolved</option>
        </select>
      </div>

      {/* Alert List */}
      {filteredAlerts.length === 0 ? (
        <EmptyState
          title="No alerts match the current filters"
          description="Alerts from milk production, treatments, environment, water, and hardware appear here."
        />
      ) : (
        <div className="space-y-3">
          {filteredAlerts.map((a, index) => {
            const draft = noteDrafts[a.id] ?? a.reviewNotes;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.16, delay: Math.min(index * 0.02, 0.2) }}
                className={`rounded-lg border p-4 bg-white ${
                  a.severity === 'Critical' && a.status !== 'Resolved'
                    ? 'border-[#F5C2C2]'
                    : 'border-[#E4E1D8]'
                }`}
              >
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <AlertTriangle
                        className={`h-4 w-4 ${
                          a.severity === 'Critical'
                            ? 'text-[#B91C1C]'
                            : a.severity === 'Warning'
                            ? 'text-[#B45309]'
                            : 'text-[#5C6660]'
                        }`}
                      />
                      <span className="font-display text-sm font-bold text-[#1F2421]">
                        {a.title}
                      </span>
                      <StatusBadge
                        tone={
                          a.severity === 'Critical'
                            ? 'danger'
                            : a.severity === 'Warning'
                            ? 'warning'
                            : 'neutral'
                        }
                      >
                        {a.severity}
                      </StatusBadge>
                      <StatusBadge tone={a.status === 'Resolved' ? 'success' : 'neutral'}>
                        {a.status}
                      </StatusBadge>
                    </div>
                    <p className="text-xs text-[#3F4742]">{a.explanation}</p>
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#7A827E] tabular-nums">
                      <span>{a.category}</span>
                      <span>·</span>
                      <span>{formatDateTime(a.timestamp)}</span>
                      {a.cowId && (
                        <>
                          <span>·</span>
                          <button
                            onClick={() => {
                              setSelectedCowId(a.cowId!);
                              setActivePage('cows');
                            }}
                            className="font-semibold text-[#2D6A4F] hover:underline"
                          >
                            View Cow {a.cowId}
                          </button>
                        </>
                      )}
                      {a.deviceId && (
                        <>
                          <span>·</span>
                          <span>Device {a.deviceId}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5 shrink-0">
                    {a.status === 'Unread' && (
                      <button
                        onClick={() => updateAlertStatus(a.id, 'Read', draft)}
                        className="inline-flex items-center gap-1 rounded border border-[#E4E1D8] px-2.5 py-1.5 text-xs font-medium hover:bg-[#FAF8F4] whitespace-nowrap"
                      >
                        <Eye className="h-3.5 w-3.5" /> Mark Read
                      </button>
                    )}
                    {a.status !== 'Reviewed' && a.status !== 'Resolved' && (
                      <button
                        onClick={() => updateAlertStatus(a.id, 'Reviewed', draft)}
                        className="rounded border border-[#E4E1D8] px-2.5 py-1.5 text-xs font-medium hover:bg-[#FAF8F4] whitespace-nowrap"
                      >
                        Mark Reviewed
                      </button>
                    )}
                    {a.status !== 'Resolved' && (
                      <button
                        onClick={() => updateAlertStatus(a.id, 'Resolved', draft)}
                        className="inline-flex items-center gap-1 rounded bg-[#1B4332] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2D6A4F] whitespace-nowrap"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" /> Resolve
                      </button>
                    )}
                  </div>
                </div>

                {/* Review Notes */}
                <div className="mt-3 flex flex-col sm:flex-row gap-2 pt-3 border-t border-[#F0EDE5]">
                  <input
                    type="text"
                    value={draft}
                    onChange={(e) => setNoteDrafts((p) => ({ ...p, [a.id]: e.target.value }))}
                    placeholder="Add review notes or corrective actions taken..."
                    className="flex-1 rounded border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs"
                  />
                  <button
                    onClick={() => updateAlertStatus(a.id, a.status, draft)}
                    className="rounded border border-[#E4E1D8] bg-white px-3 py-1.5 text-xs font-medium text-[#3F4742] hover:bg-[#FAF8F4] whitespace-nowrap"
                  >
                    Save Notes
                  </button>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};
