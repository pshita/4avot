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
      const value = overrides[cid];
      if (Array.isArray(value)) {
        const container = document.querySelector(`[data-cid-group="${CSS.escape(cid)}"]`);
        if (!container) return;
        container.innerHTML = "";
        value.forEach((para) => {
          const p = document.createElement("p");
          if (para.cls) p.className = para.cls;
          p.textContent = para.text;
          container.appendChild(p);
        });
      } else {
        const el = document.querySelector(`[data-cid="${CSS.escape(cid)}"]`);
        if (el) el.textContent = value;
      }
    });
  }).catch(() => {
    /* best-effort: page keeps its static text */
  });
}
