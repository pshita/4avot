import { watchAuthState, logoutUser } from "./auth.js";

const loggedOutEl = document.getElementById("auth-area-out");
const loggedInEl = document.getElementById("auth-area-in");
const logoutBtn = document.getElementById("logout-btn");
const userNameEl = document.getElementById("auth-user-name");

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
});
