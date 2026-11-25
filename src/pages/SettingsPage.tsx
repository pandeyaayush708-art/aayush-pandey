import React, { useState } from 'react';
import { Download, RotateCcw, Trash2, Upload } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { validateImportedDatabase } from '../services/storageService';
import { FarmSettings, HardwareMode } from '../types/dairy';
import { getTodayISO } from '../utils/calculations';
import { ConfirmDialog } from '../components/ui/MotionPrimitives';

export const SettingsPage: React.FC = () => {
  const {
    db,
    updateSettings,
    setHardwareMode,
    resetDemoData,
    importDatabase,
    clearAllData,
    pushToast,
  } = useFarm();

  const [form, setForm] = useState<FarmSettings>({ ...db.settings });
  const [confirmReset, setConfirmReset] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateSettings(form);
  };

  const handleExportJSON = () => {
    const blob = new Blob([JSON.stringify(db, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dairymitra-backup-${getTodayISO()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast('Exported full farm backup JSON.', 'success');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = validateImportedDatabase(String(reader.result));
        importDatabase(parsed);
        setForm({ ...parsed.settings });
      } catch (err) {
        pushToast(err instanceof Error ? err.message : 'Invalid JSON backup.', 'error');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Storage Honesty Banner */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white px-4 py-3 text-xs text-[#5C6660]">
        <strong className="text-[#1F2421]">Local Persistence Disclosure:</strong> All farm records, settings, and telemetry logs are persisted locally in this browser&apos;s storage (`localStorage`). Cloud synchronization, multi-device sync, and user authentication are not claimed or enabled in this standalone build; use Export/Import JSON below to back up or transfer records.
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Farm Details */}
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <h2 className="font-display text-base font-bold text-[#1F2421]">
            Farm Profile & Units
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Farm Name</label>
              <input
                type="text"
                value={form.farmName}
                onChange={(e) => setForm((p) => ({ ...p, farmName: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Farm Manager / Owner
              </label>
              <input
                type="text"
                value={form.ownerName}
                onChange={(e) => setForm((p) => ({ ...p, ownerName: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">Location</label>
              <input
                type="text"
                value={form.location}
                onChange={(e) => setForm((p) => ({ ...p, location: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Temperature Unit
              </label>
              <select
                value={form.temperatureUnit}
                onChange={(e) =>
                  setForm((p) => ({ ...p, temperatureUnit: e.target.value as 'C' | 'F' }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              >
                <option value="C">Celsius (°C)</option>
                <option value="F">Fahrenheit (°F)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Water Tank Capacity (Litres)
              </label>
              <input
                type="number"
                min={100}
                value={form.tankCapacityLitres}
                onChange={(e) =>
                  setForm((p) => ({ ...p, tankCapacityLitres: Number(e.target.value) || 1000 }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Water Tank Height (cm)
              </label>
              <input
                type="number"
                min={30}
                value={form.tankHeightCm}
                onChange={(e) =>
                  setForm((p) => ({ ...p, tankHeightCm: Number(e.target.value) || 100 }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Alert Thresholds */}
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <h2 className="font-display text-base font-bold text-[#1F2421]">
            Alert & Automation Thresholds
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Milk Yield Deviation (%)
              </label>
              <input
                type="number"
                min={5}
                max={80}
                value={form.milkChangeThresholdPercent}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    milkChangeThresholdPercent: Number(e.target.value) || 25,
                  }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Activity Deviation (%)
              </label>
              <input
                type="number"
                min={5}
                max={80}
                value={form.activityChangeThresholdPercent}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    activityChangeThresholdPercent: Number(e.target.value) || 30,
                  }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                High Temperature (°C)
              </label>
              <input
                type="number"
                step="0.5"
                value={form.highTemperatureThresholdC}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    highTemperatureThresholdC: Number(e.target.value) || 33,
                  }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                High Humidity (%)
              </label>
              <input
                type="number"
                value={form.highHumidityThresholdPercent}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    highHumidityThresholdPercent: Number(e.target.value) || 80,
                  }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Low Water Warning (%)
              </label>
              <input
                type="number"
                value={form.lowWaterThresholdPercent}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    lowWaterThresholdPercent: Number(e.target.value) || 25,
                  }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Stale Telemetry Timeout (s)
              </label>
              <input
                type="number"
                min={10}
                value={form.staleDataTimeoutSeconds}
                onChange={(e) =>
                  setForm((p) => ({
                    ...p,
                    staleDataTimeoutSeconds: Number(e.target.value) || 45,
                  }))
                }
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
        </div>

        {/* Hardware & Bridge Configuration */}
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
          <h2 className="font-display text-base font-bold text-[#1F2421]">
            Hardware & Connection Settings
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Operating Mode
              </label>
              <select
                value={db.hardwareState.mode}
                onChange={(e) => setHardwareMode(e.target.value as HardwareMode)}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm"
              >
                <option value="Demo Mode">Demo Mode</option>
                <option value="Manual Test Mode">Manual Test Mode</option>
                <option value="Live Hardware Mode">Live Hardware Mode</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Local Serial-Bridge Endpoint
              </label>
              <input
                type="text"
                value={form.bridgeUrl}
                onChange={(e) => setForm((p) => ({ ...p, bridgeUrl: e.target.value }))}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="space-y-2 text-xs text-[#3F4742]">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.fanHardwareConfigured}
                onChange={(e) =>
                  setForm((p) => ({ ...p, fanHardwareConfigured: e.target.checked }))
                }
              />
              Ventilation fan relay, driver & external power supply physically installed
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.pumpFlowSensorInstalled}
                onChange={(e) =>
                  setForm((p) => ({ ...p, pumpFlowSensorInstalled: e.target.checked }))
                }
              />
              Pump flow / physical verification sensor installed
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.physicalIndicatorsEnabled}
                onChange={(e) =>
                  setForm((p) => ({ ...p, physicalIndicatorsEnabled: e.target.checked }))
                }
              />
              Physical LCD / LED / Buzzer Arduino firmware active
            </label>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              className="rounded-md bg-[#1B4332] px-5 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
            >
              Save All Settings
            </button>
          </div>
        </div>
      </form>

      {/* Data Backup, Restore & Reset */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-4">
        <h2 className="font-display text-base font-bold text-[#1F2421]">
          Data Backup & Demo Dataset Controls
        </h2>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleExportJSON}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#E4E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#1F2421] hover:bg-[#FAF8F4] whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" /> Export JSON Backup
          </button>

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border border-[#E4E1D8] bg-white px-4 py-2 text-xs font-semibold text-[#1F2421] hover:bg-[#FAF8F4] whitespace-nowrap">
            <Upload className="h-3.5 w-3.5" /> Import JSON Backup
            <input type="file" accept=".json" onChange={handleImportJSON} className="hidden" />
          </label>

          <button
            onClick={() => setConfirmReset(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#F3D9A4] bg-[#FEF6E7] px-4 py-2 text-xs font-semibold text-[#92400E] hover:bg-[#FDEBC8] whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset Demo Data
          </button>

          <button
            onClick={() => setConfirmClear(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-[#F5C2C2] bg-[#FDECEC] px-4 py-2 text-xs font-semibold text-[#991B1B] hover:bg-[#FAD6D6] whitespace-nowrap"
          >
            <Trash2 className="h-3.5 w-3.5" /> Clear All Farm Records
          </button>
        </div>
      </div>

      <ConfirmDialog
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        onConfirm={() => {
          resetDemoData();
        }}
        title="Restore Original Demo Dataset?"
        message="This will overwrite your current local records with the fresh 10-cow DairyMitra AI 2.0 demo dataset."
        confirmLabel="Restore Demo Data"
      />

      <ConfirmDialog
        open={confirmClear}
        onClose={() => setConfirmClear(false)}
        onConfirm={clearAllData}
        title="Clear All Farm Records?"
        message="This permanently removes all cows, milk entries, health observations, treatments, and alerts from local browser storage."
        confirmLabel="Clear Everything"
        danger
      />
    </div>
  );
};
