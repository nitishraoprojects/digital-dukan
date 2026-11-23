/* Shared helpers for concept demos */
(function () {
  // Reveal on scroll
  const els = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((en) => en.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.12 });
    els.forEach((el) => io.observe(el));
  } else els.forEach((el) => el.classList.add("in"));

  // Toast
  let t;
  window.ddToast = function (msg) {
    let el = document.querySelector(".toast");
    if (!el) { el = document.createElement("div"); el.className = "toast"; el.setAttribute("role", "status"); document.body.appendChild(el); }
    el.textContent = msg;
    el.classList.add("show");
    clearTimeout(t);
    t = setTimeout(() => el.classList.remove("show"), 3600);
  };

  // Demo forms: validate natively, then show a concept message instead of sending
  document.querySelectorAll("form[data-demo]").forEach((f) => {
    f.addEventListener("submit", (e) => {
      e.preventDefault();
      if (!f.reportValidity()) return;
      window.ddToast(f.dataset.demo || "Concept demo — on a real site this goes straight to the owner's WhatsApp or inbox.");
      f.reset();
    });
  });

  // Fake-links in demos
  document.querySelectorAll("a[href='#demo']").forEach((a) => a.addEventListener("click", (e) => { e.preventDefault(); window.ddToast("This is a concept demo. On a live site, this would open the real page."); }));

  // Set min dates to today
  const today = new Date().toISOString().slice(0, 10);
  document.querySelectorAll("input[type=date]").forEach((d) => (d.min = today));

  // When shown inside the Nikavi Labs showcase iframe, hide the banner for a cleaner preview
  if (window.self !== window.top) document.documentElement.classList.add("in-frame");
})();
