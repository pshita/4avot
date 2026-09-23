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

const CONFETTI_COLORS = ["#a0522d", "#6b7f3f", "#3f6f7f", "#b23b2e", "#d99a2b", "#4a8fbd"];

// A longer, more generous celebration than a quick flash - the correct
// answer's feedback window is stretched to match (see FEEDBACK_MS below).
function spawnConfetti(container) {
  if (!container) return;
  for (let i = 0; i < 24; i++) {
    const piece = document.createElement("span");
    piece.className = "confetti-piece";
    piece.style.left = `${4 + Math.random() * 92}%`;
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    const duration = 1.7 + Math.random() * 0.9;
    piece.style.animationDuration = `${duration}s`;
    piece.style.animationDelay = `${Math.random() * 0.35}s`;
    container.appendChild(piece);
    setTimeout(() => piece.remove(), (duration + 0.4) * 1000);
  }
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

// Wraps the question + choices in their own box so the correct/incorrect
// feedback can pop up directly on top of them instead of pushing them down.
function wrapQuizBody(quizEl) {
  const body = document.createElement("div");
  body.className = "quiz-body";
  const question = quizEl.querySelector(".quiz-question");
  const choices = quizEl.querySelector(".quiz-choices");
  const feedback = quizEl.querySelector(".quiz-feedback");
  quizEl.insertBefore(body, question);
  body.appendChild(question);
  body.appendChild(choices);
  body.appendChild(feedback);
}

document.querySelectorAll(".quiz").forEach(wrapQuizBody);

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

    const title = document.createElement("p");
    title.className = "quiz-group-title";
    title.textContent = "תרגול מכפיל את הזיכרון";

    const revealBtn = document.createElement("button");
    revealBtn.type = "button";
    revealBtn.className = "quiz-reveal-btn";
    revealBtn.textContent = "להכפיל?";

    const body = document.createElement("div");
    body.className = "quiz-group-body";
    body.hidden = true;

    const doneMsg = document.createElement("p");
    doneMsg.className = "quiz-group-done";
    doneMsg.textContent = "כל הכבוד!";
    doneMsg.hidden = true;

    let progressEl = null;
    if (members.length > 1) {
      progressEl = document.createElement("p");
      progressEl.className = "quiz-progress";
    }

    parent.insertBefore(wrapper, first);
    wrapper.appendChild(title);
    wrapper.appendChild(revealBtn);
    wrapper.appendChild(body);
    wrapper.appendChild(doneMsg);

    const groupState = { wrapper, title, revealBtn, body, doneMsg };

    members.forEach((q, i) => {
      body.appendChild(q);
      q.hidden = i !== 0;
      quizGroupInfo.set(q, { members, index: i, progressEl, groupState });
    });

    function placeProgress(index) {
      if (!progressEl) return;
      members[index].appendChild(progressEl);
      progressEl.textContent = `שאלה ${index + 1} מתוך ${members.length}`;
    }

    revealBtn.addEventListener("click", () => {
      wrapper.classList.add("open");
      title.hidden = true;
      revealBtn.hidden = true;
      doneMsg.hidden = true;
      body.hidden = false;
      let startIndex = members.findIndex((q) => q.dataset.answered !== "true");
      if (startIndex === -1) startIndex = members.length - 1;
      members.forEach((q, i) => {
        q.hidden = i !== startIndex;
      });
      placeProgress(startIndex);
    });
  });
}

function advanceQuizGroup(quizEl) {
  const info = quizGroupInfo.get(quizEl);
  if (!info) return;
  const { members, index, progressEl, groupState } = info;
  if (index >= members.length - 1) {
    completeQuizGroup(groupState);
    return;
  }
  members[index].hidden = true;
  members[index + 1].hidden = false;
  if (progressEl) {
    members[index + 1].appendChild(progressEl);
    progressEl.textContent = `שאלה ${index + 2} מתוך ${members.length}`;
  }
}

function completeQuizGroup(groupState) {
  const { wrapper, title, revealBtn, body, doneMsg } = groupState;
  wrapper.classList.remove("open");
  body.hidden = true;
  title.hidden = true;
  revealBtn.hidden = true;
  doneMsg.hidden = false;
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
      feedback.textContent = isCorrect ? "נכון!" : "לא נכון";
      feedback.className = "quiz-feedback " + (isCorrect ? "correct" : "incorrect");
      if (isCorrect) spawnConfetti(quizEl.querySelector(".quiz-body"));

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

      setTimeout(() => {
        feedback.hidden = true;
        advanceQuizGroup(quizEl);
      }, isCorrect ? 2600 : 1400);
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
