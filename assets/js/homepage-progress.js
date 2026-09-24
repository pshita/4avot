import { onAnswersReady, getCurrentQuizUser } from "./score.js";
import { computeLessonCompletion } from "./lesson-completion.js";

const groupPanels = Array.from(document.querySelectorAll(".group-panel"));
if (groupPanels.length) {
  onAnswersReady((answers) => {
    const user = getCurrentQuizUser();
    if (!user) {
      document.querySelectorAll(".lesson-card-done").forEach((el) => el.remove());
      document.querySelectorAll(".group-progress").forEach((el) => { el.hidden = true; });
      return;
    }

    groupPanels.forEach((panel) => {
      const cards = Array.from(panel.querySelectorAll(".lesson-card"));
      const entries = cards.map((card) => ({ href: card.getAttribute("href"), card }));

      computeLessonCompletion(entries, answers).then((results) => {
        let doneCount = 0;
        results.forEach((r) => {
          const existing = r.card.querySelector(".lesson-card-done");
          if (r.complete) {
            doneCount++;
            if (!existing) {
              const badge = document.createElement("span");
              badge.className = "lesson-card-done";
              badge.setAttribute("aria-hidden", "true");
              badge.textContent = "✓";
              r.card.appendChild(badge);
            }
          } else if (existing) {
            existing.remove();
          }
        });

        const progressEl = panel.querySelector(".group-progress");
        if (progressEl) {
          progressEl.textContent = `${doneCount} מתוך ${results.length} הושלמו`;
          progressEl.hidden = doneCount === 0;
        }
      });
    });
  });
}
