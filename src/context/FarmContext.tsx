import React, { createContext, useContext, useEffect, useState } from 'react';
import { createDemoDatabase } from '../data/demoData';
import {
  ArduinoTelemetryPayload,
  connectArduinoWebSerial,
  fetchBridgeTelemetry,
} from '../services/hardwareService';
import { loadDatabase, saveDatabase } from '../services/storageService';
import {
  ActivityReading,
  AlertStatus,
  Cow,
  EnvironmentReading,
  FarmAlert,
  FarmDatabase,
  FarmSettings,
  HardwareMode,
  HealthRecord,
  MilkRecord,
  MilkSafetyEvent,
  PageId,
  PumpMode,
  PumpState,
  TreatmentRecord,
  UnusualMilkReview,
  WaterReading,
} from '../types/dairy';
import {
  calculateAgeYears,
  checkEnvironmentThresholds,
  checkWaterThresholds,
  computeWithdrawalEndISO,
  evaluateCowActivityBaseline,
  evaluateCowMilkBaseline,
  isTreatmentComplete,
  isWithdrawalActive,
  round2,
  runMilkSafetyCheck,
} from '../utils/calculations';

export interface ToastMessage {
  id: string;
  title: string;
  type: 'success' | 'warning' | 'error' | 'info';
}

interface FarmContextValue {
  db: FarmDatabase;
  activePage: PageId;
  setActivePage: (page: PageId) => void;
  selectedCowId: string | null;
  setSelectedCowId: (cowId: string | null) => void;
  toasts: ToastMessage[];
  pushToast: (title: string, type?: ToastMessage['type']) => void;
  dismissToast: (id: string) => void;

  // Cow CRUD
  addCow: (cow: Omit<Cow, 'createdAt' | 'updatedAt' | 'ageYears'>) => void;
  updateCow: (cow: Cow) => void;
  deleteOrArchiveCow: (cowId: string, hardDelete: boolean) => void;

  // Milk CRUD & Unusual Review
  upsertMilkRecord: (
    record: Omit<MilkRecord, 'id' | 'totalLitres' | 'createdAt' | 'updatedAt'> & { id?: string }
  ) => void;
  deleteMilkRecord: (id: string) => void;
  saveUnusualMilkReview: (review: Omit<UnusualMilkReview, 'id'> & { id?: string }) => void;

  // Health & Activity
  addHealthRecord: (record: Omit<HealthRecord, 'id' | 'createdAt'>) => void;
  addActivityReading: (reading: Omit<ActivityReading, 'id'>) => void;

  // Treatments
  upsertTreatment: (
    tr: Omit<
      TreatmentRecord,
      'id' | 'expectedWithdrawalEndISO' | 'isComplete' | 'createdAt' | 'updatedAt'
    > & { id?: string }
  ) => void;
  deleteTreatment: (id: string) => void;

  // Milk Safety
  executeMilkSafetyCheck: (
    cowIdOrRfid: string,
    checkedBy: 'RFID Simulation' | 'Manual Check' | 'RFID Hardware'
  ) => MilkSafetyEvent;

  // Environment, Water & Pump
  recordEnvironmentReading: (
    tempC: number,
    hum: number,
    source: EnvironmentReading['source']
  ) => void;
  recordWaterReading: (waterPercent: number, source: WaterReading['source']) => void;
  commandPump: (state: PumpState, mode: PumpMode, reason: string) => Promise<boolean>;
  setPumpMode: (mode: PumpMode) => void;
  toggleFan: (enabled: boolean, mode?: PumpMode) => void;

  // Hardware Control
  setHardwareMode: (mode: HardwareMode) => void;
  connectSerialArduino: () => Promise<void>;
  disconnectSerialArduino: () => Promise<void>;
  pollLocalBridgeOnce: () => Promise<void>;
  updateHardwareConfig: (patch: Partial<FarmDatabase['hardwareState']>) => void;

  // Alerts
  updateAlertStatus: (id: string, status: AlertStatus, reviewNotes?: string) => void;
  createManualAlert: (alert: Omit<FarmAlert, 'id' | 'status' | 'reviewNotes'>) => void;

  // Settings & Data Management
  updateSettings: (settings: FarmSettings) => void;
  resetDemoData: () => void;
  importDatabase: (newDb: FarmDatabase) => void;
  clearAllData: () => void;
}

const FarmContext = createContext<FarmContextValue | null>(null);

export const FarmProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [db, setDb] = useState<FarmDatabase>(() => loadDatabase());
  const [activePage, setActivePage] = useState<PageId>('overview');
  const [selectedCowId, setSelectedCowId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const [serialHandle, setSerialHandle] = useState<{
    sendCommand: (c: string) => Promise<void>;
    disconnect: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    saveDatabase(db);
  }, [db]);

  const pushToast = (title: string, type: ToastMessage['type'] = 'info') => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setToasts((prev) => [...prev.slice(-3), { id, title, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4200);
  };

  const dismissToast = (id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  };

  const appendAlertIfNew = (
    alerts: FarmAlert[],
    candidate: Omit<FarmAlert, 'id' | 'status' | 'reviewNotes'>
  ): FarmAlert[] => {
    if (
      candidate.dedupeKey &&
      alerts.some((a) => a.dedupeKey === candidate.dedupeKey && a.status !== 'Resolved')
    ) {
      return alerts;
    }
    const newAlert: FarmAlert = {
      ...candidate,
      id: `ALT-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
      status: 'Unread',
      reviewNotes: '',
    };
    return [newAlert, ...alerts];
  };

  // Demo Mode gentle simulation tick (only runs when Demo Mode is active)
  useEffect(() => {
    if (db.hardwareState.mode !== 'Demo Mode') return;
    const interval = setInterval(() => {
      setDb((prev) => {
        if (prev.hardwareState.mode !== 'Demo Mode') return prev;
        const lastEnv = prev.environmentReadings[prev.environmentReadings.length - 1];
        const lastWater = prev.waterReadings[prev.waterReadings.length - 1];
        const nextTemp = round2(
          Math.max(22, Math.min(39, (lastEnv?.temperatureC ?? 28) + (Math.random() - 0.48) * 0.6))
        );
        const nextHum = round2(
          Math.max(45, Math.min(92, (lastEnv?.humidityPercent ?? 64) + (Math.random() - 0.5) * 1.4))
        );
        let nextWaterPct = lastWater?.waterPercent ?? 68;
        if (prev.hardwareState.pumpCommandedState === 'ON') {
          nextWaterPct = Math.min(100, nextWaterPct + 3);
        } else {
          nextWaterPct = Math.max(10, nextWaterPct - 1);
        }

        const nowISO = new Date().toISOString();
        const newEnv: EnvironmentReading = {
          id: `ENV-${Date.now()}`,
          timestamp: nowISO,
          temperatureC: nextTemp,
          humidityPercent: nextHum,
          source: 'Demo',
        };
        const newWater: WaterReading = {
          id: `WAT-${Date.now()}`,
          timestamp: nowISO,
          waterPercent: nextWaterPct,
          distanceCm: Math.round(((100 - nextWaterPct) / 100) * prev.settings.tankHeightCm),
          estimatedLitres: Math.round((nextWaterPct / 100) * prev.settings.tankCapacityLitres),
          source: 'Demo',
        };

        let nextAlerts = prev.alerts;
        checkEnvironmentThresholds(newEnv, prev.settings).forEach((a) => {
          nextAlerts = appendAlertIfNew(nextAlerts, a);
        });
        checkWaterThresholds(newWater, prev.settings).forEach((a) => {
          nextAlerts = appendAlertIfNew(nextAlerts, a);
        });

        let pumpCommanded = prev.hardwareState.pumpCommandedState;
        let pumpLogs = prev.pumpLogs;
        if (prev.hardwareState.pumpMode === 'AUTO') {
          if (nextWaterPct <= prev.settings.autoPumpStartBelowPercent && pumpCommanded === 'OFF') {
            pumpCommanded = 'ON';
            pumpLogs = [
              {
                id: `PUMP-${Date.now()}`,
                timestamp: nowISO,
                commandedState: 'ON' as const,
                verifiedState: prev.settings.pumpFlowSensorInstalled
                  ? ('ON' as const)
                  : ('Unverified (No Flow Sensor)' as const),
                mode: 'AUTO' as const,
                success: true,
                reason: `Auto-start triggered at ${nextWaterPct}% (threshold ${prev.settings.autoPumpStartBelowPercent}%).`,
              },
              ...pumpLogs,
            ].slice(0, 50);
          } else if (
            nextWaterPct >= prev.settings.autoPumpStopAbovePercent &&
            pumpCommanded === 'ON'
          ) {
            pumpCommanded = 'OFF';
            pumpLogs = [
              {
                id: `PUMP-${Date.now()}`,
                timestamp: nowISO,
                commandedState: 'OFF' as const,
                verifiedState: prev.settings.pumpFlowSensorInstalled
                  ? ('OFF' as const)
                  : ('Unverified (No Flow Sensor)' as const),
                mode: 'AUTO' as const,
                success: true,
                reason: `Auto-stop triggered at ${nextWaterPct}% (threshold ${prev.settings.autoPumpStopAbovePercent}%).`,
              },
              ...pumpLogs,
            ].slice(0, 50);
          }
        }

        return {
          ...prev,
          environmentReadings: [...prev.environmentReadings.slice(-39), newEnv],
          waterReadings: [...prev.waterReadings.slice(-39), newWater],
          pumpLogs,
          alerts: nextAlerts,
          hardwareState: {
            ...prev.hardwareState,
            pumpCommandedState: pumpCommanded,
            lastReadingTimestamp: nowISO,
          },
        };
      });
    }, 15000);
    return () => clearInterval(interval);
  }, [db.hardwareState.mode]);

  // Stale data watcher in Live Hardware Mode
  useEffect(() => {
    if (db.hardwareState.mode !== 'Live Hardware Mode') return;
    const t = setInterval(() => {
      setDb((prev) => {
        if (
          prev.hardwareState.mode === 'Live Hardware Mode' &&
          prev.hardwareState.connectionStatus === 'Connected' &&
          prev.hardwareState.lastReadingTimestamp
        ) {
          const ageSec =
            (Date.now() - new Date(prev.hardwareState.lastReadingTimestamp).getTime()) / 1000;
          if (ageSec > prev.settings.staleDataTimeoutSeconds) {
            const nextAlerts = appendAlertIfNew(prev.alerts, {
              title: 'Stale Hardware Sensor Readings',
              category: 'Stale Sensor Readings',
              deviceId: 'ARDUINO-UNO-01',
              timestamp: new Date().toISOString(),
              severity: 'Warning',
              explanation: `No telemetry received for ${Math.round(
                ageSec
              )}s (timeout ${prev.settings.staleDataTimeoutSeconds}s).`,
              dedupeKey: `stale-${new Date().toISOString().slice(0, 13)}`,
            });
            return {
              ...prev,
              alerts: nextAlerts,
              hardwareState: { ...prev.hardwareState, connectionStatus: 'Stale Data' },
            };
          }
        }
        return prev;
      });
    }, 5000);
    return () => clearInterval(t);
  }, [db.hardwareState.mode]);

  const addCow: FarmContextValue['addCow'] = (cowInput) => {
    const now = new Date().toISOString();
    const newCow: Cow = {
      ...cowInput,
      ageYears: calculateAgeYears(cowInput.dateOfBirth),
      createdAt: now,
      updatedAt: now,
    };
    setDb((prev) => ({
      ...prev,
      cows: [newCow, ...prev.cows],
      timeline: [
        {
          id: `TL-${Date.now()}`,
          timestamp: now,
          module: 'Cow Management',
          summary: `Registered cow ${newCow.id} (${newCow.name}, ${newCow.breed}).`,
          cowId: newCow.id,
        },
        ...prev.timeline,
      ].slice(0, 50),
    }));
    pushToast(`Cow ${newCow.id} (${newCow.name}) added.`, 'success');
  };

  const updateCow: FarmContextValue['updateCow'] = (cow) => {
    const now = new Date().toISOString();
    setDb((prev) => ({
      ...prev,
      cows: prev.cows.map((c) =>
        c.id === cow.id
          ? { ...cow, ageYears: calculateAgeYears(cow.dateOfBirth), updatedAt: now }
          : c
      ),
    }));
    pushToast(`Updated profile for ${cow.id}.`, 'success');
  };

  const deleteOrArchiveCow: FarmContextValue['deleteOrArchiveCow'] = (cowId, hardDelete) => {
    setDb((prev) => {
      if (hardDelete) {
        return {
          ...prev,
          cows: prev.cows.filter((c) => c.id !== cowId),
          milkRecords: prev.milkRecords.filter((m) => m.cowId !== cowId),
          healthRecords: prev.healthRecords.filter((h) => h.cowId !== cowId),
          treatments: prev.treatments.filter((t) => t.cowId !== cowId),
        };
      }
      return {
        ...prev,
        cows: prev.cows.map((c) =>
          c.id === cowId ? { ...c, status: 'Archived', updatedAt: new Date().toISOString() } : c
        ),
      };
    });
    if (selectedCowId === cowId && hardDelete) setSelectedCowId(null);
    pushToast(hardDelete ? `Cow ${cowId} permanently deleted.` : `Cow ${cowId} archived.`, 'info');
  };

  const upsertMilkRecord: FarmContextValue['upsertMilkRecord'] = (input) => {
    const now = new Date().toISOString();
    const total = round2(input.morningLitres + input.eveningLitres + input.additionalLitres);
    setDb((prev) => {
      const existingIdx = prev.milkRecords.findIndex(
        (r) =>
          r.id === input.id ||
          (r.cowId === input.cowId && r.date === input.date && !input.id)
      );
      let nextRecords: MilkRecord[];
      if (existingIdx >= 0) {
        nextRecords = prev.milkRecords.map((r, i) =>
          i === existingIdx ? { ...r, ...input, totalLitres: total, updatedAt: now } : r
        );
      } else {
        nextRecords = [
          {
            id: input.id || `MR-${input.cowId}-${input.date}-${Date.now()}`,
            cowId: input.cowId,
            date: input.date,
            morningLitres: round2(input.morningLitres),
            eveningLitres: round2(input.eveningLitres),
            additionalLitres: round2(input.additionalLitres),
            totalLitres: total,
            notes: input.notes,
            createdAt: now,
            updatedAt: now,
          },
          ...prev.milkRecords,
        ];
      }

      let nextAlerts = prev.alerts;
      let nextReviews = prev.unusualMilkReviews;
      const cmp = evaluateCowMilkBaseline(
        input.cowId,
        nextRecords,
        prev.settings.milkChangeThresholdPercent
      );
      if (cmp && cmp.isUnusual && cmp.latestDate === input.date) {
        const cow = prev.cows.find((c) => c.id === input.cowId);
        nextAlerts = appendAlertIfNew(nextAlerts, {
          title: `Unusual Milk ${cmp.direction === 'decrease' ? 'Decrease' : 'Increase'} — ${
            input.cowId
          } (${cow?.name || ''})`,
          category: 'Unusual Milk Production',
          cowId: input.cowId,
          timestamp: now,
          severity: Math.abs(cmp.percentDifference) >= 35 ? 'Critical' : 'Warning',
          explanation: `Recorded ${cmp.currentLitres} L on ${cmp.latestDate} vs ${
            cmp.previousAverage
          } L recent average (${cmp.percentDifference > 0 ? '+' : ''}${
            cmp.percentDifference
          }%). Flagged for human review.`,
          dedupeKey: `milk-unusual-${input.cowId}-${input.date}`,
        });
        const alreadyRev = nextReviews.some(
          (rev) => rev.cowId === input.cowId && rev.date === input.date
        );
        if (!alreadyRev) {
          nextReviews = [
            {
              id: `UMR-${Date.now()}`,
              cowId: input.cowId,
              date: input.date,
              currentLitres: cmp.currentLitres,
              baselineLitres: cmp.previousAverage,
              percentDifference: cmp.percentDifference,
              observations: input.notes || '',
              resolved: false,
            },
            ...nextReviews,
          ];
        }
      }

      return {
        ...prev,
        milkRecords: nextRecords,
        unusualMilkReviews: nextReviews,
        alerts: nextAlerts,
        timeline: [
          {
            id: `TL-${Date.now()}`,
            timestamp: now,
            module: 'Milk Production',
            summary: `Recorded ${total} L for ${input.cowId} on ${input.date}.`,
            cowId: input.cowId,
          },
          ...prev.timeline,
        ].slice(0, 50),
      };
    });
    pushToast(`Milk record saved for ${input.cowId} (${total} L).`, 'success');
  };

  const deleteMilkRecord = (id: string) => {
    setDb((prev) => ({ ...prev, milkRecords: prev.milkRecords.filter((r) => r.id !== id) }));
    pushToast('Milk record deleted.', 'info');
  };

  const saveUnusualMilkReview: FarmContextValue['saveUnusualMilkReview'] = (review) => {
    const now = new Date().toISOString();
    setDb((prev) => {
      const existing = prev.unusualMilkReviews.find(
        (r) => r.id === review.id || (r.cowId === review.cowId && r.date === review.date)
      );
      let nextReviews: UnusualMilkReview[];
      if (existing) {
        nextReviews = prev.unusualMilkReviews.map((r) =>
          r.id === existing.id
            ? {
                ...r,
                observations: review.observations,
                resolved: review.resolved,
                resolvedAt: review.resolved ? now : undefined,
              }
            : r
        );
      } else {
        nextReviews = [
          {
            ...review,
            id: review.id || `UMR-${Date.now()}`,
            resolvedAt: review.resolved ? now : undefined,
          },
          ...prev.unusualMilkReviews,
        ];
      }

      // Sync corresponding milk-unusual alert if resolved
      const nextAlerts = prev.alerts.map((a) =>
        a.category === 'Unusual Milk Production' &&
        a.cowId === review.cowId &&
        review.resolved
          ? {
              ...a,
              status: 'Resolved' as AlertStatus,
              reviewNotes: review.observations || a.reviewNotes,
            }
          : a
      );

      return { ...prev, unusualMilkReviews: nextReviews, alerts: nextAlerts };
    });
    pushToast(
      review.resolved ? `Milk review for ${review.cowId} marked resolved.` : 'Observation saved.',
      'success'
    );
  };

  const addHealthRecord: FarmContextValue['addHealthRecord'] = (input) => {
    const now = new Date().toISOString();
    const record: HealthRecord = { ...input, id: `HR-${Date.now()}`, createdAt: now };
    setDb((prev) => {
      let nextAlerts = prev.alerts;
      const cow = prev.cows.find((c) => c.id === input.cowId);
      if (input.requiresInspection) {
        nextAlerts = appendAlertIfNew(nextAlerts, {
          title: `Health Inspection Required — ${input.cowId} (${cow?.name || ''})`,
          category: 'Health Inspection Required',
          cowId: input.cowId,
          timestamp: now,
          severity: 'Warning',
          explanation: `${input.type}: ${
            input.symptoms || input.unusualBehaviour || 'Flagged during observation.'
          }`,
          dedupeKey: `health-${input.cowId}-${input.date}`,
        });
      }
      return {
        ...prev,
        healthRecords: [record, ...prev.healthRecords],
        cows: prev.cows.map((c) =>
          c.id === input.cowId
            ? {
                ...c,
                requiresHealthInspection: input.requiresInspection,
                status:
                  input.requiresInspection && c.status === 'Active'
                    ? 'Under Observation'
                    : !input.requiresInspection && c.status === 'Under Observation'
                    ? 'Active'
                    : c.status,
                updatedAt: now,
              }
            : c
        ),
        alerts: nextAlerts,
        timeline: [
          {
            id: `TL-${Date.now()}`,
            timestamp: now,
            module: 'Health Monitoring',
            summary: `${input.type} recorded for ${input.cowId}.`,
            cowId: input.cowId,
          },
          ...prev.timeline,
        ].slice(0, 50),
      };
    });
    pushToast(`Health record saved for ${input.cowId}.`, 'success');
  };

  const addActivityReading: FarmContextValue['addActivityReading'] = (input) => {
    const reading: ActivityReading = { ...input, id: `ACT-${Date.now()}` };
    setDb((prev) => {
      const nextReadings = [...prev.activityReadings, reading];
      let nextAlerts = prev.alerts;
      const cmp = evaluateCowActivityBaseline(
        input.cowId,
        nextReadings,
        prev.settings.activityChangeThresholdPercent
      );
      if (cmp && cmp.isUnusual) {
        const cow = prev.cows.find((c) => c.id === input.cowId);
        nextAlerts = appendAlertIfNew(nextAlerts, {
          title: `Unusual Activity Reading — ${input.cowId} (${cow?.name || ''})`,
          category: 'Unusual Activity',
          cowId: input.cowId,
          timestamp: input.timestamp,
          severity: 'Warning',
          explanation: `Activity index ${input.activityIndex} differs by ${cmp.percentDifference}% from baseline (${cmp.baseline}) via ${input.source}.`,
          dedupeKey: `act-unusual-${input.cowId}-${input.timestamp.slice(0, 10)}`,
        });
      }
      return { ...prev, activityReadings: nextReadings, alerts: nextAlerts };
    });
    pushToast(`Activity reading saved for ${input.cowId}.`, 'success');
  };

  const upsertTreatment: FarmContextValue['upsertTreatment'] = (input) => {
    const now = new Date().toISOString();
    const expectedEnd = computeWithdrawalEndISO(
      input.startDate,
      input.startTime,
      input.withdrawalDurationValue,
      input.withdrawalDurationUnit
    );
    const complete = isTreatmentComplete(input);

    setDb((prev) => {
      const id = input.id || `TR-${Date.now()}`;
      const record: TreatmentRecord = {
        ...input,
        id,
        expectedWithdrawalEndISO: expectedEnd,
        isComplete: complete,
        createdAt: input.id
          ? prev.treatments.find((t) => t.id === input.id)?.createdAt || now
          : now,
        updatedAt: now,
      };
      const exists = prev.treatments.some((t) => t.id === id);
      const nextTreatments = exists
        ? prev.treatments.map((t) => (t.id === id ? record : t))
        : [record, ...prev.treatments];

      let nextAlerts = prev.alerts;
      const cow = prev.cows.find((c) => c.id === record.cowId);
      if (!complete) {
        nextAlerts = appendAlertIfNew(nextAlerts, {
          title: `Incomplete Treatment Record — ${record.cowId} (${cow?.name || ''})`,
          category: 'Incomplete Treatment Record',
          cowId: record.cowId,
          timestamp: now,
          severity: 'Critical',
          explanation: `Treatment "${record.treatmentName}" is missing vet verification or withdrawal duration. Fail-safe diversion applies.`,
          dedupeKey: `incomplete-${id}`,
        });
      } else if (isWithdrawalActive(record)) {
        nextAlerts = appendAlertIfNew(nextAlerts, {
          title: `Active Withdrawal Period — ${record.cowId} (${cow?.name || ''})`,
          category: 'Active Withdrawal Period',
          cowId: record.cowId,
          timestamp: now,
          severity: 'Critical',
          explanation: `${record.medicineName} withdrawal active until ${new Date(
            record.expectedWithdrawalEndISO!
          ).toLocaleString()}.`,
          dedupeKey: `withdrawal-${id}`,
        });
      }

      return {
        ...prev,
        treatments: nextTreatments,
        alerts: nextAlerts,
        timeline: [
          {
            id: `TL-${Date.now()}`,
            timestamp: now,
            module: 'Treatment & Medicine',
            summary: `${exists ? 'Updated' : 'Added'} treatment "${record.treatmentName}" for ${
              record.cowId
            }.`,
            cowId: record.cowId,
          },
          ...prev.timeline,
        ].slice(0, 50),
      };
    });
    pushToast(
      complete
        ? `Treatment saved for ${input.cowId}.`
        : `Saved as incomplete record — fail-safe milk diversion will apply.`,
      complete ? 'success' : 'warning'
    );
  };

  const deleteTreatment = (id: string) => {
    setDb((prev) => ({ ...prev, treatments: prev.treatments.filter((t) => t.id !== id) }));
    pushToast('Treatment record removed.', 'info');
  };

  const executeMilkSafetyCheck: FarmContextValue['executeMilkSafetyCheck'] = (
    cowIdOrRfid,
    checkedBy
  ) => {
    const event = runMilkSafetyCheck({
      cowIdOrRfid,
      cows: db.cows,
      treatments: db.treatments,
      hardwareState: db.hardwareState,
      checkedBy,
    });
    const isDiverted = event.route !== 'Main Collection Route';

    setDb((prev) => {
      let nextAlerts = prev.alerts;
      if (event.status === 'Unknown cow') {
        nextAlerts = appendAlertIfNew(nextAlerts, {
          title: `Unknown RFID / Cow Tag Scanned (${cowIdOrRfid})`,
          category: 'Unknown RFID',
          timestamp: event.timestamp,
          severity: 'Critical',
          explanation: event.reason,
        });
      } else if (isDiverted) {
        nextAlerts = appendAlertIfNew(nextAlerts, {
          title: `Milk Diversion Event — ${event.cowId || cowIdOrRfid}`,
          category: 'Milk Diversion Event',
          cowId: event.cowId || undefined,
          timestamp: event.timestamp,
          severity: 'Warning',
          explanation: event.reason,
        });
      }

      return {
        ...prev,
        safetyEvents: [event, ...prev.safetyEvents].slice(0, 100),
        alerts: nextAlerts,
        hardwareState: {
          ...prev.hardwareState,
          diverterServoAngle: isDiverted ? 90 : 0,
        },
        timeline: [
          {
            id: `TL-${Date.now()}`,
            timestamp: event.timestamp,
            module: 'Milk Safety',
            summary: `${event.status}: ${event.cowId || event.rfidTag} → ${event.route}.`,
            cowId: event.cowId || undefined,
          },
          ...prev.timeline,
        ].slice(0, 50),
      };
    });

    pushToast(
      `${event.status} → ${event.route}`,
      event.status === 'Approved by record checks' ? 'success' : 'warning'
    );
    return event;
  };

  const recordEnvironmentReading: FarmContextValue['recordEnvironmentReading'] = (
    tempC,
    hum,
    source
  ) => {
    const reading: EnvironmentReading = {
      id: `ENV-${Date.now()}`,
      timestamp: new Date().toISOString(),
      temperatureC: round2(tempC),
      humidityPercent: round2(hum),
      source,
    };
    setDb((prev) => {
      let nextAlerts = prev.alerts;
      checkEnvironmentThresholds(reading, prev.settings).forEach((a) => {
        nextAlerts = appendAlertIfNew(nextAlerts, a);
      });
      return {
        ...prev,
        environmentReadings: [...prev.environmentReadings.slice(-49), reading],
        alerts: nextAlerts,
        hardwareState: { ...prev.hardwareState, lastReadingTimestamp: reading.timestamp },
      };
    });
    pushToast(`Environment reading logged (${tempC}°C, ${hum}%).`, 'info');
  };

  const recordWaterReading: FarmContextValue['recordWaterReading'] = (waterPercent, source) => {
    const pct = Math.max(0, Math.min(100, Math.round(waterPercent)));
    const reading: WaterReading = {
      id: `WAT-${Date.now()}`,
      timestamp: new Date().toISOString(),
      waterPercent: pct,
      distanceCm: Math.round(((100 - pct) / 100) * db.settings.tankHeightCm),
      estimatedLitres: Math.round((pct / 100) * db.settings.tankCapacityLitres),
      source,
    };
    setDb((prev) => {
      let nextAlerts = prev.alerts;
      checkWaterThresholds(reading, prev.settings).forEach((a) => {
        nextAlerts = appendAlertIfNew(nextAlerts, a);
      });
      return {
        ...prev,
        waterReadings: [...prev.waterReadings.slice(-49), reading],
        alerts: nextAlerts,
        hardwareState: { ...prev.hardwareState, lastReadingTimestamp: reading.timestamp },
      };
    });
    pushToast(`Water reading logged (${pct}%).`, 'info');
  };

  const commandPump: FarmContextValue['commandPump'] = async (state, mode, reason) => {
    const now = new Date().toISOString();
    if (
      db.hardwareState.mode === 'Live Hardware Mode' &&
      db.hardwareState.connectionStatus !== 'Connected'
    ) {
      setDb((prev) => ({
        ...prev,
        pumpLogs: [
          {
            id: `PUMP-${Date.now()}`,
            timestamp: now,
            commandedState: state,
            verifiedState: prev.settings.pumpFlowSensorInstalled
              ? ('OFF' as const)
              : ('Unverified (No Flow Sensor)' as const),
            mode,
            success: false,
            reason: `Command ${state} failed: Arduino is ${prev.hardwareState.connectionStatus}.`,
          },
          ...prev.pumpLogs,
        ].slice(0, 50),
        alerts: appendAlertIfNew(prev.alerts, {
          title: 'Pump Command Failure',
          category: 'Pump Command Failure',
          deviceId: 'RELAY-PUMP-01',
          timestamp: now,
          severity: 'Critical',
          explanation: `Failed to send PUMP_${state}: Live Hardware Mode is enabled but Arduino is ${prev.hardwareState.connectionStatus}.`,
        }),
      }));
      pushToast(`Pump command ${state} failed: Arduino disconnected.`, 'error');
      return false;
    }

    if (db.hardwareState.mode === 'Live Hardware Mode' && serialHandle) {
      try {
        await serialHandle.sendCommand(state === 'ON' ? 'PUMP_ON' : 'PUMP_OFF');
      } catch {
        pushToast('Failed to transmit serial command to Arduino.', 'error');
        return false;
      }
    }

    setDb((prev) => ({
      ...prev,
      hardwareState: {
        ...prev.hardwareState,
        pumpCommandedState: state,
        pumpMode: mode,
      },
      pumpLogs: [
        {
          id: `PUMP-${Date.now()}`,
          timestamp: now,
          commandedState: state,
          verifiedState: prev.settings.pumpFlowSensorInstalled
            ? state
            : ('Unverified (No Flow Sensor)' as const),
          mode,
          success: true,
          reason,
        },
        ...prev.pumpLogs,
      ].slice(0, 50),
      timeline: [
        {
          id: `TL-${Date.now()}`,
          timestamp: now,
          module: 'Water Management',
          summary: `Pump commanded ${state} (${mode}): ${reason}`,
        },
        ...prev.timeline,
      ].slice(0, 50),
    }));
    pushToast(`Pump commanded ${state} (${db.hardwareState.mode}).`, 'success');
    return true;
  };

  const setPumpMode = (mode: PumpMode) => {
    setDb((prev) => ({ ...prev, hardwareState: { ...prev.hardwareState, pumpMode: mode } }));
    pushToast(`Pump control mode switched to ${mode}.`, 'info');
  };

  const toggleFan = (enabled: boolean, mode?: PumpMode) => {
    if (!db.settings.fanHardwareConfigured) {
      pushToast('Ventilation fan relay is not configured in Settings.', 'warning');
      return;
    }
    setDb((prev) => ({
      ...prev,
      hardwareState: {
        ...prev.hardwareState,
        fanEnabled: enabled,
        fanMode: mode || prev.hardwareState.fanMode,
      },
    }));
    pushToast(
      `Ventilation fan ${enabled ? 'enabled' : 'disabled'} (${db.hardwareState.mode}).`,
      'info'
    );
  };

  const applyIncomingHardwarePayload = (payload: ArduinoTelemetryPayload) => {
    const now = payload.timestamp || new Date().toISOString();
    setDb((prev) => {
      let nextEnv = prev.environmentReadings;
      let nextWater = prev.waterReadings;
      let nextAlerts = prev.alerts;

      if (typeof payload.temperatureC === 'number' && typeof payload.humidityPercent === 'number') {
        const env: EnvironmentReading = {
          id: `ENV-${Date.now()}`,
          timestamp: now,
          temperatureC: round2(payload.temperatureC),
          humidityPercent: round2(payload.humidityPercent),
          source: 'DHT11 Live',
        };
        nextEnv = [...nextEnv.slice(-49), env];
        checkEnvironmentThresholds(env, prev.settings).forEach((a) => {
          nextAlerts = appendAlertIfNew(nextAlerts, a);
        });
      }

      if (typeof payload.waterDistanceCm === 'number') {
        const pct = Math.max(
          0,
          Math.min(100, Math.round((1 - payload.waterDistanceCm / prev.settings.tankHeightCm) * 100))
        );
        const wat: WaterReading = {
          id: `WAT-${Date.now()}`,
          timestamp: now,
          distanceCm: round2(payload.waterDistanceCm),
          waterPercent: pct,
          estimatedLitres: Math.round((pct / 100) * prev.settings.tankCapacityLitres),
          source: 'Ultrasonic Live',
        };
        nextWater = [...nextWater.slice(-49), wat];
        checkWaterThresholds(wat, prev.settings).forEach((a) => {
          nextAlerts = appendAlertIfNew(nextAlerts, a);
        });
      }

      return {
        ...prev,
        environmentReadings: nextEnv,
        waterReadings: nextWater,
        alerts: nextAlerts,
        hardwareState: {
          ...prev.hardwareState,
          connectionStatus: 'Connected',
          lastReadingTimestamp: now,
          pumpCommandedState: payload.pumpRelayState || prev.hardwareState.pumpCommandedState,
          sensors: {
            ...prev.hardwareState.sensors,
            dht11Connected:
              typeof payload.temperatureC === 'number' ||
              prev.hardwareState.sensors.dht11Connected,
            ultrasonicConnected:
              typeof payload.waterDistanceCm === 'number' ||
              prev.hardwareState.sensors.ultrasonicConnected,
          },
        },
      };
    });
  };

  const setHardwareMode = (mode: HardwareMode) => {
    setDb((prev) => ({
      ...prev,
      hardwareState: {
        ...prev.hardwareState,
        mode,
        connectionStatus:
          mode === 'Live Hardware Mode' ? prev.hardwareState.connectionStatus : 'Disconnected',
      },
      hardwareLogs: [
        {
          id: `HWL-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: 'Mode Switch',
          message: `Switched hardware mode to ${mode}.`,
          severity: 'info' as const,
        },
        ...prev.hardwareLogs,
      ].slice(0, 50),
    }));
    pushToast(`Switched to ${mode}.`, 'info');
  };

  const connectSerialArduino = async () => {
    try {
      const handle = await connectArduinoWebSerial(
        (payload) => applyIncomingHardwarePayload(payload),
        (reason) => {
          setSerialHandle(null);
          setDb((prev) => ({
            ...prev,
            hardwareState: {
              ...prev.hardwareState,
              connectionStatus: 'Disconnected',
              serialPortLabel: null,
            },
            alerts: appendAlertIfNew(prev.alerts, {
              title: 'Arduino Serial Disconnected',
              category: 'Arduino Disconnected',
              deviceId: 'ARDUINO-UNO-01',
              timestamp: new Date().toISOString(),
              severity: 'Critical',
              explanation: `USB serial disconnected: ${reason}`,
            }),
            hardwareLogs: [
              {
                id: `HWL-${Date.now()}`,
                timestamp: new Date().toISOString(),
                source: 'Web Serial',
                message: `Disconnected: ${reason}`,
                severity: 'error' as const,
              },
              ...prev.hardwareLogs,
            ].slice(0, 50),
          }));
          pushToast('Arduino serial disconnected.', 'error');
        }
      );
      setSerialHandle({ sendCommand: handle.sendCommand, disconnect: handle.disconnect });
      setDb((prev) => ({
        ...prev,
        hardwareState: {
          ...prev.hardwareState,
          mode: 'Live Hardware Mode',
          connectionStatus: 'Connected',
          serialPortLabel: handle.portLabel,
        },
        hardwareLogs: [
          {
            id: `HWL-${Date.now()}`,
            timestamp: new Date().toISOString(),
            source: 'Web Serial',
            message: `Connected via ${handle.portLabel}.`,
            severity: 'info' as const,
          },
          ...prev.hardwareLogs,
        ].slice(0, 50),
      }));
      pushToast('Arduino Uno connected via USB Serial.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unable to connect via Web Serial.';
      setDb((prev) => ({
        ...prev,
        hardwareLogs: [
          {
            id: `HWL-${Date.now()}`,
            timestamp: new Date().toISOString(),
            source: 'Web Serial',
            message: msg,
            severity: 'warning' as const,
          },
          ...prev.hardwareLogs,
        ].slice(0, 50),
      }));
      pushToast(msg, 'error');
    }
  };

  const disconnectSerialArduino = async () => {
    if (serialHandle) {
      await serialHandle.disconnect();
      setSerialHandle(null);
    }
    setDb((prev) => ({
      ...prev,
      hardwareState: {
        ...prev.hardwareState,
        connectionStatus: 'Disconnected',
        serialPortLabel: null,
      },
    }));
    pushToast('Serial connection closed.', 'info');
  };

  const pollLocalBridgeOnce = async () => {
    try {
      const payload = await fetchBridgeTelemetry(db.settings.bridgeUrl);
      applyIncomingHardwarePayload(payload);
      setDb((prev) => ({
        ...prev,
        hardwareState: {
          ...prev.hardwareState,
          mode: 'Live Hardware Mode',
          connectionStatus: 'Connected',
          serialPortLabel: `Local Bridge (${prev.settings.bridgeUrl})`,
        },
      }));
      pushToast('Received live telemetry from Local Serial Bridge.', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Bridge unreachable';
      setDb((prev) => ({
        ...prev,
        hardwareState: { ...prev.hardwareState, connectionStatus: 'Disconnected' },
        hardwareLogs: [
          {
            id: `HWL-${Date.now()}`,
            timestamp: new Date().toISOString(),
            source: 'Local Bridge',
            message: `Bridge poll failed (${prev.settings.bridgeUrl}): ${msg}`,
            severity: 'error' as const,
          },
          ...prev.hardwareLogs,
        ].slice(0, 50),
      }));
      pushToast(`Local bridge unreachable: ${msg}`, 'error');
    }
  };

  const updateHardwareConfig: FarmContextValue['updateHardwareConfig'] = (patch) => {
    setDb((prev) => ({ ...prev, hardwareState: { ...prev.hardwareState, ...patch } }));
  };

  const updateAlertStatus: FarmContextValue['updateAlertStatus'] = (id, status, reviewNotes) => {
    setDb((prev) => ({
      ...prev,
      alerts: prev.alerts.map((a) =>
        a.id === id
          ? {
              ...a,
              status,
              reviewNotes: reviewNotes !== undefined ? reviewNotes : a.reviewNotes,
            }
          : a
      ),
    }));
    pushToast(`Alert marked as ${status}.`, 'success');
  };

  const createManualAlert: FarmContextValue['createManualAlert'] = (alert) => {
    setDb((prev) => ({ ...prev, alerts: appendAlertIfNew(prev.alerts, alert) }));
  };

  const updateSettings = (settings: FarmSettings) => {
    setDb((prev) => {
      let nextAlerts = prev.alerts;
      const latestEnv = prev.environmentReadings[prev.environmentReadings.length - 1];
      const latestWater = prev.waterReadings[prev.waterReadings.length - 1];
      if (latestEnv) {
        checkEnvironmentThresholds(latestEnv, settings).forEach((a) => {
          nextAlerts = appendAlertIfNew(nextAlerts, a);
        });
      }
      if (latestWater) {
        checkWaterThresholds(latestWater, settings).forEach((a) => {
          nextAlerts = appendAlertIfNew(nextAlerts, a);
        });
      }
      return {
        ...prev,
        settings,
        alerts: nextAlerts,
        hardwareState: {
          ...prev.hardwareState,
          sensors: {
            ...prev.hardwareState.sensors,
            fanRelayConfigured: settings.fanHardwareConfigured,
          },
        },
      };
    });
    pushToast('Settings saved and thresholds re-evaluated.', 'success');
  };

  const resetDemoData = () => {
    const fresh = createDemoDatabase();
    setDb(fresh);
    setSelectedCowId(null);
    pushToast('Demo dataset restored.', 'success');
  };

  const importDatabase = (newDb: FarmDatabase) => {
    setDb(newDb);
    pushToast('Farm database backup imported.', 'success');
  };

  const clearAllData = () => {
    const empty: FarmDatabase = {
      ...createDemoDatabase(),
      isDemoData: false,
      cows: [],
      milkRecords: [],
      unusualMilkReviews: [],
      healthRecords: [],
      activityReadings: [],
      treatments: [],
      safetyEvents: [],
      environmentReadings: [],
      waterReadings: [],
      pumpLogs: [],
      hardwareLogs: [],
      alerts: [],
      timeline: [],
    };
    setDb(empty);
    setSelectedCowId(null);
    pushToast('All farm records cleared.', 'info');
  };

  return (
    <FarmContext.Provider
      value={{
        db,
        activePage,
        setActivePage,
        selectedCowId,
        setSelectedCowId,
        toasts,
        pushToast,
        dismissToast,
        addCow,
        updateCow,
        deleteOrArchiveCow,
        upsertMilkRecord,
        deleteMilkRecord,
        saveUnusualMilkReview,
        addHealthRecord,
        addActivityReading,
        upsertTreatment,
        deleteTreatment,
        executeMilkSafetyCheck,
        recordEnvironmentReading,
        recordWaterReading,
        commandPump,
        setPumpMode,
        toggleFan,
        setHardwareMode,
        connectSerialArduino,
        disconnectSerialArduino,
        pollLocalBridgeOnce,
        updateHardwareConfig,
        updateAlertStatus,
        createManualAlert,
        updateSettings,
        resetDemoData,
        importDatabase,
        clearAllData,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
};

export function useFarm(): FarmContextValue {
  const ctx = useContext(FarmContext);
  if (!ctx) throw new Error('useFarm must be used within FarmProvider');
  return ctx;
}
