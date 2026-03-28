import express from 'express';
import cors from 'cors';
import { MongoClient } from 'mongodb';
import { appData as seedAppData, vendorDrillDownData as seedVendorDrillDownData, studentData as seedStudentData } from '../src/data.js';

const PORT = process.env.PORT || 3001;
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/zerowaste';

const app = express();
app.use(cors());
app.use(express.json());

const client = new MongoClient(MONGODB_URI);
let collectionPromise;

const deepClone = (value) => {
  if (typeof structuredClone === 'function') {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const getCollection = () => {
  if (!collectionPromise) {
    collectionPromise = client.connect().then(() => client.db().collection('dashboard'));
  }
  return collectionPromise;
};

const buildSeed = () => ({
  appData: deepClone(seedAppData),
  vendorDrillDownData: deepClone(seedVendorDrillDownData),
  studentData: deepClone(seedStudentData)
});

const stripId = ({ _id, ...rest }) => rest;

const ensureSeed = async () => {
  const collection = await getCollection();
  const existing = await collection.findOne({ _id: 'dashboard' });
  if (existing) {
    return existing;
  }
  const seed = {
    _id: 'dashboard',
    ...buildSeed(),
    updatedAt: new Date()
  };
  await collection.insertOne(seed);
  return seed;
};

const parseCount = (value) => Number(String(value).replace(/[^\d]/g, '')) || 0;
const formatCount = (value) => Math.max(0, Math.round(value)).toLocaleString('en-US');
const parseMoney = (value) => Number(String(value).replace(/[^0-9.]/g, '')) || 0;
const formatMoney = (value) => `$${value.toFixed(2)}`;

const normalizeTransaction = (payload) => {
  const timeframe = payload?.timeframe;
  const vendor = payload?.vendor;
  const type = payload?.type;
  const amount = Number(payload?.amount ?? 1);

  const validTimeframes = new Set(['week', 'month']);
  const validTypes = new Set(['byo', 'rental', 'disposable']);

  if (!validTimeframes.has(timeframe)) {
    return { error: 'timeframe must be "week" or "month".' };
  }
  if (!validTypes.has(type)) {
    return { error: 'type must be "byo", "rental", or "disposable".' };
  }
  if (!vendor || typeof vendor !== 'string') {
    return { error: 'vendor is required.' };
  }
  if (!Number.isFinite(amount) || amount <= 0 || amount > 500) {
    return { error: 'amount must be a positive number up to 500.' };
  }

  return { timeframe, vendor, type, amount };
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

const applyTransaction = (dashboard, { timeframe, vendor, type, amount }) => {
  const macro = dashboard.appData?.[timeframe];
  const vendorMacro = macro?.vendor?.find(
    (row) => row.name.toLowerCase() === vendor.toLowerCase()
  );
  const vendorKey = vendorMacro?.name;
  const trend = macro?.trend?.[macro.trend.length - 1];
  const drillDown = vendorKey ? dashboard.vendorDrillDownData?.[timeframe]?.[vendorKey] : null;
  const drillLast = drillDown?.[drillDown.length - 1];
  const student = dashboard.studentData?.[timeframe];
  const studentLast = student?.chart?.[student.chart.length - 1];

  if (!macro || !vendorMacro || !trend || !drillLast || !student || !studentLast) {
    throw new Error('Dashboard seed data is missing required structures.');
  }

  const macroKey = type === 'byo' ? 'personal' : type;
  trend[macroKey] = (trend[macroKey] || 0) + amount;

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

  return dashboard;
};

app.get('/api/dashboard', async (req, res) => {
  try {
    const dashboard = await ensureSeed();
    res.json(stripId(dashboard));
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
    const collection = await getCollection();
    const current = await ensureSeed();
    const updated = applyTransaction(deepClone(current), normalized);
    updated.updatedAt = new Date();

    await collection.updateOne(
      { _id: 'dashboard' },
      {
        $set: {
          appData: updated.appData,
          vendorDrillDownData: updated.vendorDrillDownData,
          studentData: updated.studentData,
          updatedAt: updated.updatedAt
        }
      }
    );

    const saved = await collection.findOne({ _id: 'dashboard' });
    res.json(stripId(saved));
  } catch (error) {
    console.error('Failed to apply transaction', error);
    res.status(500).json({ error: 'Failed to apply transaction.' });
  }
});

app.listen(PORT, () => {
  console.log(`ZeroWasteNUS API running on http://localhost:${PORT}`);
});
