/* =========================================================
   Nikavi Labs — interactions
   Motion (vanilla) for animation, plain JS for everything else.
   Every feature degrades gracefully if a CDN script fails.
   ========================================================= */
(function () {
  "use strict";

  const CFG = window.DD_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const M = window.Motion;
  const motionOK = !!(M && M.animate && M.inView) && !reduceMotion;
  const EASE = [0.22, 1, 0.36, 1];

  if (motionOK) root.classList.add("motion-ok");

  /* ---------- Icons ---------- */
  if (window.lucide) window.lucide.createIcons({ attrs: { "stroke-width": 1.75, "aria-hidden": "true" } });

  /* ---------- Contact links from config ---------- */
  const waNumber = (CFG.whatsappNumber || "").replace(/\D/g, "");
  const waLink = (msg) => `https://wa.me/${waNumber}?text=${encodeURIComponent(msg || CFG.whatsappMessage || "")}`;

  $$("[data-whatsapp]").forEach((a) => {
    a.href = waLink();
    a.target = "_blank";
    a.rel = "noopener";
  });
  $$("[data-booking]").forEach((a) => {
    if (CFG.bookingUrl) {
      a.href = CFG.bookingUrl;
    } else {
      // Fallback until a booking link is configured: request a call over WhatsApp.
      a.href = waLink("Hi! I'd like to book a free 15-minute discovery call for my business website.");
    }
  });
  if (CFG.email) {
    $$("[data-email]").forEach((a) => (a.href = `mailto:${CFG.email}`));
    $$("[data-email-text]").forEach((s) => (s.textContent = CFG.email));
  }
  if (CFG.phoneDisplay) $$("[data-phone-text]").forEach((s) => (s.textContent = CFG.phoneDisplay));
  $$("[data-social]").forEach((a) => {
    const url = CFG.socials && CFG.socials[a.dataset.social];
    if (url) { a.href = url; a.target = "_blank"; a.rel = "noopener"; } else a.remove();
  });
  const yr = $("#year"); if (yr) yr.textContent = new Date().getFullYear();

  if (!CFG.bookingUrl || /^910+$/.test(waNumber)) {
    console.info("[Nikavi Labs] Placeholder contact settings detected. Update assets/js/config.js before launch.");
  }

  /* ---------- Header: scrolled state, hide on scroll down ---------- */
  const header = $(".site-header");
  let lastY = window.scrollY;
  let ticking = false;
  const onScroll = () => {
    const y = window.scrollY;
    header.classList.toggle("scrolled", y > 20);
    const menuOpen = $("#navToggle").getAttribute("aria-expanded") === "true";
    header.classList.toggle("hide", !menuOpen && y > 700 && y > lastY + 4);
    if (y < lastY - 4) header.classList.remove("hide");
    lastY = y;
    updateTimeline();
    updateHeroScroll(y);
    ticking = false;
  };
  window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });

  /* ---------- Mobile menu ---------- */
  const toggle = $("#navToggle");
  const menu = $("#mobileMenu");
  const setMenu = (open) => {
    toggle.setAttribute("aria-expanded", String(open));
    toggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    menu.hidden = !open;
    if (open) {
      header.classList.add("scrolled");
      if (motionOK) M.animate(menu, { opacity: [0, 1], y: [-12, 0] }, { duration: 0.35, ease: EASE });
      const first = $("a", menu); if (first) first.focus();
    }
  };
  toggle.addEventListener("click", () => setMenu(toggle.getAttribute("aria-expanded") !== "true"));
  $$("a", menu).forEach((a) => a.addEventListener("click", () => setMenu(false)));
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !menu.hidden) { setMenu(false); toggle.focus(); } });

  /* ---------- Active nav link ---------- */
  const navLinks = $$("#navLinks a");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) navLinks.forEach((l) => l.classList.toggle("active", l.getAttribute("href") === "#" + en.target.id));
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    ["work", "approach", "services", "pricing", "faq"].forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
  }

  /* ---------- Hero entrance ---------- */
  const underline = $(".underline-word");
  if (motionOK) {
    const words = $$("[data-hero-word]");
    M.animate(words, { y: ["110%", "0%"], opacity: [0, 1] }, { duration: 0.9, delay: M.stagger(0.06, { startDelay: 0.15 }), ease: EASE });
    M.animate($$("[data-hero-item]"), { opacity: [0, 1], y: [18, 0] }, { duration: 0.8, delay: M.stagger(0.1, { startDelay: 0.55 }), ease: EASE });
    M.animate($$(".mock"), { opacity: [0, 1], y: [60, 0], rotateX: [12, 0] }, { duration: 1.1, delay: M.stagger(0.14, { startDelay: 0.35 }), ease: EASE });
    M.animate($$(".hero-chip"), { opacity: [0, 1], scale: [0.85, 1] }, { duration: 0.6, delay: M.stagger(0.12, { startDelay: 1.1 }), ease: EASE });
    if (underline) {
      underline.style.setProperty("--u", "0");
      M.animate(0, 1, { duration: 0.9, delay: 1.05, ease: EASE, onUpdate: (v) => underline.style.setProperty("--u", v) });
    }
  }

  /* ---------- Hero parallax (pointer + scroll) ---------- */
  const stage = $("#heroStage");
  const layers = stage ? $$("[data-depth]", stage) : [];
  let px = 0, py = 0, sy = 0;
  const applyParallax = () => {
    layers.forEach((l) => {
      const d = parseFloat(l.dataset.depth) || 1;
      l.style.translate = `${px * d * 10}px ${py * d * 10 - sy * d * 0.06}px`;
    });
  };
  function updateHeroScroll(y) {
    if (!motionOK || !stage || y > window.innerHeight * 1.2) return;
    sy = y; applyParallax();
  }
  if (motionOK && finePointer && stage) {
    $(".hero").addEventListener("pointermove", (e) => {
      px = e.clientX / window.innerWidth - 0.5;
      py = e.clientY / window.innerHeight - 0.5;
      requestAnimationFrame(applyParallax);
    });
  }

  // Cycle the hero mock windows' stacking order for a "living" collage.
  if (motionOK && stage) {
    const mocks = $$(".mock", stage);
    let front = 2;
    setInterval(() => {
      if (document.hidden) return;
      front = (front + 1) % mocks.length;
      mocks.forEach((m, i) => {
        const isFront = i === front;
        m.style.zIndex = isFront ? 3 : i === (front + 2) % mocks.length ? 2 : 1;
        M.animate(m, { scale: isFront ? [0.97, 1.03, 1] : 1 }, { duration: 0.9, ease: EASE });
      });
    }, 3800);
  }

  /* ---------- Scroll reveals ---------- */
  if (motionOK) {
    const getEl = (a) => (a instanceof Element ? a : a && a.target);
    M.inView("[data-reveal]", (a) => {
      const el = getEl(a);
      M.animate(el, { opacity: [0, 1], y: [36, 0] }, { duration: 0.9, ease: EASE });
    }, { amount: 0.15 });
    M.inView("[data-stagger]", (a) => {
      const el = getEl(a);
      M.animate(Array.from(el.children), { opacity: [0, 1], y: [30, 0] }, { duration: 0.75, delay: M.stagger(0.07), ease: EASE });
    }, { amount: 0.1 });
  }

  /* ---------- Approach timeline progress ---------- */
  const timeline = $("#timeline");
  const fill = $("#timelineFill");
  const steps = $$(".step");
  function updateTimeline() {
    if (!timeline) return;
    const r = timeline.getBoundingClientRect();
    const vh = window.innerHeight;
    const p = Math.min(1, Math.max(0, (vh * 0.6 - r.top) / r.height));
    if (fill) fill.style.transform = `scaleY(${reduceMotion ? 1 : p})`;
    steps.forEach((s) => {
      const sr = s.getBoundingClientRect();
      s.classList.toggle("is-active", sr.top < vh * 0.6);
    });
  }
  updateTimeline();

  /* ---------- Showcase tabs + live iframe previews ---------- */
  const tabs = $$(".showcase-tabs [role=tab]");
  const panels = $$(".sc-panel");

  const scaleFrame = (view) => {
    const f = $("iframe", view);
    if (!f) return;
    const s = view.clientWidth / 1280;
    f.style.transform = `scale(${s})`;
    f.style.height = `${view.clientHeight / s}px`;
  };
  const loadFrame = (panel) => {
    const f = $("iframe[data-src]", panel);
    if (f && !f.src) f.src = f.dataset.src;
    const v = $(".browser-view", panel);
    if (v) scaleFrame(v);
  };
  if ("ResizeObserver" in window) {
    const ro = new ResizeObserver((entries) => entries.forEach((e) => scaleFrame(e.target)));
    $$(".browser-view").forEach((v) => ro.observe(v));
  }

  const activate = (tab, focus) => {
    const id = tab.dataset.tab;
    tabs.forEach((t) => {
      const on = t === tab;
      t.setAttribute("aria-selected", String(on));
      t.tabIndex = on ? 0 : -1;
    });
    panels.forEach((p) => {
      const on = p.dataset.panel === id;
      p.hidden = !on;
      if (on) {
        loadFrame(p);
        if (motionOK) {
          M.animate($(".browser", p), { opacity: [0, 1], x: [-30, 0], rotate: [-1, 0] }, { duration: 0.7, ease: EASE });
          M.animate($$(".col-lg-5 > *", p), { opacity: [0, 1], y: [16, 0] }, { duration: 0.55, delay: M.stagger(0.05, { startDelay: 0.1 }), ease: EASE });
        }
      }
    });
    if (focus) tab.focus();
    tab.scrollIntoView({ block: "nearest", inline: "center", behavior: reduceMotion ? "auto" : "smooth" });
  };
  tabs.forEach((t, i) => {
    t.addEventListener("click", () => activate(t));
    t.addEventListener("keydown", (e) => {
      let n = null;
      if (e.key === "ArrowRight") n = tabs[(i + 1) % tabs.length];
      if (e.key === "ArrowLeft") n = tabs[(i - 1 + tabs.length) % tabs.length];
      if (e.key === "Home") n = tabs[0];
      if (e.key === "End") n = tabs[tabs.length - 1];
      if (n) { e.preventDefault(); activate(n, true); }
    });
  });
  // Load first preview once the showcase approaches the viewport
  const work = $("#work");
  if (work && "IntersectionObserver" in window) {
    const lo = new IntersectionObserver((en) => {
      if (en[0].isIntersecting) { loadFrame(panels.find((p) => !p.hidden)); lo.disconnect(); }
    }, { rootMargin: "400px" });
    lo.observe(work);
  } else if (panels[0]) loadFrame(panels[0]);

  /* ---------- Magnetic buttons ---------- */
  if (motionOK && finePointer) {
    $$("[data-magnetic]").forEach((b) => {
      b.addEventListener("pointermove", (e) => {
        const r = b.getBoundingClientRect();
        const x = (e.clientX - r.left - r.width / 2) * 0.22;
        const y = (e.clientY - r.top - r.height / 2) * 0.3;
        b.style.translate = `${x}px ${y}px`;
      });
      b.addEventListener("pointerleave", () => {
        M.animate(b, { translate: "0px 0px" }, { duration: 0.5, ease: EASE });
      });
    });
  }

  /* ---------- FAQ: only one open + animated content ---------- */
  const faqs = $$(".faq-list details");
  faqs.forEach((d) => {
    d.addEventListener("toggle", () => {
      if (d.open) {
        faqs.forEach((o) => { if (o !== d) o.open = false; });
        if (motionOK) M.animate($("div", d), { opacity: [0, 1], y: [-8, 0] }, { duration: 0.4, ease: EASE });
      }
    });
  });

  /* ---------- Floating WhatsApp peek ---------- */
  const wa = $(".wa-float");
  if (wa && !reduceMotion) {
    setTimeout(() => { wa.classList.add("peek"); setTimeout(() => wa.classList.remove("peek"), 4000); }, 6000);
  }

  /* =========================================================
     LEAD FORM
     ========================================================= */
  const form = $("#leadForm");
  if (!form) return;

  const urlField = $("#urlField");
  const msg = $("#f-message");
  const counter = $("#msgCount");
  const status = $("#formStatus");
  const btn = $("#submitBtn");
  const btnLabel = $(".btn-label", btn);

  const showUrlFieldFor = (need) => {
    const show = need === "Redesign" || need === "Free Website Audit";
    urlField.hidden = !show;
  };
  $$("input[name=need]", form).forEach((r) => r.addEventListener("change", () => { showUrlFieldFor(r.value); clearErr("need"); }));
  msg.addEventListener("input", () => (counter.textContent = msg.value.length));

  // Prefill from CTAs throughout the page
  $$("[data-prefill-category],[data-prefill-need],[data-prefill-budget]").forEach((a) => {
    a.addEventListener("click", () => {
      if (a.dataset.prefillCategory) $("#f-category").value = a.dataset.prefillCategory;
      if (a.dataset.prefillBudget) $("#f-budget").value = a.dataset.prefillBudget;
      if (a.dataset.prefillNeed) {
        const r = $(`input[name=need][value="${a.dataset.prefillNeed}"]`, form);
        if (r) { r.checked = true; showUrlFieldFor(r.value); }
      }
      setTimeout(() => $("#f-name").focus({ preventScroll: true }), 700);
    });
  });

  const fields = {
    name: { el: $("#f-name"), test: (v) => v.trim().length >= 2 || "Please enter your name." },
    business: { el: $("#f-business"), test: (v) => v.trim().length >= 2 || "Please enter your business name." },
    phone: {
      el: $("#f-phone"),
      test: (v) => {
        let d = v.replace(/\D/g, "");
        if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
        if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
        if (!d) return "Please enter your phone or WhatsApp number.";
        return /^[6-9]\d{9}$/.test(d) || "Please enter a valid 10-digit Indian mobile number.";
      }
    },
    email: { el: $("#f-email"), test: (v) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Please enter a valid email address." },
    category: { el: $("#f-category"), test: (v) => !!v || "Please choose your business category." },
    need: { el: null, test: () => !!$("input[name=need]:checked", form) || "Please tell us what you need." },
    url: {
      el: $("#f-url"),
      test: (v) => {
        if (urlField.hidden || !v.trim()) return true;
        try { const u = new URL(/^https?:\/\//i.test(v.trim()) ? v.trim() : "https://" + v.trim()); return u.hostname.includes(".") || "Please enter a valid website address."; }
        catch { return "Please enter a valid website address."; }
      }
    }
  };

  function setErr(key, text) {
    const f = fields[key];
    const errEl = $(`#f-${key}-err`);
    const wrap = f.el ? f.el.closest(".field") : $(".chips", form).closest(".field");
    if (errEl) errEl.textContent = text || "";
    if (wrap) wrap.classList.toggle("invalid", !!text);
    if (f.el) {
      f.el.setAttribute("aria-invalid", text ? "true" : "false");
      if (text) f.el.setAttribute("aria-describedby", `f-${key}-err`); else f.el.removeAttribute("aria-describedby");
    }
  }
  function clearErr(key) { setErr(key, ""); }
  function validate(key) {
    const f = fields[key];
    const res = f.test(f.el ? f.el.value : "");
    setErr(key, res === true ? "" : res);
    return res === true;
  }

  Object.keys(fields).forEach((k) => {
    const el = fields[k].el;
    if (!el) return;
    el.addEventListener("blur", () => { if (el.value) validate(k); });
    el.addEventListener("input", () => { if (el.closest(".field").classList.contains("invalid")) validate(k); });
    el.addEventListener("change", () => { if (el.tagName === "SELECT") validate(k); });
  });

  const collect = () => {
    const fd = new FormData(form);
    return {
      name: (fd.get("name") || "").trim(),
      business: (fd.get("business") || "").trim(),
      phone: (fd.get("phone") || "").trim(),
      email: (fd.get("email") || "").trim(),
      category: fd.get("category") || "",
      need: fd.get("need") || "",
      budget: fd.get("budget") || "Not sure yet",
      website: urlField.hidden ? "" : (fd.get("website") || "").trim(),
      message: (fd.get("message") || "").trim(),
      botcheck: fd.get("botcheck") || ""
    };
  };

  const waSummary = (d) =>
    [
      "Hi Nikavi Labs! I'd like a free consultation.",
      `Name: ${d.name}`,
      `Business: ${d.business} (${d.category})`,
      `Need: ${d.need}`,
      `Budget: ${d.budget}`,
      d.website && `Current website: ${d.website}`,
      `Phone: ${d.phone}`,
      d.email && `Email: ${d.email}`,
      d.message && `About: ${d.message}`
    ].filter(Boolean).join("\n");

  const setLoading = (on) => {
    btn.classList.toggle("loading", on);
    btn.disabled = on;
    btn.setAttribute("aria-busy", String(on));
    btnLabel.textContent = on ? "Sending…" : "Get My Free Consultation";
  };

  const showSuccess = (text) => {
    $(".form-inner", form).hidden = true;
    const s = $("#formSuccess");
    if (text) $("#successText").textContent = text;
    s.hidden = false;
    if (motionOK) {
      M.animate(s, { opacity: [0, 1], y: [20, 0] }, { duration: 0.6, ease: EASE });
      M.animate($(".success-mark", s), { scale: [0.4, 1.12, 1] }, { duration: 0.7, ease: EASE });
    }
    s.focus();
    form.scrollIntoView({ block: "center", behavior: reduceMotion ? "auto" : "smooth" });
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    const order = ["name", "business", "phone", "email", "category", "need", "url"];
    const results = order.map((k) => [k, validate(k)]);
    const firstBad = results.find(([, ok]) => !ok);
    if (firstBad) {
      const f = fields[firstBad[0]];
      (f.el || $("input[name=need]", form)).focus();
      status.textContent = "Please fix the highlighted fields.";
      status.classList.add("error");
      if (motionOK) M.animate(form, { x: [0, -8, 8, -5, 5, 0] }, { duration: 0.45 });
      return;
    }

    const data = collect();
    if (data.botcheck) { showSuccess(); return; } // silently drop bots

    const cfg = CFG.form || {};
    const configured = !!(cfg.endpoint && (cfg.accessKey || !/web3forms\.com/.test(cfg.endpoint)));

    // No backend configured yet → hand the enquiry off to WhatsApp so no lead is lost.
    if (!configured) {
      console.warn("[Nikavi Labs] Form endpoint not configured; routing enquiry to WhatsApp.");
      window.open(waLink(waSummary(data)), "_blank", "noopener");
      showSuccess("We've opened WhatsApp with your details filled in — just press send and we'll take it from there.");
      return;
    }

    setLoading(true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs || 15000);
    try {
      const payload = {
        subject: `${cfg.subject || "New enquiry"} — ${data.business}`,
        from_name: "Nikavi Labs Website",
        name: data.name,
        business: data.business,
        phone: data.phone,
        email: data.email || undefined,
        replyto: data.email || undefined,
        category: data.category,
        need: data.need,
        budget: data.budget,
        current_website: data.website || undefined,
        message: data.message || "(not provided)",
        page: location.href
      };
      if (cfg.accessKey) payload.access_key = cfg.accessKey;

      const res = await fetch(cfg.endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload),
        signal: ctrl.signal
      });
      let body = {};
      try { body = await res.json(); } catch { /* non-JSON */ }
      if (!res.ok || body.success === false) throw new Error(body.message || `HTTP ${res.status}`);

      form.reset();
      showSuccess(`Thanks, ${data.name.split(" ")[0]}! We'll reach out personally within one working day. Want to move faster?`);
    } catch (err) {
      console.error("[Nikavi Labs] Form submission failed:", err);
      status.innerHTML = "";
      status.classList.add("error");
      status.append(
        document.createTextNode(err.name === "AbortError" ? "The request timed out. " : "Something went wrong sending your enquiry. "),
        Object.assign(document.createElement("a"), { href: waLink(waSummary(data)), target: "_blank", rel: "noopener", textContent: "Send it on WhatsApp instead →", style: "text-decoration:underline" })
      );
    } finally {
      clearTimeout(timer);
      setLoading(false);
    }
  });
})();
