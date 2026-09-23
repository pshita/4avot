// Reads a lesson page's current HTML (fetched live from the site, never a
// baked-in copy) and turns it into the same block-list shape admin.html
// edits: an ordered array of heading / paragraphs / quiz / raw blocks,
// grouped into one or more "box" sections (most lessons have one
// .intro-box; shor-umave has three). This mirrors the block model that
// saveLessonContent (functions/index.js) writes back out, so what you see
// in the editor always matches what's actually live.

function parseQuiz(div) {
  const qid = div.getAttribute("data-question-id") || "";
  const questionEl = div.querySelector(".quiz-question");
  const question = questionEl ? questionEl.textContent.trim() : "";
  const choices = Array.from(div.querySelectorAll(".quiz-choice")).map((btn) => ({
    text: btn.textContent.trim(),
    correct: btn.getAttribute("data-correct") === "true",
  }));
  const block = { type: "quiz", qid, question, choices };
  const marksSection = div.getAttribute("data-marks-section");
  if (marksSection) block.marksSection = marksSection;
  return block;
}

export function parseLessonHtml(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const h1 = doc.querySelector(".lesson-title-row h1");
  const titleText = h1 ? h1.textContent.trim() : "";

  const introBoxes = doc.querySelectorAll(".intro-box");
  const blocks = [];
  let pending = [];
  let bidSeq = 0;
  const nextBid = () => {
    bidSeq++;
    return "b" + bidSeq;
  };

  function flush() {
    if (!pending.length) return;
    blocks.push({ bid: nextBid(), type: "paragraphs", items: pending });
    pending = [];
  }

  introBoxes.forEach((intro) => {
    flush();
    blocks.push({ bid: nextBid(), type: "box" });
    Array.from(intro.children).forEach((child) => {
      const tag = child.tagName.toLowerCase();
      if (tag === "h1" || tag === "h2" || tag === "h3") {
        flush();
        blocks.push({ bid: nextBid(), type: "heading", tag, cls: child.className || "", text: child.textContent.trim() });
      } else if (tag === "p") {
        pending.push({ text: child.textContent.trim(), cls: child.className || "" });
      } else if (tag === "div" && child.classList.contains("cgroup")) {
        // legacy wrapper from an earlier version of the site; unwrap it so
        // its paragraphs join the current run like any other adjacent <p>.
        Array.from(child.children).forEach((p) => {
          if (p.tagName.toLowerCase() === "p") {
            pending.push({ text: p.textContent.trim(), cls: p.className || "" });
          }
        });
      } else if (tag === "div" && child.classList.contains("quiz")) {
        flush();
        blocks.push({ bid: nextBid(), ...parseQuiz(child) });
      } else {
        flush();
        blocks.push({ bid: nextBid(), type: "raw", html: child.outerHTML.trim() });
      }
    });
  });
  flush();

  return { titleText, blocks };
}
