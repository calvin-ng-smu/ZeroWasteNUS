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

const getDb = () => {
  if (!dbPromise) {
    dbPromise = client.connect().then(() => client.db());
  }
  return dbPromise;
};

const getCollection = async (name) => {
  const db = await getDb();
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
      macro.kpis.rental = formatCount(parseCount(macro.kpis.rental) + amount);
    }
    if (type === 'disposable') {
      macro.kpis.disp = formatCount(parseCount(macro.kpis.disp) + amount);
    }

    updateShareAndReuse(macro, type, amount);
    updateCarbon(macro, type, amount);
    updateStudentKpis(student, type, amount);
  }

  // Cup lifecycle events could further adjust KPIs later (e.g. returns, wash lag)
  // For this demo, they are stored for drill-down but not yet altering the top-line charts.

  dashboard.updatedAt = now;
  return dashboard;
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

app.listen(PORT, () => {
  console.log(`ZeroWasteNUS API running on http://localhost:${PORT}`);
});
