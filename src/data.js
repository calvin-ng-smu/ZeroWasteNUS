// ==========================================
// 1. MACRO DATA (STAKEHOLDER TOP-LEVEL)
// ==========================================
export const appData = {
  week: {
    // Rental ceiling reduced to ~1,100 (fluctuation range 1,000–1,200).
    // Reuse share recalculated: BYO 2,720 + Rental 1,105 vs Disposable 4,650 → reuse 45%.
    kpis: { reuse: "45.0%", rental: "1,100", disp: "4,650", carbon: "1.2 Tons", trendText: "This Week" },
    trend: [
      // Per-day totals are fixed at 1,800 cups (personal + rental + disposable).
      { time: 'Mon', personal: 400, rental: 145, disposable: 1255 },
      { time: 'Tue', personal: 450, rental: 180, disposable: 1170 },
      { time: 'Wed', personal: 520, rental: 230, disposable: 1050 },
      { time: 'Thu', personal: 600, rental: 250, disposable: 950 },
      { time: 'Fri', personal: 750, rental: 300, disposable: 750 },
      // Weekend placeholders (filled dynamically; should appear empty when not yet reached).
      { time: 'Sat', personal: null, rental: null, disposable: null },
      { time: 'Sun', personal: null, rental: null, disposable: null },
    ],
    vendor: [
      { name: 'Frontier', byo: 320, rental: 125 },
      { name: 'UTown', byo: 450, rental: 225 },
      { name: 'Deck', byo: 280, rental: 90 },
      { name: 'Techno', byo: 190, rental: 55 },
    ],
    share: [
      { name: 'Personal BYO', value: 32 },
      { name: 'Campus Rental', value: 13 },
      { name: 'Single-Use', value: 55 },
    ]
  },
  month: {
    // Rental scaled proportionally. Reuse: BYO 9,100 + Rental 3,395 vs Disposable 18,200 → reuse 41%.
    kpis: { reuse: "41.0%", rental: "4,400", disp: "19,200", carbon: "4.8 Tons", trendText: "This Month" },
    trend: [
      { time: 'Week 1', personal: 1800, rental: 655, disposable: 5200 },
      { time: 'Week 2', personal: 2100, rental: 775, disposable: 4800 },
      { time: 'Week 3', personal: 2400, rental: 895, disposable: 4300 },
      { time: 'Week 4', personal: 2800, rental: 1070, disposable: 3900 },
    ],
    vendor: [
      { name: 'Frontier', byo: 1250, rental: 505 },
      { name: 'UTown', byo: 1800, rental: 835 },
      { name: 'Deck', byo: 1100, rental: 355 },
      { name: 'Techno', byo: 750, rental: 210 },
    ],
    share: [
      { name: 'Personal BYO', value: 30 },
      { name: 'Campus Rental', value: 11 },
      { name: 'Single-Use', value: 59 },
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
