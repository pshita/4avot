import { getDb, isReady } from "./auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import { initQuizzes } from "./quiz.js";

const lessonId = location.pathname.split("/").pop().replace(/\.html$/, "");

function applyTitleOverride(data) {
  const titleCid = `${lessonId}:0`;
  if (!Object.prototype.hasOwnProperty.call(data, titleCid)) return;
  const el = document.querySelector(`[data-cid="${CSS.escape(titleCid)}"]`);
  if (el) el.textContent = data[titleCid];
}

function renderQuizBlock(block) {
  const div = document.createElement("div");
  div.className = "quiz";
  div.dataset.questionId = block.qid;
  if (block.marksSection) div.dataset.marksSection = block.marksSection;

  const q = document.createElement("p");
  q.className = "quiz-question";
  q.textContent = block.question;

  const choicesWrap = document.createElement("div");
  choicesWrap.className = "quiz-choices";
  (block.choices || []).forEach((c) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "quiz-choice";
    btn.textContent = c.text;
    btn.dataset.correct = c.correct ? "true" : "false";
    choicesWrap.appendChild(btn);
  });

  const feedback = document.createElement("p");
  feedback.className = "quiz-feedback";
  feedback.hidden = true;

  div.appendChild(q);
  div.appendChild(choicesWrap);
  div.appendChild(feedback);
  return div;
}

// Rebuilds every .intro-box in <main> from a saved "sections" array. The
// array is a flat, ordered list of blocks; a "box" block starts a fresh
// <div class="intro-box"> (most lessons have exactly one, shor-umave has
// three), everything else appends into whichever box is currently open.
function renderSections(main, sections) {
  const existingBoxes = main.querySelectorAll(".intro-box");
  if (!existingBoxes.length) return;
  const anchor = existingBoxes[0];
  const parent = anchor.parentNode;
  for (let i = 1; i < existingBoxes.length; i++) existingBoxes[i].remove();

  let container = null;
  sections.forEach((block) => {
    if (block.type === "box") {
      container = document.createElement("div");
      container.className = "intro-box";
      parent.insertBefore(container, anchor);
      return;
    }
    if (!container) return; // malformed data: no box opened yet
    if (block.type === "heading") {
      const el = document.createElement(block.tag || "h3");
      if (block.cls) el.className = block.cls;
      el.textContent = block.text;
      container.appendChild(el);
    } else if (block.type === "paragraphs") {
      (block.items || []).forEach((it) => {
        const p = document.createElement("p");
        if (it.cls) p.className = it.cls;
        p.textContent = it.text;
        container.appendChild(p);
      });
    } else if (block.type === "quiz") {
      container.appendChild(renderQuizBlock(block));
    } else if (block.type === "raw") {
      const wrap = document.createElement("div");
      wrap.innerHTML = block.html;
      while (wrap.firstChild) container.appendChild(wrap.firstChild);
    }
  });
  anchor.remove();
}

function finish() {
  initQuizzes();
}

if (isReady()) {
  const ref = doc(getDb(), "content", lessonId);
  getDoc(ref)
    .then((snap) => {
      if (!snap.exists()) return;
      const data = snap.data();
      applyTitleOverride(data);
      if (Array.isArray(data.sections)) {
        const main = document.querySelector("main");
        if (main) renderSections(main, data.sections);
      }
    })
    .catch(() => {
      /* best-effort: page keeps its static content */
    })
    .finally(finish);
} else {
  finish();
}
