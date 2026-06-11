/* ZenScail — page effects: reveal-on-scroll, nav state, hero typing, waitlist forms */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* nav border on scroll */
  var nav = document.querySelector(".nav");
  function onScroll() {
    if (nav) nav.classList.toggle("scrolled", window.scrollY > 8);
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* reveal on scroll */
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) {
          e.target.classList.add("in-view");
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.18 }
  );
  document.querySelectorAll(".reveal").forEach(function (el) { io.observe(el); });

  /* hero brief typing effect */
  var briefBody = document.getElementById("hero-brief-typed");
  if (briefBody) {
    var briefHTML =
      'Good morning, Maya. <mark>3 emails</mark> need a reply \u2014 the Linear contract is the urgent one. Your <mark>1:1 with Sam</mark> moved to 2:30pm, so your afternoon is clear for deep work. I drafted a reply to the invoice thread; one tap to send.';
    if (reduceMotion) {
      briefBody.innerHTML = briefHTML;
    } else {
      typeHTML(briefBody, briefHTML, 18, 600);
    }
  }

  /* types html string into el, preserving tags, with blinking cursor */
  function typeHTML(el, html, speed, delay) {
    var cursor = document.createElement("span");
    cursor.className = "typed-cursor";
    var i = 0;
    var out = "";
    el.innerHTML = "";
    el.appendChild(cursor);
    function step() {
      if (i >= html.length) {
        setTimeout(function () { cursor.remove(); }, 1800);
        return;
      }
      if (html[i] === "<") {
        var close = html.indexOf(">", i);
        out += html.slice(i, close + 1);
        i = close + 1;
      } else {
        out += html[i];
        i++;
      }
      el.innerHTML = out;
      el.appendChild(cursor);
      setTimeout(step, speed + Math.random() * 22);
    }
    var startIO = new IntersectionObserver(function (entries) {
      if (entries[0].isIntersecting) {
        startIO.disconnect();
        setTimeout(step, delay);
      }
    });
    startIO.observe(el);
  }
  window.zsTypeHTML = typeHTML;

  /* waitlist forms (visual only) */
  document.querySelectorAll(".waitlist").forEach(function (form) {
    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var input = form.querySelector("input");
      if (!input.value || input.value.indexOf("@") < 1) {
        input.focus();
        input.style.borderColor = "var(--accent)";
        return;
      }
      form.closest(".waitlist-wrap").classList.add("joined");
    });
  });
})();
