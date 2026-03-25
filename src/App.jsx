import React, { useState } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar, Legend, PieChart, Pie, Cell } from 'recharts';
import { appData, vendorDrillDownData, studentData, COLORS } from './data.js';
import MobileApp from './MobileApp.jsx';

// ==========================================
// MAIN COMPONENT
// ==========================================
export default function ZeroWasteDashboard() {
  const [viewRole, setViewRole] = useState('stakeholder');
  const [selectedVendor, setSelectedVendor] = useState(null);
  const [timeframe, setTimeframe] = useState('week');
  const [showMobile, setShowMobile] = useState(false);

  if (showMobile) {
    return (
      <div className="h-screen">
        <MobileApp onBack={() => setShowMobile(false)} />
      </div>
    );
  }

  // Active Datasets based on filters
  const activeMacro = appData[timeframe];
  const activeStudent = studentData[timeframe];
  // Dynamically pull the correct drill-down data (e.g. Frontier's Hourly vs Frontier's Daily)
  const activeDrillDown = selectedVendor ? vendorDrillDownData[timeframe][selectedVendor] : [];

  // Click Handler for Vendor Bars
  const handleVendorClick = (data) => {
    if (data && data.name) {
      setSelectedVendor(data.name);
    }
  };

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
          <button 
            onClick={() => { setViewRole('stakeholder'); setSelectedVendor(null); }}
            className={`w-full text-left px-4 py-3 rounded-lg mb-2 transition-all ${viewRole === 'stakeholder' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            📊 Macro Stakeholder
          </button>
          <button 
            onClick={() => { setViewRole('student'); setSelectedVendor(null); }}
            className={`w-full text-left px-4 py-3 rounded-lg transition-all ${viewRole === 'student' ? 'bg-green-600 text-white shadow-md' : 'text-slate-300 hover:bg-slate-800'}`}
          >
            📱 Micro Student
          </button>
        </div>
        <div className="p-4 border-t border-slate-800 text-xs text-slate-500 text-center">
          System Live • V 2.4.1
        </div>
      </div>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* TOP HEADER */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-8 shadow-sm z-0">
          <h2 className="text-xl font-semibold text-gray-800">
            {viewRole === 'stakeholder' 
              ? (selectedVendor ? `Vendor Logistics: ${selectedVendor}` : 'Campus Sustainability Overview') 
              : 'My Personal Impact Hub'}
          </h2>
          <div className="flex items-center space-x-4">
            
            {/* TIMEFRAME FILTER */}
            <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
              <button 
                onClick={() => setTimeframe('week')}
                className={`px-3 py-1 text-sm rounded-md transition-all ${timeframe === 'week' ? 'bg-white shadow-sm text-gray-800 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
              >
                This Week
              </button>
              <button 
                onClick={() => setTimeframe('month')}
                className={`px-3 py-1 text-sm rounded-md transition-all ${timeframe === 'month' ? 'bg-white shadow-sm text-gray-800 font-semibold' : 'text-gray-500 hover:text-gray-700'}`}
              >
                This Month
              </button>
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
          
          {viewRole === 'stakeholder' ? (
            
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
                      <p className="text-xs text-blue-600 mt-1 font-medium">92% return compliance</p>
                    </div>
                    <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 border-t-4 border-t-red-400 transition-all">
                      <p className="text-sm font-medium text-gray-500">Disposables Used</p>
                      <p className="text-3xl font-bold text-gray-800 mt-1">{activeMacro.kpis.disp}</p>
                      <p className="text-xs text-red-500 mt-1 font-medium">↓ Dropping consistently</p>
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
                          <AreaChart data={activeMacro.trend} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                            <defs>
                              <linearGradient id="colorDisposable" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorReusable" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                              </linearGradient>
                              <linearGradient id="colorPersonal" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#22c55e" stopOpacity={0.4}/>
                                <stop offset="95%" stopColor="#22c55e" stopOpacity={0}/>
                              </linearGradient>
                            </defs>
                            <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8'}} />
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                            <RechartsTooltip contentStyle={{borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}} />
                            <Legend iconType="circle" />
                            <Area type="monotone" dataKey="disposable" name="Single-Use (SUC)" stroke="#ef4444" strokeWidth={2} fill="url(#colorDisposable)" />
                            <Area type="monotone" dataKey="rental" name="Campus Rental" stroke="#3b82f6" strokeWidth={2} fill="url(#colorReusable)" />
                            <Area type="monotone" dataKey="personal" name="Personal BYO" stroke="#22c55e" strokeWidth={2} fill="url(#colorPersonal)" />
                          </AreaChart>
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
                          <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-green-500 mr-2"></div>BYO</span>
                          <span className="flex items-center"><div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>Rental</span>
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
                            <YAxis dataKey="name" type="category" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontSize: 12}} width={70} />
                            <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: 'none'}}/>
                            <Legend iconType="circle" />
                            <Bar dataKey="byo" name="Personal BYO" stackId="a" fill="#22c55e" radius={[0, 0, 0, 0]} barSize={20} onClick={handleVendorClick} style={{cursor: 'pointer'}} />
                            <Bar dataKey="rental" name="Rental Cups" stackId="a" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} onClick={handleVendorClick} style={{cursor: 'pointer'}} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">Live Logistics Feed</h3>
                        <span className="flex items-center text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-green-500 animate-pulse mr-2"></span>Live Sync</span>
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
                            <tr className="border-b border-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-800">Frontier Canteen</td>
                              <td className="px-4 py-3 text-red-500 font-medium">Low Clean Cups (12 left)</td>
                              <td className="px-4 py-3"><button className="text-blue-600 hover:text-blue-800 font-medium transition-colors">Dispatch</button></td>
                            </tr>
                            <tr className="border-b border-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-800">UTown Fine Food</td>
                              <td className="px-4 py-3 text-yellow-600 font-medium">Drop-off Bin 80% Full</td>
                              <td className="px-4 py-3"><button className="text-blue-600 hover:text-blue-800 font-medium transition-colors">Collect</button></td>
                            </tr>
                            <tr className="border-b border-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-800">Deck Drink Stall</td>
                              <td className="px-4 py-3 text-green-600 font-medium">Optimal (150 clean)</td>
                              <td className="px-4 py-3"><button className="text-gray-400 cursor-not-allowed">--</button></td>
                            </tr>
                            <tr className="border-b border-gray-50">
                              <td className="px-4 py-3 font-medium text-gray-800">Techno Edge</td>
                              <td className="px-4 py-3 text-green-600 font-medium">Optimal (110 clean)</td>
                              <td className="px-4 py-3"><button className="text-gray-400 cursor-not-allowed">--</button></td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
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
                        <p className="text-sm text-gray-500 mt-1">
                          {timeframe === 'week' ? 'Analyzing specific hourly peak waste times to optimize logistics.' : 'Analyzing daily volume consistency across the past month.'}
                        </p>
                      </div>
                      <div className="mt-4 md:mt-0 bg-red-50 text-red-700 px-4 py-3 rounded-lg text-sm border border-red-100 shadow-inner flex flex-col items-center">
                        <span className="font-bold uppercase tracking-wide text-xs">Primary Pain Point</span>
                        <span className="font-semibold text-lg">{timeframe === 'week' ? 'Peak SUC Waste: 12:00 PM' : 'Peak SUC Waste: Fridays'}</span>
                      </div>
                    </div>
                    
                    <div className="h-96 w-full mt-8">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={activeDrillDown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 500}} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                          <RechartsTooltip contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                          <Legend iconType="circle" verticalAlign="top" height={36}/>
                          <Area type="monotone" dataKey="disposable" name="Single-Use (SUC)" stroke="#ef4444" strokeWidth={3} fillOpacity={0.15} fill="#ef4444" />
                          <Area type="monotone" dataKey="rental" name="Campus Rental" stroke="#3b82f6" strokeWidth={3} fillOpacity={0.15} fill="#3b82f6" />
                          <Area type="monotone" dataKey="byo" name="Personal BYO" stroke="#22c55e" strokeWidth={3} fillOpacity={0.15} fill="#22c55e" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
          ) : (

            /* =========================================================
               STUDENT: GAMIFICATION VIEW 
               ========================================================= */
            <div className="space-y-6 animate-fadeIn">
              
              {/* STREAK BANNER */}
              <div className="bg-gradient-to-r from-emerald-500 to-teal-500 p-6 rounded-xl shadow-md text-white flex flex-col md:flex-row items-start md:items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold flex items-center">
                    You're on a 5-Day BYO Streak! <span className="text-3xl ml-2 drop-shadow-md">🔥</span>
                  </h3>
                  <p className="text-emerald-50 mt-1 font-medium">Keep it up! You're only 2 scans away from a free cup wash.</p>
                </div>
                <div className="w-full md:w-1/3 mt-6 md:mt-0 bg-white/20 p-4 rounded-lg backdrop-blur-sm border border-white/30">
                  <div className="flex justify-between text-xs mb-2 font-bold uppercase tracking-wide text-white">
                    <span>Reward Progress</span>
                    <span>8 / 10 Scans</span>
                  </div>
                  <div className="w-full bg-emerald-900/50 rounded-full h-3 border border-emerald-800/50">
                    <div className="bg-white h-3 rounded-full shadow-[0_0_10px_rgba(255,255,255,0.8)] transition-all duration-1000 ease-out" style={{ width: '80%' }}></div>
                  </div>
                </div>
              </div>

              {/* KPI CARDS */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center hover:-translate-y-1 transition-transform">
                  <div className="p-3 bg-green-100 text-green-600 rounded-xl mr-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Money Saved</p>
                    <p className="text-3xl font-bold text-gray-800 transition-all">{activeStudent.kpis.saved}</p>
                    <p className="text-xs text-gray-400 font-medium">From BYO discounts</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center hover:-translate-y-1 transition-transform">
                  <div className="p-3 bg-blue-100 text-blue-600 rounded-xl mr-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"></path></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Washing Credits</p>
                    <p className="text-3xl font-bold text-gray-800 transition-all">{activeStudent.kpis.points}</p>
                    <p className="text-xs text-gray-400 font-medium">Ready to redeem via QR</p>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-100 flex items-center hover:-translate-y-1 transition-transform">
                  <div className="p-3 bg-purple-100 text-purple-600 rounded-xl mr-4">
                    <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-500 uppercase tracking-wide">Cups Diverted</p>
                    <p className="text-3xl font-bold text-gray-800 transition-all">{activeStudent.kpis.diverted}</p>
                    <p className="text-xs text-gray-400 font-medium">Total single-use avoided</p>
                  </div>
                </div>
              </div>

              {/* CHART & ACTIVITY ROW */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                
                {/* Personal Bar Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                  <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2">My Impact History ({activeStudent.kpis.text})</h3>
                  <div className="h-64 w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={activeStudent.chart} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                        <XAxis dataKey="time" axisLine={false} tickLine={false} tick={{fill: '#64748b', fontWeight: 500}} />
                        <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748b'}} />
                        <RechartsTooltip cursor={{fill: '#f8fafc'}} contentStyle={{borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'}}/>
                        <Legend iconType="circle" wrapperStyle={{paddingTop: '10px'}}/>
                        <Bar dataKey="byo" name="Personal BYO" stackId="a" fill="#22c55e" radius={[0, 0, 4, 4]} barSize={35} />
                        <Bar dataKey="rental" name="Campus Rental" stackId="a" fill="#3b82f6" barSize={35} />
                        <Bar dataKey="disposable" name="Single-Use (Oops!)" stackId="a" fill="#ef4444" radius={[4, 4, 0, 0]} barSize={35} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Activity Feed */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                  <h3 className="text-lg font-bold text-gray-800 mb-6 border-b pb-2">Recent Transactions</h3>
                  <div className="space-y-5">
                    <div className="flex items-start">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5 mr-3 shadow-[0_0_5px_rgba(59,130,246,0.6)]"></div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-800">Returned Rental Cup</p>
                        <p className="text-xs text-gray-500 font-medium">UTown Drop-off • 2 hrs ago</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="w-3 h-3 rounded-full bg-blue-500 mt-1.5 mr-3"></div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-800">Checked Out: Rental</p>
                        <p className="text-xs text-gray-500 font-medium">Frontier Canteen • 4 hrs ago</p>
                      </div>
                    </div>
                    <div className="flex items-start">
                      <div className="w-3 h-3 rounded-full bg-green-500 mt-1.5 mr-3 shadow-[0_0_5px_rgba(34,197,94,0.6)]"></div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-800">Checked Out: BYO</p>
                        <p className="text-xs text-gray-500 font-medium">Deck Drinks • Yesterday</p>
                      </div>
                      <span className="text-xs font-bold text-green-600 bg-green-50 px-2 py-1 rounded border border-green-100">-$0.50</span>
                    </div>
                    <div className="flex items-start opacity-60">
                      <div className="w-3 h-3 rounded-full bg-red-500 mt-1.5 mr-3"></div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-gray-800 line-through decoration-red-400">Checked Out: SUC</p>
                        <p className="text-xs text-gray-500 font-medium">Techno Edge • Wed</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}