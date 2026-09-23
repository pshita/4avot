const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { defineSecret } = require("firebase-functions/params");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const logger = require("firebase-functions/logger");
const cheerio = require("cheerio");

initializeApp();
const db = getFirestore();

// Set these once via: firebase functions:secrets:set SMS4FREE_KEY (etc.)
// Never put real values in this file or in git.
const SMS4FREE_KEY = defineSecret("SMS4FREE_KEY");
const SMS4FREE_USER = defineSecret("SMS4FREE_USER");
const SMS4FREE_PASS = defineSecret("SMS4FREE_PASS");
const SMS4FREE_SENDER = defineSecret("SMS4FREE_SENDER");

// Set once via: firebase functions:secrets:set GITHUB_TOKEN
// A GitHub fine-grained personal access token scoped to this repo only,
// with Contents: Read and write permission.
const GITHUB_TOKEN = defineSecret("GITHUB_TOKEN");

// Send a parent SMS every time a student's quiz score crosses another
// multiple of this number (10, 20, 30, ...).
const MILESTONE_STEP = 10;

function countCorrect(sections) {
  if (!sections) return 0;
  return Object.values(sections).filter(Boolean).length;
}

async function sendSms({ key, user, pass, sender, recipient, msg }) {
  const res = await fetch("https://api.sms4free.co.il/ApiSMS/v2/SendSMS", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ key, user, pass, sender, recipient, msg }),
  });
  const data = await res.json();
  if (!(data.status > 0)) {
    throw new Error(`SMS4Free error ${data.status}: ${data.message}`);
  }
  return data;
}

// Fires on every write to a user's quiz-progress doc (users/{uid}/progress/quiz),
// which quiz.js updates each time a question is answered correctly for the
// first time. Compares the score before/after the write; if it just crossed
// a new MILESTONE_STEP multiple, texts the parents.
exports.notifyParentsOnQuizMilestone = onDocumentWritten(
  {
    document: "users/{uid}/progress/quiz",
    secrets: [SMS4FREE_KEY, SMS4FREE_USER, SMS4FREE_PASS, SMS4FREE_SENDER],
  },
  async (event) => {
    const uid = event.params.uid;
    const before = event.data.before.exists ? event.data.before.data() : null;
    const after = event.data.after.exists ? event.data.after.data() : null;
    if (!after) return;

    const prevScore = countCorrect(before?.sections);
    const newScore = countCorrect(after.sections);
    if (newScore <= prevScore) return;

    const prevMilestone = Math.floor(prevScore / MILESTONE_STEP) * MILESTONE_STEP;
    const newMilestone = Math.floor(newScore / MILESTONE_STEP) * MILESTONE_STEP;
    if (newMilestone <= prevMilestone || newMilestone === 0) return;

    const userSnap = await db.collection("users").doc(uid).get();
    if (!userSnap.exists) return;
    const userData = userSnap.data();
    const recipients = [userData.fatherPhone, userData.motherPhone].filter(Boolean);
    if (recipients.length === 0) return;

    const fullName = `${userData.firstName || ""} ${userData.lastName || ""}`.trim();
    const msg = `${fullName}: ${newMilestone} נקודות בשיעורי "ארבעה אבות" 🎉`;

    try {
      await sendSms({
        key: SMS4FREE_KEY.value(),
        user: SMS4FREE_USER.value(),
        pass: SMS4FREE_PASS.value(),
        sender: SMS4FREE_SENDER.value(),
        recipient: recipients.join(";"),
        msg,
      });
      logger.info(`Notified parents of ${uid} at ${newMilestone} points`);
    } catch (err) {
      logger.error(`Failed to notify parents of ${uid} at ${newMilestone} points`, err);
    }
  }
);

// ---------------------------------------------------------------------
// Admin content panel: commits lesson edits straight to the GitHub repo
// so the change is baked into the static HTML (no runtime DB lookup).
// ---------------------------------------------------------------------

const REPO_OWNER = "pshita";
const REPO_NAME = "4avot";
const REPO_BRANCH = "main";
const LESSON_IDS = [
  "avot-vetoldot",
  "shor-umave",
  "lo-hari-hashor",
  "gabei-shabbat-tanan",
  "umai-ika",
  "gabei-tumaot-tanan",
];

// Only this account may write to the site's content. Computed the same way
// auth.js turns a name into a pseudo-email: sha256("<first>|<last>", both
// normalized), first 32 hex chars, prefixed "u", @arba-avot-users.local.
const ALLOWED_EMAIL = "ufd5a4a70e876fc8672e3d112e6866c55@arba-avot-users.local";

function renderQuizBlock($, block) {
  const $div = $("<div></div>").addClass("quiz");
  $div.attr("data-question-id", block.qid || "");
  if (block.marksSection) $div.attr("data-marks-section", block.marksSection);

  const $q = $("<p></p>").addClass("quiz-question").text(block.question || "");
  const $choicesWrap = $("<div></div>").addClass("quiz-choices");
  (block.choices || []).forEach((c) => {
    const $btn = $("<button></button>").attr("type", "button").addClass("quiz-choice").text(c.text || "");
    $btn.attr("data-correct", c.correct ? "true" : "false");
    $choicesWrap.append($btn);
  });
  const $feedback = $("<p></p>").addClass("quiz-feedback").attr("hidden", "");

  $div.append($q).append($choicesWrap).append($feedback);
  return $div;
}

// Builds one cheerio element per "box" block (a fresh <div class="intro-box">),
// appending every block that follows it until the next box marker.
function renderBoxes($, sections) {
  const boxes = [];
  let $current = null;
  (sections || []).forEach((block) => {
    if (block.type === "box") {
      $current = $("<div></div>").addClass("intro-box");
      boxes.push($current);
      return;
    }
    if (!$current) return;
    if (block.type === "heading") {
      const tag = ["h1", "h2", "h3"].includes(block.tag) ? block.tag : "h3";
      const $el = $(`<${tag}></${tag}>`).text(block.text || "");
      if (block.cls) $el.addClass(block.cls);
      $current.append($el);
    } else if (block.type === "paragraphs") {
      (block.items || []).forEach((it) => {
        const $p = $("<p></p>").text(it.text || "");
        if (it.cls) $p.addClass(it.cls);
        $current.append($p);
      });
    } else if (block.type === "quiz") {
      $current.append(renderQuizBlock($, block));
    } else if (block.type === "raw" && block.html) {
      $current.append($(block.html));
    }
  });
  return boxes;
}

function validateSections(sections) {
  if (!Array.isArray(sections) || sections.length === 0) return false;
  if (sections[0].type !== "box") return false;
  return sections.every((b) => ["box", "heading", "paragraphs", "quiz", "raw"].includes(b.type));
}

async function githubRequest(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "avot-admin-panel",
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`GitHub ${method} ${path} failed: ${res.status} ${text}`);
  }
  return res.json();
}

async function updateLessonFile({ lessonId, titleText, sections, token }) {
  const path = `contents/lessons/${lessonId}.html`;
  const current = await githubRequest(`${path}?ref=${REPO_BRANCH}`, { token });
  const currentHtml = Buffer.from(current.content, "base64").toString("utf8");

  const $ = cheerio.load(currentHtml);

  if (typeof titleText === "string" && titleText.trim()) {
    $(".lesson-title-row h1").text(titleText);
  }

  const existingBoxes = $(".intro-box");
  if (existingBoxes.length === 0) throw new Error("No .intro-box found in lesson file");
  const $anchor = existingBoxes.first();
  existingBoxes.slice(1).remove();

  const newBoxes = renderBoxes($, sections);
  newBoxes.forEach(($box) => $anchor.before($box));
  $anchor.remove();

  const newHtml = $.html();

  await githubRequest(path, {
    method: "PUT",
    token,
    body: {
      message: `עדכון תוכן: ${lessonId} (דרך פאנל הניהול)`,
      content: Buffer.from(newHtml, "utf8").toString("base64"),
      sha: current.sha,
      branch: REPO_BRANCH,
    },
  });
}

exports.saveLessonContent = onCall({ secrets: [GITHUB_TOKEN] }, async (request) => {
  if (!request.auth || request.auth.token.email !== ALLOWED_EMAIL) {
    throw new HttpsError("permission-denied", "אין הרשאה לערוך תוכן באתר.");
  }

  const { lessonId, titleText, sections } = request.data || {};
  if (!LESSON_IDS.includes(lessonId)) {
    throw new HttpsError("invalid-argument", "שיעור לא מוכר.");
  }
  if (!validateSections(sections)) {
    throw new HttpsError("invalid-argument", "מבנה התוכן שגוי.");
  }

  try {
    await updateLessonFile({ lessonId, titleText, sections, token: GITHUB_TOKEN.value() });
    return { ok: true };
  } catch (err) {
    logger.error(`saveLessonContent failed for ${lessonId}`, err);
    throw new HttpsError("internal", "השמירה נכשלה. נסו שוב.");
  }
});
