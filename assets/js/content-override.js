import { getDb, isReady } from "./auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

if (isReady()) {
  const lessonId = location.pathname.split("/").pop().replace(/\.html$/, "");
  const ref = doc(getDb(), "content", lessonId);
  getDoc(ref).then((snap) => {
    if (!snap.exists()) return;
    const overrides = snap.data();
    Object.keys(overrides).forEach((cid) => {
      if (cid === "updatedAt") return;
      const el = document.querySelector(`[data-cid="${CSS.escape(cid)}"]`);
      if (el) el.textContent = overrides[cid];
    });
  }).catch(() => {
    /* best-effort: page keeps its static text */
  });
}
