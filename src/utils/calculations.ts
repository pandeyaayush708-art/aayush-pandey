import {
  ActivityReading,
  Cow,
  EnvironmentReading,
  FarmAlert,
  FarmSettings,
  HardwareState,
  MilkBaselineComparison,
  MilkRecord,
  MilkSafetyEvent,
  TreatmentRecord,
  WaterReading,
} from '../types/dairy';

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function getTodayISO(): string {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export function getDaysAgoISO(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const offset = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - offset).toISOString().slice(0, 10);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Not available';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Invalid time';
  return d.toLocaleString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatShortDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function formatTemp(tempC: number, unit: 'C' | 'F'): string {
  if (unit === 'F') {
    return `${round2((tempC * 9) / 5 + 32)} °F`;
  }
  return `${round2(tempC)} °C`;
}

export function calculateAgeYears(dob: string): number {
  const birth = new Date(dob);
  if (isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}

export function computeWithdrawalEndISO(
  startDate: string,
  startTime: string,
  durationValue: number | null,
  durationUnit: 'hours' | 'days'
): string | null {
  if (!startDate || !startTime || durationValue === null || durationValue <= 0) {
    return null;
  }
  const start = new Date(`${startDate}T${startTime}:00`);
  if (isNaN(start.getTime())) return null;
  const ms =
    durationUnit === 'days'
      ? durationValue * 24 * 60 * 60 * 1000
      : durationValue * 60 * 60 * 1000;
  return new Date(start.getTime() + ms).toISOString();
}

export function isTreatmentComplete(t: {
  cowId: string;
  treatmentName: string;
  medicineName: string;
  startDate: string;
  startTime: string;
  veterinarianName: string;
  vetVerified: boolean;
  withdrawalDurationValue: number | null;
}): boolean {
  return Boolean(
    t.cowId.trim() &&
      t.treatmentName.trim() &&
      t.medicineName.trim() &&
      t.startDate.trim() &&
      t.startTime.trim() &&
      t.veterinarianName.trim() &&
      t.vetVerified &&
      t.withdrawalDurationValue !== null &&
      t.withdrawalDurationValue > 0
  );
}

export function isWithdrawalActive(t: TreatmentRecord, now = new Date()): boolean {
  if (!t.expectedWithdrawalEndISO) return false;
  const start = new Date(`${t.startDate}T${t.startTime}:00`);
  const end = new Date(t.expectedWithdrawalEndISO);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return false;
  return now >= start && now < end;
}

export function isUpcomingWithdrawalCompletion(t: TreatmentRecord, now = new Date()): boolean {
  if (!isWithdrawalActive(t, now) || !t.expectedWithdrawalEndISO) return false;
  const end = new Date(t.expectedWithdrawalEndISO);
  const diffHours = (end.getTime() - now.getTime()) / (1000 * 60 * 60);
  return diffHours > 0 && diffHours <= 24;
}

export function getCowMilkStats(cowId: string, milkRecords: MilkRecord[]) {
  const records = milkRecords
    .filter((r) => r.cowId === cowId)
    .sort((a, b) => b.date.localeCompare(a.date));
  const totalAll = records.reduce((s, r) => s + r.totalLitres, 0);
  const avgAll = records.length ? round2(totalAll / records.length) : 0;

  const d7 = getDaysAgoISO(6);
  const d30 = getDaysAgoISO(29);
  const r7 = records.filter((r) => r.date >= d7);
  const r30 = records.filter((r) => r.date >= d30);

  return {
    records,
    count: records.length,
    totalAll: round2(totalAll),
    avgAll,
    avg7Day: r7.length ? round2(r7.reduce((s, r) => s + r.totalLitres, 0) / r7.length) : 0,
    avg30Day: r30.length ? round2(r30.reduce((s, r) => s + r.totalLitres, 0) / r30.length) : 0,
    latest: records[0] || null,
  };
}

export function evaluateCowMilkBaseline(
  cowId: string,
  milkRecords: MilkRecord[],
  thresholdPercent: number
): MilkBaselineComparison | null {
  const records = milkRecords
    .filter((r) => r.cowId === cowId)
    .sort((a, b) => b.date.localeCompare(a.date));

  if (records.length < 3) return null;

  const latest = records[0];
  const prior = records.slice(1, 8);
  const prevAvg = round2(prior.reduce((s, r) => s + r.totalLitres, 0) / prior.length);
  if (prevAvg <= 0) return null;

  const diff = round2(latest.totalLitres - prevAvg);
  const pct = round2((diff / prevAvg) * 100);
  const isUnusual = Math.abs(pct) >= thresholdPercent;

  return {
    cowId,
    latestDate: latest.date,
    currentLitres: latest.totalLitres,
    previousAverage: prevAvg,
    differenceLitres: diff,
    percentDifference: pct,
    isUnusual,
    direction: !isUnusual ? 'normal' : diff < 0 ? 'decrease' : 'increase',
  };
}

export function evaluateCowActivityBaseline(
  cowId: string,
  activityReadings: ActivityReading[],
  thresholdPercent: number
) {
  const readings = activityReadings
    .filter((a) => a.cowId === cowId)
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp));

  if (readings.length < 3) return null;
  const latest = readings[0];
  const prior = readings.slice(1, 8);
  const baseline = round2(prior.reduce((s, r) => s + r.activityIndex, 0) / prior.length);
  if (baseline <= 0) return null;

  const diff = round2(latest.activityIndex - baseline);
  const pct = round2((diff / baseline) * 100);
  const isUnusual = Math.abs(pct) >= thresholdPercent;

  return {
    cowId,
    latest,
    baseline,
    difference: diff,
    percentDifference: pct,
    isUnusual,
  };
}

export function runMilkSafetyCheck(params: {
  cowIdOrRfid: string;
  cows: Cow[];
  treatments: TreatmentRecord[];
  hardwareState: HardwareState;
  checkedBy: 'RFID Simulation' | 'Manual Check' | 'RFID Hardware';
}): MilkSafetyEvent {
  const { cowIdOrRfid, cows, treatments, hardwareState, checkedBy } = params;
  const now = new Date();
  const nowISO = now.toISOString();
  const query = cowIdOrRfid.trim().toUpperCase();

  // Fail-safe 1: Hardware availability in Live Hardware Mode
  if (
    hardwareState.mode === 'Live Hardware Mode' &&
    hardwareState.connectionStatus !== 'Connected'
  ) {
    return {
      id: `MSE-${Date.now()}`,
      timestamp: nowISO,
      cowId: null,
      rfidTag: cowIdOrRfid,
      status: 'Hardware unavailable',
      route: 'Hold / Manual Verification',
      reason: `Live Hardware Mode active, but Arduino controller is ${hardwareState.connectionStatus}. Fail-safe prevents automatic main collection.`,
      hardwareMode: hardwareState.mode,
      checkedBy,
    };
  }

  // Fail-safe 2: System clock / time validity sanity check
  if (now.getFullYear() < 2024 || isNaN(now.getTime())) {
    return {
      id: `MSE-${Date.now()}`,
      timestamp: nowISO,
      cowId: null,
      rfidTag: cowIdOrRfid,
      status: 'Time verification required',
      route: 'Hold / Manual Verification',
      reason: 'System date/time appears invalid. Withdrawal calculation cannot be verified without a valid clock.',
      hardwareMode: hardwareState.mode,
      checkedBy,
    };
  }

  // Fail-safe 3: Identify cow by ID or RFID tag
  const cow = cows.find(
    (c) =>
      c.status !== 'Archived' &&
      (c.id.toUpperCase() === query || c.rfidTag.toUpperCase() === query)
  );

  if (!cow) {
    return {
      id: `MSE-${Date.now()}`,
      timestamp: nowISO,
      cowId: null,
      rfidTag: cowIdOrRfid,
      status: 'Unknown cow',
      route: 'Separate Diversion Route',
      reason: `Identifier "${cowIdOrRfid}" does not match any active registered cow or RFID tag. Fail-safe directs to separate collection route.`,
      hardwareMode: hardwareState.mode,
      checkedBy,
    };
  }

  const cowTreatments = treatments.filter((t) => t.cowId === cow.id);

  // Fail-safe 4: Check for invalid timestamps in treatments
  const invalidTime = cowTreatments.some((t) => {
    const s = new Date(`${t.startDate}T${t.startTime}:00`);
    return isNaN(s.getTime()) || s.getTime() - now.getTime() > 3600 * 1000;
  });

  if (invalidTime) {
    return {
      id: `MSE-${Date.now()}`,
      timestamp: nowISO,
      cowId: cow.id,
      rfidTag: cow.rfidTag,
      status: 'Time verification required',
      route: 'Hold / Manual Verification',
      reason: `Cow ${cow.id} has treatment records with invalid or future start times requiring verification.`,
      hardwareMode: hardwareState.mode,
      checkedBy,
    };
  }

  // Fail-safe 5: Incomplete treatment records
  const incomplete = cowTreatments.find((t) => !t.isComplete);
  if (incomplete) {
    return {
      id: `MSE-${Date.now()}`,
      timestamp: nowISO,
      cowId: cow.id,
      rfidTag: cow.rfidTag,
      status: 'Missing treatment information',
      route: 'Separate Diversion Route',
      reason: `Treatment "${incomplete.treatmentName || 'Untitled'}" is incomplete (missing vet verification or withdrawal duration). Fail-safe diverts milk.`,
      hardwareMode: hardwareState.mode,
      checkedBy,
    };
  }

  // Fail-safe 6: Active withdrawal check
  const activeWithdrawal = cowTreatments.find((t) => isWithdrawalActive(t, now));
  if (activeWithdrawal) {
    return {
      id: `MSE-${Date.now()}`,
      timestamp: nowISO,
      cowId: cow.id,
      rfidTag: cow.rfidTag,
      status: 'Withdrawal active',
      route: 'Separate Diversion Route',
      reason: `Active milk withdrawal for ${activeWithdrawal.medicineName} until ${formatDateTime(
        activeWithdrawal.expectedWithdrawalEndISO
      )}. Diverted to separate collection route.`,
      hardwareMode: hardwareState.mode,
      checkedBy,
    };
  }

  // Fail-safe 7: Health observation hold
  if (cow.status === 'Under Observation' || cow.requiresHealthInspection) {
    return {
      id: `MSE-${Date.now()}`,
      timestamp: nowISO,
      cowId: cow.id,
      rfidTag: cow.rfidTag,
      status: 'Manual review required',
      route: 'Hold / Manual Verification',
      reason: `Cow ${cow.id} (${cow.name}) is flagged for health inspection/observation. Manual review required before main collection.`,
      hardwareMode: hardwareState.mode,
      checkedBy,
    };
  }

  return {
    id: `MSE-${Date.now()}`,
    timestamp: nowISO,
    cowId: cow.id,
    rfidTag: cow.rfidTag,
    status: 'Approved by record checks',
    route: 'Main Collection Route',
    reason: `No active withdrawal or incomplete treatment records for ${cow.id} (${cow.name}). Record check passed (routine milk quality checks still required).`,
    hardwareMode: hardwareState.mode,
    checkedBy,
  };
}

export function exportToCSV(filename: string, headers: string[], rows: (string | number)[][]) {
  const escape = (val: string | number) => {
    const s = String(val ?? '');
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const csv = [headers.map(escape).join(','), ...rows.map((r) => r.map(escape).join(','))].join(
    '\n'
  );
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function checkEnvironmentThresholds(
  reading: EnvironmentReading,
  settings: FarmSettings
): Omit<FarmAlert, 'id' | 'status' | 'reviewNotes'>[] {
  const alerts: Omit<FarmAlert, 'id' | 'status' | 'reviewNotes'>[] = [];
  if (reading.temperatureC >= settings.highTemperatureThresholdC) {
    alerts.push({
      title: 'High Barn Temperature Detected',
      category: 'High Temperature',
      deviceId: 'DHT11-BARN-01',
      timestamp: reading.timestamp,
      severity: reading.temperatureC >= settings.highTemperatureThresholdC + 4 ? 'Critical' : 'Warning',
      explanation: `Temperature reached ${reading.temperatureC}°C (threshold: ${settings.highTemperatureThresholdC}°C) via ${reading.source}. Check ventilation and drinking water availability.`,
      dedupeKey: `env-temp-${reading.timestamp.slice(0, 13)}`,
    });
  }
  if (reading.humidityPercent >= settings.highHumidityThresholdPercent) {
    alerts.push({
      title: 'High Barn Humidity Detected',
      category: 'High Humidity',
      deviceId: 'DHT11-BARN-01',
      timestamp: reading.timestamp,
      severity: 'Warning',
      explanation: `Humidity reached ${reading.humidityPercent}% (threshold: ${settings.highHumidityThresholdPercent}%) via ${reading.source}.`,
      dedupeKey: `env-hum-${reading.timestamp.slice(0, 13)}`,
    });
  }
  return alerts;
}

export function checkWaterThresholds(
  reading: WaterReading,
  settings: FarmSettings
): Omit<FarmAlert, 'id' | 'status' | 'reviewNotes'>[] {
  if (reading.waterPercent <= settings.lowWaterThresholdPercent) {
    return [
      {
        title: 'Low Water Tank Level',
        category: 'Low Water',
        deviceId: 'US-TANK-01',
        timestamp: reading.timestamp,
        severity: reading.waterPercent <= 15 ? 'Critical' : 'Warning',
        explanation: `Water tank at ${reading.waterPercent}% (${reading.estimatedLitres} L), below threshold of ${settings.lowWaterThresholdPercent}% (${reading.source}).`,
        dedupeKey: `water-low-${reading.timestamp.slice(0, 13)}`,
      },
    ];
  }
  return [];
}
