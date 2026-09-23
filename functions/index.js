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

// Lesson ids are validated by shape (matches every id already in use, e.g.
// "avot-vetoldot") rather than a fixed list, so a newly created lesson can
// be edited right away with no code change or redeploy.
const LESSON_ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
function isValidLessonId(id) {
  return typeof id === "string" && id.length >= 2 && id.length <= 60 && LESSON_ID_RE.test(id);
}

// Only this account may write to the site's content. Computed the same way
// auth.js turns a name into a pseudo-email: sha256("<first>|<last>", both
// normalized), first 32 hex chars, prefixed "u", @arba-avot-users.local.
const ALLOWED_EMAIL = "ufd5a4a70e876fc8672e3d112e6866c55@arba-avot-users.local";

// Paragraph text may carry lightweight inline markup: **bold** and
// _italic_, matching what admin.html's textarea buttons insert. Escape
// everything else first so the markers are the only way to produce tags.
function escapeHtml(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function markdownLiteToHtml(text) {
  let out = escapeHtml(text);
  out = out.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/_(.+?)_/g, "<em>$1</em>");
  return out;
}

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
        const $p = $("<p></p>").html(markdownLiteToHtml(it.text || ""));
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
  if (!isValidLessonId(lessonId)) {
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

async function fileExists(path, token) {
  const res = await fetch(`https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/${path}?ref=${REPO_BRANCH}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github+json", "User-Agent": "avot-admin-panel" },
  });
  return res.status === 200;
}

function renderNewLessonHtml({ lessonId, titleText, prevId }) {
  const title = escapeHtml(titleText);
  return `<!DOCTYPE html><html lang="he" dir="rtl"><head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | ארבעה אבות</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="">
  <link href="https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@500;700&amp;family=Heebo:wght@300;400;600&amp;display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../assets/css/style.css?v=29">
</head>
<body>
  <header class="site-header">
    <div class="wrap">
      <div class="dropdown brand-dropdown">
        <button type="button" class="brand dropdown-trigger">
          <span class="mark">📖</span>
          <span>פשיטא</span>
        </button>
        <div class="dropdown-menu brand-menu" hidden="">
          <a class="dropdown-item" href="../index.html">בית</a>
          <div class="auth-area" id="auth-area-out">
            <a class="auth-link auth-link-primary" href="../login.html">התחברות</a>
          </div>
          <div class="auth-area" id="auth-area-in" hidden="">
            <span class="score-badge" id="score-badge" hidden=""></span>
            <button type="button" class="auth-link auth-link-primary" id="logout-btn">התנתקות</button>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main class="wrap" style="padding-top: 34px;">
    <div class="breadcrumbs"><a href="../index.html">בית</a> ← ${title}</div>

    <div class="lesson-title-row">
      <h1 class="lesson-title">${title}</h1>
    </div>

    <div class="intro-box"><p class="p-light">כאן יופיע תוכן השיעור.</p></div>

    <div class="lesson-nav single">
      <a class="lesson-nav-btn lesson-nav-btn--secondary" href="${prevId}.html">לשיעור הקודם</a>
    </div>
  </main>

  <footer class="site-footer"></footer>

  <script src="../assets/js/main.js?v=1"></script>
  <script type="module" src="../assets/js/header-auth.js"></script>
  <script type="module" src="../assets/js/score.js"></script>
  <script type="module" src="../assets/js/quiz.js?v=11"></script>


</body></html>`;
}

// Finds the last lesson in index.html's lesson grid - the new lesson gets
// appended right after it, so this stays correct as more lessons are added
// without ever touching this file again.
async function findLastLessonId($index) {
  const cards = $index(".lesson-card");
  if (!cards.length) throw new Error("No lesson cards found in index.html");
  const href = cards.last().attr("href") || "";
  const m = href.match(/^lessons\/([a-z0-9-]+)\.html$/);
  if (!m) throw new Error("Could not parse last lesson id from index.html");
  return m[1];
}

async function createLessonFiles({ lessonId, titleText, token }) {
  const indexPath = "contents/index.html";
  const indexCurrent = await githubRequest(`${indexPath}?ref=${REPO_BRANCH}`, { token });
  const indexHtml = Buffer.from(indexCurrent.content, "base64").toString("utf8");
  const $index = cheerio.load(indexHtml);
  const prevId = await findLastLessonId($index);

  // 1) Create the new lesson file first - if a later step fails, the site
  // ends up with an unlinked page rather than a link to a missing one.
  const newHtml = renderNewLessonHtml({ lessonId, titleText, prevId });
  await githubRequest(`contents/lessons/${lessonId}.html`, {
    method: "PUT",
    token,
    body: {
      message: `הוספת שיעור חדש: ${lessonId} (דרך פאנל הניהול)`,
      content: Buffer.from(newHtml, "utf8").toString("base64"),
      branch: REPO_BRANCH,
    },
  });

  // 2) Give the previous last lesson a "next" link to the new one.
  const prevPath = `contents/lessons/${prevId}.html`;
  const prevCurrent = await githubRequest(`${prevPath}?ref=${REPO_BRANCH}`, { token });
  const prevHtml = Buffer.from(prevCurrent.content, "base64").toString("utf8");
  const $prev = cheerio.load(prevHtml);
  const $prevNav = $prev(".lesson-nav");
  $prevNav.removeClass("single");
  $prevNav.find("a.lesson-nav-btn:not(.lesson-nav-btn--secondary)").remove();
  $prevNav.append(`<a class="lesson-nav-btn" href="${lessonId}.html">לשיעור הבא</a>`);
  await githubRequest(prevPath, {
    method: "PUT",
    token,
    body: {
      message: `הוספת שיעור חדש: ${lessonId} (דרך פאנל הניהול)`,
      content: Buffer.from($prev.html(), "utf8").toString("base64"),
      sha: prevCurrent.sha,
      branch: REPO_BRANCH,
    },
  });

  // 3) Add the new lesson to the home page's lesson grid.
  $index(".lesson-grid").append(
    `<a class="lesson-card" href="lessons/${lessonId}.html">\n            <h3>${escapeHtml(titleText)}</h3>\n          </a>\n          `
  );
  await githubRequest(indexPath, {
    method: "PUT",
    token,
    body: {
      message: `הוספת שיעור חדש: ${lessonId} (דרך פאנל הניהול)`,
      content: Buffer.from($index.html(), "utf8").toString("base64"),
      sha: indexCurrent.sha,
      branch: REPO_BRANCH,
    },
  });
}

exports.createLesson = onCall({ secrets: [GITHUB_TOKEN] }, async (request) => {
  if (!request.auth || request.auth.token.email !== ALLOWED_EMAIL) {
    throw new HttpsError("permission-denied", "אין הרשאה לערוך תוכן באתר.");
  }

  const { lessonId, titleText } = request.data || {};
  if (!isValidLessonId(lessonId)) {
    throw new HttpsError("invalid-argument", "מזהה שיעור לא תקין (אותיות אנגליות קטנות, ספרות ומקפים בלבד).");
  }
  if (typeof titleText !== "string" || !titleText.trim()) {
    throw new HttpsError("invalid-argument", "צריך כותרת לשיעור.");
  }

  const token = GITHUB_TOKEN.value();
  if (await fileExists(`contents/lessons/${lessonId}.html`, token)) {
    throw new HttpsError("already-exists", "כבר קיים שיעור עם המזהה הזה.");
  }

  try {
    await createLessonFiles({ lessonId, titleText: titleText.trim(), token });
    return { ok: true, lessonId };
  } catch (err) {
    logger.error(`createLesson failed for ${lessonId}`, err);
    throw new HttpsError("internal", "יצירת השיעור נכשלה. נסו שוב.");
  }
});
