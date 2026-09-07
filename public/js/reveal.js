// Scroll-reveal, ported from jinder's [data-reveal] pattern: plain
// IntersectionObserver, gated behind html.js so no-JS clients and
// crawlers still see full content immediately. Toggles both ways so
// elements fade back out scrolling up and fade back in scrolling down,
// rather than a one-time reveal.
document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const targets = document.querySelectorAll("[data-reveal], [data-reveal-stagger]");
  if (!targets.length || !("IntersectionObserver" in window)) return;

  // threshold is a fraction of the TARGET's own height, not the viewport's —
  // a section taller than the screen (the 4-step grid, the catalog on a
  // phone) could sit on screen forever without ever clearing 0.15, staying
  // invisible for good. threshold: 0 fires as soon as a single pixel is
  // on screen, which is what "reveal as it scrolls into view" actually means.
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    },
    { threshold: 0, rootMargin: "0px 0px -10% 0px" }
  );

  targets.forEach((el, i) => {
    el.style.setProperty("--reveal-delay", `${(i % 4) * 80}ms`);
    observer.observe(el);
  });
});
