/* ------------------------------------------------------------------
   SETTINGS — everything you might need to change lives in this file.
   This file is public: anyone can view it in their browser.
   Only put customer-facing prices here.
------------------------------------------------------------------- */
window.SL_CONFIG = {
  company: "PowerPayback",
  phone: "",            // shown on the thank-you page, e.g. "03 9000 0000"
  salesName: "",        // e.g. "Sam" -> "Sam will call you"
  privacyEmail: "",     // shown on the privacy policy page for requests and complaints

  // Paste the Google Apps Script web-app URL here to go live (see SETUP.md).
  // While this is empty the funnel runs in DEMO mode: leads are saved in
  // this browser only and show up in dashboard.html on the same device.
  webhookUrl: "https://script.google.com/macros/s/AKfycbzR2L9BgCVjl1V_vtuVoDqPGoarjo6t6d9PE0rzkUMkt7pVDMkiBD5FLKoPjwEGIGAi/exec",

  showPrices: true,     // false = show savings only, no dollar price for the system

  tariff: {
    usageRate: 0.28,    // $/kWh  — Victorian Default Offer 2026-27 is roughly 26-32c
    supplyPerDay: 1.30, // $/day  — VDO 2026-27 is roughly $1.19-$1.38
    feedIn: 0.03        // $/kWh  — retailers set their own since July 2025; most are 0-5c
  },

  solar: {
    yieldPerKwPerDay: 3.6,              // kWh per kW per day, Melbourne average
    panels: "Hanersun 475W panels",
    sizesKw: [6.6, 10],
    stcDiscount: { "6.6": 2173, "10": 3280 }   // federal solar discount already taken off the prices below
  },

  /* Customer prices, after federal discounts.
     "withSolar" prices also assume the Solar Victoria rebate AND the
     Solar Victoria interest-free loan are both used (the calculator adds
     them back for people who are not eligible). */
  offers: {
    value: {
      label: "Best value",
      battery: "Hiconics 30 kWh battery",
      batteryKwh: 30,
      batteryDiscount: 6314,            // federal battery discount already taken off
      batteryOnly: 4236,
      withSolar: { "6.6": 6083, "10": 6966 }
    },
    mid: {
      label: "Mid-range",
      battery: "FoxESS 28 kWh battery",
      batteryKwh: 28,
      batteryDiscount: 6232,
      batteryOnly: 6397,
      withSolar: { "6.6": 9123, "10": 10227 },
      // Used instead when the customer says they have three-phase power.
      // Add a threePhase block to another offer to give it three-phase prices too.
      threePhase: {
        battery: "FoxESS 28 kWh three-phase battery",
        batteryOnly: 7167,
        withSolar: { "6.6": 9893, "10": 10997 }
      }
    },
    premium: {
      label: "Premium",
      battery: "Sigenergy 27 kWh battery",
      batteryKwh: 27,
      batteryDiscount: 6068,
      batteryOnly: 8503,
      withSolar: { "6.6": 10350, "10": 12365 }
    }
  },

  rebates: {
    // Solar Victoria 2026-27: owner-occupiers, combined household income
    // under $150,000, no existing solar. The loan is repaid over four years.
    // Deadline banner. The federal battery discount steps down from 6.8 to 5.7
    // certificates per kWh on this date, based on when the battery is switched on.
    // The banner hides itself once the date passes; then set the next step-down here.
    batteryStepDown: { date: "2027-01-01", label: "1 January 2027", keeps: 5.7 / 6.8 },
    solarVic: 1400,
    solarVicLoan: 1400
  }
};
