(function () {
  var C = window.SL_CONFIG;
  var STATUSES = ["New", "Called", "No answer", "Quoted", "Deposit paid", "Lost"];
  var LABELS = {
    ownership: { owner: "Owner-occupier", landlord: "Landlord", renter: "Renter" },
    hasSolar: { no: "No solar", yes: "Has solar, no battery", both: "Has solar + battery" },
    timeframe: { asap: "ASAP", soon: "1–3 months", later: "3–6 months", research: "Researching" },
    bizSpend: { b1: "Under $1k/mo", b2: "$1k–3k/mo", b3: "$3k–10k/mo", b4: "Over $10k/mo" },
    daytime: { out: "Out by day", mix: "Mixed days", home: "Home by day" }
  };
  var live = !!C.webhookUrl, leads = [], filter = "All";
  var $ = function (id) { return document.getElementById(id); };
  $("brandName").textContent = C.company;

  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "text") n.textContent = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] != null && attrs[k] !== false) n.setAttribute(k, attrs[k]);
    }
    (kids || []).forEach(function (c) { if (c) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c); });
    return n;
  }

  /* ---------- data ---------- */
  function key() {
    var k = sessionStorage.getItem("sl_key");
    if (!k) { k = prompt("Dashboard key (the DASHBOARD_KEY you set in the Google script):") || ""; sessionStorage.setItem("sl_key", k); }
    return k;
  }
  function api(body) {
    body.key = key();
    return fetch(C.webhookUrl, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json(); })
      .then(function (j) { if (!j.ok) { sessionStorage.removeItem("sl_key"); throw new Error(j.error || "Request failed"); } return j; });
  }
  function load() {
    if (!live) {
      try { leads = JSON.parse(localStorage.getItem("sl_leads") || "[]"); } catch (e) { leads = []; }
      return Promise.resolve();
    }
    return api({ action: "list" }).then(function (j) { leads = j.leads || []; });
  }
  function save(lead) {
    if (!live) { localStorage.setItem("sl_leads", JSON.stringify(leads)); return; }
    api({ action: "update", id: lead.id, status: lead.status, notes: lead.notes })
      .catch(function (e) { alert("Could not save the change: " + e.message); });
  }

  /* ---------- view ---------- */
  function when(iso) {
    var d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleString("en-AU", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
  }
  function facts(l) {
    var f = [];
    if (l.type === "business") { f.push("Business" + (l.business ? ": " + l.business : "")); f.push(LABELS.bizSpend[l.bizSpend]); }
    else {
      f.push(LABELS.ownership[l.ownership]); f.push(LABELS.hasSolar[l.hasSolar]);
      if (l.quarterlyBill) f.push("$" + l.quarterlyBill + "/qtr bill");
      f.push(LABELS.daytime[l.daytime]);
      if (l.inverter) f.push(l.inverter + " inverter");
      if (l.roof) f.push(l.roof + " roof, " + l.storeys);
      f.push({ single: "Single phase", three: "Three phase", unsure: "Phase unknown" }[l.phase]);
      if (l.extras) f.push(l.extras);
    }
    f.push(LABELS.timeframe[l.timeframe]);
    return f.filter(Boolean).join(" · ");
  }
  function estLine(l) {
    if (!l.estSavings) return "";
    var s = "Estimate shown: ";
    if (l.hasSolar === "no") s += l.estSolarKw + " kW solar + ";
    s += l.estBatteryKwh + " kWh battery, saves ~$" + Number(l.estSavings).toLocaleString() + "/yr";
    if (l.estNetCost) s += ", ~$" + Number(l.estNetCost).toLocaleString() + " after rebates";
    return s;
  }

  function draw() {
    $("mode").textContent = live
      ? "Live: showing leads from your Google Sheet."
      : "Demo mode: showing leads saved in this browser only. Add your webhook URL in config.js to collect real leads.";

    var c = $("counts"); c.innerHTML = "";
    [["Total", leads.length],
     ["Hot", leads.filter(function (l) { return l.grade === "Hot"; }).length],
     ["New, not called", leads.filter(function (l) { return l.status === "New"; }).length],
     ["Deposits", leads.filter(function (l) { return l.status === "Deposit paid"; }).length]
    ].forEach(function (x) {
      c.appendChild(el("div", { class: "stat" }, [el("div", { class: "k", text: x[0] }), el("div", { class: "v", text: String(x[1]) })]));
    });

    var fb = $("filters"); fb.innerHTML = "";
    ["All", "Hot", "Warm", "Cold"].concat(STATUSES).forEach(function (name) {
      fb.appendChild(el("button", { class: "chip" + (filter === name ? " on" : ""), type: "button", text: name,
        onclick: function () { filter = name; draw(); } }));
    });

    var rows = leads.filter(function (l) { return filter === "All" || l.grade === filter || l.status === filter; })
      .sort(function (x, y) { return (y.score - x.score) || String(y.createdAt).localeCompare(String(x.createdAt)); });

    var list = $("list"); list.innerHTML = "";
    if (!rows.length) { list.appendChild(el("div", { class: "empty", text: leads.length ? "No leads match this filter." : "No leads yet. Complete the quiz to see one appear here." })); return; }

    rows.forEach(function (l) {
      var status = el("select", { "aria-label": "Status" }, STATUSES.map(function (s) {
        var o = el("option", { text: s }); if (s === l.status) o.selected = true; return o;
      }));
      status.addEventListener("change", function () { l.status = status.value; save(l); draw(); });
      var notes = el("input", { type: "text", placeholder: "Notes…", value: l.notes || "", "aria-label": "Notes" });
      notes.addEventListener("change", function () { l.notes = notes.value; save(l); });

      list.appendChild(el("div", { class: "lead" }, [
        el("div", { class: "lead-head" }, [
          el("span", { class: "badge " + l.grade, text: l.grade + " " + l.score }),
          el("span", { class: "nm", text: l.name }),
          el("a", { href: "tel:" + String(l.phone).replace(/[^\d+]/g, ""), text: String(l.phone) }),
          el("a", { href: "mailto:" + encodeURIComponent(l.email), text: "Email" })
        ]),
        el("p", { class: "meta", text: [when(l.createdAt), "Postcode " + l.postcode, "Call: " + [l.bestDay, l.bestTime].filter(Boolean).join(", ")].filter(Boolean).join(" · ") }),
        el("p", { class: "facts", text: facts(l) }),
        estLine(l) ? el("p", { class: "meta", text: estLine(l) }) : null,
        l.customerNote ? el("p", { class: "facts", text: "Customer note: " + l.customerNote }) : null,
        el("div", { class: "lead-foot" }, [status, notes])
      ]));
    });
  }

  function exportCsv() {
    if (!leads.length) return alert("No leads to export yet.");
    var cols = Object.keys(leads[0]);
    var esc = function (v) {
      v = v == null ? "" : String(v);
      if (/^[=+\-@]/.test(v)) v = "'" + v;            // stop spreadsheet formula injection
      return '"' + v.replace(/"/g, '""') + '"';
    };
    var csv = [cols.join(",")].concat(leads.map(function (l) { return cols.map(function (c) { return esc(l[c]); }).join(","); })).join("\r\n");
    var a = el("a", { href: URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv" })), download: "leads-" + new Date().toISOString().slice(0, 10) + ".csv" });
    document.body.appendChild(a); a.click(); a.remove();
  }

  function refresh() {
    load().then(draw).catch(function (e) {
      $("list").innerHTML = ""; $("list").appendChild(el("div", { class: "empty", text: "Could not load leads: " + e.message }));
    });
  }
  $("refresh").addEventListener("click", refresh);
  $("export").addEventListener("click", exportCsv);
  refresh();
})();
