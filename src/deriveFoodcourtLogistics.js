const SINGAPORE_TZ = 'Asia/Singapore';

const clampInt = (value, min, max) => {
  const parsed = Math.trunc(Number(value) || 0);
  return Math.min(max, Math.max(min, parsed));
};

const getSingaporeHour = (date = new Date()) => {
  try {
    const formatted = new Intl.DateTimeFormat('en-SG', {
      timeZone: SINGAPORE_TZ,
      hour: '2-digit',
      hour12: false,
    }).format(date);
    const hour = Number.parseInt(String(formatted), 10);
    return Number.isFinite(hour) ? hour : date.getHours();
  } catch {
    return date.getHours();
  }
};

const distributeByWeights = (total, weights) => {
  const normalizedTotal = Math.max(0, Math.trunc(Number(total) || 0));
  const safeWeights = Array.isArray(weights) && weights.length
    ? weights.map((w) => Math.max(0, Number(w) || 0))
    : [1];
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

const resolveCutoffDayLabel = (weekMacro) => {
  const trend = weekMacro?.trend;
  if (!Array.isArray(trend) || trend.length === 0) return null;

  for (let i = trend.length - 1; i >= 0; i -= 1) {
    const row = trend[i];
    const hasData = [row?.personal, row?.rental, row?.disposable].some(
      (v) => v !== null && v !== undefined && Number.isFinite(Number(v))
    );
    if (hasData) return row?.time ?? null;
  }

  return trend[trend.length - 1]?.time ?? null;
};

const resolveDayLabels = (weekMacro, vendorDrillDownWeek) => {
  const fromTrend = Array.isArray(weekMacro?.trend) ? weekMacro.trend.map((r) => r?.time).filter(Boolean) : [];
  if (fromTrend.length) return fromTrend;

  const firstVendor = vendorDrillDownWeek && typeof vendorDrillDownWeek === 'object'
    ? Object.keys(vendorDrillDownWeek)[0]
    : null;
  const series = firstVendor ? vendorDrillDownWeek[firstVendor] : null;
  return Array.isArray(series) ? series.map((r) => r?.time).filter(Boolean) : [];
};

export const deriveFoodcourtLogistics = ({
  weekMacro,
  vendorDrillDownWeek,
  now = new Date(),
  capacity = 200,
} = {}) => {
  if (!weekMacro || !vendorDrillDownWeek) return null;

  const foodcourts = Array.isArray(weekMacro?.vendor)
    ? weekMacro.vendor.map((v) => v?.name).filter(Boolean)
    : [];
  if (!foodcourts.length) return null;

  const todayLabel = resolveCutoffDayLabel(weekMacro);
  const dayLabels = resolveDayLabels(weekMacro, vendorDrillDownWeek);
  const todayIndex = todayLabel ? dayLabels.indexOf(todayLabel) : -1;
  const yesterdayLabel = todayIndex > 0 ? dayLabels[todayIndex - 1] : null;

  const nowHour = getSingaporeHour(now);
  const lastVisibleHour = nowHour < 8 ? 7 : Math.min(19, nowHour);
  const visibleCount = clampInt(lastVisibleHour - 8 + 1, 0, 12);

  // Timeline modeling:
  // - Consider each bucket as one hour from 8AM.
  // - Use "start of current hour" as the time reference to avoid counting returns too early.
  const currentTime = clampInt(nowHour - 8, 0, 12);

  // Operational assumptions (lightweight + deterministic):
  // - Return lag: 3 hours from issue.
  // - Wash: 2 hours.
  // No "coming back" stage: assume onsite washing.
  const RETURN_LAG_HOURS = 3;
  const WASH_HOURS = 2;

  // Keep in sync with the hourly breakdown chart weights used in App/Mobile.
  const weightsRental = [0.04, 0.05, 0.06, 0.07, 0.10, 0.12, 0.13, 0.11, 0.09, 0.08, 0.08, 0.07];

  const accumulateStages = (count, returnTime, buckets) => {
    if (count <= 0) return;
    if (buckets.currentTime < returnTime) {
      buckets.rentedOut += count;
    } else if (buckets.currentTime < returnTime + WASH_HOURS) {
      buckets.inWash += count;
    }
  };

  const applyIssues = ({ issues, dayOffsetHours, allowNextMorningReturns, buckets }) => {
    const endOfDay = dayOffsetHours + 12;

    for (let hourIdx = 0; hourIdx < issues.length; hourIdx += 1) {
      const amount = Math.max(0, Math.trunc(Number(issues[hourIdx]) || 0));
      if (!amount) continue;

      const issueTime = dayOffsetHours + (hourIdx + 1);

      let nextMorning = 0;
      if (allowNextMorningReturns) {
        // Encourage a small carryover into the next morning, heavier for late-day rentals.
        const frac = hourIdx >= 9 ? 0.35 : 0.05; // >=5PM vs earlier
        nextMorning = Math.min(amount, Math.floor(amount * frac));
      }

      const sameDay = amount - nextMorning;

      if (sameDay > 0) {
        const returnTime = Math.min(issueTime + RETURN_LAG_HOURS, endOfDay);
        accumulateStages(sameDay, returnTime, buckets);
      }

      if (nextMorning > 0) {
        // Next-morning returns arrive at 8AM (today start = 0).
        accumulateStages(nextMorning, 0, buckets);
      }
    }
  };

  const cap = Math.max(1, Math.trunc(Number(capacity) || 200));

  const rows = foodcourts.map((name) => {
    const series = vendorDrillDownWeek?.[name];
    if (!Array.isArray(series) || !series.length) {
      return {
        name,
        returnedToday: 0,
        rentedOut: 0,
        comingBack: 0,
        inStock: cap,
      };
    }

    const todayRow = todayLabel ? series.find((r) => r?.time === todayLabel) : null;
    const yesterdayRow = yesterdayLabel ? series.find((r) => r?.time === yesterdayLabel) : null;

    const todayRental = Number(todayRow?.rental);
    const yesterdayRental = Number(yesterdayRow?.rental);

    const todayIssues = Number.isFinite(todayRental) && visibleCount > 0
      ? distributeByWeights(todayRental, weightsRental.slice(0, visibleCount))
      : [];

    const yesterdayIssues = Number.isFinite(yesterdayRental)
      ? distributeByWeights(yesterdayRental, weightsRental)
      : [];

    const buckets = { currentTime, rentedOut: 0, inWash: 0 };

    // Yesterday rentals may still be washing / in-transit this morning.
    applyIssues({
      issues: yesterdayIssues,
      dayOffsetHours: -24,
      allowNextMorningReturns: true,
      buckets,
    });

    // Today rentals drive the baseline rented-out count.
    applyIssues({
      issues: todayIssues,
      dayOffsetHours: 0,
      allowNextMorningReturns: false,
      buckets,
    });

    let returnedPending = Math.max(0, Math.trunc(buckets.inWash));
    let rentedOut = Math.max(0, Math.trunc(buckets.rentedOut));

    // Enforce the 200-cup pool split (never exceed cap).
    if (returnedPending > cap) returnedPending = cap;
    if (rentedOut > cap - returnedPending) rentedOut = Math.max(0, cap - returnedPending);

    const inStock = Math.max(0, cap - rentedOut - returnedPending);

    return {
      name,
      returnedToday: returnedPending,
      rentedOut,
      inStock,
    };
  });

  return {
    todayLabel,
    capacity: cap,
    rows,
  };
};
