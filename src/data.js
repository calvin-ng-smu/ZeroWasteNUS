// ==========================================
// 1. MACRO DATA (STAKEHOLDER TOP-LEVEL)
// ==========================================
export const appData = {
  week: {
    // Baseline (per day): BYO starts low (~100), rental oscillates (~1,000–1,200), SUC starts high (~2,500).
    // Reuse share recalculated from trend totals.
    kpis: { reuse: "34.3%", rental: "1,200", disp: "12,150", carbon: "1.2 Tons", trendText: "This Week", returnCompliance: "92.00%" },
    trend: [
      // Per-day totals are ~3,700 cups (personal + rental + disposable).
      { time: 'Mon', personal: 100, rental: 1100, disposable: 2500 },
      { time: 'Tue', personal: 120, rental: 1150, disposable: 2430 },
      { time: 'Wed', personal: 140, rental: 1080, disposable: 2480 },
      { time: 'Thu', personal: 160, rental: 1200, disposable: 2340 },
      { time: 'Fri', personal: 180, rental: 1120, disposable: 2400 },
      // Weekend placeholders (filled dynamically; should appear empty when not yet reached).
      { time: 'Sat', personal: null, rental: null, disposable: null },
      { time: 'Sun', personal: null, rental: null, disposable: null },
    ],
    vendor: [
      // Values represent only the 4 displayed foodcourts; remaining demand is spread across 5 other foodcourts not shown.
      { name: 'Frontier', byo: 83, rental: 667 },
      { name: 'UTown', byo: 76, rental: 610 },
      { name: 'Deck', byo: 62, rental: 497 },
      { name: 'Techno', byo: 55, rental: 441 },
    ],
    share: [
      // Sum of week trend buckets (Mon–Fri in the seed data).
      { name: 'Personal BYO', value: 700 },
      { name: 'Campus Rental', value: 5650 },
      { name: 'Single-Use', value: 12150 },
    ]
  },
  month: {
    // Rental scaled proportionally. Reuse: BYO 9,100 + Rental 3,395 vs Disposable 18,200 → reuse 41%.
    kpis: { reuse: "40.7%", rental: "3,395", disp: "18,200", carbon: "4.8 Tons", trendText: "This Month", returnCompliance: "92.00%" },
    trend: [
      { time: 'Week 1', personal: 1800, rental: 655, disposable: 5200 },
      { time: 'Week 2', personal: 2100, rental: 775, disposable: 4800 },
      { time: 'Week 3', personal: 2400, rental: 895, disposable: 4300 },
      { time: 'Week 4', personal: 2800, rental: 1070, disposable: 3900 },
    ],
    vendor: [
      { name: 'Frontier', byo: 1074, rental: 401 },
      { name: 'UTown', byo: 983, rental: 367 },
      { name: 'Deck', byo: 801, rental: 299 },
      { name: 'Techno', byo: 710, rental: 265 },
    ],
    share: [
      { name: 'Personal BYO', value: 9100 },
      { name: 'Campus Rental', value: 3395 },
      { name: 'Single-Use', value: 18200 },
    ]
  }
};

// ==========================================
// 2. MICRO DATA (VENDOR DRILL-DOWN)
// ==========================================
export const vendorDrillDownData = {
  week: {
    Frontier: [
      { time: '8 AM', byo: 40, rental: 12, disposable: 120 },
      { time: '10 AM', byo: 65, rental: 27, disposable: 180 },
      { time: '12 PM', byo: 120, rental: 54, disposable: 350 },
      { time: '2 PM', byo: 55, rental: 21, disposable: 140 },
      { time: '4 PM', byo: 40, rental: 12, disposable: 90 },
    ],
    UTown: [
      { time: '8 AM', byo: 30, rental: 9, disposable: 90 },
      { time: '10 AM', byo: 80, rental: 36, disposable: 210 },
      { time: '12 PM', byo: 150, rental: 71, disposable: 400 },
      { time: '2 PM', byo: 90, rental: 45, disposable: 200 },
      { time: '4 PM', byo: 100, rental: 65, disposable: 180 },
    ],
    Deck: [
      { time: '8 AM', byo: 20, rental: 6, disposable: 60 },
      { time: '10 AM', byo: 45, rental: 15, disposable: 110 },
      { time: '12 PM', byo: 100, rental: 36, disposable: 220 },
      { time: '2 PM', byo: 60, rental: 18, disposable: 130 },
      { time: '4 PM', byo: 55, rental: 15, disposable: 90 },
    ],
    Techno: [
      { time: '8 AM', byo: 50, rental: 12, disposable: 80 },
      { time: '10 AM', byo: 40, rental: 9, disposable: 90 },
      { time: '12 PM', byo: 60, rental: 21, disposable: 150 },
      { time: '2 PM', byo: 20, rental: 6, disposable: 60 },
      { time: '4 PM', byo: 20, rental: 6, disposable: 50 },
    ]
  },
  month: {
    Frontier: [
      { time: 'Mon', byo: 250, rental: 101, disposable: 800 },
      { time: 'Tue', byo: 260, rental: 104, disposable: 780 },
      { time: 'Wed', byo: 275, rental: 107, disposable: 750 },
      { time: 'Thu', byo: 290, rental: 113, disposable: 700 },
      { time: 'Fri', byo: 310, rental: 125, disposable: 650 },
    ],
    UTown: [
      { time: 'Mon', byo: 350, rental: 149, disposable: 900 },
      { time: 'Tue', byo: 360, rental: 155, disposable: 880 },
      { time: 'Wed', byo: 380, rental: 161, disposable: 850 },
      { time: 'Thu', byo: 410, rental: 173, disposable: 800 },
      { time: 'Fri', byo: 450, rental: 190, disposable: 750 },
    ],
    Deck: [
      { time: 'Mon', byo: 210, rental: 65, disposable: 600 },
      { time: 'Tue', byo: 220, rental: 68, disposable: 580 },
      { time: 'Wed', byo: 230, rental: 71, disposable: 550 },
      { time: 'Thu', byo: 245, rental: 77, disposable: 520 },
      { time: 'Fri', byo: 260, rental: 83, disposable: 500 },
    ],
    Techno: [
      { time: 'Mon', byo: 140, rental: 36, disposable: 400 },
      { time: 'Tue', byo: 145, rental: 39, disposable: 390 },
      { time: 'Wed', byo: 155, rental: 42, disposable: 370 },
      { time: 'Thu', byo: 165, rental: 45, disposable: 350 },
      { time: 'Fri', byo: 180, rental: 48, disposable: 320 },
    ]
  }
};

// ==========================================
// 3. STUDENT GAMIFICATION DATA
// ==========================================
export const studentData = {
  week: {
    kpis: { saved: "$4.50", points: "120 pts", diverted: "14", text: "This Week" },
    chart: [
      { time: 'Mon', byo: 1, rental: 1, disposable: 0 },
      { time: 'Tue', byo: 2, rental: 0, disposable: 0 },
      { time: 'Wed', byo: 1, rental: 0, disposable: 1 },
      { time: 'Thu', byo: 2, rental: 1, disposable: 0 },
      { time: 'Fri', byo: 1, rental: 2, disposable: 0 },
    ]
  },
  month: {
    kpis: { saved: "$18.50", points: "450 pts", diverted: "48", text: "This Month" },
    chart: [
      { time: 'Week 1', byo: 5, rental: 3, disposable: 2 },
      { time: 'Week 2', byo: 6, rental: 4, disposable: 1 },
      { time: 'Week 3', byo: 7, rental: 5, disposable: 0 },
      { time: 'Week 4', byo: 8, rental: 6, disposable: 1 },
    ]
  }
};

export const COLORS = ['#22c55e', '#3b82f6', '#ef4444'];
