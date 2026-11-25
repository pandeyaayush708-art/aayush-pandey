import { FarmDatabase } from '../types/dairy';
import {
  evaluateCowMilkBaseline,
  formatDateTime,
  formatTemp,
  getCowMilkStats,
  getDaysAgoISO,
  getTodayISO,
  isWithdrawalActive,
  round2,
} from '../utils/calculations';

export interface AssistantReply {
  answer: string;
  referencedCowIds: string[];
  disclaimer?: string;
  engine: 'Deterministic Record Engine' | 'Server Gemini Assistant';
}

export function buildCompactFarmContext(db: FarmDatabase) {
  const today = getTodayISO();
  const weekStart = getDaysAgoISO(6);
  const monthStart = getDaysAgoISO(29);
  const nonArchived = db.cows.filter((c) => c.status !== 'Archived');
  const latestEnv = db.environmentReadings[db.environmentReadings.length - 1] || null;
  const latestWater = db.waterReadings[db.waterReadings.length - 1] || null;

  return {
    today,
    farmName: db.settings.farmName,
    thresholds: {
      milkChangePercent: db.settings.milkChangeThresholdPercent,
      highTemperatureC: db.settings.highTemperatureThresholdC,
      highHumidityPercent: db.settings.highHumidityThresholdPercent,
      lowWaterPercent: db.settings.lowWaterThresholdPercent,
    },
    cows: nonArchived.map((c) => {
      const stats = getCowMilkStats(c.id, db.milkRecords);
      const cmp = evaluateCowMilkBaseline(c.id, db.milkRecords, db.settings.milkChangeThresholdPercent);
      return {
        id: c.id,
        name: c.name,
        breed: c.breed,
        status: c.status,
        requiresHealthInspection: c.requiresHealthInspection,
        todayMilkLitres: db.milkRecords.find((r) => r.cowId === c.id && r.date === today)?.totalLitres ?? null,
        avgAllLitres: stats.avgAll,
        avg7DayLitres: stats.avg7Day,
        unusualMilkChange: cmp?.isUnusual ? cmp : null,
      };
    }),
    totals: {
      todayMilkLitres: round2(
        db.milkRecords.filter((r) => r.date === today).reduce((s, r) => s + r.totalLitres, 0)
      ),
      weeklyMilkLitres: round2(
        db.milkRecords.filter((r) => r.date >= weekStart).reduce((s, r) => s + r.totalLitres, 0)
      ),
      monthlyMilkLitres: round2(
        db.milkRecords.filter((r) => r.date >= monthStart).reduce((s, r) => s + r.totalLitres, 0)
      ),
    },
    treatments: db.treatments.map((t) => ({
      id: t.id,
      cowId: t.cowId,
      treatmentName: t.treatmentName,
      medicineName: t.medicineName,
      startDate: t.startDate,
      startTime: t.startTime,
      isComplete: t.isComplete,
      withdrawalActive: isWithdrawalActive(t),
      expectedWithdrawalEndISO: t.expectedWithdrawalEndISO,
    })),
    latestEnvironment: latestEnv,
    latestWater: latestWater,
    pumpCommandedState: db.hardwareState.pumpCommandedState,
    hardwareMode: db.hardwareState.mode,
    alerts: db.alerts.slice(0, 15).map((a) => ({
      title: a.title,
      category: a.category,
      cowId: a.cowId,
      severity: a.severity,
      status: a.status,
      timestamp: a.timestamp,
      explanation: a.explanation,
    })),
  };
}

export function answerFarmQuestion(query: string, db: FarmDatabase): AssistantReply {
  const q = query.trim().toLowerCase();
  const today = getTodayISO();
  const weekStart = getDaysAgoISO(6);
  const cowsById = new Map(db.cows.map((c) => [c.id.toUpperCase(), c]));
  const activeCows = db.cows.filter((c) => c.status !== 'Archived');

  const idMatch = q.match(/c-\d+/i);
  const mentionedCow = idMatch
    ? cowsById.get(idMatch[0].toUpperCase())
    : activeCows.find((c) => q.includes(c.name.toLowerCase()));

  if (!q) {
    return {
      answer: 'Please enter a question about your cows, milk production, treatments, water level, or alerts.',
      referencedCowIds: [],
      engine: 'Deterministic Record Engine',
    };
  }

  // 1. Specific cow query
  if (
    mentionedCow &&
    (q.includes('average') ||
      q.includes('milk') ||
      q.includes('production') ||
      q.includes('about') ||
      q.includes('status'))
  ) {
    const stats = getCowMilkStats(mentionedCow.id, db.milkRecords);
    const activeTr = db.treatments.filter(
      (t) => t.cowId === mentionedCow.id && isWithdrawalActive(t)
    );
    const lines = [
      `Summary for ${mentionedCow.id} (${mentionedCow.name}, ${mentionedCow.breed}, Status: ${mentionedCow.status}):`,
      `• Overall average milk production: ${stats.avgAll} L/day across ${stats.count} recorded day(s).`,
      `• 7-day average: ${stats.avg7Day} L/day | 30-day average: ${stats.avg30Day} L/day.`,
      stats.latest
        ? `• Latest entry (${stats.latest.date}): ${stats.latest.totalLitres} L (Morning ${stats.latest.morningLitres} L + Evening ${stats.latest.eveningLitres} L).`
        : '• No milk production entries recorded yet for this cow.',
      activeTr.length
        ? `• Active withdrawal: ${activeTr[0].medicineName} until ${formatDateTime(
            activeTr[0].expectedWithdrawalEndISO
          )}.`
        : '• No active milk withdrawal records found.',
    ];
    return {
      answer: lines.join('\n'),
      referencedCowIds: [mentionedCow.id],
      disclaimer:
        'Based strictly on recorded farm entries. Always verify animal health with a qualified veterinarian.',
      engine: 'Deterministic Record Engine',
    };
  }

  // 2. Least / lowest or highest milk today
  if (
    q.includes('least milk') ||
    q.includes('lowest milk') ||
    q.includes('most milk') ||
    q.includes('highest milk')
  ) {
    const todayEntries = db.milkRecords.filter((r) => r.date === today);
    if (todayEntries.length === 0) {
      return {
        answer: `No milk production entries have been recorded for today (${today}) yet.`,
        referencedCowIds: [],
        engine: 'Deterministic Record Engine',
      };
    }
    const sorted = [...todayEntries].sort((a, b) => a.totalLitres - b.totalLitres);
    const isHighest = q.includes('most') || q.includes('highest');
    const target = isHighest ? sorted[sorted.length - 1] : sorted[0];
    const cow = cowsById.get(target.cowId.toUpperCase());
    return {
      answer: `On ${today}, ${target.cowId} (${cow?.name || 'Unknown'}) produced the ${
        isHighest ? 'highest' : 'lowest'
      } recorded milk at ${target.totalLitres} L (Morning: ${target.morningLitres} L, Evening: ${
        target.eveningLitres
      } L) out of ${todayEntries.length} recorded cows.`,
      referencedCowIds: [target.cowId],
      engine: 'Deterministic Record Engine',
    };
  }

  // 3. Unusual milk changes
  if (q.includes('unusual') && (q.includes('milk') || q.includes('change') || q.includes('drop'))) {
    const flagged = activeCows
      .map((c) => ({
        cow: c,
        cmp: evaluateCowMilkBaseline(c.id, db.milkRecords, db.settings.milkChangeThresholdPercent),
      }))
      .filter((x) => x.cmp && x.cmp.isUnusual);

    if (flagged.length === 0) {
      return {
        answer: `No cows currently show an unusual milk change exceeding your configured ±${db.settings.milkChangeThresholdPercent}% threshold.`,
        referencedCowIds: [],
        engine: 'Deterministic Record Engine',
      };
    }
    const lines = flagged.map(
      ({ cow, cmp }) =>
        `• ${cow.id} (${cow.name}): ${cmp!.currentLitres} L on ${cmp!.latestDate} vs ${
          cmp!.previousAverage
        } L recent average (${cmp!.percentDifference > 0 ? '+' : ''}${cmp!.percentDifference}%).`
    );
    return {
      answer: `Cows with unusual milk yield changes (±${db.settings.milkChangeThresholdPercent}% threshold):\n${lines.join(
        '\n'
      )}`,
      referencedCowIds: flagged.map((f) => f.cow.id),
      disclaimer:
        'Yield changes alone do not diagnose illness; conduct physical observation and milking checks.',
      engine: 'Deterministic Record Engine',
    };
  }

  // 4. Active treatments / withdrawal
  if (q.includes('treatment') || q.includes('medicine') || q.includes('withdrawal')) {
    const active = db.treatments.filter((t) => isWithdrawalActive(t));
    const incomplete = db.treatments.filter((t) => !t.isComplete);
    const parts: string[] = [];

    if (active.length > 0) {
      parts.push(
        `Active withdrawal records (${active.length}):\n` +
          active
            .map((t) => {
              const c = cowsById.get(t.cowId.toUpperCase());
              return `• ${t.cowId} (${c?.name || 'Unknown'}) — ${t.medicineName}, ends ${formatDateTime(
                t.expectedWithdrawalEndISO
              )}`;
            })
            .join('\n')
      );
    } else {
      parts.push('There are currently no active milk withdrawal periods.');
    }

    if (incomplete.length > 0) {
      parts.push(
        `\nIncomplete treatment records requiring fail-safe diversion (${incomplete.length}):\n` +
          incomplete
            .map((t) => `• ${t.cowId} — ${t.treatmentName} (vet verification/duration missing)`)
            .join('\n')
      );
    }

    return {
      answer: parts.join('\n'),
      referencedCowIds: Array.from(new Set([...active, ...incomplete].map((t) => t.cowId))),
      disclaimer:
        'Record-based withdrawal reminders do not chemically test milk for antibiotic residues.',
      engine: 'Deterministic Record Engine',
    };
  }

  // 5. Health inspection
  if (q.includes('health') || q.includes('inspection') || q.includes('sick') || q.includes('observation')) {
    const flagged = activeCows.filter(
      (c) => c.requiresHealthInspection || c.status === 'Under Observation'
    );
    if (flagged.length === 0) {
      return {
        answer: 'No cows are currently flagged as requiring health inspection.',
        referencedCowIds: [],
        engine: 'Deterministic Record Engine',
      };
    }
    return {
      answer:
        `Cows requiring health inspection (${flagged.length}):\n` +
        flagged
          .map((c) => `• ${c.id} (${c.name}, ${c.breed}) — Status: ${c.status}. ${c.notes}`)
          .join('\n'),
      referencedCowIds: flagged.map((c) => c.id),
      disclaimer:
        'DairyMitra Assistant does not provide veterinary diagnoses. Consult a qualified veterinarian.',
      engine: 'Deterministic Record Engine',
    };
  }

  // 6. Weekly / Monthly / Today farm milk production
  if (q.includes('week') || q.includes('month') || q.includes('total milk') || q.includes('production')) {
    const monthStart = getDaysAgoISO(29);
    const todayTotal = round2(
      db.milkRecords.filter((r) => r.date === today).reduce((s, r) => s + r.totalLitres, 0)
    );
    const weekTotal = round2(
      db.milkRecords.filter((r) => r.date >= weekStart).reduce((s, r) => s + r.totalLitres, 0)
    );
    const monthTotal = round2(
      db.milkRecords.filter((r) => r.date >= monthStart).reduce((s, r) => s + r.totalLitres, 0)
    );
    return {
      answer: `Farm milk production totals:\n• Today (${today}): ${todayTotal} L\n• Last 7 days (${weekStart} to ${today}): ${weekTotal} L\n• Last 30 days (${monthStart} to ${today}): ${monthTotal} L`,
      referencedCowIds: [],
      engine: 'Deterministic Record Engine',
    };
  }

  // 7. Water tank / pump
  if (q.includes('water') || q.includes('tank') || q.includes('pump')) {
    const latestW = db.waterReadings[db.waterReadings.length - 1];
    if (!latestW) {
      return {
        answer: 'No water-level readings are currently recorded.',
        referencedCowIds: [],
        engine: 'Deterministic Record Engine',
      };
    }
    const isLow = latestW.waterPercent <= db.settings.lowWaterThresholdPercent;
    return {
      answer: `Water Tank Status (${latestW.source}):\n• Level: ${latestW.waterPercent}% (${latestW.estimatedLitres} L of ${db.settings.tankCapacityLitres} L capacity)\n• Status: ${
        isLow ? `LOW (below ${db.settings.lowWaterThresholdPercent}% threshold)` : 'Normal'
      }\n• Pump Commanded State: ${db.hardwareState.pumpCommandedState} (${db.hardwareState.pumpMode} mode)\n• Last updated: ${formatDateTime(latestW.timestamp)}`,
      referencedCowIds: [],
      engine: 'Deterministic Record Engine',
    };
  }

  // 8. Temperature / Humidity / Environment
  if (
    q.includes('temp') ||
    q.includes('humid') ||
    q.includes('environment') ||
    q.includes('barn')
  ) {
    const latestEnv = db.environmentReadings[db.environmentReadings.length - 1];
    if (!latestEnv) {
      return {
        answer: 'No environment readings recorded yet.',
        referencedCowIds: [],
        engine: 'Deterministic Record Engine',
      };
    }
    return {
      answer: `Barn Environment (${latestEnv.source}):\n• Temperature: ${formatTemp(
        latestEnv.temperatureC,
        db.settings.temperatureUnit
      )} (Alert threshold: ${formatTemp(
        db.settings.highTemperatureThresholdC,
        db.settings.temperatureUnit
      )})\n• Humidity: ${latestEnv.humidityPercent}% (Alert threshold: ${
        db.settings.highHumidityThresholdPercent
      }%)\n• Recorded at: ${formatDateTime(latestEnv.timestamp)}`,
      referencedCowIds: [],
      engine: 'Deterministic Record Engine',
    };
  }

  // 9. Alerts today
  if (q.includes('alert') || q.includes('warning') || q.includes('problem')) {
    const todayAlerts = db.alerts.filter((a) => a.timestamp.slice(0, 10) === today);
    const unresolved = db.alerts.filter((a) => a.status !== 'Resolved');
    const list = (todayAlerts.length > 0 ? todayAlerts : unresolved).slice(0, 6);
    if (list.length === 0) {
      return {
        answer: 'There are no active or today alerts.',
        referencedCowIds: [],
        engine: 'Deterministic Record Engine',
      };
    }
    return {
      answer:
        `Alerts (${todayAlerts.length} logged today, ${unresolved.length} unresolved total):\n` +
        list
          .map((a) => `• [${a.severity}] ${a.title} (${a.status}) — ${a.explanation}`)
          .join('\n'),
      referencedCowIds: list.map((a) => a.cowId).filter((x): x is string => Boolean(x)),
      engine: 'Deterministic Record Engine',
    };
  }

  // 10. Summarize today's farm performance
  if (
    q.includes('summary') ||
    q.includes('summarise') ||
    q.includes('summarize') ||
    q.includes('performance') ||
    q.includes('overview')
  ) {
    const todayMilk = db.milkRecords.filter((r) => r.date === today);
    const todayTotal = round2(todayMilk.reduce((s, r) => s + r.totalLitres, 0));
    const avgCow = todayMilk.length ? round2(todayTotal / todayMilk.length) : 0;
    const activeWithdrawals = db.treatments.filter((t) => isWithdrawalActive(t));
    const inspCount = activeCows.filter((c) => c.requiresHealthInspection).length;
    const unreadAlerts = db.alerts.filter((a) => a.status === 'Unread').length;
    const latestEnv = db.environmentReadings[db.environmentReadings.length - 1];
    const latestWater = db.waterReadings[db.waterReadings.length - 1];

    return {
      answer: [
        `Daily Farm Summary for ${db.settings.farmName} (${today}):`,
        `• Herd: ${activeCows.length} non-archived cows (${
          activeCows.filter((c) => c.status === 'Active').length
        } Active).`,
        `• Today's Milk: ${todayTotal} L across ${todayMilk.length} cows (avg ${avgCow} L/cow).`,
        `• Health & Treatments: ${inspCount} cow(s) needing health inspection, ${activeWithdrawals.length} active withdrawal(s).`,
        `• Environment & Water: ${
          latestEnv
            ? `${formatTemp(latestEnv.temperatureC, db.settings.temperatureUnit)}, ${
                latestEnv.humidityPercent
              }% RH`
            : 'N/A'
        } | Water tank: ${latestWater ? `${latestWater.waterPercent}%` : 'N/A'} (${
          latestWater?.source || 'N/A'
        }).`,
        `• Alerts: ${unreadAlerts} unread alert(s).`,
      ].join('\n'),
      referencedCowIds: activeWithdrawals.map((t) => t.cowId),
      engine: 'Deterministic Record Engine',
    };
  }

  return {
    answer:
      'I can answer questions directly from your farm records—for example:\n• "Which cow produced the least milk today?"\n• "What is cow C-102\'s average milk production?"\n• "Which cows have unusual milk changes?"\n• "Which cows have active treatments?"\n• "Is the water tank level low?"\n• "Summarise today\'s farm performance."',
    referencedCowIds: [],
    engine: 'Deterministic Record Engine',
  };
}
