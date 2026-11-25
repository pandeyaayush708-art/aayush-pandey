import {
  ActivityReading,
  Cow,
  EnvironmentReading,
  FarmAlert,
  FarmDatabase,
  FarmSettings,
  HealthRecord,
  MilkRecord,
  MilkSafetyEvent,
  PumpActivityLog,
  TreatmentRecord,
  UnusualMilkReview,
  WaterReading,
} from '../types/dairy';
import {
  computeWithdrawalEndISO,
  getDaysAgoISO,
  getTodayISO,
  isTreatmentComplete,
  round2,
} from '../utils/calculations';

export const DEFAULT_SETTINGS: FarmSettings = {
  farmName: 'GreenPasture Dairy Research Farm',
  ownerName: 'Rajesh Deshmukh',
  location: 'Pune District, Maharashtra, India',
  tankCapacityLitres: 2000,
  tankHeightCm: 150,
  temperatureUnit: 'C',
  milkChangeThresholdPercent: 25,
  activityChangeThresholdPercent: 30,
  highTemperatureThresholdC: 33,
  highHumidityThresholdPercent: 80,
  lowWaterThresholdPercent: 25,
  autoPumpStartBelowPercent: 25,
  autoPumpStopAbovePercent: 85,
  staleDataTimeoutSeconds: 45,
  bridgeUrl: 'http://localhost:8765/api/telemetry',
  fanHardwareConfigured: false,
  pumpFlowSensorInstalled: false,
  physicalIndicatorsEnabled: false,
};

export function createDemoDatabase(): FarmDatabase {
  const today = getTodayISO();
  const now = new Date();
  const isoHoursAgo = (h: number) => new Date(now.getTime() - h * 3600 * 1000).toISOString();

  const cows: Cow[] = [
    {
      id: 'C-101',
      name: 'Gauri',
      rfidTag: 'RF-00104821',
      breed: 'Gir',
      dateOfBirth: '2021-03-14',
      ageYears: 5,
      status: 'Active',
      lactationNumber: 3,
      notes: 'Consistent high-butterfat yield. Calm temperament in parlour.',
      requiresHealthInspection: false,
      createdAt: isoHoursAgo(720),
      updatedAt: isoHoursAgo(4),
    },
    {
      id: 'C-102',
      name: 'Nandini',
      rfidTag: 'RF-00104822',
      breed: 'Holstein Friesian Cross',
      dateOfBirth: '2020-07-22',
      ageYears: 6,
      status: 'Active',
      lactationNumber: 4,
      notes: 'Primary high-yielder; monitor feed intake during afternoon heat.',
      requiresHealthInspection: false,
      createdAt: isoHoursAgo(720),
      updatedAt: isoHoursAgo(5),
    },
    {
      id: 'C-103',
      name: 'Kaveri',
      rfidTag: 'RF-00104823',
      breed: 'Sahiwal',
      dateOfBirth: '2021-11-02',
      ageYears: 5,
      status: 'Under Observation',
      lactationNumber: 2,
      notes: 'Noticeable drop in daily yield; scheduled for veterinary review.',
      requiresHealthInspection: true,
      createdAt: isoHoursAgo(700),
      updatedAt: isoHoursAgo(2),
    },
    {
      id: 'C-104',
      name: 'Lakshmi',
      rfidTag: 'RF-00104824',
      breed: 'Jersey Cross',
      dateOfBirth: '2022-01-19',
      ageYears: 4,
      status: 'Active',
      lactationNumber: 2,
      notes: 'Treated for mild hoof inflammation; currently in withdrawal period.',
      requiresHealthInspection: false,
      createdAt: isoHoursAgo(690),
      updatedAt: isoHoursAgo(6),
    },
    {
      id: 'C-105',
      name: 'Radha',
      rfidTag: 'RF-00104825',
      breed: 'Gir',
      dateOfBirth: '2019-08-10',
      ageYears: 7,
      status: 'Active',
      lactationNumber: 4,
      notes: 'Steady morning and evening output across lactations.',
      requiresHealthInspection: false,
      createdAt: isoHoursAgo(680),
      updatedAt: isoHoursAgo(8),
    },
    {
      id: 'C-106',
      name: 'Tara',
      rfidTag: 'RF-00104826',
      breed: 'Red Sindhi',
      dateOfBirth: '2022-05-28',
      ageYears: 4,
      status: 'Active',
      lactationNumber: 1,
      notes: 'First lactation; responding well to mineral supplement.',
      requiresHealthInspection: false,
      createdAt: isoHoursAgo(670),
      updatedAt: isoHoursAgo(12),
    },
    {
      id: 'C-107',
      name: 'Meera',
      rfidTag: 'RF-00104827',
      breed: 'Holstein Friesian Cross',
      dateOfBirth: '2020-04-03',
      ageYears: 6,
      status: 'Active',
      lactationNumber: 3,
      notes: 'Recent treatment record pending veterinarian withdrawal verification.',
      requiresHealthInspection: true,
      createdAt: isoHoursAgo(660),
      updatedAt: isoHoursAgo(3),
    },
    {
      id: 'C-108',
      name: 'Yamuna',
      rfidTag: 'RF-00104828',
      breed: 'Tharparkar',
      dateOfBirth: '2021-09-12',
      ageYears: 5,
      status: 'Dry',
      lactationNumber: 2,
      notes: 'Dry-off period ahead of expected calving next month.',
      requiresHealthInspection: false,
      createdAt: isoHoursAgo(650),
      updatedAt: isoHoursAgo(24),
    },
    {
      id: 'C-109',
      name: 'Sita',
      rfidTag: 'RF-00104829',
      breed: 'Jersey Cross',
      dateOfBirth: '2021-06-15',
      ageYears: 5,
      status: 'Active',
      lactationNumber: 3,
      notes: 'High morning yield, moderate evening yield.',
      requiresHealthInspection: false,
      createdAt: isoHoursAgo(640),
      updatedAt: isoHoursAgo(7),
    },
    {
      id: 'C-110',
      name: 'Kamadhenu',
      rfidTag: 'RF-00104830',
      breed: 'Gir',
      dateOfBirth: '2020-12-01',
      ageYears: 5,
      status: 'Active',
      lactationNumber: 3,
      notes: 'Steady milk production; vaccinated last week.',
      requiresHealthInspection: false,
      createdAt: isoHoursAgo(630),
      updatedAt: isoHoursAgo(10),
    },
  ];

  const baseYields: Record<string, { m: number; e: number }> = {
    'C-101': { m: 6.4, e: 5.2 },
    'C-102': { m: 9.8, e: 8.4 },
    'C-103': { m: 6.5, e: 5.5 },
    'C-104': { m: 7.2, e: 6.1 },
    'C-105': { m: 6.0, e: 5.1 },
    'C-106': { m: 5.2, e: 4.4 },
    'C-107': { m: 8.5, e: 7.3 },
    'C-109': { m: 7.6, e: 5.9 },
    'C-110': { m: 6.3, e: 5.0 },
  };

  const milkRecords: MilkRecord[] = [];
  for (let d = 13; d >= 0; d--) {
    const dateStr = getDaysAgoISO(d);
    Object.entries(baseYields).forEach(([cowId, base], idx) => {
      const wave = Math.sin((d + idx) * 0.7) * 0.35;
      let m = round2(Math.max(0.5, base.m + wave));
      let e = round2(Math.max(0.5, base.e - wave * 0.5));
      let notes = '';

      if (cowId === 'C-103' && d === 0) {
        m = 3.8;
        e = 3.0;
        notes = 'Noticeably lower intake and reduced evening yield; flagged for human review.';
      }
      if (cowId === 'C-107' && d === 0) {
        m = 5.4;
        e = 4.6;
        notes = 'Yield lower during recovery observation.';
      }

      milkRecords.push({
        id: `MR-${cowId}-${dateStr}`,
        cowId,
        date: dateStr,
        morningLitres: m,
        eveningLitres: e,
        additionalLitres: 0,
        totalLitres: round2(m + e),
        notes,
        createdAt: `${dateStr}T18:30:00.000Z`,
        updatedAt: `${dateStr}T18:30:00.000Z`,
      });
    });
  }

  const unusualMilkReviews: UnusualMilkReview[] = [
    {
      id: 'UMR-1',
      cowId: 'C-103',
      date: today,
      currentLitres: 6.8,
      baselineLitres: 12.0,
      percentDifference: -43.33,
      observations: 'Reduced silage intake observed during morning shift; scheduled vet check.',
      resolved: false,
    },
    {
      id: 'UMR-2',
      cowId: 'C-105',
      date: getDaysAgoISO(5),
      currentLitres: 8.1,
      baselineLitres: 11.1,
      percentDifference: -27.03,
      observations: 'Temporary afternoon heat stress; restored to 11.2 L next day after shading and water.',
      resolved: true,
      resolvedAt: isoHoursAgo(96),
    },
  ];

  const healthRecords: HealthRecord[] = [
    {
      id: 'HR-1',
      cowId: 'C-103',
      date: today,
      type: 'Observation',
      symptoms: 'Reduced feed intake, mild lethargy during morning milking',
      unusualBehaviour: 'Standing away from herd near water trough',
      recommendations: 'Monitor water intake and schedule veterinarian visit today',
      followUpDate: today,
      requiresInspection: true,
      notes: 'Observed by milker at 06:15 AM.',
      createdAt: isoHoursAgo(5),
    },
    {
      id: 'HR-2',
      cowId: 'C-104',
      date: getDaysAgoISO(2),
      type: 'Vet Visit',
      symptoms: 'Mild soreness in rear left hoof',
      unusualBehaviour: 'Slight limp walking into parlour',
      vetName: 'Dr. A. Kulkarni (BVSc)',
      recommendations: 'Clean hoof, complete prescribed 72h milk withdrawal',
      followUpDate: getDaysAgoISO(-1),
      requiresInspection: false,
      notes: 'Responding well to dressing.',
      createdAt: isoHoursAgo(48),
    },
    {
      id: 'HR-3',
      cowId: 'C-110',
      date: getDaysAgoISO(6),
      type: 'Vaccination',
      symptoms: 'None (routine preventive care)',
      unusualBehaviour: 'None',
      vetName: 'Dr. A. Kulkarni (BVSc)',
      vaccinationDetails: 'FMD + HS Booster Dose (Batch #IND-8821)',
      recommendations: 'Routine herd record updated; no withdrawal required per vet.',
      requiresInspection: false,
      notes: 'Annual herd vaccination drive.',
      createdAt: isoHoursAgo(144),
    },
  ];

  const activityReadings: ActivityReading[] = [];
  ['C-101', 'C-102', 'C-103', 'C-104', 'C-105'].forEach((cowId, idx) => {
    for (let d = 5; d >= 0; d--) {
      const baseAct = 140 + idx * 12;
      const val = cowId === 'C-103' && d === 0 ? 78 : Math.round(baseAct + Math.cos(d + idx) * 8);
      activityReadings.push({
        id: `ACT-${cowId}-${d}`,
        cowId,
        timestamp: isoHoursAgo(d * 24 + 2),
        activityIndex: val,
        source: 'Demo',
        notes: cowId === 'C-103' && d === 0 ? 'Lower movement index recorded in demo dataset.' : '',
      });
    }
  });

  const yesterday = getDaysAgoISO(1);
  const tenDaysAgo = getDaysAgoISO(10);

  const treatments: TreatmentRecord[] = [
    {
      id: 'TR-201',
      cowId: 'C-104',
      treatmentName: 'Hoof Infection Therapy',
      medicineName: 'Oxytetracycline LA (Vet Prescribed)',
      startDate: yesterday,
      startTime: '09:00',
      veterinarianName: 'Dr. A. Kulkarni',
      vetVerificationInfo: 'Reg #MSVC-4419 — Verified',
      vetVerified: true,
      withdrawalDurationValue: 72,
      withdrawalDurationUnit: 'hours',
      expectedWithdrawalEndISO: computeWithdrawalEndISO(yesterday, '09:00', 72, 'hours'),
      notes: 'Milk must be diverted until withdrawal period completes.',
      isComplete: true,
      createdAt: isoHoursAgo(30),
      updatedAt: isoHoursAgo(30),
    },
    {
      id: 'TR-202',
      cowId: 'C-107',
      treatmentName: 'Respiratory Support Course',
      medicineName: 'Amoxicillin + Sulbactam',
      startDate: today,
      startTime: '07:30',
      veterinarianName: 'Dr. S. Patil',
      vetVerificationInfo: 'Pending written slip confirmation',
      vetVerified: false,
      withdrawalDurationValue: null,
      withdrawalDurationUnit: 'hours',
      expectedWithdrawalEndISO: null,
      notes: 'Awaiting vet-confirmed withdrawal hours; fail-safe diversion active.',
      isComplete: false,
      createdAt: isoHoursAgo(4),
      updatedAt: isoHoursAgo(4),
    },
    {
      id: 'TR-203',
      cowId: 'C-101',
      treatmentName: 'Post-Calving Mineral & Calcium Support',
      medicineName: 'Oral Calcium Gel',
      startDate: tenDaysAgo,
      startTime: '08:00',
      veterinarianName: 'Dr. A. Kulkarni',
      vetVerificationInfo: 'Reg #MSVC-4419 — Verified',
      vetVerified: true,
      withdrawalDurationValue: 24,
      withdrawalDurationUnit: 'hours',
      expectedWithdrawalEndISO: computeWithdrawalEndISO(tenDaysAgo, '08:00', 24, 'hours'),
      notes: 'Completed successfully; withdrawal ended.',
      isComplete: true,
      createdAt: isoHoursAgo(240),
      updatedAt: isoHoursAgo(216),
    },
  ];

  treatments.forEach((t) => {
    t.isComplete = isTreatmentComplete(t);
  });

  const safetyEvents: MilkSafetyEvent[] = [
    {
      id: 'MSE-1',
      timestamp: isoHoursAgo(6),
      cowId: 'C-101',
      rfidTag: 'RF-00104821',
      status: 'Approved by record checks',
      route: 'Main Collection Route',
      reason: 'No active withdrawal or incomplete records for C-101 (Gauri).',
      hardwareMode: 'Demo Mode',
      checkedBy: 'RFID Simulation',
    },
    {
      id: 'MSE-2',
      timestamp: isoHoursAgo(5.5),
      cowId: 'C-104',
      rfidTag: 'RF-00104824',
      status: 'Withdrawal active',
      route: 'Separate Diversion Route',
      reason: 'Active withdrawal for Oxytetracycline LA. Milk diverted to separate route.',
      hardwareMode: 'Demo Mode',
      checkedBy: 'RFID Simulation',
    },
    {
      id: 'MSE-3',
      timestamp: isoHoursAgo(3.5),
      cowId: 'C-107',
      rfidTag: 'RF-00104827',
      status: 'Missing treatment information',
      route: 'Separate Diversion Route',
      reason: 'Treatment TR-202 missing vet verification / withdrawal duration. Fail-safe diverted.',
      hardwareMode: 'Demo Mode',
      checkedBy: 'Manual Check',
    },
  ];

  const environmentReadings: EnvironmentReading[] = Array.from({ length: 12 }, (_, idx) => {
    const hAgo = (11 - idx) * 2;
    const temp = round2(26.5 + Math.sin(idx * 0.5) * 3.8 + (idx === 10 ? 3.5 : 0));
    const hum = round2(62 + Math.cos(idx * 0.4) * 9);
    return {
      id: `ENV-${idx + 1}`,
      timestamp: isoHoursAgo(hAgo),
      temperatureC: temp,
      humidityPercent: hum,
      source: 'Demo',
    };
  });

  const waterReadings: WaterReading[] = Array.from({ length: 10 }, (_, idx) => {
    const hAgo = (9 - idx) * 2;
    const pct = Math.max(18, Math.min(92, Math.round(74 - idx * 5 + (idx > 6 ? 25 : 0))));
    const distanceCm = Math.round(((100 - pct) / 100) * DEFAULT_SETTINGS.tankHeightCm);
    return {
      id: `WAT-${idx + 1}`,
      timestamp: isoHoursAgo(hAgo),
      distanceCm,
      waterPercent: pct,
      estimatedLitres: Math.round((pct / 100) * DEFAULT_SETTINGS.tankCapacityLitres),
      source: 'Demo',
    };
  });

  const pumpLogs: PumpActivityLog[] = [
    {
      id: 'PUMP-1',
      timestamp: isoHoursAgo(8),
      commandedState: 'ON',
      verifiedState: 'Unverified (No Flow Sensor)',
      mode: 'AUTO',
      success: true,
      reason: 'Auto-started when demo tank reading dropped to 24%.',
    },
    {
      id: 'PUMP-2',
      timestamp: isoHoursAgo(6),
      commandedState: 'OFF',
      verifiedState: 'Unverified (No Flow Sensor)',
      mode: 'AUTO',
      success: true,
      reason: 'Auto-stopped at 86% tank threshold.',
    },
  ];

  const alerts: FarmAlert[] = [
    {
      id: 'ALT-1',
      title: 'Unusual Milk Decrease — C-103 (Kaveri)',
      category: 'Unusual Milk Production',
      cowId: 'C-103',
      timestamp: isoHoursAgo(2),
      severity: 'Warning',
      explanation:
        'Today yield (6.8 L) is 43.3% below recent 7-day average (12.0 L). Flagged for human review (not a diagnosis).',
      status: 'Unread',
      reviewNotes: '',
      dedupeKey: `milk-unusual-C-103-${today}`,
    },
    {
      id: 'ALT-2',
      title: 'Active Withdrawal Reminder — C-104 (Lakshmi)',
      category: 'Active Withdrawal Period',
      cowId: 'C-104',
      timestamp: isoHoursAgo(5.5),
      severity: 'Critical',
      explanation:
        'Cow C-104 is under active milk withdrawal for Oxytetracycline LA. Milk must be routed separately.',
      status: 'Read',
      reviewNotes: 'Confirmed separate bucket used in morning shift.',
      dedupeKey: 'withdrawal-TR-201',
    },
    {
      id: 'ALT-3',
      title: 'Incomplete Treatment Record — C-107 (Meera)',
      category: 'Incomplete Treatment Record',
      cowId: 'C-107',
      timestamp: isoHoursAgo(3.5),
      severity: 'Critical',
      explanation:
        'Treatment "Respiratory Support Course" is missing vet-confirmed withdrawal duration and verification.',
      status: 'Unread',
      reviewNotes: '',
      dedupeKey: 'incomplete-TR-202',
    },
    {
      id: 'ALT-4',
      title: 'Health Inspection Required — C-103 (Kaveri)',
      category: 'Health Inspection Required',
      cowId: 'C-103',
      timestamp: isoHoursAgo(5),
      severity: 'Warning',
      explanation:
        'Morning observation logged reduced feed intake and lower activity index (78 vs 164 baseline).',
      status: 'Unread',
      reviewNotes: '',
      dedupeKey: 'health-C-103',
    },
    {
      id: 'ALT-5',
      title: 'Unusual Activity Drop — C-103 (Kaveri)',
      category: 'Unusual Activity',
      cowId: 'C-103',
      timestamp: isoHoursAgo(2),
      severity: 'Warning',
      explanation: 'Activity index 78 is 52% below baseline (164). Demo reading flagged for inspection.',
      status: 'Unread',
      reviewNotes: '',
      dedupeKey: `act-unusual-C-103-${today}`,
    },
  ];

  return {
    version: '2.0.0',
    isDemoData: true,
    cows,
    milkRecords,
    unusualMilkReviews,
    healthRecords,
    activityReadings,
    treatments,
    safetyEvents,
    environmentReadings,
    waterReadings,
    pumpLogs,
    hardwareState: {
      mode: 'Demo Mode',
      connectionStatus: 'Disconnected',
      lastReadingTimestamp: environmentReadings[environmentReadings.length - 1].timestamp,
      serialPortLabel: null,
      pumpCommandedState: 'OFF',
      pumpMode: 'AUTO',
      fanEnabled: false,
      fanMode: 'MANUAL',
      diverterServoAngle: 0,
      sensors: {
        dht11Connected: false,
        ultrasonicConnected: false,
        rfidConnected: false,
        mpu6050Connected: false,
        pumpRelayConnected: false,
        fanRelayConfigured: false,
        servoDiverterConnected: false,
        lcdConnected: false,
        ledsConnected: false,
        buzzerConnected: false,
      },
      buzzerRules: {
        lowWaterWarning: true,
        highTemperatureWarning: true,
        hardwareFailureWarning: true,
      },
    },
    hardwareLogs: [
      {
        id: 'HWL-1',
        timestamp: isoHoursAgo(1),
        source: 'System Boot',
        message: 'Initialized in Demo Mode. Physical Arduino Uno USB serial not connected.',
        severity: 'info',
      },
    ],
    alerts,
    timeline: [
      {
        id: 'TL-1',
        timestamp: isoHoursAgo(2),
        module: 'Milk Production',
        summary: 'Morning & evening milk totals logged; unusual yield drop flagged for C-103.',
        cowId: 'C-103',
      },
      {
        id: 'TL-2',
        timestamp: isoHoursAgo(3.5),
        module: 'Milk Safety',
        summary: 'Fail-safe diverted C-107 milk due to incomplete treatment record TR-202.',
        cowId: 'C-107',
      },
      {
        id: 'TL-3',
        timestamp: isoHoursAgo(5.5),
        module: 'Milk Safety',
        summary: 'C-104 milk diverted due to active withdrawal period.',
        cowId: 'C-104',
      },
      {
        id: 'TL-4',
        timestamp: isoHoursAgo(6),
        module: 'Water Management',
        summary: 'Auto pump command OFF issued after demo tank reached 86%.',
      },
    ],
    settings: { ...DEFAULT_SETTINGS },
  };
}
