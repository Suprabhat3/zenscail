/* ZenScail — interactive product demo: tabs, inbox, AI replies, calendar suggestion */
(function () {
  "use strict";

  /* ----- data ----- */
  var EMAILS = [
    {
      id: "linear",
      from: "Priya Nair",
      time: "8:42 AM",
      subj: "Contract renewal \u2014 need your sign-off by Friday",
      prev: "Hi Maya, following up on the renewal terms we discussed last week\u2026",
      tag: ["action", "Needs reply"],
      meta: "Priya Nair \u00b7 to you, Sam \u00b7 thread of 9",
      summary: [
        "Renewal terms updated: 12-month term at the same rate, net-30 billing.",
        "Legal already approved the redlines on Tuesday \u2014 nothing is blocking.",
        "Priya needs your signature by <strong>Friday EOD</strong> or pricing resets."
      ],
      replies: [
        { label: "Looks good \u2014 signing today", draft: "Hi Priya \u2014 thanks for shepherding this through. The terms look good on our side, and legal\u2019s already cleared the redlines. I\u2019ll get my signature on it today so we\u2019re well ahead of Friday. \u2014 Maya" },
        { label: "One question first", draft: "Hi Priya \u2014 almost there. Quick question before I sign: does the net-30 billing start from invoice date or delivery date? Once that\u2019s confirmed I\u2019ll sign right away. \u2014 Maya" },
        { label: "Loop in finance", draft: "Hi Priya \u2014 terms look right to me. I\u2019m looping in Dana from finance to give the billing schedule a final once-over, then I\u2019ll sign. We\u2019ll be done well before Friday. \u2014 Maya" }
      ]
    },
    {
      id: "invoice",
      from: "Atlas Studio",
      time: "8:15 AM",
      subj: "Invoice #2041 \u2014 March retainer",
      prev: "Please find attached the invoice for March. Payment is due within\u2026",
      tag: ["action", "Needs reply"],
      meta: "Atlas Studio \u00b7 to you \u00b7 thread of 2",
      summary: [
        "March retainer invoice: <strong>$4,800</strong>, due April 14 (net-30).",
        "Same scope as February \u2014 no line-item changes.",
        "They asked you to confirm receipt so their books close on time."
      ],
      replies: [
        { label: "Confirm \u2014 payment scheduled", draft: "Hi team \u2014 confirming receipt of invoice #2041. Everything matches the agreed scope, and I\u2019ve scheduled payment for April 10, ahead of the due date. Thanks as always! \u2014 Maya" },
        { label: "Ask for PO number", draft: "Hi team \u2014 got the invoice, thank you. Could you re-issue it with our PO number (ZS-0231) referenced? Our finance system needs it to process payment. Appreciate it! \u2014 Maya" }
      ]
    },
    {
      id: "standup",
      from: "Sam Okafor",
      time: "7:58 AM",
      subj: "Moving our 1:1 to 2:30 today?",
      prev: "Morning! Something came up at noon \u2014 any chance we can shift\u2026",
      tag: ["meeting", "Meeting"],
      meta: "Sam Okafor \u00b7 to you \u00b7 thread of 3",
      summary: [
        "Sam asks to move today\u2019s 1:1 from <strong>12:00 to 2:30pm</strong>.",
        "Your 2:30 slot is free \u2014 ZenScail already checked your calendar.",
        "He wants to cover the Q2 roadmap and one hiring update."
      ],
      replies: [
        { label: "2:30 works \u2014 confirmed", draft: "Morning Sam \u2014 2:30 works perfectly, calendar\u2019s already updated. I\u2019ll bring my notes on the Q2 roadmap, and curious to hear the hiring update. See you then! \u2014 Maya" },
        { label: "Propose 4pm instead", draft: "Hey Sam \u2014 2:30 is a bit tight on my end. Could we do 4:00 instead? I\u2019m free then and we\u2019d have the full half hour for the roadmap. \u2014 Maya" }
      ]
    },
    {
      id: "digest",
      from: "Field Notes Weekly",
      time: "6:30 AM",
      subj: "Issue 81 \u2014 the slow productivity movement",
      prev: "This week: why doing less, better, is having a moment\u2026",
      tag: ["fyi", "FYI"],
      meta: "Field Notes Weekly \u00b7 newsletter",
      summary: [
        "Newsletter \u2014 nothing for you to act on.",
        "Main essay argues focus time beats response time for knowledge work.",
        "ZenScail filed it under <strong>Reading</strong>; it never hit your inbox sound."
      ],
      replies: []
    }
  ];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }

  var demo = $("#demo-app");
  if (!demo) return;

  /* ----- tabs ----- */
  $all(".demo-tab", demo).forEach(function (tab) {
    tab.addEventListener("click", function () {
      $all(".demo-tab", demo).forEach(function (t) { t.classList.remove("active"); });
      tab.classList.add("active");
      $all(".demo-pane", demo).forEach(function (p) { p.classList.remove("active"); });
      var pane = $("#pane-" + tab.dataset.pane, demo);
      if (pane) pane.classList.add("active");
    });
  });

  /* ----- inbox: build rows ----- */
  var list = $("#email-list", demo);
  EMAILS.forEach(function (em, idx) {
    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "email-row" + (idx === 0 ? " selected" : "");
    btn.dataset.email = em.id;
    btn.innerHTML =
      '<span class="er-top"><span class="er-from">' + em.from + '</span><span class="er-time">' + em.time + '</span></span>' +
      '<span class="er-subj">' + em.subj + '</span>' +
      '<span class="er-prev">' + em.prev + '</span>' +
      '<span class="er-tag tag-' + em.tag[0] + '">' + em.tag[1] + '</span>';
    btn.addEventListener("click", function () { selectEmail(em.id); });
    list.appendChild(btn);
  });

  function selectEmail(id) {
    var em = EMAILS.filter(function (e) { return e.id === id; })[0];
    if (!em) return;
    $all(".email-row", demo).forEach(function (r) {
      r.classList.toggle("selected", r.dataset.email === id);
    });
    $("#ed-subject", demo).textContent = em.subj;
    $("#ed-meta", demo).textContent = em.meta;
    var sum = $("#ed-summary", demo);
    sum.innerHTML = em.summary.map(function (s) { return "<li>" + s + "</li>"; }).join("");
    var chipsWrap = $("#ed-chips", demo);
    var chipRow = $(".reply-chip-row", chipsWrap);
    chipRow.innerHTML = "";
    var draftBox = $("#ed-draft", demo);
    draftBox.classList.remove("show");
    draftBox.innerHTML = "";
    if (em.replies.length) {
      chipsWrap.style.display = "";
      em.replies.forEach(function (r) {
        var chip = document.createElement("button");
        chip.type = "button";
        chip.className = "reply-chip";
        chip.textContent = r.label;
        chip.addEventListener("click", function () {
          $all(".reply-chip", chipRow).forEach(function (c) { c.classList.remove("picked"); });
          chip.classList.add("picked");
          draftBox.classList.add("show");
          if (window.zsTypeHTML && !window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            window.zsTypeHTML(draftBox, r.draft, 8, 100);
          } else {
            draftBox.textContent = r.draft;
          }
        });
        chipRow.appendChild(chip);
      });
    } else {
      chipsWrap.style.display = "none";
    }
  }
  selectEmail("linear");

  /* ----- calendar: AI suggestion confirm ----- */
  var suggest = $("#cal-suggest", demo);
  if (suggest) {
    suggest.addEventListener("click", function () {
      if (suggest.classList.contains("confirmed")) return;
      suggest.classList.add("confirmed");
      suggest.textContent = "Booked \u2713 \u2014 invite sent";
      var foot = $("#cal-foot-msg", demo);
      if (foot) foot.innerHTML = "Done. Invite sent to Priya and Sam \u2014 <strong>Thursday 11:00</strong> works for all three calendars.";
    });
  }
})();
