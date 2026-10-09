import { api, setSession, clearSession, getToken } from "./api.js";
const authView = document.querySelector("#auth-view");
const appView = document.querySelector("#app-view");
const authForm = document.querySelector("#auth-form");
const authError = document.querySelector("#auth-error");
const authSubmit = document.querySelector("#auth-submit");
const listEl = document.querySelector("#list");
const formError = document.querySelector("#form-error");
let mode = "login";
const showError = (el, message) => { el.hidden = !message; el.textContent = message || ""; };

function setMode(next) {
  mode = next;
  document.querySelectorAll(".tab").forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  authSubmit.textContent = mode === "login" ? "Entrar" : "Crear cuenta";
}
async function refresh() {
  const data = await api("/api/plants");
  listEl.innerHTML = "";
  data.plants.forEach((plant) => {
    const card = document.createElement("article");
    card.className = "plant";
    if (plant.photo) {
      const img = document.createElement("img");
      img.src = plant.photo;
      img.alt = plant.name;
      card.append(img);
    }
    const title = document.createElement("strong");
    title.textContent = `${plant.name}${plant.place ? ` \u00b7 ${plant.place}` : ""}`;
    const last = data.waters.find((water) => water.plantId === plant.id);
    const info = document.createElement("p");
    info.textContent = last ? `Ultimo riego ${last.day}` : "Sin riegos";
    const water = document.createElement("button");
    water.type = "button";
    water.className = "primary";
    water.textContent = "Regar";
    water.addEventListener("click", async () => { await api("/api/waters", { method: "POST", body: JSON.stringify({ plantId: plant.id }) }); await refresh(); });
    const del = document.createElement("button");
    del.type = "button";
    del.className = "ghost";
    del.textContent = "Borrar";
    del.addEventListener("click", async () => { await api(`/api/plants/${plant.id}`, { method: "DELETE" }); await refresh(); });
    const row = document.createElement("div");
    row.className = "row";
    row.append(water, del);
    card.append(title, info, row);
    listEl.append(card);
  });
}
async function boot() {
  if (!getToken()) return;
  try {
    const { user } = await api("/api/auth/me");
    authView.classList.add("hidden");
    appView.classList.remove("hidden");
    document.querySelector("#user-name").textContent = user.username;
    await refresh();
  } catch { clearSession(); }
}
document.querySelectorAll(".tab").forEach((tab) => tab.addEventListener("click", () => setMode(tab.dataset.mode)));
authForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(authError, "");
  const fd = new FormData(authForm);
  try {
    const data = await api(mode === "login" ? "/api/auth/login" : "/api/auth/register", { method: "POST", body: JSON.stringify({ username: fd.get("username"), password: fd.get("password") }) });
    setSession(data.token);
    authForm.reset();
    await boot();
  } catch (err) { showError(authError, err.message); }
});
document.querySelector("#logout").addEventListener("click", () => { clearSession(); appView.classList.add("hidden"); authView.classList.remove("hidden"); });
document.querySelector("#plant-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  showError(formError, "");
  try {
    await api("/api/plants", { method: "POST", body: JSON.stringify({ name: document.querySelector("#name").value.trim(), place: document.querySelector("#place").value.trim(), photo: document.querySelector("#photo").value.trim() }) });
    document.querySelector("#plant-form").reset();
    await refresh();
  } catch (err) { showError(formError, err.message); }
});
boot();
