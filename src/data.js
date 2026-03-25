// ==========================================
// 1. MACRO DATA (STAKEHOLDER TOP-LEVEL)
// ==========================================
export const appData = {
  week: {
    kpis: { reuse: "70.0%", rental: "1,850", disp: "4,650", carbon: "1.2 Tons", trendText: "This Week" },
    trend: [
      { time: 'Mon', personal: 400, rental: 240, disposable: 1200 },
      { time: 'Tue', personal: 450, rental: 300, disposable: 1100 },
      { time: 'Wed', personal: 520, rental: 390, disposable: 950 },
      { time: 'Thu', personal: 600, rental: 420, disposable: 800 },
      { time: 'Fri', personal: 750, rental: 500, disposable: 600 },
    ],
    vendor: [
      { name: 'Frontier', byo: 320, rental: 210 },
      { name: 'UTown', byo: 450, rental: 380 },
      { name: 'Deck', byo: 280, rental: 150 },
      { name: 'Techno', byo: 190, rental: 90 },
    ],
    share: [
      { name: 'Personal BYO', value: 45 },
      { name: 'Campus Rental', value: 25 },
      { name: 'Single-Use', value: 30 },
    ]
  },
  month: {
    kpis: { reuse: "65.5%", rental: "7,400", disp: "19,200", carbon: "4.8 Tons", trendText: "This Month" },
    trend: [
      { time: 'Week 1', personal: 1800, rental: 1100, disposable: 5200 },
      { time: 'Week 2', personal: 2100, rental: 1300, disposable: 4800 },
      { time: 'Week 3', personal: 2400, rental: 1500, disposable: 4300 },
      { time: 'Week 4', personal: 2800, rental: 1800, disposable: 3900 },
    ],
    vendor: [
      { name: 'Frontier', byo: 1250, rental: 850 },
      { name: 'UTown', byo: 1800, rental: 1400 },
      { name: 'Deck', byo: 1100, rental: 600 },
      { name: 'Techno', byo: 750, rental: 350 },
    ],
    share: [
      { name: 'Personal BYO', value: 48 },
      { name: 'Campus Rental', value: 28 },
      { name: 'Single-Use', value: 24 },
    ]
  }
};

// ==========================================
// 2. MICRO DATA (VENDOR DRILL-DOWN)
// ==========================================
export const vendorDrillDownData = {
  week: {
    Frontier: [
      { time: '8 AM', byo: 40, rental: 20, disposable: 120 },
      { time: '10 AM', byo: 65, rental: 45, disposable: 180 },
      { time: '12 PM', byo: 120, rental: 90, disposable: 350 },
      { time: '2 PM', byo: 55, rental: 35, disposable: 140 },
      { time: '4 PM', byo: 40, rental: 20, disposable: 90 },
    ],
    UTown: [
      { time: '8 AM', byo: 30, rental: 15, disposable: 90 },
      { time: '10 AM', byo: 80, rental: 60, disposable: 210 },
      { time: '12 PM', byo: 150, rental: 120, disposable: 400 },
      { time: '2 PM', byo: 90, rental: 75, disposable: 200 },
      { time: '4 PM', byo: 100, rental: 110, disposable: 180 },
    ],
    Deck: [
      { time: '8 AM', byo: 20, rental: 10, disposable: 60 },
      { time: '10 AM', byo: 45, rental: 25, disposable: 110 },
      { time: '12 PM', byo: 100, rental: 60, disposable: 220 },
      { time: '2 PM', byo: 60, rental: 30, disposable: 130 },
      { time: '4 PM', byo: 55, rental: 25, disposable: 90 },
    ],
    Techno: [
      { time: '8 AM', byo: 50, rental: 20, disposable: 80 },
      { time: '10 AM', byo: 40, rental: 15, disposable: 90 },
      { time: '12 PM', byo: 60, rental: 35, disposable: 150 },
      { time: '2 PM', byo: 20, rental: 10, disposable: 60 },
      { time: '4 PM', byo: 20, rental: 10, disposable: 50 },
    ]
  },
  month: {
    Frontier: [
      { time: 'Mon', byo: 250, rental: 170, disposable: 800 },
      { time: 'Tue', byo: 260, rental: 175, disposable: 780 },
      { time: 'Wed', byo: 275, rental: 180, disposable: 750 },
      { time: 'Thu', byo: 290, rental: 190, disposable: 700 },
      { time: 'Fri', byo: 310, rental: 210, disposable: 650 },
    ],
    UTown: [
      { time: 'Mon', byo: 350, rental: 250, disposable: 900 },
      { time: 'Tue', byo: 360, rental: 260, disposable: 880 },
      { time: 'Wed', byo: 380, rental: 270, disposable: 850 },
      { time: 'Thu', byo: 410, rental: 290, disposable: 800 },
      { time: 'Fri', byo: 450, rental: 320, disposable: 750 },
    ],
    Deck: [
      { time: 'Mon', byo: 210, rental: 110, disposable: 600 },
      { time: 'Tue', byo: 220, rental: 115, disposable: 580 },
      { time: 'Wed', byo: 230, rental: 120, disposable: 550 },
      { time: 'Thu', byo: 245, rental: 130, disposable: 520 },
      { time: 'Fri', byo: 260, rental: 140, disposable: 500 },
    ],
    Techno: [
      { time: 'Mon', byo: 140, rental: 60, disposable: 400 },
      { time: 'Tue', byo: 145, rental: 65, disposable: 390 },
      { time: 'Wed', byo: 155, rental: 70, disposable: 370 },
      { time: 'Thu', byo: 165, rental: 75, disposable: 350 },
      { time: 'Fri', byo: 180, rental: 80, disposable: 320 },
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
