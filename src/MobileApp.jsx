import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer,
  BarChart, Bar, Legend, PieChart, Pie, Cell
} from 'recharts';
import { COLORS } from './data.js';

export default function MobileApp({ onBack, data, status }) {
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [timeframe, setTimeframe] = useState('week');

  const { appData, vendorDrillDownData } = data;
  const activeMacro = appData[timeframe];
  const activeDrillDown = selectedVendor ? vendorDrillDownData[timeframe][selectedVendor] : [];
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
    if (vendor) setSelectedVendor(vendor);
  };

  const handleVendorFromLocationPress = (location) => {
    const vendor = resolveVendorName(location);
    if (vendor) setSelectedVendor(vendor);
  };

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

        {/* Timeframe toggle */}
        <div className="flex bg-slate-700 p-0.5 rounded-lg">
          <button
            onClick={() => setTimeframe('week')}
            className={`px-2 py-1 text-xs rounded-md transition-all font-medium ${timeframe === 'week' ? 'bg-white text-gray-800 shadow-sm' : 'text-slate-300'}`}
          >
            Week
          </button>
          <button
            onClick={() => setTimeframe('month')}
            className={`px-2 py-1 text-xs rounded-md transition-all font-medium ${timeframe === 'month' ? 'bg-white text-gray-800 shadow-sm' : 'text-slate-300'}`}
          >
            Month
          </button>
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
                    <p className="text-xs text-blue-600 mt-1 font-medium">92% return rate</p>
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
                      <AreaChart data={activeMacro.trend} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <defs>
                          <linearGradient id="mColorDisposable" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="mColorReusable" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="mColorPersonal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#94a3b8', fontSize: 10 }} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', fontSize: 11 }} />
                        <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="disposable" name="Single-Use" stroke="#ef4444" strokeWidth={2} fill="url(#mColorDisposable)" />
                        <Area type="monotone" dataKey="rental" name="Rental" stroke="#3b82f6" strokeWidth={2} fill="url(#mColorReusable)" />
                        <Area type="monotone" dataKey="personal" name="BYO" stroke="#22c55e" strokeWidth={2} fill="url(#mColorPersonal)" />
                      </AreaChart>
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
                    {[
                      { name: 'Frontier Canteen', status: 'Low Clean Cups (12 left)', statusColor: 'text-red-500', action: 'Dispatch', actionColor: 'text-blue-600 hover:text-blue-800' },
                      { name: 'UTown Fine Food', status: 'Drop-off Bin 80% Full', statusColor: 'text-yellow-600', action: 'Collect', actionColor: 'text-blue-600 hover:text-blue-800' },
                      { name: 'Deck Drink Stall', status: 'Optimal (150 clean)', statusColor: 'text-green-600', action: '--', actionColor: 'text-gray-400 cursor-not-allowed' },
                      { name: 'Techno Edge', status: 'Optimal (110 clean)', statusColor: 'text-green-600', action: '--', actionColor: 'text-gray-400 cursor-not-allowed' },
                    ].map((row) => (
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
              </>

          ) : (

              /* ── STAKEHOLDER MICRO (VENDOR DRILL-DOWN) VIEW ── */
              <>
                <button
                  onClick={() => setSelectedVendor(null)}
                  className="flex items-center gap-1 text-sm text-slate-600 hover:text-blue-700 transition-colors font-semibold bg-white border border-slate-200 shadow-sm px-4 py-2 rounded-lg min-h-[44px]"
                >
                  ← Campus Overview
                </button>

                {/* Pain point */}
                <div className="bg-red-50 border border-red-100 rounded-xl p-4 text-center">
                  <p className="text-xs font-bold uppercase tracking-wide text-red-500 mb-1">Primary Pain Point</p>
                  <p className="font-semibold text-lg text-red-700">
                    {timeframe === 'week' ? 'Peak SUC Waste: 12:00 PM' : 'Peak SUC Waste: Fridays'}
                  </p>
                </div>

                {/* Drill-down area chart */}
                <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-sm font-bold text-gray-800 mb-1">{selectedVendor} Flow Breakdown</h3>
                  <p className="text-xs text-gray-500 mb-3">
                    {timeframe === 'week' ? 'Hourly peak waste analysis' : 'Daily volume consistency'}
                  </p>
                  <div style={{ height: 220 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={activeDrillDown} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10, fontWeight: 500 }} />
                        <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 10 }} />
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                        <RechartsTooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: 11 }} />
                        <Legend iconType="circle" iconSize={8} verticalAlign="top" height={28} wrapperStyle={{ fontSize: 11 }} />
                        <Area type="monotone" dataKey="disposable" name="Single-Use" stroke="#ef4444" strokeWidth={2} fillOpacity={0.15} fill="#ef4444" />
                        <Area type="monotone" dataKey="rental" name="Rental" stroke="#3b82f6" strokeWidth={2} fillOpacity={0.15} fill="#3b82f6" />
                        <Area type="monotone" dataKey="byo" name="BYO" stroke="#22c55e" strokeWidth={2} fillOpacity={0.15} fill="#22c55e" />
                      </AreaChart>
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
