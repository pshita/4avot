// Reads a lesson's own HTML (never a baked-in copy) to find its quiz
// question ids, so completion can be computed against the live content
// instead of an assumption that might drift out of sync with it.
async function fetchLessonQuizIds(href) {
  try {
    const res = await fetch(href, { cache: "no-store" });
    if (!res.ok) return [];
    const html = await res.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    return Array.from(doc.querySelectorAll(".quiz[data-question-id]"))
      .map((el) => el.dataset.questionId)
      .filter(Boolean);
  } catch (e) {
    return [];
  }
}

// Given lesson entries ({ href, ... }) and the user's "quiz" progress
// answers map (question id -> answered correctly, the same one score.js's
// badge is built from), returns each entry with total/answered counts and
// a complete flag - true once every question in that lesson is answered.
// A lesson with no quiz questions at all never counts as complete.
export async function computeLessonCompletion(entries, answers) {
  const idLists = await Promise.all(entries.map((e) => fetchLessonQuizIds(e.href)));
  return entries.map((entry, i) => {
    const qids = idLists[i];
    const total = qids.length;
    const answered = qids.filter((qid) => answers[qid]).length;
    return Object.assign({}, entry, { total, answered, complete: total > 0 && answered === total });
  });
}
