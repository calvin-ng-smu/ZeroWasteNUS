import React, { useMemo, useState } from 'react';
import {
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { COLORS } from './data.js';
import { useDashboardData } from './useDashboardData.js';
import MobileApp from './MobileApp.jsx';
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

// ==========================================
// MAIN COMPONENT (STAKEHOLDER ONLY)
// ==========================================
export default function ZeroWasteDashboard() {
  const [selectedVendor, setSelectedVendor] = useState(null);
  const timeframe = 'week';
  const [showMobile, setShowMobile] = useState(false);
  const [selectedVendorDay, setSelectedVendorDay] = useState(null);

  const { data, status } = useDashboardData();
  const { appData, vendorDrillDownData, foodcourtLogistics } = data;

  const activeMacro = appData?.[timeframe];
  const activeDrillDown = selectedVendor
    ? (vendorDrillDownData?.[timeframe]?.[selectedVendor] ?? EMPTY_SERIES)
    : EMPTY_SERIES;

  const lastUpdatedLabel = status.lastUpdated ? new Date(status.lastUpdated).toLocaleTimeString() : null;

  const vendorNames = activeMacro?.vendor?.map((v) => v.name) ?? [];

  const resolveVendorName = (value) => {
    if (!value) return null;

    const candidate = String(value);
    const exact = vendorNames.find((v) => v.toLowerCase() === candidate.toLowerCase());
    if (exact) return exact;

    const contained = vendorNames.find((v) => candidate.toLowerCase().includes(v.toLowerCase()));
    return contained || null;
  };

  // Recharts provides the clicked row category via `payload.name`
  const handleVendorClick = (chartDatum) => {
    const vendor = resolveVendorName(chartDatum?.payload?.name ?? chartDatum?.name);
    if (vendor) {
      setSelectedVendor(vendor);
      setSelectedVendorDay(null);
    }
  };

  const handleVendorFromLocationClick = (location) => {
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
      const hasData = [row?.byo, row?.rental, row?.disposable].some(
        (v) => v !== null && v !== undefined && Number.isFinite(Number(v))
      );
      if (hasData) return row.time;
    }
    return null;
  }, [activeDrillDown]);

  const selectedVendorDayLabel = selectedVendorDay || vendorCutoffDayLabel;

  const selectedVendorDayRow = useMemo(() => {
    if (!selectedVendorDayLabel || !activeDrillDown?.length) return null;
    const row = activeDrillDown.find((r) => r.time === selectedVendorDayLabel) || null;
    if (!row) return null;
    const hasAny = [row?.byo, row?.rental, row?.disposable].some((v) => v !== null && v !== undefined);
    return hasAny ? row : null;
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

      // Priority: critical stock > high returns (bin fullness) > normal stock tiers.
      if (inStock <= CRITICAL_STOCK) {
        return {
          name,
          status: `Low Clean Cups (${inStock} clean, ${rentedOut} out)`,
          statusClass: 'text-red-500 font-medium',
          action: 'Dispatch',
          actionClass: 'text-blue-600 hover:text-blue-800 font-medium transition-colors',
        };
      }

      if (returnedToday >= HIGH_RETURNED_TODAY) {
        const percent = clamp(Math.round((returnedToday / BIN_CAPACITY) * 100), 0, 100);
        const statusClass =
          returnedToday >= BIN_RED_AT
            ? 'text-red-500 font-medium'
            : returnedToday >= BIN_AMBER_AT
              ? 'text-yellow-600 font-medium'
              : 'text-green-600 font-medium';
        return {
          name,
          status: `Return Point ${percent}% Full (${returnedToday}/${BIN_CAPACITY} returned)`,
          statusClass,
          action: 'Collect',
          actionClass: 'text-blue-600 hover:text-blue-800 font-medium transition-colors',
        };
      }

      if (inStock <= LOW_STOCK) {
        return {
          name,
          status: `Monitor Clean Cups (${inStock} clean, ${rentedOut} out)`,
          statusClass: 'text-yellow-600 font-medium',
          action: 'Dispatch',
          actionClass: 'text-blue-600 hover:text-blue-800 font-medium transition-colors',
        };
      }

      return {
        name,
        status: `Optimal (${inStock} clean)`,
        statusClass: 'text-green-600 font-medium',
        action: '--',
        actionClass: 'text-gray-400 cursor-not-allowed',
      };
    });
  }, [tiedFoodcourtLogistics]);

  if (showMobile) {
    return (
      <div className="h-screen">
        <MobileApp onBack={() => setShowMobile(false)} data={data} status={status} />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-gray-100 font-sans overflow-hidden">
      {/* SIDEBAR */}
      <div className="w-64 bg-slate-900 text-white flex flex-col shadow-xl z-10">
        <div className="p-6 border-b border-slate-800">
          <h1 className="text-2xl font-bold text-green-400 tracking-tight">ZeroWasteNUS</h1>
          <p className="text-xs text-slate-400 mt-1">Impact Analytics Engine</p>
        </div>
        <div className="p-4 flex-1">
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4">Dashboards</p>
          <div className="w-full text-left px-4 py-3 rounded-lg bg-blue-600 text-white shadow-md">
            📊 Stakeholder Dashboard
          </div>
        </div>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">System Live • V 2.4.1</div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-0">
          <h2 className="text-xl font-semibold text-gray-800">
            {selectedVendor ? `Vendor Logistics: ${selectedVendor}` : 'Campus Sustainability Overview'}
          </h2>
          <div className="flex items-center space-x-4">
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200" aria-label="Timeframe">
              <span className="px-3 py-1 text-sm rounded-md bg-white shadow-sm text-gray-800 font-semibold">This Week</span>
            </div>

            <div
              className={`flex items-center text-xs font-medium ${status.error ? 'text-red-600' : status.loading ? 'text-amber-600' : 'text-green-600'}`}
              title={status.error || 'Live data connected'}
            >
              <span
                className={`w-2 h-2 rounded-full mr-2 ${status.error ? 'bg-red-500' : status.loading ? 'bg-amber-500' : 'bg-green-500'} animate-pulse`}
              ></span>
              {status.error ? 'Live sync error' : status.loading ? 'Connecting live data' : 'Live sync'}
              {!status.error && lastUpdatedLabel ? <span className="ml-2 text-gray-400">Updated {lastUpdatedLabel}</span> : null}
            </div>

            <span className="text-sm text-gray-500 bg-gray-100 px-3 py-1 rounded-full border border-gray-200">AY2025/2026</span>
            <button
              onClick={() => setShowMobile(true)}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition-colors"
            >
              📱 View Mobile
            </button>
          </div>
        </header>

        {/* SCROLLABLE DASHBOARD GRID */}
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-slate-50 p-8">
          <div className="space-y-6 animate-fadeIn">
            {/* =========================================================
                STAKEHOLDER: MACRO VIEW
                ========================================================= */}
            {!selectedVendor ? (
              <>
                {/* KPI ROW */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-green-500 transition-all">
                    <p className="text-sm font-medium text-gray-500">Total Reuse Share</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{activeMacro.kpis.reuse}</p>
                    <p className="text-xs text-green-600 mt-1 font-medium">↑ Steady Adoption</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-blue-500 transition-all">
                    <p className="text-sm font-medium text-gray-500">Active Rental Cups</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{activeMacro.kpis.rental}</p>
                    <p className="text-xs text-blue-600 mt-1 font-medium">{activeMacro.kpis.returnCompliance || '0.00%'} return compliance</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-red-400 transition-all">
                    <p className="text-sm font-medium text-gray-500">Disposables Used</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{activeMacro.kpis.disp}</p>
                    <p className="text-xs text-red-500 mt-1 font-medium">Percentage increase slower than last week</p>
                  </div>
                  <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-purple-500 transition-all">
                    <p className="text-sm font-medium text-gray-500">Est. Carbon Saved</p>
                    <p className="text-3xl font-bold text-gray-800 mt-1">{activeMacro.kpis.carbon}</p>
                    <p className="text-xs text-purple-600 mt-1 font-medium">Validated by sensors</p>
                  </div>
                </div>

                {/* CHARTS ROW 1 */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Campus Adoption Trend ({activeMacro.kpis.trendText})</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={activeMacro.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8' }} />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <RechartsTooltip
                            contentStyle={{
                              borderRadius: '8px',
                              border: 'none',
                              boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                            }}
                          />
                          <Legend iconType="circle" />
                          <Line type="monotone" dataKey="disposable" name="Single-Use (SUC)" stroke="#ef4444" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="rental" name="Campus Rental" stroke="#3b82f6" strokeWidth={2} dot={false} />
                          <Line type="monotone" dataKey="personal" name="Personal BYO" stroke="#22c55e" strokeWidth={2} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4">Cup Share ({activeMacro.kpis.trendText})</h3>
                    <div className="h-72 w-full flex flex-col items-center justify-center">
                      <ResponsiveContainer width="100%" height="80%">
                        <PieChart>
                          <Pie data={activeMacro.share} cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                            {activeMacro.share.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <RechartsTooltip />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex justify-center space-x-4 mt-2 text-sm">
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>BYO
                        </span>
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>Rental
                        </span>
                        <span className="flex items-center">
                          <div className="w-3 h-3 rounded-full bg-red-500 mr-2"></div>Single-Use
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* CHARTS ROW 2 - Bar Chart & Table */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow relative">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Vendor Adoption ({activeMacro.kpis.trendText})</h3>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full animate-pulse cursor-default border border-blue-200">Click Bar to Drill Down</span>
                    </div>
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={activeMacro.vendor} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                          <XAxis type="number" hide />
                          <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} width={70} />
                          <RechartsTooltip cursor={{ fill: '#f8fafc' }} contentStyle={{ borderRadius: '8px', border: 'none' }} />
                          <Legend iconType="circle" />
                          <Bar dataKey="byo" name="Personal BYO" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={20} onClick={handleVendorClick} style={{ cursor: 'pointer' }} />
                          <Bar dataKey="rental" name="Rental Cups" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} onClick={handleVendorClick} style={{ cursor: 'pointer' }} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-lg font-semibold text-gray-800">Live Logistics Feed</h3>
                      <span className="flex items-center text-xs text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></span>Live Sync
                      </span>
                    </div>
                    <div className="overflow-y-auto h-64 pr-2">
                      <table className="w-full text-sm text-left">
                        <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 rounded-tl-lg">Location</th>
                            <th className="px-4 py-2">Status</th>
                            <th className="px-4 py-2 rounded-tr-lg">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(liveLogisticsRows.length ? liveLogisticsRows : [
                            {
                              name: 'Frontier Canteen',
                              status: '—',
                              statusClass: 'text-gray-400 font-medium',
                              action: '--',
                              actionClass: 'text-gray-400 cursor-not-allowed',
                            },
                          ]).map((row) => (
                            <tr
                              key={row.name}
                              className="border-b border-gray-50 cursor-pointer hover:bg-slate-50"
                              onClick={() => handleVendorFromLocationClick(row.name)}
                              title="Click to drill down"
                            >
                              <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                              <td className={`px-4 py-3 ${row.statusClass}`}>{row.status}</td>
                              <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                                <button className={row.actionClass}>{row.action}</button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800">Reusable Cup Logistics (Today)</h3>
                      <p className="text-xs text-gray-500">Per foodcourt pool is capped at {tiedFoodcourtLogistics?.capacity ?? 200}</p>
                    </div>
                    <span className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-full border border-slate-200">
                      {tiedFoodcourtLogistics?.todayLabel ? `${tiedFoodcourtLogistics.todayLabel}` : '—'}
                    </span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                      <thead className="text-xs text-gray-500 uppercase bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 rounded-tl-lg">Foodcourt</th>
                          <th className="px-4 py-2">Returned Today</th>
                          <th className="px-4 py-2">Rented Out</th>
                          <th className="px-4 py-2 rounded-tr-lg">In Stock</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(tiedFoodcourtLogistics?.rows || []).map((row) => (
                          <tr key={row.name} className="border-b border-gray-50">
                            <td className="px-4 py-3 font-medium text-gray-800">{row.name}</td>
                            <td className="px-4 py-3 text-slate-700">{row.returnedToday}</td>
                            <td className="px-4 py-3 text-slate-700">{row.rentedOut}</td>
                            <td className="px-4 py-3 font-semibold text-gray-900">{row.inStock}</td>
                          </tr>
                        ))}
                        {!tiedFoodcourtLogistics?.rows?.length ? (
                          <tr>
                            <td className="px-4 py-3 text-gray-500" colSpan={4}>No logistics data available.</td>
                          </tr>
                        ) : null}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            ) : (
              /* =========================================================
                 STAKEHOLDER: MICRO (VENDOR DRILL-DOWN) VIEW
                 ========================================================= */
              <div className="animate-fadeIn">
                <button
                  onClick={() => setSelectedVendor(null)}
                  className="mb-4 flex items-center text-sm text-slate-600 hover:text-blue-700 transition-colors font-semibold bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-lg"
                >
                  ← Return to Campus Overview
                </button>

                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
                    <div>
                      <h3 className="text-2xl font-bold text-gray-800">{selectedVendor} Flow Breakdown</h3>
                      <p className="text-sm text-gray-500 mt-1">Daily breakdown (This Week)</p>
                    </div>

                    <div className="mt-4 md:mt-0 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-100 shadow-inner flex flex-col items-center">
                      <span className="font-bold uppercase tracking-wide text-xs">Primary Pain Point</span>
                      <span className="font-semibold text-lg">Peak SUC Waste: {peakSUCLabel}</span>
                    </div>
                  </div>

                  <div className="h-96 w-full mt-8">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart
                        data={activeDrillDown}
                        margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
                        onClick={(e) => {
                          const label = e?.activeLabel;
                          if (label) setSelectedVendorDay(label);
                        }}
                      >
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 500 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <RechartsTooltip
                          contentStyle={{
                            borderRadius: '8px',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                          }}
                        />
                        <Legend iconType="circle" verticalAlign="top" height={36} />
                        <Line type="monotone" dataKey="disposable" name="Single-Use (SUC)" stroke="#ef4444" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="rental" name="Campus Rental" stroke="#3b82f6" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="byo" name="Personal BYO" stroke="#22c55e" strokeWidth={3} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="mt-10">
                    <h4 className="text-lg font-semibold text-gray-800">Hourly Breakdown ({selectedVendorDayLabel || '—'})</h4>
                    <p className="text-sm text-gray-500 mb-4">8 AM to 8 PM (future hours hidden)</p>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={hourlyVendorSeries} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontWeight: 500 }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b' }} />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <RechartsTooltip
                            contentStyle={{
                              borderRadius: '8px',
                              border: '1px solid #e2e8f0',
                              boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)',
                            }}
                          />
                          <Legend iconType="circle" verticalAlign="top" height={36} />
                          <Line type="monotone" dataKey="disposable" name="Single-Use (SUC)" stroke="#ef4444" strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="rental" name="Campus Rental" stroke="#3b82f6" strokeWidth={3} dot={false} />
                          <Line type="monotone" dataKey="byo" name="Personal BYO" stroke="#22c55e" strokeWidth={3} dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
