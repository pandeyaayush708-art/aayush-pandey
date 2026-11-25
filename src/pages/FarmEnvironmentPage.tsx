import React, { useState } from 'react';
import { Fan, Thermometer, Droplets } from 'lucide-react';
import { useFarm } from '../context/FarmContext';
import { formatDateTime, formatTemp } from '../utils/calculations';
import { EmptyState, StatusBadge } from '../components/ui/MotionPrimitives';
import { TrendAreaChart } from '../components/ui/Charts';

export const FarmEnvironmentPage: React.FC = () => {
  const { db, recordEnvironmentReading, updateSettings, toggleFan, pushToast } = useFarm();

  const latest = db.environmentReadings[db.environmentReadings.length - 1];
  const [manualTemp, setManualTemp] = useState('31.5');
  const [manualHum, setManualHum] = useState('72');
  const [tempThresh, setTempThresh] = useState(String(db.settings.highTemperatureThresholdC));
  const [humThresh, setHumThresh] = useState(String(db.settings.highHumidityThresholdPercent));

  const isHighTemp = latest ? latest.temperatureC >= db.settings.highTemperatureThresholdC : false;
  const isHighHum = latest ? latest.humidityPercent >= db.settings.highHumidityThresholdPercent : false;

  const handleManualInject = (e: React.FormEvent) => {
    e.preventDefault();
    const t = parseFloat(manualTemp);
    const h = parseFloat(manualHum);
    if (isNaN(t) || isNaN(h) || h < 0 || h > 100) {
      pushToast('Enter valid temperature and humidity (0–100%).', 'error');
      return;
    }
    recordEnvironmentReading(
      t,
      h,
      db.hardwareState.mode === 'Live Hardware Mode' ? 'Manual Test' : 'Manual Test'
    );
  };

  const handleSaveThresholds = (e: React.FormEvent) => {
    e.preventDefault();
    const tt = parseFloat(tempThresh);
    const hh = parseFloat(humThresh);
    if (isNaN(tt) || isNaN(hh)) {
      pushToast('Enter valid threshold numbers.', 'error');
      return;
    }
    updateSettings({
      ...db.settings,
      highTemperatureThresholdC: tt,
      highHumidityThresholdPercent: hh,
    });
  };

  const tempChartData = db.environmentReadings.slice(-16).map((r) => ({
    label: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: r.temperatureC,
  }));

  const humChartData = db.environmentReadings.slice(-16).map((r) => ({
    label: new Date(r.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: r.humidityPercent,
  }));

  return (
    <div className="space-y-6">
      {/* Live DHT11 Metrics & Source Labelling */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C6660]">Barn Temperature (DHT11)</span>
            <Thermometer className="h-4 w-4 text-[#2D6A4F]" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-[#1F2421] tabular-nums">
            {latest ? formatTemp(latest.temperatureC, db.settings.temperatureUnit) : '—'}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <StatusBadge tone={isHighTemp ? 'danger' : 'success'}>
              {isHighTemp ? 'High Temperature Warning' : 'Within Threshold'}
            </StatusBadge>
            <span className="text-[11px] text-[#7A827E]">{latest?.source || 'No Data'}</span>
          </div>
        </div>

        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C6660]">Relative Humidity (DHT11)</span>
            <Droplets className="h-4 w-4 text-[#2D6A4F]" />
          </div>
          <p className="mt-2 font-display text-3xl font-bold text-[#1F2421] tabular-nums">
            {latest ? `${latest.humidityPercent}%` : '—'}
          </p>
          <div className="mt-2 flex items-center justify-between">
            <StatusBadge tone={isHighHum ? 'warning' : 'success'}>
              {isHighHum ? 'High Humidity Warning' : 'Nominal Range'}
            </StatusBadge>
            <span className="text-[11px] text-[#7A827E] tabular-nums">
              {latest ? formatDateTime(latest.timestamp) : 'No timestamp'}
            </span>
          </div>
        </div>

        {/* Future Ventilation Fan Automation */}
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-[#5C6660]">Ventilation Fan Relay</span>
            <Fan className="h-4 w-4 text-[#5C6660]" />
          </div>
          {!db.settings.fanHardwareConfigured ? (
            <div className="mt-2 space-y-2">
              <StatusBadge tone="neutral">Fan Relay Not Configured</StatusBadge>
              <p className="text-[11px] text-[#5C6660]">
                Fan controls stay disabled until a suitable relay, driver, and power supply are configured in Settings.
              </p>
            </div>
          ) : (
            <div className="mt-2 space-y-2.5">
              <div className="flex items-center justify-between">
                <StatusBadge tone={db.hardwareState.fanEnabled ? 'success' : 'neutral'}>
                  Fan {db.hardwareState.fanEnabled ? 'ON' : 'OFF'} ({db.hardwareState.fanMode})
                </StatusBadge>
                <div className="flex gap-1.5">
                  <button
                    onClick={() => toggleFan(true, 'MANUAL')}
                    className="rounded bg-[#1B4332] px-2.5 py-1 text-xs font-semibold text-white"
                  >
                    ON
                  </button>
                  <button
                    onClick={() => toggleFan(false, 'MANUAL')}
                    className="rounded border border-[#E4E1D8] px-2.5 py-1 text-xs font-semibold"
                  >
                    OFF
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
          <h2 className="font-display text-sm font-bold text-[#1F2421] mb-1">
            Temperature History (°C)
          </h2>
          <p className="text-xs text-[#7A827E] mb-3">
            Alert threshold: {db.settings.highTemperatureThresholdC}°C
          </p>
          <TrendAreaChart data={tempChartData} unit="°C" height={190} strokeColor="#B45309" fillColor="#B45309" />
        </div>
        <div className="rounded-lg border border-[#E4E1D8] bg-white p-5">
          <h2 className="font-display text-sm font-bold text-[#1F2421] mb-1">
            Humidity History (% RH)
          </h2>
          <p className="text-xs text-[#7A827E] mb-3">
            Alert threshold: {db.settings.highHumidityThresholdPercent}%
          </p>
          <TrendAreaChart data={humChartData} unit="%" height={190} />
        </div>
      </div>

      {/* Threshold Settings & Manual Test Input */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <form
          onSubmit={handleSaveThresholds}
          className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-3"
        >
          <h3 className="font-display text-sm font-bold text-[#1F2421]">
            Environment Warning Thresholds
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                High Temperature (°C)
              </label>
              <input
                type="number"
                step="0.5"
                value={tempThresh}
                onChange={(e) => setTempThresh(e.target.value)}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                High Humidity (%)
              </label>
              <input
                type="number"
                step="1"
                value={humThresh}
                onChange={(e) => setHumThresh(e.target.value)}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md bg-[#1B4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2D6A4F]"
          >
            Update Thresholds
          </button>
        </form>

        <form
          onSubmit={handleManualInject}
          className="rounded-lg border border-[#E4E1D8] bg-white p-5 space-y-3"
        >
          <h3 className="font-display text-sm font-bold text-[#1F2421]">
            Manual Test Reading (Labelled as Manual Test)
          </h3>
          <p className="text-xs text-[#5C6660]">
            Test high-temperature or humidity alerts without physical DHT11 hardware connected.
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Test Temp (°C)
              </label>
              <input
                type="number"
                step="0.1"
                value={manualTemp}
                onChange={(e) => setManualTemp(e.target.value)}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#3F4742] mb-1">
                Test Humidity (%)
              </label>
              <input
                type="number"
                step="1"
                value={manualHum}
                onChange={(e) => setManualHum(e.target.value)}
                className="w-full rounded-md border border-[#E4E1D8] bg-[#FAF8F4] px-3 py-2 text-sm tabular-nums"
              />
            </div>
          </div>
          <button
            type="submit"
            className="rounded-md border border-[#2D6A4F] px-4 py-2 text-xs font-semibold text-[#1B4332] hover:bg-[#EBF5EE]"
          >
            Log Manual Test Reading
          </button>
        </form>
      </div>

      {/* Readings Table */}
      <div className="rounded-lg border border-[#E4E1D8] bg-white">
        <div className="border-b border-[#E4E1D8] px-5 py-3">
          <h3 className="font-display text-sm font-bold text-[#1F2421]">Recent Sensor Readings</h3>
        </div>
        {db.environmentReadings.length === 0 ? (
          <div className="p-6">
            <EmptyState
              title="No environment readings yet"
              description="Connect DHT11 hardware or inject a manual test reading."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-[#E4E1D8] bg-[#FAF8F4] text-[#5C6660]">
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4 text-right">Temperature</th>
                  <th className="py-2.5 px-4 text-right">Humidity</th>
                  <th className="py-2.5 px-4">Source</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F0EDE5]">
                {[...db.environmentReadings]
                  .reverse()
                  .slice(0, 12)
                  .map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 px-4 tabular-nums">{formatDateTime(r.timestamp)}</td>
                      <td className="py-2 px-4 text-right font-semibold tabular-nums">
                        {formatTemp(r.temperatureC, db.settings.temperatureUnit)}
                      </td>
                      <td className="py-2 px-4 text-right tabular-nums">{r.humidityPercent}%</td>
                      <td className="py-2 px-4 text-[#5C6660]">{r.source}</td>
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
