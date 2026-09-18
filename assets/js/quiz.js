import { setSectionComplete } from "./progress.js";
import { QUIZ_LESSON_ID, getCachedAnswers, getCurrentQuizUser, markQuestionCorrect, onAnswersReady } from "./score.js";

const main = document.querySelector("main[data-lesson-id]");
const lessonId = main ? main.dataset.lessonId : null;

function lockQuiz(quizEl, revealCorrect) {
  quizEl.querySelectorAll(".quiz-choice").forEach((b) => {
    b.disabled = true;
    if (revealCorrect && b.dataset.correct === "true") b.classList.add("correct");
  });
}

function markSectionDoneIfAny(quizEl) {
  const sectionId = quizEl.dataset.marksSection;
  if (!sectionId || !lessonId) return;
  const badge = document.getElementById(`done-${sectionId}`);
  if (badge) badge.hidden = false;
  setSectionComplete(lessonId, sectionId, true).catch(() => {
    /* best-effort: badge already updated locally */
  });
}

// Wraps each run of directly-adjacent .quiz elements in a collapsed
// "שנחזור על זה?" group, revealed one question at a time.
const quizGroupInfo = new Map(); // quizEl -> { members, index, progressEl }

function initQuizGroups() {
  const quizzes = Array.from(document.querySelectorAll(".quiz"));
  const runs = [];
  let current = [];
  quizzes.forEach((q) => {
    if (current.length && q.previousElementSibling === current[current.length - 1]) {
      current.push(q);
    } else {
      if (current.length) runs.push(current);
      current = [q];
    }
  });
  if (current.length) runs.push(current);

  runs.forEach((members) => {
    const first = members[0];
    const parent = first.parentElement;

    const wrapper = document.createElement("div");
    wrapper.className = "quiz-group";

    const revealBtn = document.createElement("button");
    revealBtn.type = "button";
    revealBtn.className = "quiz-reveal-btn";
    revealBtn.textContent = "שנחזור על זה?";

    const count = document.createElement("p");
    count.className = "quiz-group-count";
    count.textContent = members.length > 1 ? `${members.length} שאלות` : "שאלה אחת";

    const body = document.createElement("div");
    body.className = "quiz-group-body";
    body.hidden = true;

    let progressEl = null;
    if (members.length > 1) {
      progressEl = document.createElement("p");
      progressEl.className = "quiz-progress";
      body.appendChild(progressEl);
    }

    parent.insertBefore(wrapper, first);
    wrapper.appendChild(revealBtn);
    wrapper.appendChild(count);
    wrapper.appendChild(body);

    members.forEach((q, i) => {
      body.appendChild(q);
      q.hidden = i !== 0;
      quizGroupInfo.set(q, { members, index: i, progressEl });
    });

    revealBtn.addEventListener("click", () => {
      revealBtn.hidden = true;
      count.hidden = true;
      body.hidden = false;
      let startIndex = members.findIndex((q) => q.dataset.answered !== "true");
      if (startIndex === -1) startIndex = members.length - 1;
      members.forEach((q, i) => {
        q.hidden = i !== startIndex;
      });
      if (progressEl) progressEl.textContent = `שאלה ${startIndex + 1} מתוך ${members.length}`;
    });
  });
}

function advanceQuizGroup(quizEl) {
  const info = quizGroupInfo.get(quizEl);
  if (!info) return;
  const { members, index, progressEl } = info;
  if (index >= members.length - 1) return;
  members[index].hidden = true;
  members[index + 1].hidden = false;
  if (progressEl) progressEl.textContent = `שאלה ${index + 2} מתוך ${members.length}`;
}

initQuizGroups();

document.querySelectorAll(".quiz").forEach((quizEl) => {
  const qid = quizEl.dataset.questionId;
  const feedback = quizEl.querySelector(".quiz-feedback");

  quizEl.querySelectorAll(".quiz-choice").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (quizEl.dataset.answered === "true") return;
      quizEl.dataset.answered = "true";

      const isCorrect = btn.dataset.correct === "true";
      lockQuiz(quizEl, true);
      if (!isCorrect) btn.classList.add("incorrect");

      feedback.hidden = false;
      feedback.textContent = isCorrect ? "נכון!" : "לא נכון — התשובה הנכונה מסומנת למעלה.";
      feedback.className = "quiz-feedback " + (isCorrect ? "correct" : "incorrect");

      const user = getCurrentQuizUser();
      if (isCorrect && user) {
        if (!getCachedAnswers()[qid]) {
          markQuestionCorrect(qid);
          try {
            await setSectionComplete(QUIZ_LESSON_ID, qid, true);
          } catch (err) {
            /* best-effort: score already updated locally */
          }
        }
        markSectionDoneIfAny(quizEl);
      }

      setTimeout(() => advanceQuizGroup(quizEl), 1400);
    });
  });
});

// Runs immediately with whatever's cached, and again after each auth-state
// change (login/logout), so already-answered questions stay locked in.
onAnswersReady((answers) => {
  document.querySelectorAll(".quiz").forEach((quizEl) => {
    const qid = quizEl.dataset.questionId;
    if (answers[qid] && quizEl.dataset.answered !== "true") {
      quizEl.dataset.answered = "true";
      lockQuiz(quizEl, true);
    }
  });
});
