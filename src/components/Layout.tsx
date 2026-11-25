import React, { useState } from 'react';
import {
  Activity,
  BarChart3,
  Bell,
  ChevronLeft,
  ChevronRight,
  Cpu,
  Droplets,
  HeartPulse,
  LayoutDashboard,
  Menu,
  MessageSquare,
  Pill,
  Settings,
  ShieldCheck,
  Tag,
  Thermometer,
  Waves,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { useFarm } from '../context/FarmContext';
import { PageId } from '../types/dairy';
import { BrandLogo } from './BrandLogo';
import { StatusBadge } from './ui/MotionPrimitives';

const NAV_ITEMS: { id: PageId; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'overview', label: 'Overview Dashboard', icon: LayoutDashboard },
  { id: 'cows', label: 'Cow Management', icon: Tag },
  { id: 'milk', label: 'Milk Production', icon: Droplets },
  { id: 'health', label: 'Health Monitoring', icon: HeartPulse },
  { id: 'treatments', label: 'Treatment & Medicine', icon: Pill },
  { id: 'safety', label: 'Milk Safety System', icon: ShieldCheck },
  { id: 'environment', label: 'Farm Environment', icon: Thermometer },
  { id: 'water', label: 'Water Management', icon: Waves },
  { id: 'hardware', label: 'Hardware Control Centre', icon: Cpu },
  { id: 'assistant', label: 'AI Dairy Assistant', icon: MessageSquare },
  { id: 'alerts', label: 'Alerts Centre', icon: Bell },
  { id: 'reports', label: 'Reports & Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { db, activePage, setActivePage } = useFarm();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const unreadAlerts = db.alerts.filter((a) => a.status === 'Unread').length;
  const activeNav = NAV_ITEMS.find((n) => n.id === activePage);

  const hwBadgeTone =
    db.hardwareState.mode === 'Live Hardware Mode'
      ? db.hardwareState.connectionStatus === 'Connected'
        ? 'success'
        : db.hardwareState.connectionStatus === 'Stale Data'
        ? 'warning'
        : 'danger'
      : 'neutral';

  const SidebarContent = (isMobile: boolean) => (
    <div className="flex h-full flex-col bg-white border-r border-[#E4E1D8]">
      <div className="flex h-16 items-center justify-between border-b border-[#E4E1D8] px-4">
        <BrandLogo collapsed={!isMobile && collapsed} />
        {isMobile ? (
          <button
            onClick={() => setMobileOpen(false)}
            className="rounded-md p-2 text-[#5C6660] hover:bg-[#F3F0E8]"
            aria-label="Close navigation menu"
          >
            <X className="h-5 w-5" />
          </button>
        ) : (
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="rounded-md p-1.5 text-[#5C6660] hover:bg-[#F3F0E8]"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-2.5 py-3 space-y-0.5" aria-label="Primary">
        {NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = activePage === item.id;
          return (
            <button
              key={item.id}
              onClick={() => {
                setActivePage(item.id);
                if (isMobile) setMobileOpen(false);
              }}
              className={`group flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-[13.5px] font-medium transition-colors ${
                active
                  ? 'bg-[#1B4332] text-[#FAF8F4]'
                  : 'text-[#3F4742] hover:bg-[#F3F0E8] hover:text-[#1F2421]'
              }`}
              title={!isMobile && collapsed ? item.label : undefined}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  active ? 'text-[#B7C99C]' : 'text-[#5C6660] group-hover:text-[#1B4332]'
                }`}
              />
              {(isMobile || !collapsed) && (
                <span className="flex-1 truncate whitespace-nowrap">{item.label}</span>
              )}
              {(isMobile || !collapsed) && item.id === 'alerts' && unreadAlerts > 0 && (
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums ${
                    active ? 'bg-[#B7C99C] text-[#1B4332]' : 'bg-[#B91C1C] text-white'
                  }`}
                >
                  {unreadAlerts}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {(isMobile || !collapsed) && (
        <div className="border-t border-[#E4E1D8] p-3 text-xs">
          <div className="rounded-md bg-[#FAF8F4] border border-[#E4E1D8] p-2.5">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-[#1F2421]">Hardware Link</span>
              <Activity className="h-3.5 w-3.5 text-[#2D6A4F]" />
            </div>
            <p className="mt-1 text-[11px] text-[#5C6660]">{db.hardwareState.mode}</p>
            <div className="mt-1.5">
              <StatusBadge
                tone={hwBadgeTone}
                liveTelemetry={
                  db.hardwareState.mode === 'Live Hardware Mode' &&
                  db.hardwareState.connectionStatus === 'Connected'
                }
              >
                {db.hardwareState.mode === 'Live Hardware Mode'
                  ? db.hardwareState.connectionStatus
                  : 'Arduino Disconnected'}
              </StatusBadge>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen flex bg-[#FAF8F4]">
      {/* Desktop Collapsible Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 72 : 256 }}
        transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        className="hidden lg:block shrink-0 sticky top-0 h-screen z-30"
      >
        {SidebarContent(false)}
      </motion.aside>

      {/* Mobile Drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <div className="fixed inset-0 z-50 lg:hidden flex">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 bg-[#1F2421]/40"
            />
            <motion.div
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 w-64 h-full"
            >
              {SidebarContent(true)}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-20 flex h-14 sm:h-16 items-center justify-between gap-4 border-b border-[#E4E1D8] bg-white/95 backdrop-blur px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-md p-2 text-[#3F4742] hover:bg-[#F3F0E8] lg:hidden shrink-0"
              aria-label="Open navigation"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0 flex items-center gap-2 text-sm">
              <span className="hidden md:inline text-[#7A827E] truncate max-w-[200px]">
                {db.settings.farmName}
              </span>
              <span className="hidden md:inline text-[#D5D0C3]" aria-hidden="true">
                /
              </span>
              <h1 className="font-display text-base sm:text-lg font-bold text-[#1F2421] truncate">
                {activeNav?.label}
              </h1>
              {db.isDemoData && (
                <span className="hidden xl:inline text-xs font-medium text-[#5C6660] whitespace-nowrap">
                  · Demo dataset
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              onClick={() => setActivePage('hardware')}
              className="hidden sm:inline-flex items-center gap-2 rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-1.5 text-xs font-medium text-[#3F4742] hover:border-[#2D6A4F] whitespace-nowrap shrink-0"
            >
              <span>{db.hardwareState.mode}</span>
              <span className="text-[#D5D0C3]" aria-hidden="true">
                ·
              </span>
              <span className="font-semibold text-[#1F2421]">
                {db.hardwareState.mode === 'Live Hardware Mode'
                  ? db.hardwareState.connectionStatus
                  : 'Offline'}
              </span>
            </button>
            <button
              onClick={() => setActivePage('alerts')}
              className="relative rounded-md border border-[#E4E1D8] bg-white px-3 py-1.5 text-xs font-medium text-[#3F4742] hover:bg-[#FAF8F4] inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
              aria-label="Open Alerts Centre"
            >
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">Alerts</span>
              {unreadAlerts > 0 && (
                <span className="rounded bg-[#B91C1C] px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums">
                  {unreadAlerts}
                </span>
              )}
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
};
