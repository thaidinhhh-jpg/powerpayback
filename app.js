(function () {
  var C = window.SL_CONFIG, Calc = window.SLCalc;
  var app = document.getElementById("app");
  document.getElementById("brandName").textContent = C.company;

  var a = { extras: [], bill: 500 };   // answers
  var trail = [];                      // step ids visited, for Back
  var est = null;

  var isHome = function () { return a.type === "home"; };
  var STEPS = [
    { id: "type", kind: "choice", q: "What are you looking to power?",
      sub: "See what solar and a battery could save you. It takes about a minute.",
      options: [
        { v: "home", label: "My home", hint: "House, townhouse or unit" },
        { v: "business", label: "A business", hint: "Shop, office, warehouse, farm" }
      ] },
    { id: "postcode", kind: "postcode", q: "What's the postcode?",
      sub: "Rebates and sunshine hours depend on where you are." },

    /* ---- business (short path) ---- */
    { id: "bizSpend", kind: "choice", when: function () { return a.type === "business"; },
      q: "Roughly how much is the electricity bill each month?",
      options: [
        { v: "b1", label: "Under $1,000" }, { v: "b2", label: "$1,000 – $3,000" },
        { v: "b3", label: "$3,000 – $10,000" }, { v: "b4", label: "Over $10,000" }
      ] },

    /* ---- home ---- */
    { id: "ownership", kind: "choice", when: isHome, q: "Do you own the property?",
      options: [
        { v: "owner", label: "Yes, and I live there" },
        { v: "landlord", label: "Yes, it's a rental I own" },
        { v: "renter", label: "No, I'm renting" }
      ] },
    { id: "hasSolar", kind: "choice", when: isHome, q: "Do you already have solar panels?",
      options: [
        { v: "no", label: "No solar yet", hint: "We'll size solar and a battery together" },
        { v: "yes", label: "Yes, solar but no battery", hint: "We'll check if a battery stacks up" },
        { v: "both", label: "Yes, solar and a battery" }
      ] },
    { id: "roof", kind: "choice", two: true, when: function () { return isHome() && a.hasSolar === "no"; },
      q: "What's the roof made of?",
      options: [
        { v: "tin", label: "Metal", hint: "Colorbond or tin" }, { v: "tile", label: "Tile" },
        { v: "flat", label: "Flat roof" }, { v: "unsure", label: "Not sure" }
      ] },
    { id: "storeys", kind: "choice", two: true, when: function () { return isHome() && a.hasSolar === "no"; },
      q: "How many storeys?",
      options: [{ v: "single", label: "Single storey" }, { v: "double", label: "Two or more" }] },
    { id: "solarSize", kind: "choice", two: true, when: function () { return isHome() && a.hasSolar !== "no"; },
      q: "How big is your solar system?", sub: "It's on your inverter or your original quote. A guess is fine.",
      options: [
        { v: "s3", label: "Up to 3 kW", hint: "About 8–12 panels" }, { v: "s5", label: "4–5 kW", hint: "About 13–18 panels" },
        { v: "s7", label: "6–7 kW", hint: "About 15–20 panels" }, { v: "s10", label: "8–10 kW" },
        { v: "s13", label: "Over 10 kW" }, { v: "unsure", label: "Not sure" }
      ] },
    { id: "solarAge", kind: "choice", when: function () { return isHome() && a.hasSolar === "yes"; },
      q: "How old is the system?",
      options: [
        { v: "new", label: "Under 5 years" }, { v: "mid", label: "5–10 years" }, { v: "old", label: "Over 10 years" }
      ] },
    { id: "inverter", kind: "choice", two: true, when: function () { return isHome() && a.hasSolar === "yes"; },
      q: "Which inverter brand do you have?", sub: "This tells us which batteries will connect easily.",
      options: ["Fronius", "Sungrow", "SolarEdge", "GoodWe", "Enphase", "SMA", "Growatt", "Other / not sure"]
        .map(function (n) { return { v: n, label: n }; }) },
    { id: "phase", kind: "choice", when: isHome, q: "Is your home single phase or three phase?",
      sub: "Look at your switchboard. One main switch usually means single phase. Three joined together usually means three phase.",
      options: [
        { v: "single", label: "Single phase", hint: "Most homes" },
        { v: "three", label: "Three phase", hint: "Often larger homes, or ducted air conditioning" },
        { v: "unsure", label: "I don't know", hint: "No problem, we'll check for you" }
      ] },
    { id: "bill", kind: "bill", when: isHome, q: "About how much is your electricity bill each quarter?",
      sub: "Drag the slider. If you're billed monthly, multiply by three." },
    { id: "daytime", kind: "choice", when: isHome, q: "Is anyone home during the day?",
      options: [
        { v: "out", label: "Mostly out", hint: "Work or school on weekdays" },
        { v: "mix", label: "A mix", hint: "Some days home, some out" },
        { v: "home", label: "Home most days", hint: "Work from home, retired, young kids" }
      ] },
    { id: "extras", kind: "multi", when: isHome, q: "Do any of these apply?", sub: "Tick all that fit, or skip.",
      options: [
        { v: "ev", label: "Electric car, now or soon" },
        { v: "pool", label: "Pool or spa" },
        { v: "electric", label: "Electric heating or hot water" },
        { v: "blackout", label: "I want power during blackouts" }
      ] },
    { id: "timeframe", kind: "choice", q: "When are you hoping to get this done?",
      options: [
        { v: "asap", label: "As soon as possible" }, { v: "soon", label: "In the next 1–3 months" },
        { v: "later", label: "In 3–6 months" }, { v: "research", label: "Just researching" }
      ] },
    { id: "income", kind: "choice",
      when: function () { return isHome() && a.hasSolar === "no" && a.ownership === "owner"; },
      q: "Is your combined household income under $150,000 a year?",
      sub: "This decides whether you can claim the Solar Victoria rebate of up to $" + C.rebates.solarVic.toLocaleString() + ".",
      options: [{ v: "yes", label: "Yes" }, { v: "no", label: "No" }, { v: "unsure", label: "Not sure / rather not say" }] }
  ];

  /* ---------- tiny DOM helper ---------- */
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];        // static strings only
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }
  function money(n) { return "$" + Math.round(n).toLocaleString("en-AU"); }
  function active() { return STEPS.filter(function (s) { return !s.when || s.when(); }); }

  function nextAfter(id) {
    var list = active(), i = list.map(function (s) { return s.id; }).indexOf(id);
    return list[i + 1];
  }
  function go(id) { trail.push(id); render(); }
  function advance(fromId) {
    var n = nextAfter(fromId);
    if (n) go(n.id); else { trail.push("result"); render(); }
  }
  function back() { trail.pop(); render(); }

  function shell(stepId) {
    app.innerHTML = "";
    var list = active(), idx = list.map(function (s) { return s.id; }).indexOf(stepId);
    var pct = stepId === "result" ? 100 : Math.round(((idx + 1) / (list.length + 1)) * 100);
    app.appendChild(el("div", { class: "progress" }, [el("i", { style: "width:" + pct + "%" })]));
    if (trail.length > 1) app.appendChild(el("button", { class: "back", type: "button", onclick: back, text: "← Back" }));
  }

  /* ---------- anonymous step counts ----------
     Records which quiz step a visit reached, so we can see where people stop.
     Sends the step name, the ad tag and a random number made for this page view.
     No answers, no contact details, no cookie, nothing saved in the browser. */
  var visit = Math.random().toString(36).slice(2, 12);
  var seen = {};
  function track(step) {
    if (!C.webhookUrl || seen[step]) return;
    seen[step] = true;
    try {
      fetch(C.webhookUrl, { method: "POST", keepalive: true, headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "step", sid: visit, step: step, source: location.search.replace(/^\?/, "").slice(0, 50) }) })
        .catch(function () {});
    } catch (e) { /* counting must never break the quiz */ }
  }

  function render() {
    var id = trail[trail.length - 1];
    track(id);
    if (id === "result") return renderResult();
    if (id === "thanks") return renderThanks();
    var s = STEPS.filter(function (x) { return x.id === id; })[0];
    shell(id);
    app.appendChild(el("h1", { text: s.q }));
    if (s.sub) app.appendChild(el("p", { class: "sub", text: s.sub }));
    ({ choice: renderChoice, multi: renderMulti, postcode: renderPostcode, bill: renderBill })[s.kind](s);
    window.scrollTo(0, 0);
  }

  function optButton(o, on, handler) {
    return el("button", { class: "opt" + (on ? " on" : ""), type: "button", onclick: handler },
      [el("b", { text: o.label }), o.hint ? el("small", { text: o.hint }) : null]);
  }

  function renderChoice(s) {
    var box = el("div", { class: "options" + (s.two ? " two" : "") });
    s.options.forEach(function (o) {
      box.appendChild(optButton(o, a[s.id] === o.v, function () { a[s.id] = o.v; advance(s.id); }));
    });
    app.appendChild(box);
  }

  function renderMulti(s) {
    var box = el("div", { class: "options" });
    s.options.forEach(function (o) {
      var b = optButton(o, a.extras.indexOf(o.v) >= 0, function () {
        var i = a.extras.indexOf(o.v);
        if (i >= 0) a.extras.splice(i, 1); else a.extras.push(o.v);
        b.classList.toggle("on");
      });
      box.appendChild(b);
    });
    app.appendChild(box);
    app.appendChild(el("button", { class: "btn", type: "button", text: "Continue", onclick: function () { advance(s.id); } }));
  }

  function renderPostcode(s) {
    var input = el("input", { type: "text", inputmode: "numeric", maxlength: "4", autocomplete: "postal-code",
      placeholder: "e.g. 3123", value: a.postcode || "", "aria-label": "Postcode" });
    var err = el("p", { class: "err" });
    function submit() {
      var v = input.value.trim(), n = parseInt(v, 10);
      if (!/^\d{4}$/.test(v)) { err.textContent = "Please enter a 4-digit postcode."; return; }
      if (!((n >= 3000 && n <= 3999) || (n >= 8000 && n <= 8999))) {
        err.textContent = "Sorry, we only install in Victoria at the moment."; return;
      }
      a.postcode = v; advance(s.id);
    }
    input.addEventListener("keydown", function (e) { if (e.key === "Enter") submit(); });
    app.appendChild(input); app.appendChild(err);
    app.appendChild(el("button", { class: "btn", type: "button", text: "Continue", onclick: submit }));
    input.focus();
  }

  function renderBill(s) {
    var big = el("p", { class: "bill-big" });
    var range = el("input", { type: "range", min: "150", max: "1500", step: "25", value: String(a.bill), "aria-label": "Quarterly bill" });
    function show() {
      a.bill = parseInt(range.value, 10);
      big.innerHTML = "";
      big.appendChild(document.createTextNode(money(a.bill) + (a.bill >= 1500 ? "+" : "")));
      big.appendChild(el("small", { text: " per quarter" }));
    }
    range.addEventListener("input", show); show();
    app.appendChild(big); app.appendChild(range);
    app.appendChild(el("div", { class: "range-ends" }, [el("span", { text: "$150" }), el("span", { text: "$1,500+" })]));
    app.appendChild(el("button", { class: "btn", type: "button", text: "Continue", onclick: function () { advance(s.id); } }));
  }

  /* ---------- result ---------- */
  function renderResult() {
    shell("result");
    var showEstimate = isHome() && a.hasSolar !== "both";
    est = showEstimate ? Calc.estimate(a, C) : null;

    if (a.type === "business") {
      app.appendChild(el("h1", { text: "Commercial systems are quoted individually" }));
      app.appendChild(el("p", { class: "sub", text: "Business savings depend on your tariff, demand charges and when you use power, so we work from your actual bills. Leave your details and we'll come back with a tailored proposal." }));
    } else if (a.hasSolar === "both") {
      app.appendChild(el("h1", { text: "You're already ahead of most homes" }));
      app.appendChild(el("p", { class: "sub", text: "With solar and a battery in place, the usual next steps are adding battery capacity or more panels. Leave your details and we'll check what your system can take." }));
    } else {
      renderEstimate();
    }
    renderCapture();
    window.scrollTo(0, 0);
  }

  function renderEstimate() {
    var isNew = est.path === "new";
    var fitText = { great: "A battery looks like a great fit", good: "A battery looks like a good fit", marginal: "A battery would help, but savings are modest" };
    app.appendChild(el("span", { class: "pill", text: isNew ? "Your estimate" : fitText[est.fit] }));
    app.appendChild(el("h1", { text: isNew ? "Solar and a battery could cut your bills sharply" : "Here's what a battery could do for you" }));

    app.appendChild(el("div", { class: "hero" }, [
      el("div", { class: "k", text: "Estimated saving" }),
      el("div", { class: "v", text: money(est.savingsLow) + " – " + money(est.savingsHigh) + " a year" }),
      el("div", { class: "n", text: "About " + est.gridCut + "% less power bought from the grid" })
    ]));

    app.appendChild(el("div", { class: "stats" }, [
      stat(isNew ? "Solar size" : "Your solar", est.solarKw + " kW"),
      stat("Battery size", est.batteryKwh + " kWh"),
      stat("Pays for itself in", est.payback && C.showPrices ? "about " + est.payback + " yrs" : "ask us")
    ]));

    var maxBill = est.annualBill;
    app.appendChild(el("div", { class: "bars" }, [
      barRow("Bill now", est.annualBill, maxBill, false),
      barRow("Bill after", est.billAfter, maxBill, true)
    ]));
    app.appendChild(el("p", { class: "fine", text: "Yearly electricity cost, before and after. The daily supply charge stays either way." }));

    if (C.showPrices) {
      app.appendChild(el("h2", { text: "Estimated price" }));
      var t = el("table", { class: "cost" });
      t.appendChild(row((isNew ? est.solarKw + " kW solar + " : "") + est.batteryName + ", installed", money(est.gross)));
      t.appendChild(row("Federal battery discount", "– " + money(est.batteryDiscount), "less"));
      if (isNew) t.appendChild(row("Federal solar discount", "– " + money(est.stcDiscount), "less"));
      if (est.solarVic) t.appendChild(row("Solar Victoria rebate" + (est.solarVicUnsure ? " (if eligible)" : ""), "– " + money(est.solarVic), "less"));
      t.appendChild(row("You pay about", money(est.netCost), "total"));
      app.appendChild(t);
      if (est.upfrontWithLoan) app.appendChild(el("p", { class: "fine", text: "Or " + money(est.upfrontWithLoan) + " upfront with the Solar Victoria interest-free loan, then " + money(est.loan) + " repaid over four years" + (est.solarVicUnsure ? ", if eligible." : ".") }));
      app.appendChild(el("p", { class: "fine", text: "Other battery options" + (isNew ? " with the same solar" : "") + ":" }));
      est.alternatives.forEach(function (o) {
        app.appendChild(el("p", { class: "fine alt", text: o.name + ", about " + money(o.netCost) }));
      });
      if (est.phaseNote) app.appendChild(el("p", { class: "fine", text: "You have three-phase power. Prices not marked three-phase may change once we confirm the right model for your home." }));
      app.appendChild(el("p", { class: "fine", text: "Indicative only. Your firm price comes in a written quote after we check your roof and switchboard." }));
    }
    var banner = deadlineBanner();
    if (banner) app.appendChild(banner);
  }
  function deadlineBanner() {
    var s = C.rebates.batteryStepDown;
    if (!s) return null;
    var days = Math.ceil((new Date(s.date + "T00:00:00") - new Date()) / 86400000);
    if (days <= 0) return null;                          // date has passed: say nothing
    var drop = Math.round((est.batteryDiscount * (1 - s.keeps)) / 50) * 50;
    return el("div", { class: "deadline" }, [
      el("b", { text: days + (days === 1 ? " day" : " days") + " left at today's battery discount" }),
      el("span", { text: "The federal battery discount drops on " + s.label + ". A battery switched on after that gets about " +
        money(drop) + " less than the " + money(est.batteryDiscount) + " shown here." })
    ]);
  }
  function stat(k, v) { return el("div", { class: "stat" }, [el("div", { class: "k", text: k }), el("div", { class: "v", text: v })]); }
  function barRow(label, amt, max, after) {
    return el("div", { class: "bar-row" }, [
      el("span", { text: label }),
      el("div", { class: "bar" + (after ? " after" : ""), style: "width:" + Math.max(6, Math.round((amt / max) * 100)) + "%" }),
      el("span", { class: "amt", text: money(amt) })
    ]);
  }
  function row(k, v, cls) { return el("tr", { class: cls || false }, [el("td", { text: k }), el("td", { text: v })]); }

  /* ---------- lead capture ---------- */
  function renderCapture() {
    var biz = a.type === "business";
    var f = el("form", { class: "capture", novalidate: "novalidate" });
    f.appendChild(el("h2", { text: est ? "Get your exact quote" : "Where should we send your proposal?" }));
    f.appendChild(el("p", { class: "sub", text: "A local solar specialist will call to confirm the numbers. No obligation." }));

    var fields = {};
    function field(key, label, type, auto, ph) {
      f.appendChild(el("label", { class: "f", for: "f_" + key, text: label }));
      fields[key] = el("input", { id: "f_" + key, type: type, autocomplete: auto, placeholder: ph || "" });
      f.appendChild(fields[key]);
    }
    if (biz) field("business", "Business name", "text", "organization");
    field("name", "Your name", "text", "name");
    field("phone", "Mobile", "tel", "tel", "04xx xxx xxx");
    field("email", "Email", "email", "email");

    // Best day: "as soon as possible" plus the next six days (no Sundays).
    var day = "As soon as possible";
    var dayBox = el("div", { class: "days", role: "group", "aria-label": "Best day for a call" });
    var dayOpts = [day], d = new Date();
    while (dayOpts.length < 7) {
      d.setDate(d.getDate() + 1);
      if (d.getDay() !== 0) dayOpts.push(d.toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }));
    }
    dayOpts.forEach(function (label) {
      var b = el("button", { type: "button", class: "day" + (label === day ? " on" : ""), text: label, "aria-pressed": String(label === day) });
      b.addEventListener("click", function () {
        day = label;
        Array.prototype.forEach.call(dayBox.children, function (c) {
          c.classList.toggle("on", c === b); c.setAttribute("aria-pressed", String(c === b));
        });
      });
      dayBox.appendChild(b);
    });
    f.appendChild(el("span", { class: "f", text: "Best day for a call" }));
    f.appendChild(dayBox);

    f.appendChild(el("label", { class: "f", for: "f_time", text: "Best time to call" }));
    var time = el("select", { id: "f_time" }, ["Any time", "Morning", "Afternoon", "After 5pm"].map(function (t) { return el("option", { text: t }); }));
    f.appendChild(time);

    f.appendChild(el("label", { class: "f", for: "f_note", text: "Anything else we should know? (optional)" }));
    var note = el("textarea", { id: "f_note", rows: "3", maxlength: "500",
      placeholder: "e.g. shaded roof, three-phase power, planning a renovation" });
    f.appendChild(note);

    var hp = el("input", { type: "text", name: "website", tabindex: "-1", autocomplete: "off", "aria-hidden": "true" });
    f.appendChild(el("div", { class: "hp" }, [hp]));

    var consent = el("input", { type: "checkbox", id: "f_consent" });
    f.appendChild(el("label", { class: "consent", for: "f_consent" }, [consent,
      el("span", {}, ["I agree to " + C.company + " and its installation partner contacting me by phone, SMS and email about my solar and battery quote. I can opt out at any time. See our ",
        el("a", { href: "privacy.html", target: "_blank", rel: "noopener", text: "privacy policy" }), "."])]));

    var err = el("p", { class: "err" });
    var btn = el("button", { class: "btn", type: "submit", text: est ? "Get my exact quote" : "Request my proposal" });
    f.appendChild(err); f.appendChild(btn);
    f.addEventListener("focusin", function () { track("form-started"); });

    f.addEventListener("submit", function (e) {
      e.preventDefault();
      var name = fields.name.value.trim(), phone = fields.phone.value.replace(/[\s()-]/g, ""), email = fields.email.value.trim();
      if (name.length < 2) return (err.textContent = "Please enter your name.");
      if (!/^(\+?61|0)[2-478]\d{8}$/.test(phone)) return (err.textContent = "Please enter a valid Australian phone number.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return (err.textContent = "Please enter a valid email address.");
      if (!consent.checked) return (err.textContent = "Please tick the box so we're allowed to contact you.");
      err.textContent = ""; btn.disabled = true; btn.textContent = "Sending…";
      // Store as "0400 000 000" / "03 9000 0000". The spaces stop a spreadsheet
      // treating it as a number and dropping the leading zero.
      phone = phone.replace(/^\+?61/, "0");
      phone = phone.charAt(1) === "4"
        ? phone.slice(0, 4) + " " + phone.slice(4, 7) + " " + phone.slice(7)
        : phone.slice(0, 2) + " " + phone.slice(2, 6) + " " + phone.slice(6);

      // Drop answers from a branch the customer backed out of (e.g. roof type after switching to "have solar").
      STEPS.forEach(function (s) {
        if (s.when && !s.when() && s.id !== "bill") { if (s.id === "extras") a.extras = []; else delete a[s.id]; }
      });
      var sc = Calc.score(a, est);
      var lead = {
        id: "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
        createdAt: new Date().toISOString(),
        type: a.type, name: name, phone: phone, email: email, bestDay: day, bestTime: time.value, customerNote: note.value.trim().slice(0, 500),
        business: biz ? fields.business.value.trim() : "",
        postcode: a.postcode, score: sc.score, grade: sc.grade,
        ownership: a.ownership || "", hasSolar: a.hasSolar || "", quarterlyBill: biz ? "" : a.bill,
        bizSpend: a.bizSpend || "", roof: a.roof || "", storeys: a.storeys || "", phase: a.phase || "",
        solarSize: a.solarSize || "", solarAge: a.solarAge || "", inverter: a.inverter || "",
        daytime: a.daytime || "", extras: (a.extras || []).join(", "), timeframe: a.timeframe || "",
        income: a.income || "",
        estSolarKw: est ? est.solarKw : "", estBatteryKwh: est ? est.batteryKwh : "",
        estSavings: est ? Math.round(est.savings) : "", estNetCost: est ? est.netCost : "",
        estPayback: est && est.payback ? est.payback : "",
        consent: "yes", source: location.search.replace(/^\?/, "").slice(0, 200),
        status: "New", notes: "", website: hp.value
      };
      saveLead(lead).then(function () { trail.push("thanks"); render(); })
        .catch(function () {
          btn.disabled = false; btn.textContent = "Try again";
          err.textContent = "Sorry, that didn't send. Please try again" + (C.phone ? " or call " + C.phone + "." : ".");
        });
    });
    app.appendChild(f);
  }

  function saveLead(lead) {
    if (C.webhookUrl) {
      // text/plain keeps this a "simple" request, which Google Apps Script accepts cross-site.
      return fetch(C.webhookUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
        body: JSON.stringify({ action: "lead", lead: lead }) })
        .then(function (r) { return r.json(); })
        .then(function (j) { if (!j || !j.ok) throw new Error("rejected"); });
    }
    return new Promise(function (resolve, reject) {
      try {
        var all = JSON.parse(localStorage.getItem("sl_leads") || "[]");
        delete lead.website; all.push(lead);
        localStorage.setItem("sl_leads", JSON.stringify(all));
        resolve();
      } catch (e) { reject(e); }
    });
  }

  function renderThanks() {
    app.innerHTML = "";
    app.appendChild(el("span", { class: "pill", text: "Request received" }));
    app.appendChild(el("h1", { text: "Thanks, you're booked in for a call" }));
    var who = C.salesName ? C.salesName + " from " + C.company : "A specialist from " + C.company;
    app.appendChild(el("p", { class: "sub", text: who + " will be in touch, usually within one business day." }));
    app.appendChild(el("ol", { class: "steps-next" }, [
      el("li", { text: "A quick call to confirm your details and answer questions." }),
      el("li", { text: "A written quote with firm pricing and your rebates applied." }),
      el("li", { text: "If you go ahead, a deposit secures your install date." })
    ]));
    if (C.phone) app.appendChild(el("p", { class: "sub", text: "Prefer to talk now? Call " + C.phone + "." }));
    if (!C.webhookUrl) {
      var note = el("div", { class: "demo-note" }, ["Demo mode: this lead was saved in this browser only. "]);
      note.appendChild(el("a", { href: "dashboard.html", text: "Open the lead dashboard" }));
      app.appendChild(note);
    }
    window.scrollTo(0, 0);
  }

  window.SLApp = { answers: a };
  go("type");
})();
