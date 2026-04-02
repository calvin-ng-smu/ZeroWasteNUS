import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { COLORS } from './data.js';
import { deriveFoodcourtLogistics } from './deriveFoodcourtLogistics.js';

const EMPTY_SERIES = Object.freeze([]);

const getSingaporeHour = (date = new Date()) => {
  try {
    const formatted = new Intl.DateTimeFormat('en-SG', {
      timeZone: 'Asia/Singapore',
      hour: '2-digit',
      hour12: false,
    }).format(date);
    const hour = Number.parseInt(String(formatted), 10);
    return Number.isFinite(hour) ? hour : date.getHours();
  } catch {
    return date.getHours();
  }
};

export default function MobileApp({ onBack, data, status }) {
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [selectedVendorDay, setSelectedVendorDay] = useState(null);
  const timeframe = 'week';

  const { appData, vendorDrillDownData, foodcourtLogistics } = data;
  const activeMacro = appData[timeframe];
  const activeDrillDown = selectedVendor
    ? (vendorDrillDownData?.[timeframe]?.[selectedVendor] ?? EMPTY_SERIES)
    : EMPTY_SERIES;
  const vendorNames = activeMacro?.vendor?.map((v) => v.name) ?? [];

  const lastUpdatedLabel = status?.lastUpdated
    ? new Date(status.lastUpdated).toLocaleTimeString()
    : null;

  const resolveVendorName = (value) => {
    if (!value) return null;

    const candidate = String(value);
    const exact = vendorNames.find((v) => v.toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;

    const contained = vendorNames.find((v) => candidate.toLowerCase().includes(v.toLowerCase()));
    return contained || null;
  };

  const handleVendorClick = (chartDatum) => {
    const vendor = resolveVendorName(chartDatum?.payload?.name ?? chartDatum?.name);
    if (vendor) {
      setSelectedVendor(vendor);
      setSelectedVendorDay(null);
    }
  };

  const handleVendorFromLocationPress = (location) => {
    const vendor = resolveVendorName(location);
    if (vendor) {
      setSelectedVendor(vendor);
      setSelectedVendorDay(null);
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

  const vendorCutoffDayLabel = useMemo(() => {
    if (!activeDrillDown?.length) return null;
    for (let i = activeDrillDown.length - 1; i >= 0; i -= 1) {
      const row = activeDrillDown[i];
      const hasData = [row?.byo, row?.rental, row?.disposable].some((v) => v !== null && v !== undefined && Number.isFinite(Number(v)));
      if (hasData) return row.time;
    }
    return null;
  }, [activeDrillDown]);

  const selectedVendorDayLabel = selectedVendorDay || vendorCutoffDayLabel;

  const selectedVendorDayRow = useMemo(() => {
    if (!selectedVendorDayLabel || !activeDrillDown?.length) return null;
    return activeDrillDown.find((r) => r.time === selectedVendorDayLabel) || null;
  }, [activeDrillDown, selectedVendorDayLabel]);

  const hourlyVendorSeries = useMemo(() => {
    const hours = Array.from({ length: 12 }, (_, i) => 8 + i); // 8..19 (8AM..7PM)
    const labels = hours.map((h) => {
      const hour12 = ((h + 11) % 12) + 1;
      const ampm = h < 12 ? 'AM' : 'PM';
      return `${hour12} ${ampm}`;
    });

    if (!selectedVendorDayRow) {
      return labels.map((time) => ({ time, byo: null, rental: null, disposable: null }));
    }

    const dayByo = Number(selectedVendorDayRow.byo);
    const dayRental = Number(selectedVendorDayRow.rental);
    const dayDisposable = Number(selectedVendorDayRow.disposable);

    if (![dayByo, dayRental, dayDisposable].some((v) => Number.isFinite(v))) {
      return labels.map((time) => ({ time, byo: null, rental: null, disposable: null }));
    }

    const nowHour = getSingaporeHour();
    const isToday = selectedVendorDayLabel && selectedVendorDayLabel === vendorCutoffDayLabel;
    const lastVisibleHour = isToday ? Math.min(19, nowHour) : 19;

    const visibleCount = Math.max(0, Math.min(12, lastVisibleHour - 8 + 1));
    const baseWeights = [0.04, 0.05, 0.06, 0.07, 0.10, 0.12, 0.13, 0.11, 0.09, 0.08, 0.08, 0.07];
    const visibleWeights = baseWeights.slice(0, visibleCount);

    const byoSeries = distributeByWeights(dayByo, visibleWeights);
    const rentalSeries = distributeByWeights(dayRental, visibleWeights);
    const disposableSeries = distributeByWeights(dayDisposable, visibleWeights);

    return labels.map((time, idx) => {
      if (idx >= visibleCount) {
        return { time, byo: null, rental: null, disposable: null };
      }
      return {
        time,
        byo: byoSeries[idx] ?? 0,
        rental: rentalSeries[idx] ?? 0,
        disposable: disposableSeries[idx] ?? 0,
      };
    });
  }, [selectedVendorDayRow, selectedVendorDayLabel, vendorCutoffDayLabel]);

  const peakSUCLabel = useMemo(() => {
    let best = null;
    for (const row of hourlyVendorSeries || []) {
      const value = Number(row?.disposable);
      if (!Number.isFinite(value)) continue;
      if (!best || value > best.value) best = { time: row.time, value };
    }
    return best?.time ? `${best.time}` : '—';
  }, [hourlyVendorSeries]);

  const tiedFoodcourtLogistics = useMemo(() => {
    const derived = deriveFoodcourtLogistics({
      weekMacro: activeMacro,
      vendorDrillDownWeek: vendorDrillDownData?.[timeframe],
      now: new Date(),
      capacity: foodcourtLogistics?.capacity ?? 200,
    });

    return derived || foodcourtLogistics || null;
  }, [activeMacro, vendorDrillDownData, timeframe, foodcourtLogistics]);

  const liveLogisticsRows = useMemo(() => {
    const labelMap = {
      Frontier: 'Frontier Canteen',
      UTown: 'UTown Fine Food',
      Deck: 'Deck Drink Stall',
      Techno: 'Techno Edge',
    };

    const rows = tiedFoodcourtLogistics?.rows || [];
    if (!rows.length) return [];

    const CRITICAL_STOCK = 40;
    const LOW_STOCK = 90;
    const HIGH_RETURNED_TODAY = 8;
    const BIN_CAPACITY = 65;
    const BIN_AMBER_AT = 50;
    const BIN_RED_AT = 60;

    const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

    return rows.map((r) => {
      const name = labelMap[r.name] || r.name;
      const returnedToday = Math.max(0, Math.trunc(Number(r.returnedToday) || 0));
      const rentedOut = Math.max(0, Math.trunc(Number(r.rentedOut) || 0));
      const inStock = Math.max(0, Math.trunc(Number(r.inStock) || 0));

      if (inStock <= CRITICAL_STOCK) {
        return {
          name,
          status: `Low Clean Cups (${inStock} clean, ${rentedOut} out)`,
          statusColor: 'text-red-500',
          action: 'Dispatch',
          actionColor: 'text-blue-600 hover:text-blue-800',
        };
      }

      if (returnedToday >= HIGH_RETURNED_TODAY) {
        const percent = clamp(Math.round((returnedToday / BIN_CAPACITY) * 100), 0, 100);
        const statusColor =
          returnedToday >= BIN_RED_AT
            ? 'text-red-500'
            : returnedToday >= BIN_AMBER_AT
              ? 'text-yellow-600'
              : 'text-green-600';
        return {
          name,
          status: `Drop-off Bin ${percent}% Full (${returnedToday}/${BIN_CAPACITY} returned)`,
          statusColor,
          action: 'Collect',
          actionColor: 'text-blue-600 hover:text-blue-800',
        };
      }

      if (inStock <= LOW_STOCK) {
        return {
          name,
          status: `Monitor Clean Cups (${inStock} clean, ${rentedOut} out)`,
          statusColor: 'text-yellow-600',
          action: 'Dispatch',
          actionColor: 'text-blue-600 hover:text-blue-800',
        };
      }

      return {
        name,
        status: `Optimal (${inStock} clean)`,
        statusColor: 'text-green-600',
        action: '--',
        actionColor: 'text-gray-400 cursor-not-allowed',
      };
    });
  }, [tiedFoodcourtLogistics]);

  const getTitle = () => {
    if (selectedVendor) return selectedVendor;
    return 'Campus Overview';
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">

      {/* ── STICKY HEADER ── */}
      <header className="flex-none bg-slate-900 text-white px-4 py-3 flex items-center justify-between z-20 shadow-lg">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-slate-300 hover:text-white transition-colors min-h-[44px] min-w-[44px] pr-2"
        >
          <span className="text-lg">←</span>
          <span className="text-xs font-medium">Desktop</span>
        </button>

        <div className="flex flex-col items-center">
          <span className="text-sm font-bold text-green-400 leading-tight">ZeroWasteNUS</span>
          <span className="text-xs text-slate-400">{getTitle()}</span>
          <span className={`text-[10px] mt-0.5 ${status?.error ? 'text-red-400' : status?.loading ? 'text-amber-300' : 'text-emerald-300'}`}>
            {status?.error ? 'Live sync error' : status?.loading ? 'Connecting' : 'Live sync'}
            {!status?.error && lastUpdatedLabel ? ` • ${lastUpdatedLabel}` : ''}
          </span>
        </div>

        <div className="bg-slate-700 px-2 py-1 rounded-lg text-xs font-medium text-white" aria-label="Timeframe">
          Week
        </div>
      </header>

      {/* ── SCROLLABLE CONTENT ── */}
      <main className="flex-1 overflow-y-auto pb-20 px-4 py-4 space-y-4">

        <>
          {!selectedVendor ? (

              /* ── STAKEHOLDER MACRO VIEW ── */
              <>
                {/* KPI Cards — 2 per row */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-green-500">
                    <p className="text-xs font-medium text-gray-500">Total Reuse Share</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{activeMacro.kpis.reuse}</p>
                    <p className="text-xs text-green-600 mt-1 font-medium">↑ Steady Adoption</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-blue-500">
                    <p className="text-xs font-medium text-gray-500">Active Rentals</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{activeMacro.kpis.rental}</p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">{activeMacro.kpis.returnCompliance || '0.00%'} return compliance</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-red-400">
                    <p className="text-xs font-medium text-gray-500">Disposables Used</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{activeMacro.kpis.disp}</p>
                    <p className="text-xs text-red-500 mt-1 font-medium">↓ Dropping</p>
                  </div>
                  <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-purple-500">
                    <p className="text-xs font-medium text-gray-500">Carbon Saved</p>
                    <p className="text-2xl font-bold text-gray-800 mt-1">{activeMacro.kpis.carbon}</p>
                    <p className="text-xs text-purple-600 mt-1 font-medium">Sensor validated</p>
                  </div>
                </div>

                {/* Campus Adoption Trend — Area chart */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    Campus Adoption Trend ({activeMacro.kpis.trendText})
                  </h3>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={activeMacro.trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 11 }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="disposable" name="Single-Use" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="rental" name="Rental" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="personal" name="BYO" stroke="#22c55e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Cup Share — Pie chart */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-sm font-semibold text-gray-800 mb-3">
                    Cup Share ({activeMacro.kpis.trendText})
                  </h3>
                  <div style={{ height: 180 }} className="flex flex-col items-center">
                    <ResponsiveContainer width="100%" height="80%">
                      <PieChart>
                        <Pie
                          data={activeMacro.share}
                          cx="50%" cy="50%"
                          innerRadius={50} outerRadius={70}
                          paddingAngle={5} dataKey="value"
                        >
                          {activeMacro.share.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <RechartsTooltip />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="flex justify-center space-x-4 text-xs mt-1">
                      <span className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-green-500 mr-1.5"></div>BYO</span>
                      <span className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-blue-500 mr-1.5"></div>Rental</span>
                      <span className="flex items-center"><div className="w-2.5 h-2.5 rounded-full bg-red-500 mr-1.5"></div>Single-Use</span>
                    </div>
                  </div>
                </div>

                {/* Vendor Adoption — Bar chart (tap to drill down) */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">Vendor Adoption ({activeMacro.kpis.trendText})</h3>
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200 animate-pulse">Tap to drill down</span>
                  </div>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeMacro.vendor} layout="vertical" margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                        <XAxis type="number" hide />
                        <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 11 }} width={60} />
                        <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none', fontSize: 11 }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Bar dataKey="byo" name="Personal BYO" stackId="a" fill="#22c55e" barSize={18} onClick={handleVendorClick} style={{ cursor: 'pointer' }} />
                        <Bar dataKey="rental" name="Rental Cups" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={18} onClick={handleVendorClick} style={{ cursor: 'pointer' }} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Live Logistics Feed — card list */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <h3 className="text-sm font-semibold text-gray-800">Live Logistics Feed</h3>
                    <span className="flex items-center text-xs text-gray-500">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-1.5"></span>Live Sync
                    </span>
                  </div>
                  <div className="space-y-2">
                    {(liveLogisticsRows.length ? liveLogisticsRows : [
                      { name: 'Frontier Canteen', status: '—', statusColor: 'text-gray-400', action: '--', actionColor: 'text-gray-400 cursor-not-allowed' },
                    ]).map((row) => (
                      <div
                        key={row.name}
                        className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100 active:bg-slate-100 cursor-pointer"
                        onClick={() => handleVendorFromLocationPress(row.name)}
                        role="button"
                        tabIndex={0}
                        title="Tap to drill down"
                      >
                        <div>
                          <p className="text-sm font-semibold text-gray-800">{row.name}</p>
                          <p className={`text-xs font-medium ${row.statusColor}`}>{row.status}</p>
                        </div>
                        <button
                          className={`text-sm font-medium min-h-[44px] px-3 transition-colors ${row.actionColor}`}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {row.action}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-3">
                    <div>
                      <h3 className="text-sm font-semibold text-gray-800">Reusable Cup Logistics (Today)</h3>
                      <p className="text-[10px] text-gray-500">Per foodcourt pool capped at {tiedFoodcourtLogistics?.capacity ?? 200}</p>
                    </div>
                    <span className="text-[10px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full border border-slate-200">
                      {tiedFoodcourtLogistics?.todayLabel || '—'}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="text-[10px] text-gray-500 uppercase bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 rounded-tl-lg">Foodcourt</th>
                          <th className="px-3 py-2">Returned</th>
                          <th className="px-3 py-2">Rented</th>
                          <th className="px-3 py-2 rounded-tr-lg">Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tiedFoodcourtLogistics?.rows || []).map((row) => (
                          <tr key={row.name} className="border-b border-gray-50">
                            <td className="px-3 py-2 font-semibold text-gray-800">{row.name}</td>
                            <td className="px-3 py-2 text-slate-700">{row.returnedToday}</td>
                            <td className="px-3 py-2 text-slate-700">{row.rentedOut}</td>
                            <td className="px-3 py-2 font-bold text-gray-900">{row.inStock}</td>
                          </tr>
                        ))}
                        {!tiedFoodcourtLogistics?.rows?.length ? (
                          <tr>
                            <td className="px-3 py-2 text-gray-500" colSpan={4}>No logistics data available.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>

          ) : (

              /* ── STAKEHOLDER MICRO (VENDOR DRILL-DOWN) VIEW ── */
              <>
                <button
                  onClick={() => {
                    setSelectedVendor(null);
                    setSelectedVendorDay(null);
                  }}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-700 transition-colors font-semibold bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-lg min-h-[44px]"
                >
                  ← Campus Overview
                </button>

                {/* Pain point */}
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-500 mb-1">Primary Pain Point</p>
                  <p className="font-semibold text-lg text-red-700">
                    Peak SUC Waste: {peakSUCLabel}
                  </p>
                </div>

                {/* Drill-down area chart */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 mb-1">{selectedVendor} Flow Breakdown</h3>
                  <p className="text-xs text-gray-500 mb-3">Daily breakdown (This Week)</p>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={activeDrillDown}
                        margin={{ top: 5, right: 5, left: -25, bottom: 0 }}
                        onClick={(e) => {
                          const label = e?.activeLabel;
                          if (label) setSelectedVendorDay(label);
                        }}
                      >
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 11 }} />
                        <Legend iconType="circle" iconSize={8} verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="disposable" name="Single-Use" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="rental" name="Rental" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="byo" name="BYO" stroke="#22c55e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 mb-1">Hourly Breakdown ({selectedVendorDayLabel || '—'})</h3>
                  <p className="text-xs text-gray-500 mb-3">8 AM to 8 PM (future hours hidden)</p>
                  <div style={{ height: 200 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={hourlyVendorSeries} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 11 }} />
                        <Legend iconType="circle" iconSize={8} verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
                        <Line type="monotone" dataKey="disposable" name="Single-Use" stroke="#ef4444" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="rental" name="Rental" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        <Line type="monotone" dataKey="byo" name="BYO" stroke="#22c55e" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </>
          )}
        </>
      </main>

      {/* ── BOTTOM NAVIGATION ── */}
      <nav className="flex-none fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 flex z-20">
        <button
          onClick={() => setSelectedVendor(null)}
          className="flex-1 flex flex-col items-center justify-center py-3 min-h-[56px] transition-colors bg-blue-600 text-white"
        >
          <span className="text-lg leading-none">📊</span>
          <span className="text-xs font-semibold mt-1">Dashboard</span>
        </button>
      </nav>

    </div>
  );
}
