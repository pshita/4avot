import { onAnswersReady, getCurrentQuizUser } from "./score.js";
import { computeLessonCompletion } from "./lesson-completion.js";

const MILESTONE_STEP = 10;

const gateEl = document.getElementById("achievements-gate");
const mainEl = document.getElementById("achievements-main");
const totalCountEl = document.getElementById("achv-total-count");
const trackFillEl = document.getElementById("achv-track-fill");
const nextEl = document.getElementById("achv-next");
const milestonesEl = document.getElementById("achv-milestones");
const groupsEl = document.getElementById("achv-groups");

function renderTotals(count) {
  const achieved = Math.floor(count / MILESTONE_STEP);
  const currentBase = achieved * MILESTONE_STEP;
  const pct = Math.round(((count - currentBase) / MILESTONE_STEP) * 100);

  totalCountEl.textContent = count;
  trackFillEl.style.width = pct + "%";
  nextEl.textContent = `עוד ${MILESTONE_STEP - (count - currentBase)} נקודות לאבן הדרך הבאה`;

  milestonesEl.innerHTML = "";
  for (let i = 1; i <= achieved; i++) {
    const dot = document.createElement("span");
    dot.className = "score-badge-dot achieved";
    dot.title = `${i * MILESTONE_STEP} נקודות`;
    milestonesEl.appendChild(dot);
  }
  const next = document.createElement("span");
  next.className = "score-badge-dot";
  next.title = "אבן הדרך הבאה";
  milestonesEl.appendChild(next);
}

// Reads the live page/amud groups from index.html (same source of truth
// admin.html's picker and the "insert after" choices already use), then
// computes each lesson's own completion the same way the homepage's
// checkmarks do.
function renderGroups(answers) {
  groupsEl.innerHTML = '<p class="loading-msg">טוען…</p>';
  fetch("index.html", { cache: "no-store" })
    .then((res) => res.text())
    .then((html) => {
      const doc = new DOMParser().parseFromString(html, "text/html");
      const groups = Array.from(doc.querySelectorAll(".group-panel")).map((panel) => {
        const titleEl = panel.querySelector(".group-title span");
        const cards = Array.from(panel.querySelectorAll(".lesson-card")).map((card) => ({
          href: card.getAttribute("href") || "",
          title: card.querySelector("h3") ? card.querySelector("h3").textContent.trim() : "",
        }));
        return { title: titleEl ? titleEl.textContent.trim() : "", cards };
      });

      groupsEl.innerHTML = "";
      groups.forEach((group) => {
        const section = document.createElement("div");
        section.className = "achv-group";
        const h2 = document.createElement("h2");
        h2.textContent = group.title;
        const list = document.createElement("div");
        list.className = "achv-lesson-list";
        section.appendChild(h2);
        section.appendChild(list);
        groupsEl.appendChild(section);

        computeLessonCompletion(group.cards, answers).then((results) => {
          list.innerHTML = "";
          results.forEach((r) => {
            const row = document.createElement("a");
            row.className = "achv-lesson-row";
            row.href = r.href;
            const label = document.createElement("span");
            label.textContent = r.title;
            const stat = document.createElement("span");
            stat.className = "achv-lesson-stat" + (r.complete ? " complete" : "");
            stat.textContent = r.total > 0 ? `${r.answered}/${r.total}` + (r.complete ? " ✓" : "") : "אין תרגול";
            row.appendChild(label);
            row.appendChild(stat);
            list.appendChild(row);
          });
        });
      });
    })
    .catch(() => {
      groupsEl.innerHTML = '<p class="loading-msg">לא ניתן לטעון את רשימת השיעורים כרגע.</p>';
    });
}

onAnswersReady((answers) => {
  const user = getCurrentQuizUser();
  if (!user) {
    gateEl.hidden = false;
    mainEl.hidden = true;
    return;
  }
  gateEl.hidden = true;
  mainEl.hidden = false;
  renderTotals(Object.values(answers).filter(Boolean).length);
  renderGroups(answers);
});
