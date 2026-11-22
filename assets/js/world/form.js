// Lead form, pricing modal, contact links — same integrations as the classic site (assets/js/config.js).
export function setupForms({ onOpen, onClose, audio } = {}) {
  const CFG = window.DD_CONFIG || {};
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

  const wa = (CFG.whatsappNumber || "").replace(/\D/g, "");
  const waLink = (msg) => `https://wa.me/${wa}?text=${encodeURIComponent(msg || CFG.whatsappMessage || "")}`;
  $$("[data-whatsapp]").forEach((a) => (a.href = waLink()));
  $$("[data-booking]").forEach((a) => (a.href = CFG.bookingUrl || waLink("Hi! I'd like to book a free 15-minute discovery call for my business website.")));

  /* ---------- toast ---------- */
  const toastEl = $("#wToast"); let tt;
  const toast = (msg) => { toastEl.textContent = msg; toastEl.classList.add("on"); clearTimeout(tt); tt = setTimeout(() => toastEl.classList.remove("on"), 3400); };
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-toast]"); if (b) { e.preventDefault(); toast(b.dataset.toast); audio && audio.tick(); } });

  /* ---------- modals ---------- */
  let lastFocus = null, openModal = null;
  const open = (id) => {
    const m = document.getElementById(id);
    if (openModal) close(true);
    lastFocus = document.activeElement;
    m.hidden = false; openModal = m;
    const f = m.querySelector("input, button:not([data-close]), select, textarea") || m.querySelector("button");
    setTimeout(() => f && f.focus(), 30);
    onOpen && onOpen(id);
    if (window.gsap && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.fromTo(m.querySelector(".modal-box"), { opacity: 0, y: 40, scale: 0.96, rotateX: 8 }, { opacity: 1, y: 0, scale: 1, rotateX: 0, duration: 0.7, ease: "expo.out" });
      gsap.fromTo(m.querySelector(".modal-scrim"), { opacity: 0 }, { opacity: 1, duration: 0.4 });
    }
    audio && audio.whoosh(0, 0.9);
  };
  const close = (silent) => {
    if (!openModal) return;
    openModal.hidden = true; openModal = null;
    if (!silent) { onClose && onClose(); lastFocus && lastFocus.focus && lastFocus.focus(); }
  };
  document.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) close(); });
  document.addEventListener("keydown", (e) => {
    if (!openModal) return;
    if (e.key === "Escape") close();
    if (e.key === "Tab") { // focus trap
      const els = $$("a[href], button:not([disabled]), input:not([tabindex='-1']), select, textarea", openModal).filter((x) => x.offsetParent !== null);
      if (!els.length) return;
      const first = els[0], last = els[els.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  const form = $("#worldForm");
  const openForm = ({ category, budget, need } = {}) => {
    if (category) form.category.value = category;
    if (budget) form.budget.value = budget;
    if (need) { const r = form.querySelector(`input[name=need][value="${need}"]`); if (r) r.checked = true; }
    open("formModal");
  };

  document.addEventListener("click", (e) => {
    const f = e.target.closest("[data-form]"); if (f) { e.preventDefault(); openForm({ category: f.dataset.form, need: "New Website" }); return; }
    const b = e.target.closest("[data-form-budget]"); if (b) { e.preventDefault(); openForm({ budget: b.dataset.formBudget }); return; }
    const a = e.target.closest("[data-action]");
    if (a && a.dataset.action === "pricing") { e.preventDefault(); open("pricingModal"); }
    if (a && a.dataset.action === "contact") { e.preventDefault(); openForm(); }
  });

  /* ---------- validation ---------- */
  const rules = {
    name: (v) => v.trim().length >= 2 || "Please enter your name.",
    business: (v) => v.trim().length >= 2 || "Please enter your business name.",
    phone: (v) => {
      let d = v.replace(/\D/g, "");
      if (d.length === 12 && d.startsWith("91")) d = d.slice(2);
      if (d.length === 11 && d.startsWith("0")) d = d.slice(1);
      if (!d) return "Please enter your phone or WhatsApp number.";
      return /^[6-9]\d{9}$/.test(d) || "Please enter a valid 10-digit Indian mobile number.";
    },
    email: (v) => !v.trim() || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) || "Please enter a valid email address.",
    category: (v) => !!v || "Please choose your business category."
  };
  const check = (name) => {
    const el = form[name], wrap = el.closest(".wf"), res = rules[name](el.value);
    const msg = res === true ? "" : res;
    wrap.classList.toggle("bad", !!msg); wrap.querySelector(".err").textContent = msg;
    el.setAttribute("aria-invalid", msg ? "true" : "false");
    return !msg;
  };
  Object.keys(rules).forEach((k) => { form[k].addEventListener("blur", () => form[k].value && check(k)); form[k].addEventListener("input", () => form[k].closest(".wf").classList.contains("bad") && check(k)); });

  const status = $("#wfStatus"), btn = $("#wfSubmit"), lbl = btn.querySelector(".lbl");
  const success = (text) => {
    form.querySelector(".wf-inner").hidden = true;
    const s = $("#wfSuccess"); if (text) $("#wfSuccessText").textContent = text;
    s.hidden = false; s.focus();
    audio && audio.emerge();
  };

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    const okAll = ["name", "business", "phone", "email", "category"].map(check);
    const need = form.querySelector("input[name=need]:checked");
    $("#needErr").textContent = need ? "" : "Please tell us what you need.";
    if (okAll.includes(false) || !need) {
      status.textContent = "Please fix the highlighted fields.";
      const firstBad = form.querySelector(".wf.bad input, .wf.bad select") || (!need && form.querySelector("input[name=need]"));
      firstBad && firstBad.focus();
      return;
    }
    const fd = new FormData(form);
    const d = Object.fromEntries(fd.entries());
    if (d.botcheck) { success(); return; }
    const summary = ["Hi Digital Dukan! I'd like a free consultation.", `Name: ${d.name}`, `Business: ${d.business} (${d.category})`, `Need: ${d.need}`, `Budget: ${d.budget || "Not sure yet"}`, `Phone: ${d.phone}`, d.email && `Email: ${d.email}`, d.message && `About: ${d.message}`].filter(Boolean).join("\n");

    const cfg = CFG.form || {};
    const configured = !!(cfg.endpoint && (cfg.accessKey || !/web3forms\.com/.test(cfg.endpoint)));
    if (!configured) {
      window.open(waLink(summary), "_blank", "noopener");
      success("We've opened WhatsApp with your details filled in — just press send and we'll take it from there.");
      return;
    }
    btn.disabled = true; btn.classList.add("loading"); lbl.textContent = "Sending…";
    const ctrl = new AbortController(); const timer = setTimeout(() => ctrl.abort(), cfg.timeoutMs || 15000);
    try {
      const payload = { subject: `${cfg.subject || "New enquiry"} — ${d.business}`, from_name: "Digital Dukan City", name: d.name, business: d.business, phone: d.phone, email: d.email || undefined, replyto: d.email || undefined, category: d.category, need: d.need, budget: d.budget || "Not sure yet", message: d.message || "(not provided)", page: location.href };
      if (cfg.accessKey) payload.access_key = cfg.accessKey;
      const res = await fetch(cfg.endpoint, { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(payload), signal: ctrl.signal });
      let body = {}; try { body = await res.json(); } catch {}
      if (!res.ok || body.success === false) throw new Error(body.message || res.status);
      form.reset();
      success(`Thanks, ${String(d.name).split(" ")[0]}! We'll reach out personally within one working day.`);
    } catch (err) {
      status.textContent = "";
      status.append(document.createTextNode("Something went wrong sending your enquiry. "), Object.assign(document.createElement("a"), { href: waLink(summary), target: "_blank", rel: "noopener", textContent: "Send it on WhatsApp instead →" }));
    } finally {
      clearTimeout(timer); btn.disabled = false; btn.classList.remove("loading"); lbl.textContent = "Get My Free Consultation";
    }
  });

  /* ---------- small interactive bits inside the holograms ---------- */
  $$("[data-rtab]").forEach((b) => b.addEventListener("click", () => {
    $$("[data-rtab]").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
    $$("[data-rlist]").forEach((l) => (l.hidden = l.dataset.rlist !== b.dataset.rtab));
    audio && audio.tick();
  }));
  $$(".c-slots button:not(.c-confirm)").forEach((b) => b.addEventListener("click", () => {
    $$(".c-slots button:not(.c-confirm)").forEach((x) => x.setAttribute("aria-pressed", String(x === b))); audio && audio.tick();
  }));
  let bag = 0;
  $$("[data-bag]").forEach((b) => b.addEventListener("click", () => {
    const added = b.classList.toggle("added"); bag += added ? 1 : -1;
    b.textContent = added ? "Added ✓" : "Add to bag"; $("#jBag").textContent = bag; audio && audio.tick();
  }));

  return { open, close, openForm, toast, isOpen: () => !!openModal };
}
