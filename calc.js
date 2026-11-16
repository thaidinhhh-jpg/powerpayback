/* Savings estimate + lead scoring. Pure functions, no page access. */
(function (root) {
  var DAY_SHARE_NEW = { out: 0.25, mix: 0.38, home: 0.52 };   // share of usage solar covers directly
  var SELF_USE_EXISTING = { out: 0.30, mix: 0.42, home: 0.55 }; // share of solar output used in the home
  var SOLAR_BUCKET_KW = { s3: 3, s5: 5, s7: 6.6, s10: 9, s13: 13, unsure: 5 };
  var AGE_DERATE = { new: 1, mid: 0.93, old: 0.85 };
  var EFF = 0.92, USABLE = 0.9;

  function pick(sizes, need) {
    for (var i = 0; i < sizes.length; i++) if (sizes[i] >= need) return sizes[i];
    return sizes[sizes.length - 1];
  }
  function round50(n) { return Math.round(n / 50) * 50; }

  /* Price of one offer for a new solar + battery system. */
  function newSystemPrice(offer, kw, vicOk, C) {
    var R = C.rebates, upfront = offer.withSolar[String(kw)];
    // List prices assume the Solar Victoria rebate and loan. The loan is repaid, so it counts as cost.
    var total = upfront + R.solarVicLoan + (vicOk ? 0 : R.solarVic);
    return {
      total: total,
      upfrontWithLoan: vicOk ? upfront : null,
      solarVic: vicOk ? R.solarVic : 0,
      stc: C.solar.stcDiscount[String(kw)],
      gross: total + offer.batteryDiscount + C.solar.stcDiscount[String(kw)] + (vicOk ? R.solarVic : 0)
    };
  }

  /* Swap in an offer's three-phase prices when the customer has three-phase power and the offer has them. */
  function forPhase(offer, a) {
    if (a.phase !== "three" || !offer.threePhase) return offer;
    var o = {}, k;
    for (k in offer) o[k] = offer[k];
    for (k in offer.threePhase) o[k] = offer.threePhase[k];
    o.isThreePhase = true;
    return o;
  }

  function estimate(a, C) {
    var T = C.tariff, rate = T.usageRate, fit = T.feedIn;
    var V = forPhase(C.offers.value, a), M = forPhase(C.offers.mid, a), P = forPhase(C.offers.premium, a);
    var annualBill = a.bill * 4;
    var supply = T.supplyPerDay * 365;
    var importKwh = Math.max(800, (annualBill - supply) / rate);
    var extras = a.extras || [];
    var out = { path: a.hasSolar === "no" ? "new" : "addBattery", annualBill: annualBill,
                batteryKwh: V.batteryKwh, batteryName: V.battery, batteryDiscount: V.batteryDiscount };

    if (a.hasSolar === "no") {
      var usage = importKwh;
      var target = usage * 1.25 + (extras.indexOf("ev") >= 0 ? 2500 : 0);
      var kw = pick(C.solar.sizesKw, target / (C.solar.yieldPerKwPerDay * 365));
      var prod = kw * C.solar.yieldPerKwPerDay * 365;
      var direct = Math.min(usage * DAY_SHARE_NEW[a.daytime], prod * 0.9);
      var evening = usage - direct;
      var excess = prod - direct;
      var shifted = Math.min(excess * EFF, evening * 0.9, V.batteryKwh * USABLE * 365 * 0.85);
      var exported = excess - shifted / EFF;

      var vicOk = a.ownership === "owner" && a.income !== "no";
      var price = newSystemPrice(V, kw, vicOk, C);
      out.solarKw = kw;
      out.savings = direct * rate + shifted * rate + exported * fit;
      out.gross = price.gross;
      out.stcDiscount = price.stc;
      out.solarVic = price.solarVic;
      out.solarVicUnsure = vicOk && a.income !== "yes";
      out.netCost = price.total;
      out.upfrontWithLoan = price.upfrontWithLoan;
      out.loan = vicOk ? C.rebates.solarVicLoan : 0;
      out.alternatives = [M, P].map(function (o) {
        return { name: o.battery, netCost: newSystemPrice(o, kw, vicOk, C).total };
      });
      out.gridCut = Math.round(((direct + shifted) / usage) * 100);
    } else {
      var skw = SOLAR_BUCKET_KW[a.solarSize] || 5;
      var sprod = skw * C.solar.yieldPerKwPerDay * 365 * (AGE_DERATE[a.solarAge] || 0.93);
      var exp = sprod * (1 - SELF_USE_EXISTING[a.daytime]);
      var eveImport = importKwh * 0.8;
      var sh = Math.min(exp * EFF, eveImport * 0.9, V.batteryKwh * USABLE * 365 * 0.8);

      out.solarKw = skw;
      out.savings = sh * rate - (sh / EFF) * fit;
      out.netCost = V.batteryOnly;
      out.gross = V.batteryOnly + V.batteryDiscount;
      out.solarVic = 0;
      out.alternatives = [M, P].map(function (o) {
        return { name: o.battery, netCost: o.batteryOnly };
      });
      out.gridCut = Math.round((sh / importKwh) * 100);
      out.fit = out.savings >= 900 ? "great" : out.savings >= 500 ? "good" : "marginal";
    }

    // Tell the page when a three-phase home is being shown any single-phase price.
    out.phaseNote = a.phase === "three" && !(V.isThreePhase && M.isThreePhase && P.isThreePhase);
    out.savings = Math.max(0, out.savings);
    out.savingsLow = round50(out.savings * 0.88);
    out.savingsHigh = round50(out.savings * 1.12);
    out.payback = out.savings > 0 ? Math.round((out.netCost / out.savings) * 10) / 10 : null;
    out.billAfter = Math.max(Math.round(supply), Math.round(annualBill - out.savings));
    return out;
  }

  /* 0-100. Hot >= 70, Warm 40-69, Cold below. */
  function score(a, est) {
    var s = 0;
    if (a.type === "business") {
      s = 45 + ({ b1: 0, b2: 15, b3: 30, b4: 40 }[a.bizSpend] || 0);
      s += { asap: 15, soon: 10, later: 3, research: 0 }[a.timeframe] || 0;
    } else {
      s += { owner: 30, landlord: 15, renter: 0 }[a.ownership] || 0;
      s += a.bill >= 700 ? 25 : a.bill >= 450 ? 18 : a.bill >= 300 ? 10 : 3;
      s += { asap: 25, soon: 18, later: 8, research: 2 }[a.timeframe] || 0;
      if (a.hasSolar === "yes") s += 8;            // battery-only: simplest sale
      if (a.hasSolar === "both") s -= 25;          // already has a battery
      var ex = a.extras || [];
      if (ex.indexOf("ev") >= 0) s += 5;
      if (ex.indexOf("blackout") >= 0) s += 4;
      if (est && est.payback && est.payback <= 8) s += 5;
      if (a.ownership === "renter") s = Math.min(s, 30);
    }
    s = Math.max(0, Math.min(100, Math.round(s)));
    return { score: s, grade: s >= 70 ? "Hot" : s >= 40 ? "Warm" : "Cold" };
  }

  root.SLCalc = { estimate: estimate, score: score };
})(typeof window !== "undefined" ? window : globalThis);
