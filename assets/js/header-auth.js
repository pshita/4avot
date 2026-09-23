import { watchAuthState, logoutUser } from "./auth.js";

// Duplicated from functions/index.js's ALLOWED_EMAIL - this isn't a secret
// (it's a deterministic hash of a public name, same as any other user's
// pseudo-email), it just names which logged-in account gets the admin-panel
// link. The actual write access is still enforced server-side.
const ALLOWED_EMAIL = "ufd5a4a70e876fc8672e3d112e6866c55@arba-avot-users.local";

const loggedOutEl = document.getElementById("auth-area-out");
const loggedInEl = document.getElementById("auth-area-in");
const logoutBtn = document.getElementById("logout-btn");
const userNameEl = document.getElementById("auth-user-name");
const adminLinkEl = document.getElementById("admin-panel-link");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await logoutUser();
    window.location.reload();
  });
}

watchAuthState((user) => {
  const isLoggedIn = Boolean(user);
  if (loggedOutEl) loggedOutEl.hidden = isLoggedIn;
  if (loggedInEl) loggedInEl.hidden = !isLoggedIn;
  if (userNameEl) userNameEl.textContent = isLoggedIn && user.displayName ? `מחובר/ת: ${user.displayName}` : "";
  if (adminLinkEl) adminLinkEl.hidden = !(isLoggedIn && user.email === ALLOWED_EMAIL);
});
