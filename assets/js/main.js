// Open the first "av nezikin" section by default, keep the rest collapsed
(function () {
  var sections = document.querySelectorAll(".nezek");
  if (sections.length) sections[0].setAttribute("open", "");
})();

// Generic dropdown toggle for the brand menu and the lesson picker
(function () {
  var dropdowns = document.querySelectorAll(".dropdown");
  dropdowns.forEach(function (dropdown) {
    var trigger = dropdown.querySelector(".dropdown-trigger");
    var menu = dropdown.querySelector(".dropdown-menu");
    if (!trigger || !menu) return;
    trigger.addEventListener("click", function (e) {
      e.stopPropagation();
      var willOpen = menu.hidden;
      document.querySelectorAll(".dropdown-menu").forEach(function (m) {
        m.hidden = true;
      });
      menu.hidden = !willOpen;
    });
  });
  document.addEventListener("click", function () {
    document.querySelectorAll(".dropdown-menu").forEach(function (m) {
      m.hidden = true;
    });
  });
})();
