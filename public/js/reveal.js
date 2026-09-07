// Scroll-reveal, ported from jinder's [data-reveal] pattern: plain
// IntersectionObserver, gated behind html.js so no-JS clients and
// crawlers still see full content immediately. Toggles both ways so
// elements fade back out scrolling up and fade back in scrolling down,
// rather than a one-time reveal.
document.documentElement.classList.add("js");

document.addEventListener("DOMContentLoaded", () => {
  const targets = document.querySelectorAll("[data-reveal], [data-reveal-stagger]");
  if (!targets.length || !("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        entry.target.classList.toggle("is-visible", entry.isIntersecting);
      });
    },
    { threshold: 0.15, rootMargin: "0px 0px -60px 0px" }
  );

  targets.forEach((el, i) => {
    el.style.setProperty("--reveal-delay", `${(i % 4) * 80}ms`);
    observer.observe(el);
  });
});
