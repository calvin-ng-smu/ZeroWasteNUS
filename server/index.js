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

const client = new MongoClient(MONGODB_URI);
let dbPromise;

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
    }
  };
};

const getDb = () => {
  if (!dbPromise) {
    dbPromise = client.connect()
      .then(() => client.db())
      .catch((error) => {
        console.warn('MongoDB unavailable; falling back to in-memory store.', error?.message || error);
        return null;
      });
  }
  return dbPromise;
};

const getCollection = async (name) => {
  const db = await getDb();
  if (!db) {
    return getInMemoryCollection(name);
  }
  return db.collection(name);
};

const deepClone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};


const buildSeedDashboard = () => ({
  appData: deepClone(seedAppData),
  vendorDrillDownData: deepClone(seedVendorDrillDownData),
  studentData: deepClone(seedStudentData)
});

const stripId = ({ _id, ...rest }) => rest;

const ensureSeedDashboard = async () => {
  const dashboards = await getCollection('dashboards');
  const existing = await dashboards.findOne({ _id: 'seed' });
  if (existing) return existing;
  const seed = {
    _id: 'seed',
    ...buildSeedDashboard(),
    updatedAt: new Date()
  };
  await dashboards.insertOne(seed);
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

const ensureShareCounts = (macro) => {
  if (macro.shareCounts) {
    return;
  }
  const [byo = { value: 0 }, rental = { value: 0 }, disposable = { value: 0 }] = macro.share || [];
  macro.shareCounts = {
    byo: Number(byo.value) || 0,
    rental: Number(rental.value) || 0,
    disposable: Number(disposable.value) || 0
  };
};

const updateShareAndReuse = (macro, type, amount) => {
  ensureShareCounts(macro);
  if (type === 'byo') macro.shareCounts.byo += amount;
  if (type === 'rental') macro.shareCounts.rental += amount;
  if (type === 'disposable') macro.shareCounts.disposable += amount;

  const total = macro.shareCounts.byo + macro.shareCounts.rental + macro.shareCounts.disposable;
  if (total <= 0) return;

  const byoPercent = Math.round((macro.shareCounts.byo / total) * 100);
  const rentalPercent = Math.round((macro.shareCounts.rental / total) * 100);
  const disposablePercent = Math.max(0, 100 - byoPercent - rentalPercent);

  macro.share = [
    { name: 'Personal BYO', value: byoPercent },
    { name: 'Campus Rental', value: rentalPercent },
    { name: 'Single-Use', value: disposablePercent }
  ];

  const reusePercent = byoPercent + rentalPercent;
  macro.kpis.reuse = `${reusePercent.toFixed(1)}%`;
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

const deriveDashboardFromSeedAndEvents = (seed, transactions, cupEvents) => {
  const dashboard = deepClone(seed);

  const classifyTimeframe = (timestamp, now) => {
    const msDiff = now - timestamp;
    const days = msDiff / (1000 * 60 * 60 * 24);
    if (days <= 7) return 'week';
    if (days <= 31) return 'month';
    return null;
  };

  const now = new Date();

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
    const type = mapCupModeToType(tx.cup_mode);
    if (!type) continue;

    const macro = dashboard.appData?.[timeframe];
    if (!macro) continue;

    const outletName = tx.outlet_id;
    const vendorMacro = macro.vendor.find((v) => v.name === outletName) || macro.vendor[0];
    const vendorKey = vendorMacro.name;

    const macroTrend = macro.trend[macro.trend.length - 1];
    const drill = dashboard.vendorDrillDownData?.[timeframe]?.[vendorKey];
    const drillLast = drill?.[drill.length - 1];
    const student = dashboard.studentData?.[timeframe];
    const studentLast = student?.chart?.[student.chart.length - 1];

    if (!macroTrend || !drillLast || !studentLast) continue;

    const amount = 1;
    const macroKey = type === 'byo' ? 'personal' : type;
    macroTrend[macroKey] = (macroTrend[macroKey] || 0) + amount;

    if (type === 'byo' || type === 'rental') {
      vendorMacro[type] = (vendorMacro[type] || 0) + amount;
    }

    drillLast[type] = (drillLast[type] || 0) + amount;
    studentLast[type] = (studentLast[type] || 0) + amount;

    if (type === 'rental') {
      macro.kpis.rental = formatCount(Math.min(1800, parseCount(macro.kpis.rental) + amount));
    }
    if (type === 'disposable') {
      macro.kpis.disp = formatCount(parseCount(macro.kpis.disp) + amount);
    }

    updateShareAndReuse(macro, type, amount);
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

    const macro = dashboard.appData?.[timeframe];
    if (!macro) continue;

    const delta = mapCupEventToRentalDelta(event.event_type);
    if (!delta) continue;

    macro.kpis.rental = formatCount(Math.min(1800, parseCount(macro.kpis.rental) + delta));
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
    const returns = clampInt(payload.returns ?? payload.returned ?? 0, 0, 10_000);

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
    if (totalTransactions === 0 && returns === 0) {
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

    const transactionsDocs = [];
    const addTransactions = (count, cupMode) => {
      for (let i = 0; i < count; i += 1) {
        transactionsDocs.push({
          transaction_id: crypto.randomUUID(),
          timestamp: now,
          outlet_id: pickRandom(vendors),
          stall_id: null,
          campus_zone: pickRandom(campusZones),
          channel: 'walk-up',
          cup_mode: cupMode,
          drink_category: null,
          price: null,
          disposable_fee_applied: null,
          incentive_applied: null,
          user_hash: null
        });
      }
    };

    addTransactions(byo, 'BYO');
    addTransactions(rental, 'rental');
    addTransactions(disposable, 'disposable');

    const cupEventDocs = [];
    for (let i = 0; i < returns; i += 1) {
      const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
      cupEventDocs.push({
        event_id: crypto.randomUUID(),
        timestamp: now,
        cup_id: `SIM-CUP-${suffix}`,
        event_type: 'returned',
        location_id: null,
        rental_id: `SIM-RENTAL-${suffix}`,
        condition_flag: 'ok',
        operator_id: null
      });
    }

    const transactions = await getCollection('transactions');
    const cupEvents = await getCollection('cup_events');
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
    res.status(500).json({ error: 'Failed to simulate events.' });
  }
});

app.listen(PORT, () => {
  console.log(`ZeroWasteNUS API running on http://localhost:${PORT}`);
});
