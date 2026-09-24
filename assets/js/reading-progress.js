// Fills the thin bar along the header's bottom edge as the reader scrolls
// through a lesson's content. Present in every page's markup, but this
// only does anything when .lesson-title-row exists (i.e. an actual lesson
// page) - everywhere else the bar just stays empty.
(function () {
  var isLessonPage = !!document.querySelector(".lesson-title-row");
  var fill = document.getElementById("reading-progress-fill");
  var main = document.querySelector("main");
  if (!isLessonPage || !fill || !main) return;

  function update() {
    var total = main.offsetHeight - window.innerHeight;
    if (total <= 0) {
      fill.style.width = "100%";
      return;
    }
    var scrolled = -main.getBoundingClientRect().top;
    var pct = Math.max(0, Math.min(100, (scrolled / total) * 100));
    fill.style.width = pct + "%";
  }

  window.addEventListener("scroll", update, { passive: true });
  window.addEventListener("resize", update);
  update();
})();
