export type PageId =
  | 'overview'
  | 'cows'
  | 'milk'
  | 'health'
  | 'treatments'
  | 'safety'
  | 'environment'
  | 'water'
  | 'hardware'
  | 'assistant'
  | 'alerts'
  | 'reports'
  | 'settings';

export type CowStatus = 'Active' | 'Dry' | 'Under Observation' | 'Archived';

export interface Cow {
  id: string; // e.g. C-101
  name: string;
  rfidTag: string;
  breed: string;
  dateOfBirth: string; // YYYY-MM-DD
  ageYears: number;
  status: CowStatus;
  photoDataUrl?: string;
  lactationNumber: number;
  notes: string;
  requiresHealthInspection: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MilkRecord {
  id: string;
  cowId: string;
  date: string; // YYYY-MM-DD
  morningLitres: number;
  eveningLitres: number;
  additionalLitres: number;
  totalLitres: number;
  notes: string;
  createdAt: string;
  updatedAt: string;
}

export interface MilkBaselineComparison {
  cowId: string;
  latestDate: string;
  currentLitres: number;
  previousAverage: number;
  differenceLitres: number;
  percentDifference: number;
  isUnusual: boolean;
  direction: 'decrease' | 'increase' | 'normal';
}

export interface UnusualMilkReview {
  id: string;
  cowId: string;
  date: string;
  currentLitres: number;
  baselineLitres: number;
  percentDifference: number;
  observations: string;
  resolved: boolean;
  resolvedAt?: string;
}

export type HealthRecordType = 'Observation' | 'Vet Visit' | 'Vaccination';

export interface HealthRecord {
  id: string;
  cowId: string;
  date: string;
  type: HealthRecordType;
  symptoms: string;
  unusualBehaviour: string;
  vetName?: string;
  vaccinationDetails?: string;
  recommendations: string;
  followUpDate?: string;
  requiresInspection: boolean;
  notes: string;
  createdAt: string;
}

export interface ActivityReading {
  id: string;
  cowId: string;
  timestamp: string;
  activityIndex: number; // steps / motion index per hour
  source: 'Manual' | 'Demo' | 'MPU6050';
  notes: string;
}

export type WithdrawalUnit = 'hours' | 'days';

export interface TreatmentRecord {
  id: string;
  cowId: string;
  treatmentName: string;
  medicineName: string;
  startDate: string; // YYYY-MM-DD
  startTime: string; // HH:mm
  veterinarianName: string;
  vetVerificationInfo: string;
  vetVerified: boolean;
  withdrawalDurationValue: number | null; // Must be user/vet entered, never auto-invented
  withdrawalDurationUnit: WithdrawalUnit;
  expectedWithdrawalEndISO: string | null;
  notes: string;
  isComplete: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MilkSafetyStatus =
  | 'Approved by record checks'
  | 'Withdrawal active'
  | 'Unknown cow'
  | 'Missing treatment information'
  | 'Time verification required'
  | 'Hardware unavailable'
  | 'Manual review required';

export type DiversionRoute =
  | 'Main Collection Route'
  | 'Separate Diversion Route'
  | 'Hold / Manual Verification';

export interface MilkSafetyEvent {
  id: string;
  timestamp: string;
  cowId: string | null;
  rfidTag: string;
  status: MilkSafetyStatus;
  route: DiversionRoute;
  reason: string;
  hardwareMode: HardwareMode;
  checkedBy: 'RFID Simulation' | 'Manual Check' | 'RFID Hardware';
}

export interface EnvironmentReading {
  id: string;
  timestamp: string;
  temperatureC: number;
  humidityPercent: number;
  source: 'Demo' | 'Manual Test' | 'DHT11 Live';
}

export interface WaterReading {
  id: string;
  timestamp: string;
  distanceCm: number;
  waterPercent: number;
  estimatedLitres: number;
  source: 'Demo' | 'Manual Test' | 'Ultrasonic Live';
}

export type PumpState = 'ON' | 'OFF';
export type PumpMode = 'AUTO' | 'MANUAL';

export interface PumpActivityLog {
  id: string;
  timestamp: string;
  commandedState: PumpState;
  verifiedState: 'ON' | 'OFF' | 'Unverified (No Flow Sensor)';
  mode: PumpMode;
  success: boolean;
  reason: string;
}

export type HardwareMode = 'Demo Mode' | 'Manual Test Mode' | 'Live Hardware Mode';
export type ConnectionStatus = 'Connected' | 'Disconnected' | 'Stale Data';

export interface HardwareEventLog {
  id: string;
  timestamp: string;
  source: string;
  message: string;
  severity: 'info' | 'warning' | 'error';
}

export interface HardwareState {
  mode: HardwareMode;
  connectionStatus: ConnectionStatus;
  lastReadingTimestamp: string | null;
  serialPortLabel: string | null;
  pumpCommandedState: PumpState;
  pumpMode: PumpMode;
  fanEnabled: boolean;
  fanMode: PumpMode;
  diverterServoAngle: 0 | 90; // 0 = Main Collection, 90 = Separate Diversion
  sensors: {
    dht11Connected: boolean;
    ultrasonicConnected: boolean;
    rfidConnected: boolean;
    mpu6050Connected: boolean;
    pumpRelayConnected: boolean;
    fanRelayConfigured: boolean;
    servoDiverterConnected: boolean;
    lcdConnected: boolean;
    ledsConnected: boolean;
    buzzerConnected: boolean;
  };
  buzzerRules: {
    lowWaterWarning: boolean;
    highTemperatureWarning: boolean;
    hardwareFailureWarning: boolean;
  };
}

export type AlertCategory =
  | 'Unusual Milk Production'
  | 'Unusual Activity'
  | 'Health Inspection Required'
  | 'Active Withdrawal Period'
  | 'Incomplete Treatment Record'
  | 'Unknown RFID'
  | 'High Temperature'
  | 'High Humidity'
  | 'Low Water'
  | 'Pump Command Failure'
  | 'Arduino Disconnected'
  | 'Stale Sensor Readings'
  | 'Milk Diversion Event';

export type AlertSeverity = 'Critical' | 'Warning' | 'Info';
export type AlertStatus = 'Unread' | 'Read' | 'Reviewed' | 'Resolved';

export interface FarmAlert {
  id: string;
  title: string;
  category: AlertCategory;
  cowId?: string;
  deviceId?: string;
  timestamp: string;
  severity: AlertSeverity;
  explanation: string;
  status: AlertStatus;
  reviewNotes: string;
  dedupeKey?: string;
}

export interface ActivityTimelineItem {
  id: string;
  timestamp: string;
  module: string;
  summary: string;
  cowId?: string;
}

export interface FarmSettings {
  farmName: string;
  ownerName: string;
  location: string;
  tankCapacityLitres: number;
  tankHeightCm: number;
  temperatureUnit: 'C' | 'F';
  milkChangeThresholdPercent: number;
  activityChangeThresholdPercent: number;
  highTemperatureThresholdC: number;
  highHumidityThresholdPercent: number;
  lowWaterThresholdPercent: number;
  autoPumpStartBelowPercent: number;
  autoPumpStopAbovePercent: number;
  staleDataTimeoutSeconds: number;
  bridgeUrl: string;
  fanHardwareConfigured: boolean;
  pumpFlowSensorInstalled: boolean;
  physicalIndicatorsEnabled: boolean;
}

export interface FarmDatabase {
  version: string;
  isDemoData: boolean;
  cows: Cow[];
  milkRecords: MilkRecord[];
  unusualMilkReviews: UnusualMilkReview[];
  healthRecords: HealthRecord[];
  activityReadings: ActivityReading[];
  treatments: TreatmentRecord[];
  safetyEvents: MilkSafetyEvent[];
  environmentReadings: EnvironmentReading[];
  waterReadings: WaterReading[];
  pumpLogs: PumpActivityLog[];
  hardwareState: HardwareState;
  hardwareLogs: HardwareEventLog[];
  alerts: FarmAlert[];
  timeline: ActivityTimelineItem[];
  settings: FarmSettings;
}
