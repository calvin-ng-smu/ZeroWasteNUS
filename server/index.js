import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import crypto from 'crypto';
import { MongoClient } from 'mongodb';
import { appData as seedAppData, vendorDrillDownData as seedVendorDrillDownData, studentData as seedStudentData } from '../src/data.js';

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zerowaste';

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(MONGODB_URI, {
  serverSelectionTimeoutMS: 1500,
  connectTimeoutMS: 1500
});
let dbPromise;
let mongoDisabled = false;

const inMemoryCollections = new Map();

const getInMemoryCollection = (name) => {
  if (!inMemoryCollections.has(name)) {
    inMemoryCollections.set(name, []);
  }
  const data = inMemoryCollections.get(name);

  return {
    find: () => ({
      toArray: async () => deepClone(data)
    }),
    findOne: async (filter) => {
      if (!filter || typeof filter !== 'object') return null;
      const entries = data.filter((doc) => {
        return Object.entries(filter).every(([key, value]) => doc?.[key] === value);
      });
      return entries.length ? deepClone(entries[0]) : null;
    },
    insertOne: async (doc) => {
      data.push(deepClone(doc));
      return { acknowledged: true };
    },
    insertMany: async (docs) => {
      for (const doc of docs) {
        data.push(deepClone(doc));
      }
      return { acknowledged: true };
    },
    deleteMany: async () => {
      data.length = 0;
      return { acknowledged: true, deletedCount: 0 };
    },
    replaceOne: async (filter, replacement) => {
      if (!filter || typeof filter !== 'object') {
        data.push(deepClone(replacement));
        return { acknowledged: true, modifiedCount: 0, upsertedCount: 1 };
      }

      const index = data.findIndex((doc) => {
        return Object.entries(filter).every(([key, value]) => doc?.[key] === value);
      });

      if (index === -1) {
        data.push(deepClone(replacement));
        return { acknowledged: true, modifiedCount: 0, upsertedCount: 1 };
      }

      data[index] = deepClone(replacement);
      return { acknowledged: true, modifiedCount: 1, upsertedCount: 0 };
    },
    updateOne: async (filter, update) => {
      const index = data.findIndex((doc) => {
        return Object.entries(filter || {}).every(([key, value]) => doc?.[key] === value);
      });
      if (index === -1) {
        return { acknowledged: true, matchedCount: 0, modifiedCount: 0 };
      }
      const set = update?.$set && typeof update.$set === 'object' ? update.$set : {};
      data[index] = { ...deepClone(data[index]), ...deepClone(set) };
      return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
    }
  };
};

const getDb = () => {
  if (mongoDisabled) {
    return Promise.resolve(null);
  }
  if (!dbPromise) {
    dbPromise = client.connect()
      .then(() => client.db())
      .catch((error) => {
        console.warn('MongoDB unavailable; falling back to in-memory store.', error?.message || error);
        mongoDisabled = true;
        return null;
      });
  }
  return dbPromise;
};

const getCollection = async (name) => {
  const db = await getDb();
  const memory = getInMemoryCollection(name);
  if (!db || mongoDisabled) {
    return memory;
  }

  const mongo = db.collection(name);
  const disableMongoAndFallback = (error) => {
    mongoDisabled = true;
    dbPromise = null;
    console.warn('MongoDB operation failed; switching to in-memory store.', error?.message || error);
  };

  return {
    find: (...args) => {
      try {
        const cursor = mongo.find(...args);
        return {
          toArray: async () => {
            try {
              return await cursor.toArray();
            } catch (error) {
              disableMongoAndFallback(error);
              return await memory.find(...args).toArray();
            }
          }
        };
      } catch (error) {
        disableMongoAndFallback(error);
        return memory.find(...args);
      }
    },
    findOne: async (...args) => {
      try {
        return await mongo.findOne(...args);
      } catch (error) {
        disableMongoAndFallback(error);
        return await memory.findOne(...args);
      }
    },
    insertOne: async (...args) => {
      try {
        return await mongo.insertOne(...args);
      } catch (error) {
        disableMongoAndFallback(error);
        return await memory.insertOne(...args);
      }
    },
    insertMany: async (...args) => {
      try {
        return await mongo.insertMany(...args);
      } catch (error) {
        disableMongoAndFallback(error);
        return await memory.insertMany(...args);
      }
    },
    deleteMany: async (...args) => {
      try {
        return await mongo.deleteMany(...args);
      } catch (error) {
        disableMongoAndFallback(error);
        return await memory.deleteMany(...args);
      }
    },
    replaceOne: async (...args) => {
      try {
        return await mongo.replaceOne(...args);
      } catch (error) {
        disableMongoAndFallback(error);
        return await memory.replaceOne(...args);
      }
    },
    updateOne: async (...args) => {
      try {
        return await mongo.updateOne(...args);
      } catch (error) {
        disableMongoAndFallback(error);
        return await memory.updateOne(...args);
      }
    },
  };
};

const deepClone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};


const SEED_VERSION = '2026-04-02-v8';

const buildSeedDashboard = () => ({
  seedVersion: SEED_VERSION,
  appData: deepClone(seedAppData),
  vendorDrillDownData: deepClone(seedVendorDrillDownData),
  studentData: deepClone(seedStudentData)
});

const stripId = ({ _id, ...rest }) => rest;

const ensureSeedDashboard = async () => {
  const dashboards = await getCollection('dashboards');
  const existing = await dashboards.findOne({ _id: 'seed' });

  const seed = {
    _id: 'seed',
    ...buildSeedDashboard(),
    updatedAt: new Date()
  };

  // If the seed changes (new baseline), reset stored docs so the UI immediately reflects it.
  if (existing && existing.seedVersion === SEED_VERSION) {
    return existing;
  }

  await dashboards.replaceOne({ _id: 'seed' }, seed, { upsert: true });

  // Clear historical events so the new baseline isn't skewed by old simulation.
  const transactions = await getCollection('transactions');
  const cupEvents = await getCollection('cup_events');
  if (typeof transactions.deleteMany === 'function') {
    await transactions.deleteMany({});
  }
  if (typeof cupEvents.deleteMany === 'function') {
    await cupEvents.deleteMany({});
  }

  return seed;
};

const parseCount = (value) => Number(String(value).replace(/[^\d]/g, '')) || 0;
const formatCount = (value) => Math.max(0, Math.round(value)).toLocaleString('en-US');
const parseMoney = (value) => Number(String(value).replace(/[^0-9.]/g, '')) || 0;
const formatMoney = (value) => `$${value.toFixed(2)}`;

const normalizeTransaction = (payload) => {
  const cupMode = payload?.cup_mode;
  const outletId = payload?.outlet_id;
  const stallId = payload?.stall_id || null;
  const campusZone = payload?.campus_zone || null;
  const channel = payload?.channel || 'walk-up';
  const drinkCategory = payload?.drink_category || null;
  const price = typeof payload?.price === 'number' ? payload.price : null;
  const disposableFeeApplied = payload?.disposable_fee_applied ?? null;
  const incentiveApplied = payload?.incentive_applied ?? null;
  const userHash = payload?.user_hash || null;
  const timestamp = payload?.timestamp ? new Date(payload.timestamp) : new Date();

  const validCupModes = new Set(['disposable', 'BYO', 'rental']);

  if (!outletId) return { error: 'outlet_id is required.' };
  if (!campusZone) return { error: 'campus_zone is required.' };
  if (!cupMode || !validCupModes.has(cupMode)) {
    return { error: 'cup_mode must be one of "disposable", "BYO", "rental".' };
  }

  return {
    timestamp,
    outlet_id: outletId,
    stall_id: stallId,
    campus_zone: campusZone,
    channel,
    cup_mode: cupMode,
    drink_category: drinkCategory,
    price,
    disposable_fee_applied: disposableFeeApplied,
    incentive_applied: incentiveApplied,
    user_hash: userHash
  };
};

const recomputeShareFromTrend = (macro, cutoffIndex) => {
  if (!macro?.trend?.length) return;

  const cutoff = clampInt(cutoffIndex ?? (macro.trend.length - 1), 0, macro.trend.length - 1);
  const totals = macro.trend.reduce(
    (acc, row, idx) => {
      if (idx > cutoff) return acc;

      const personal = Number(row.personal);
      const rental = Number(row.rental);
      const disposable = Number(row.disposable);

      acc.personal += Number.isFinite(personal) ? personal : 0;
      acc.rental += Number.isFinite(rental) ? rental : 0;
      acc.disposable += Number.isFinite(disposable) ? disposable : 0;
      return acc;
    },
    { personal: 0, rental: 0, disposable: 0 }
  );

  const grand = totals.personal + totals.rental + totals.disposable;
  if (grand <= 0) return;

  macro.shareCounts = {
    byo: Math.max(0, Math.round(totals.personal)),
    rental: Math.max(0, Math.round(totals.rental)),
    disposable: Math.max(0, Math.round(totals.disposable))
  };

  // For the donut chart, use summed weekly counts (not percentages).
  macro.share = [
    { name: 'Personal BYO', value: macro.shareCounts.byo },
    { name: 'Campus Rental', value: macro.shareCounts.rental },
    { name: 'Single-Use', value: macro.shareCounts.disposable }
  ];

  const reusePercent = ((totals.personal + totals.rental) / grand) * 100;
  macro.kpis.reuse = `${reusePercent.toFixed(1)}%`;
};

const setRentalKpiFromTrend = (macro, cutoffIndex) => {
  if (!macro?.kpis || !Array.isArray(macro.trend) || macro.trend.length === 0) return;
  const idx = clampInt(cutoffIndex ?? (macro.trend.length - 1), 0, macro.trend.length - 1);
  const row = macro.trend[idx];
  const rental = Number(row?.rental);
  if (!Number.isFinite(rental)) return;
  macro.kpis.rental = formatCount(rental);
};

const distributeByWeights = (total, weights) => {
  const normalizedTotal = clampInt(total, 0, Number.MAX_SAFE_INTEGER);
  const safeWeights = Array.isArray(weights) && weights.length ? weights.map((w) => Math.max(0, Number(w) || 0)) : [1];
  const sum = safeWeights.reduce((acc, w) => acc + w, 0) || 1;
  const raw = safeWeights.map((w) => (w / sum) * normalizedTotal);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = normalizedTotal - floored.reduce((acc, v) => acc + v, 0);

  const order = raw
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    floored[order[i].idx] += 1;
    remainder -= 1;
  }

  return floored;
};

const recomputeVendorsAndDrillDownFromTrendWeek = (dashboard, macro, cutoffIndex) => {
  const timeframe = 'week';
  if (!macro?.trend?.length || !Array.isArray(macro.vendor) || macro.vendor.length === 0) return;
  if (!dashboard?.vendorDrillDownData?.[timeframe]) return;

  const cutoff = clampInt(cutoffIndex ?? (macro.trend.length - 1), 0, macro.trend.length - 1);
  const dayLabels = macro.trend.map((row) => row.time).filter(Boolean);

  // Model 9 foodcourts total, even if only 4 are displayed.
  // IMPORTANT: The 4 displayed vendors should represent <= 40% of campus adoption.
  // Remaining 60% is attributed to the 5 undisplayed foodcourts.
  // First 4 weights sum to ~39.2% (slightly under 40%) to keep "<= 40%" true even after integer rounding.
  const vendorWeights9 = [0.118, 0.108, 0.088, 0.078, 0.135, 0.125, 0.123, 0.112, 0.113];
  const displayedCount = Math.min(macro.vendor.length, vendorWeights9.length);

  // Build per-vendor daily series from per-day campus totals.
  const perVendorDaily = {};
  for (let i = 0; i < displayedCount; i += 1) {
    const name = macro.vendor[i].name;
    perVendorDaily[name] = [];
  }

  for (let dayIdx = 0; dayIdx < macro.trend.length; dayIdx += 1) {
    const row = macro.trend[dayIdx];
    const time = dayLabels[dayIdx] || row.time || `Day ${dayIdx + 1}`;

    // Mirror campus chart behavior: buckets after cutoff are empty.
    if (dayIdx > cutoff) {
      for (let i = 0; i < displayedCount; i += 1) {
        perVendorDaily[macro.vendor[i].name].push({ time, byo: null, rental: null, disposable: null });
      }
      continue;
    }

    const campusByo = Number(row.personal);
    const campusRental = Number(row.rental);
    const campusDisposable = Number(row.disposable);

    const distributedByo = distributeByWeights(Number.isFinite(campusByo) ? campusByo : 0, vendorWeights9);
    const distributedRental = distributeByWeights(Number.isFinite(campusRental) ? campusRental : 0, vendorWeights9);
    const distributedDisposable = distributeByWeights(Number.isFinite(campusDisposable) ? campusDisposable : 0, vendorWeights9);

    for (let i = 0; i < displayedCount; i += 1) {
      const vendorName = macro.vendor[i].name;
      perVendorDaily[vendorName].push({
        time,
        byo: distributedByo[i] || 0,
        rental: distributedRental[i] || 0,
        disposable: distributedDisposable[i] || 0
      });
    }
  }

  // Set vendor adoption totals as sums of the daily series, ensuring consistency.
  for (let i = 0; i < displayedCount; i += 1) {
    const vendorName = macro.vendor[i].name;
    const series = perVendorDaily[vendorName] || [];
    const sums = series.reduce(
      (acc, r) => {
        acc.byo += Number(r.byo) || 0;
        acc.rental += Number(r.rental) || 0;
        acc.disposable += Number(r.disposable) || 0;
        return acc;
      },
      { byo: 0, rental: 0, disposable: 0 }
    );

    macro.vendor[i].byo = Math.round(sums.byo);
    macro.vendor[i].rental = Math.round(sums.rental);
    macro.vendor[i].disposable = Math.round(sums.disposable);

    // And publish the drill-down series.
    dashboard.vendorDrillDownData[timeframe][vendorName] = series;
  }
};

const updateCarbon = (macro, type, amount) => {
  if (type === 'disposable') return;
  const current = parseFloat(String(macro.kpis.carbon).replace(/[^\d.]/g, '')) || 0;
  const next = current + amount * 0.0003;
  macro.kpis.carbon = `${next.toFixed(1)} Tons`;
};

const updateStudentKpis = (student, type, amount) => {
  const currentSaved = parseMoney(student.kpis.saved);
  const currentPoints = parseCount(student.kpis.points);
  const currentDiverted = parseCount(student.kpis.diverted);

  let saved = currentSaved;
  let points = currentPoints;
  let diverted = currentDiverted;

  if (type === 'byo') {
    saved += amount * 0.5;
    points += amount * 10;
    diverted += amount;
  }
  if (type === 'rental') {
    saved += amount * 0.25;
    points += amount * 8;
    diverted += amount;
  }

  student.kpis.saved = formatMoney(saved);
  student.kpis.points = `${Math.max(0, Math.round(points))} pts`;
  student.kpis.diverted = `${Math.max(0, Math.round(diverted))}`;
};

const setReturnCompliance = (macro, issuedCount, returnedCount) => {
  const issued = Math.max(0, Math.trunc(Number(issuedCount) || 0));
  const returned = Math.max(0, Math.trunc(Number(returnedCount) || 0));

  if (issued <= 0) {
    macro.kpis.returnCompliance = returned > 0 ? '100.00%' : '0.00%';
    return;
  }

  const ratio = returned / issued;
  const compliance = Math.max(0, Math.min(1, ratio)) * 100;
  macro.kpis.returnCompliance = `${compliance.toFixed(2)}%`;
};

const deriveDashboardFromSeedAndEvents = (seed, transactions, cupEvents) => {
  const dashboard = deepClone(seed);

  const SINGAPORE_TIMEZONE = 'Asia/Singapore';
  const RESUPPLY_CAPACITY_PER_FOODCOURT = 200;
  const WASH_DURATION_MS = 2 * 60 * 60 * 1000;
  const TRANSIT_BACK_MS = 1 * 60 * 60 * 1000;

  const resolveSingaporeHour = (date) => {
    try {
      const formatted = new Intl.DateTimeFormat('en-SG', {
        timeZone: SINGAPORE_TIMEZONE,
        hour: '2-digit',
        hour12: false,
      }).format(date);
      const hour = Number.parseInt(String(formatted), 10);
      return Number.isFinite(hour) ? hour : date.getHours();
    } catch {
      return date.getHours();
    }
  };

  const resolveSingaporeWeekdayIndex = (date) => {
    try {
      const weekday = new Intl.DateTimeFormat('en-SG', {
        timeZone: SINGAPORE_TIMEZONE,
        weekday: 'short',
      }).format(date);
      const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      const idx = map[String(weekday)] ?? null;
      return Number.isFinite(idx) ? idx : date.getDay();
    } catch {
      return date.getDay();
    }
  };


  // Total campus drink demand per day (for presentation buckets).
  // This is intentionally NOT the same as the reusable cup pool size.
  // Reusable (rental) usage is still capped separately via MAX_REUSABLE_RENTALS.
  const DAILY_TOTAL_PER_BUCKET = 3700;
  const MAX_REUSABLE_RENTALS = 1800;

  // Presentation mode: by default, behave as if today is Thursday.
  // Override with env var:
  // - PRESENTATION_DAY=actual   -> use the real day of week
  // - PRESENTATION_DAY=<0..6>   -> explicit JS weekday (0=Sun..6=Sat)
  const resolvePresentationWeekday = (now) => {
    const configured = process.env.PRESENTATION_DAY;
    if (!configured) return 4; // Thu

    if (String(configured).trim().toLowerCase() === 'actual') {
      return resolveSingaporeWeekdayIndex(now);
    }

    const parsed = Number(configured);
    if (Number.isFinite(parsed)) {
      return clampInt(parsed, 0, 6);
    }

    return 4;
  };

  const resolvePresentationCutoffIndex = (now, trendLength) => {
    const safeLength = Math.max(1, Math.trunc(Number(trendLength) || 1));
    const weekday = resolvePresentationWeekday(now);
    // Map JS weekday -> index in our chart buckets (Mon=0..Sun=6).
    const idx = weekday === 0 ? 6 : weekday - 1;
    return clampInt(idx, 0, safeLength - 1);
  };

  const resolveWeeklyBucketIndex = (timestamp, macro) => {
    const buckets = macro?.trend;
    if (!Array.isArray(buckets) || buckets.length === 0) return 0;

    const date = timestamp instanceof Date ? timestamp : new Date(timestamp);
    const day = resolveSingaporeWeekdayIndex(date);
    // JS: 0=Sun ... 6=Sat. Our chart buckets are Mon..Fri.
    if (day === 0 || day === 6) return buckets.length - 1;
    return Math.min(buckets.length - 1, Math.max(0, day - 1));
  };

  const applyWeeklyShift = (row, type, amount) => {
    if (!row || typeof row !== 'object') return;

    let personal = Math.max(0, Math.trunc(Number(row.personal) || 0));
    let rental = Math.max(0, Math.trunc(Number(row.rental) || 0));
    let disposable = Math.max(0, Math.trunc(Number(row.disposable) || 0));

    let delta = Math.max(0, Math.trunc(Number(amount) || 0));
    if (!delta) return;

    // If we add to a bucket, subtract from the others so the total stays fixed.
    if (type === 'byo') {
      const takeFromDisposable = Math.min(disposable, delta);
      disposable -= takeFromDisposable;
      delta -= takeFromDisposable;

      if (delta > 0) {
        const takeFromRental = Math.min(rental, delta);
        rental -= takeFromRental;
        delta -= takeFromRental;
      }

      personal += Math.max(0, Math.trunc(Number(amount) || 0)) - delta;
    } else if (type === 'rental') {
      const takeFromDisposable = Math.min(disposable, delta);
      disposable -= takeFromDisposable;
      delta -= takeFromDisposable;

      if (delta > 0) {
        const takeFromPersonal = Math.min(personal, delta);
        personal -= takeFromPersonal;
        delta -= takeFromPersonal;
      }

      rental += Math.max(0, Math.trunc(Number(amount) || 0)) - delta;
    } else if (type === 'disposable') {
      const takeFromPersonal = Math.min(personal, delta);
      personal -= takeFromPersonal;
      delta -= takeFromPersonal;

      if (delta > 0) {
        const takeFromRental = Math.min(rental, delta);
        rental -= takeFromRental;
        delta -= takeFromRental;
      }

      disposable += Math.max(0, Math.trunc(Number(amount) || 0)) - delta;
    }

    // Enforce reusable cup pool cap.
    rental = Math.min(MAX_REUSABLE_RENTALS, rental);

    // Exact fix-up to guarantee total.
    const reuse = personal + rental;
    if (reuse >= DAILY_TOTAL_PER_BUCKET) {
      // If reuse exceeds the total demand, cap it and set SUC to 0.
      const overflow = reuse - DAILY_TOTAL_PER_BUCKET;
      // Remove overflow from the bigger reuse bucket first.
      if (personal >= rental) {
        personal = Math.max(0, personal - overflow);
      } else {
        rental = Math.max(0, rental - overflow);
      }
      disposable = 0;
    } else {
      disposable = DAILY_TOTAL_PER_BUCKET - reuse;
    }

    row.personal = personal;
    row.rental = rental;
    row.disposable = disposable;
  };

  const normalizeTrendRowToTotal = (row, total) => {
    if (!row || typeof row !== 'object') return;

    let personal = Math.max(0, Math.trunc(Number(row.personal) || 0));
    let rental = Math.max(0, Math.trunc(Number(row.rental) || 0));
    let disposable = Math.max(0, Math.trunc(Number(row.disposable) || 0));

    let currentTotal = personal + rental + disposable;
    if (currentTotal === total) {
      row.personal = personal;
      row.rental = rental;
      row.disposable = disposable;
      return;
    }

    // Keep total demand fixed by balancing primarily through disposable cups.
    if (currentTotal > total) {
      let overflow = currentTotal - total;
      const takeDisposable = Math.min(disposable, overflow);
      disposable -= takeDisposable;
      overflow -= takeDisposable;

      if (overflow > 0) {
        const takeRental = Math.min(rental, overflow);
        rental -= takeRental;
        overflow -= takeRental;
      }

      if (overflow > 0) {
        const takePersonal = Math.min(personal, overflow);
        personal -= takePersonal;
        overflow -= takePersonal;
      }
    } else {
      // Fill any gap into disposable to hit the fixed total.
      disposable += total - currentTotal;
    }

    // Enforce reusable cup pool cap.
    rental = Math.min(MAX_REUSABLE_RENTALS, rental);

    row.personal = personal;
    row.rental = rental;
    row.disposable = disposable;
  };

  const classifyTimeframe = (timestamp, now) => {
    const msDiff = now - timestamp;
    const days = msDiff / (1000 * 60 * 60 * 24);
    if (days <= 7) return 'week';
    if (days <= 31) return 'month';
    return null;
  };

  const now = new Date();

  // Time-of-day modeling for "today" (cutoff day).
  // We assume campus activity window is 8AM–8PM (12 buckets).
  const ACTIVITY_START_HOUR = 8;
  const ACTIVITY_END_HOUR_EXCLUSIVE = 20;
  const ACTIVITY_BUCKETS = ACTIVITY_END_HOUR_EXCLUSIVE - ACTIVITY_START_HOUR; // 12

  const resolveElapsedBucketsToday = () => {
    const hour = resolveSingaporeHour(now);
    if (hour < ACTIVITY_START_HOUR) return 0;
    if (hour >= ACTIVITY_END_HOUR_EXCLUSIVE) return ACTIVITY_BUCKETS;
    // Include the current hour bucket.
    return clampInt(hour - ACTIVITY_START_HOUR + 1, 0, ACTIVITY_BUCKETS);
  };

  // Return compliance should reflect current operations, not be dominated by historical simulation.
  // Use a rolling window so it converges quickly.
  const COMPLIANCE_WINDOW_MS = 24 * 60 * 60 * 1000;

  const rentalCounters = {
    week: { issued: 0, returned: 0 },
    month: { issued: 0, returned: 0 }
  };

  const weeklyMacro = dashboard.appData?.week;
  const weeklyCutoffIndex = weeklyMacro?.trend?.length
    ? resolvePresentationCutoffIndex(now, weeklyMacro.trend.length)
    : 0;

  // ----------------------------------------------
  // Foodcourt logistics (today): partition 200 cups
  // ----------------------------------------------
  const foodcourtNames = Array.isArray(seedAppData?.week?.vendor)
    ? seedAppData.week.vendor.map((v) => v?.name).filter(Boolean)
    : [];
  const foodcourts = foodcourtNames.length ? foodcourtNames : ['Frontier', 'UTown', 'Deck', 'Techno'];

  const totalIssuedByFoodcourt = Object.fromEntries(foodcourts.map((name) => [name, 0]));
  const totalReturnedByFoodcourt = Object.fromEntries(foodcourts.map((name) => [name, 0]));
  const inWashByFoodcourt = Object.fromEntries(foodcourts.map((name) => [name, 0]));
  const comingBackByFoodcourt = Object.fromEntries(foodcourts.map((name) => [name, 0]));

  const normalizeEventTypeLocal = (value) => String(value || '').trim().toLowerCase();

  for (const tx of transactions) {
    if (!tx) continue;
    const outlet = String(tx.outlet_id || '').trim();
    if (!outlet || !(outlet in totalIssuedByFoodcourt)) continue;
    if (tx.cup_mode !== 'rental') continue;

    const amount = Math.max(1, Math.trunc(Number(tx.amount) || 1));
    totalIssuedByFoodcourt[outlet] += amount;
  }

  for (const event of cupEvents) {
    if (!event) continue;

    const normalized = normalizeEventTypeLocal(event.event_type);
    const isReturn = ['returned', 'return', 'checkin', 'checked_in', 'dropoff', 'dropped_off'].includes(normalized);
    if (!isReturn) continue;

    const location = String(event.location_id || '').trim();
    if (!location || !(location in totalReturnedByFoodcourt)) continue;

    const ts = event.timestamp ? new Date(event.timestamp) : null;
    if (!ts || Number.isNaN(ts.getTime())) continue;

    totalReturnedByFoodcourt[location] += 1;

    const ageMs = now - ts;
    if (ageMs < WASH_DURATION_MS) {
      inWashByFoodcourt[location] += 1;
    } else if (ageMs < WASH_DURATION_MS + TRANSIT_BACK_MS) {
      comingBackByFoodcourt[location] += 1;
    }
  }

  const todayLabel = weeklyMacro?.trend?.[weeklyCutoffIndex]?.time || null;
  dashboard.foodcourtLogistics = {
    todayLabel,
    capacity: RESUPPLY_CAPACITY_PER_FOODCOURT,
    rows: foodcourts.map((name) => {
      const issuedAll = Math.max(0, Math.trunc(Number(totalIssuedByFoodcourt[name]) || 0));
      const returnedAll = Math.max(0, Math.trunc(Number(totalReturnedByFoodcourt[name]) || 0));

      let rentedOut = Math.max(0, issuedAll - returnedAll);
      let returnedPending = Math.max(0, Math.trunc(Number(inWashByFoodcourt[name]) || 0));
      let comingBack = Math.max(0, Math.trunc(Number(comingBackByFoodcourt[name]) || 0));

      // Ensure the 4 parts sum to at most 200.
      const cap = RESUPPLY_CAPACITY_PER_FOODCOURT;
      if (returnedPending + comingBack > cap) {
        returnedPending = Math.min(returnedPending, cap);
        comingBack = Math.max(0, cap - returnedPending);
      }

      if (rentedOut > cap - returnedPending - comingBack) {
        rentedOut = Math.max(0, cap - returnedPending - comingBack);
      }

      const inStock = cap - rentedOut - returnedPending - comingBack;

      return {
        name,
        returnedToday: returnedPending,
        rentedOut,
        comingBack,
        inStock: Math.max(0, inStock),
      };
    })
  };

  const mapCupModeToType = (cupMode) => {
    if (!cupMode) return null;
    if (cupMode === 'BYO') return 'byo';
    if (cupMode === 'rental') return 'rental';
    if (cupMode === 'disposable') return 'disposable';
    return null;
  };

  for (const tx of transactions) {
    const timeframe = classifyTimeframe(new Date(tx.timestamp), now);
    if (!timeframe) continue;

    const txTime = new Date(tx.timestamp);
    const inComplianceWindow = now - txTime <= COMPLIANCE_WINDOW_MS;
    const type = mapCupModeToType(tx.cup_mode);
    if (!type) continue;

    const amount = Math.max(1, Math.trunc(Number(tx.amount) || 1));

    const macro = dashboard.appData?.[timeframe];
    if (!macro) continue;

    const bucketIndex = timeframe === 'week'
      ? clampInt(tx.bucket_index ?? tx.bucketIndex ?? resolveWeeklyBucketIndex(new Date(tx.timestamp), macro), 0, macro.trend.length - 1)
      : macro.trend.length - 1;
    const macroTrend = macro.trend[bucketIndex];
    const student = dashboard.studentData?.[timeframe];
    const studentLast = student?.chart?.[student.chart.length - 1];

    if (!macroTrend || !studentLast) continue;

    if (timeframe === 'week') {
      // Ignore future buckets (after the presentation cutoff).
      if (bucketIndex > weeklyCutoffIndex) continue;
      applyWeeklyShift(macroTrend, type, amount);
    } else {
      const macroKey = type === 'byo' ? 'personal' : type;
      macroTrend[macroKey] = (macroTrend[macroKey] || 0) + amount;
    }

    studentLast[type] = (studentLast[type] || 0) + amount;

    if (type === 'rental') {
      if (inComplianceWindow && rentalCounters[timeframe]) rentalCounters[timeframe].issued += amount;
      macro.kpis.rental = formatCount(Math.min(1800, parseCount(macro.kpis.rental) + amount));
    }
    if (type === 'disposable') {
      macro.kpis.disp = formatCount(parseCount(macro.kpis.disp) + amount);
    }

    updateCarbon(macro, type, amount);
    updateStudentKpis(student, type, amount);
  }


  const normalizeEventType = (value) => String(value || '').trim().toLowerCase();
  const mapCupEventToRentalDelta = (eventType) => {
    const normalized = normalizeEventType(eventType);
    if (!normalized) return 0;

    // Increase active rentals when a cup is issued/checked out.
    if (['issued', 'issue', 'rent', 'rented', 'checkout', 'checked_out', 'loaned'].includes(normalized)) return 1;

    // Decrease active rentals when a cup is returned/checked in.
    if (['returned', 'return', 'checkin', 'checked_in', 'dropoff', 'dropped_off'].includes(normalized)) return -1;

    return 0;
  };

  for (const event of cupEvents) {
    const timeframe = classifyTimeframe(new Date(event.timestamp), now);
    if (!timeframe) continue;

    const eventTime = new Date(event.timestamp);
    const inComplianceWindow = now - eventTime <= COMPLIANCE_WINDOW_MS;

    const macro = dashboard.appData?.[timeframe];
    if (!macro) continue;

    const delta = mapCupEventToRentalDelta(event.event_type);
    if (!delta) continue;

    // Only use returns for compliance. "Active Rental Cups" is derived from the trend bucket.
    if (inComplianceWindow && delta < 0 && rentalCounters[timeframe]) {
      rentalCounters[timeframe].returned += Math.abs(delta);
    }
  }

  // Weekly-only UX:
  // - Up to cutoff day: keep each bucket at exactly 1,800 total cups.
  // - After cutoff day: show empty buckets.
  if (weeklyMacro?.trend?.length) {
    const elapsedBucketsToday = resolveElapsedBucketsToday();
    const todayTotal = clampInt(Math.round((DAILY_TOTAL_PER_BUCKET * elapsedBucketsToday) / ACTIVITY_BUCKETS), 0, DAILY_TOTAL_PER_BUCKET);

    const distributeProportionally = (total, parts) => {
      const safeTotal = Math.max(0, Math.trunc(Number(total) || 0));
      const safeParts = Array.isArray(parts)
        ? parts.map((p) => Math.max(0, Math.trunc(Number(p) || 0)))
        : [];
      const sum = safeParts.reduce((acc, p) => acc + p, 0);
      if (!safeParts.length) return [];
      if (sum <= 0) {
        const base = new Array(safeParts.length).fill(0);
        base[base.length - 1] = safeTotal;
        return base;
      }

      const raw = safeParts.map((p) => (safeTotal * p) / sum);
      const floored = raw.map((v) => Math.floor(v));
      let remainder = safeTotal - floored.reduce((acc, v) => acc + v, 0);
      const order = raw
        .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
        .sort((a, b) => b.frac - a.frac);

      for (let i = 0; i < order.length && remainder > 0; i += 1) {
        floored[order[i].idx] += 1;
        remainder -= 1;
      }
      return floored;
    };

    for (let i = 0; i < weeklyMacro.trend.length; i += 1) {
      const row = weeklyMacro.trend[i];
      if (i > weeklyCutoffIndex) {
        row.personal = null;
        row.rental = null;
        row.disposable = null;
        continue;
      }

      if (i === weeklyCutoffIndex) {
        // First, ensure the cutoff day represents a full-day baseline.
        normalizeTrendRowToTotal(row, DAILY_TOTAL_PER_BUCKET);

        // Then, allocate the partial-day total proportionally across the 3 modes.
        const [personal, rental, disposable] = distributeProportionally(todayTotal, [row.personal, row.rental, row.disposable]);

        let cappedRental = Math.min(MAX_REUSABLE_RENTALS, rental);
        let disposableAdjusted = disposable + (rental - cappedRental);

        row.personal = personal;
        row.rental = cappedRental;
        row.disposable = Math.max(0, disposableAdjusted);
      } else {
        normalizeTrendRowToTotal(row, DAILY_TOTAL_PER_BUCKET);
      }
    }
    recomputeShareFromTrend(weeklyMacro, weeklyCutoffIndex);
    // KPI should reflect the current day's (cutoff bucket) campus rentals.
    setRentalKpiFromTrend(weeklyMacro, weeklyCutoffIndex);
    recomputeVendorsAndDrillDownFromTrendWeek(dashboard, weeklyMacro, weeklyCutoffIndex);
  }

  // Month view: compute share from the full trend series.
  if (dashboard.appData?.month?.trend?.length) {
    recomputeShareFromTrend(dashboard.appData.month);
    setRentalKpiFromTrend(dashboard.appData.month);
  }

  // Return compliance: returns / rentals issued for the same timeframe.
  if (dashboard.appData?.week?.kpis) {
    setReturnCompliance(dashboard.appData.week, rentalCounters.week.issued, rentalCounters.week.returned);
  }
  if (dashboard.appData?.month?.kpis) {
    setReturnCompliance(dashboard.appData.month, rentalCounters.month.issued, rentalCounters.month.returned);
  }

  dashboard.updatedAt = now;
  return dashboard;
};

const numberOrZero = (value) => {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return parsed;
};

const clampInt = (value, min = 0, max = Number.MAX_SAFE_INTEGER) => {
  const parsed = Math.trunc(numberOrZero(value));
  return Math.min(max, Math.max(min, parsed));
};

const pickRandom = (items) => items[Math.floor(Math.random() * items.length)];

const distributeAcross = (total, buckets) => {
  const bucketCount = Math.max(1, Math.trunc(buckets));
  const normalizedTotal = clampInt(total, 0, Number.MAX_SAFE_INTEGER);
  if (bucketCount === 1) return [normalizedTotal];
  if (normalizedTotal === 0) return Array.from({ length: bucketCount }, () => 0);

  const weights = Array.from({ length: bucketCount }, () => Math.random());
  const weightSum = weights.reduce((acc, w) => acc + w, 0) || 1;
  const raw = weights.map((w) => (w / weightSum) * normalizedTotal);
  const floored = raw.map((v) => Math.floor(v));
  let remainder = normalizedTotal - floored.reduce((acc, v) => acc + v, 0);

  // Distribute remainder to the biggest fractional parts.
  const order = raw
    .map((v, idx) => ({ idx, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac);

  for (let i = 0; i < order.length && remainder > 0; i += 1) {
    floored[order[i].idx] += 1;
    remainder -= 1;
  }

  return floored;
};

const getSeedVendors = () => {
  const vendors = seedAppData?.week?.vendor?.map((v) => v.name).filter(Boolean);
  return vendors?.length ? vendors : ['Frontier'];
};

app.get('/api/dashboard', async (req, res) => {
  try {
    const [seed, transactions, cupEvents] = await Promise.all([
      ensureSeedDashboard(),
      (await getCollection('transactions')).find({}).toArray(),
      (await getCollection('cup_events')).find({}).toArray()
    ]);

    const dashboard = deriveDashboardFromSeedAndEvents(stripId(seed), transactions, cupEvents);
    res.json(dashboard);
  } catch (error) {
    console.error('Failed to load dashboard', error);
    res.status(500).json({ error: 'Failed to load dashboard data.' });
  }
});

app.post('/api/transactions', async (req, res) => {
  const normalized = normalizeTransaction(req.body);
  if (normalized.error) {
    res.status(400).json({ error: normalized.error });
    return;
  }

  try {
    const transactions = await getCollection('transactions');
    const doc = {
      transaction_id: crypto.randomUUID(),
      ...normalized
    };
    await transactions.insertOne(doc);

    const [seed, allTx, cupEvents] = await Promise.all([
      ensureSeedDashboard(),
      transactions.find({}).toArray(),
      (await getCollection('cup_events')).find({}).toArray()
    ]);

    const dashboard = deriveDashboardFromSeedAndEvents(stripId(seed), allTx, cupEvents);
    res.json(dashboard);
  } catch (error) {
    console.error('Failed to record transaction', error);
    res.status(500).json({ error: 'Failed to record transaction.' });
  }
});

app.post('/api/cup-events', async (req, res) => {
  try {
    const payload = req.body || {};
    const event = {
      event_id: crypto.randomUUID(),
      timestamp: payload.timestamp ? new Date(payload.timestamp) : new Date(),
      cup_id: payload.cup_id,
      event_type: payload.event_type,
      location_id: payload.location_id || null,
      rental_id: payload.rental_id || null,
      condition_flag: payload.condition_flag || null,
      operator_id: payload.operator_id || null
    };

    if (!event.cup_id) {
      res.status(400).json({ error: 'cup_id is required.' });
      return;
    }
    if (!event.event_type) {
      res.status(400).json({ error: 'event_type is required.' });
      return;
    }

    const cupEvents = await getCollection('cup_events');
    await cupEvents.insertOne(event);

    res.status(201).json({ ok: true, event_id: event.event_id });
  } catch (error) {
    console.error('Failed to record cup event', error);
    res.status(500).json({ error: 'Failed to record cup event.' });
  }
});

// Batch simulation endpoint for driving live dashboard updates.
// Accepts either explicit counts or a number of random events.
// Example body:
// { "random_events": 10, "returns": 3 }
// or { "byo": 4, "rental": 3, "disposable": 3, "returns": 2 }
app.post('/api/simulate', async (req, res) => {
  try {
    const payload = req.body || {};
    const randomEvents = clampInt(payload.random_events ?? payload.events ?? 0, 0, 10_000);

    let byo = clampInt(payload.byo ?? 0, 0, 10_000);
    let rental = clampInt(payload.rental ?? 0, 0, 10_000);
    let disposable = clampInt(payload.disposable ?? 0, 0, 10_000);
    const requestedReturns = clampInt(payload.returns ?? payload.returned ?? 0, 0, 10_000);

    if (randomEvents > 0) {
      const modes = ['BYO', 'rental', 'disposable'];
      for (let i = 0; i < randomEvents; i += 1) {
        const choice = pickRandom(modes);
        if (choice === 'BYO') byo += 1;
        if (choice === 'rental') rental += 1;
        if (choice === 'disposable') disposable += 1;
      }
    }

    const totalTransactions = byo + rental + disposable;
    if (totalTransactions === 0 && requestedReturns === 0) {
      res.status(400).json({ error: 'Provide at least one transaction event (byo/rental/disposable) or a return.' });
      return;
    }

    const vendors = Array.isArray(payload.vendors) && payload.vendors.length
      ? payload.vendors.map(String)
      : getSeedVendors();
    const campusZones = Array.isArray(payload.campus_zones) && payload.campus_zones.length
      ? payload.campus_zones.map(String)
      : ['UTown', 'Frontier', 'Deck', 'Techno'];

    const now = new Date();

    const resolveSingaporeWeekdayIndex = (date) => {
      try {
        const weekday = new Intl.DateTimeFormat('en-SG', {
          timeZone: 'Asia/Singapore',
          weekday: 'short',
        }).format(date);
        const map = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
        const idx = map[String(weekday)] ?? null;
        return Number.isFinite(idx) ? idx : date.getDay();
      } catch {
        return date.getDay();
      }
    };

    // Spread simulated activity across the week buckets up to the presentation cutoff.
    // Default cutoff is Thu (Mon..Thu inclusive).
    const weekTrendLength = seedAppData?.week?.trend?.length || 7;
    const presentationWeekday = (() => {
      const configured = process.env.PRESENTATION_DAY;
      if (!configured) return 4;
      if (String(configured).trim().toLowerCase() === 'actual') return resolveSingaporeWeekdayIndex(now);
      const parsed = Number(configured);
      if (Number.isFinite(parsed)) return clampInt(parsed, 0, 6);
      return 4;
    })();
    const presentationCutoffIndex = clampInt(presentationWeekday === 0 ? 6 : presentationWeekday - 1, 0, weekTrendLength - 1);
    const dayBucketCount = Math.max(1, presentationCutoffIndex + 1);

    const transactionsDocs = [];
    const addBatchedTransactions = (count, cupMode) => {
      const perDay = distributeAcross(count, dayBucketCount);
      for (let dayIndex = 0; dayIndex < dayBucketCount; dayIndex += 1) {
        const dayAmount = perDay[dayIndex] || 0;
        if (!dayAmount) continue;

        const perVendor = distributeAcross(dayAmount, vendors.length);
        for (let vendorIndex = 0; vendorIndex < vendors.length; vendorIndex += 1) {
          const amount = perVendor[vendorIndex] || 0;
          if (!amount) continue;

          transactionsDocs.push({
            transaction_id: crypto.randomUUID(),
            timestamp: now,
            outlet_id: vendors[vendorIndex],
            stall_id: null,
            campus_zone: pickRandom(campusZones),
            channel: 'walk-up',
            cup_mode: cupMode,
            bucket_index: dayIndex,
            amount,
            drink_category: null,
            price: null,
            disposable_fee_applied: null,
            incentive_applied: null,
            user_hash: null
          });
        }
      }
    };

    addBatchedTransactions(byo, 'BYO');
    addBatchedTransactions(rental, 'rental');
    addBatchedTransactions(disposable, 'disposable');

    // Ensure simulated returns don't exceed currently-rented-out cups.
    // This keeps the logistics box consistent (carryover rentals from yesterday included).
    const transactions = await getCollection('transactions');
    const cupEvents = await getCollection('cup_events');

    const [existingTx, existingEvents] = await Promise.all([
      transactions.find({}).toArray(),
      cupEvents.find({}).toArray()
    ]);

    const issuedByVendor = Object.fromEntries(vendors.map((v) => [v, 0]));
    const returnedByVendor = Object.fromEntries(vendors.map((v) => [v, 0]));

    for (const tx of existingTx) {
      if (!tx || tx.cup_mode !== 'rental') continue;
      const outlet = String(tx.outlet_id || '').trim();
      if (!outlet || !(outlet in issuedByVendor)) continue;
      const amount = Math.max(1, Math.trunc(Number(tx.amount) || 1));
      issuedByVendor[outlet] += amount;
    }

    const normalizeEventTypeLocal = (value) => String(value || '').trim().toLowerCase();
    const isReturnEvent = (eventType) => {
      const normalized = normalizeEventTypeLocal(eventType);
      return ['returned', 'return', 'checkin', 'checked_in', 'dropoff', 'dropped_off'].includes(normalized);
    };

    for (const event of existingEvents) {
      if (!event || !isReturnEvent(event.event_type)) continue;
      const location = String(event.location_id || '').trim();
      if (!location || !(location in returnedByVendor)) continue;
      returnedByVendor[location] += 1;
    }

    const issuedThisRequestByVendor = Object.fromEntries(vendors.map((v) => [v, 0]));
    for (const doc of transactionsDocs) {
      if (!doc || doc.cup_mode !== 'rental') continue;
      const outlet = String(doc.outlet_id || '').trim();
      if (!outlet || !(outlet in issuedThisRequestByVendor)) continue;
      const amount = Math.max(1, Math.trunc(Number(doc.amount) || 1));
      issuedThisRequestByVendor[outlet] += amount;
    }

    const maxReturnableByVendor = vendors.map((vendor) => {
      const issued = Math.max(0, Math.trunc(Number(issuedByVendor[vendor]) || 0));
      const returned = Math.max(0, Math.trunc(Number(returnedByVendor[vendor]) || 0));
      const outstanding = Math.max(0, issued - returned);
      const plusNew = Math.max(0, Math.trunc(Number(issuedThisRequestByVendor[vendor]) || 0));
      return outstanding + plusNew;
    });

    const totalReturnable = maxReturnableByVendor.reduce((acc, v) => acc + v, 0);
    const effectiveReturns = Math.min(requestedReturns, totalReturnable);
    const returnsPerVendor = distributeByWeights(effectiveReturns, maxReturnableByVendor);

    const cupEventDocs = [];
    for (let vendorIndex = 0; vendorIndex < vendors.length; vendorIndex += 1) {
      const count = Math.max(0, Math.trunc(Number(returnsPerVendor[vendorIndex]) || 0));
      for (let i = 0; i < count; i += 1) {
        const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
        cupEventDocs.push({
          event_id: crypto.randomUUID(),
          timestamp: now,
          cup_id: `SIM-CUP-${suffix}`,
          event_type: 'returned',
          location_id: vendors[vendorIndex],
          rental_id: `SIM-RENTAL-${suffix}`,
          condition_flag: 'ok',
          operator_id: null
        });
      }
    }
    if (transactionsDocs.length) await transactions.insertMany(transactionsDocs);
    if (cupEventDocs.length) await cupEvents.insertMany(cupEventDocs);

    const [seed, allTx, allEvents] = await Promise.all([
      ensureSeedDashboard(),
      transactions.find({}).toArray(),
      cupEvents.find({}).toArray()
    ]);

    const dashboard = deriveDashboardFromSeedAndEvents(stripId(seed), allTx, allEvents);
    res.json(dashboard);
  } catch (error) {
    console.error('Failed to simulate events', error);
    res.status(500).json({
      error: 'Failed to simulate events.',
      details: error?.message || String(error)
    });
  }
});

app.listen(PORT, '127.0.0.1', () => {
  console.log(`ZeroWasteNUS API running on http://127.0.0.1:${PORT}`);
});
