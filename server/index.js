import { URL } from "node:url";
import { connect, isReady, mapPlant, mapWater, plants, toId, users, waters } from "./db.js";
import { createApp, readJson, sendEmpty, sendJson, serveStatic } from "./http.js";
import { getUserFromRequest, hashPassword, signToken, verifyPassword } from "./middleware/auth.js";

const PORT = Number(process.env.PORT || 8080);
const HOST = process.env.HOST || "0.0.0.0";
const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;
function usernameQuery(username) { return new RegExp("^" + username.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"); }
function requireUser(req, res) { const user = getUserFromRequest(req); if (!user) { sendJson(res, 401, { error: "No autenticado" }); return null; } return user; }
function dayKey(date = new Date()) { return new Date(date.getTime() - 3 * 60 * 60 * 1000).toISOString().slice(0, 10); }
function photoOf(value) { const url = String(value || "").trim().slice(0, 300); return /^https?:\/\//i.test(url) ? url : ""; }

const server = createApp(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  const { pathname } = url;
  const method = req.method || "GET";
  if (pathname === "/health") return sendJson(res, 200, { ok: true, db: isReady() });
  if (pathname.startsWith("/api/") && !isReady()) return sendJson(res, 503, { error: "Base no lista" });
  if (!pathname.startsWith("/api/")) return serveStatic(req, res);

  if (method === "POST" && pathname === "/api/auth/register") {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const password = String(body.password || "");
    if (!USERNAME_RE.test(username)) return sendJson(res, 400, { error: "Usuario: 3-20 caracteres, letras, numeros y _" });
    if (password.length < 6) return sendJson(res, 400, { error: "La contrasena debe tener al menos 6 caracteres" });
    if (await users().findOne({ username: usernameQuery(username) })) return sendJson(res, 409, { error: "Ese usuario ya existe" });
    const result = await users().insertOne({ username, passwordHash: hashPassword(password), createdAt: new Date() });
    const user = { id: String(result.insertedId), username };
    return sendJson(res, 201, { user, token: signToken(user) });
  }
  if (method === "POST" && pathname === "/api/auth/login") {
    const body = await readJson(req);
    const username = String(body.username || "").trim();
    const row = await users().findOne({ username: usernameQuery(username) });
    if (!row || !verifyPassword(String(body.password || ""), row.passwordHash)) return sendJson(res, 401, { error: "Usuario o contrasena incorrectos" });
    const user = { id: String(row._id), username: row.username };
    return sendJson(res, 200, { user, token: signToken(user) });
  }
  if (method === "GET" && pathname === "/api/auth/me") {
    const user = requireUser(req, res);
    if (!user) return;
    return sendJson(res, 200, { user });
  }

  const user = requireUser(req, res);
  if (!user) return;
  const userId = user.id;

  if (method === "GET" && pathname === "/api/plants") {
    const rows = await plants().find({ userId }).sort({ name: 1 }).limit(80).toArray();
    const logs = await waters().find({ userId }).sort({ day: -1 }).limit(200).toArray();
    return sendJson(res, 200, { plants: rows.map(mapPlant), waters: logs.map(mapWater) });
  }
  if (method === "POST" && pathname === "/api/plants") {
    const body = await readJson(req);
    const name = String(body.name || "").trim();
    if (!name) return sendJson(res, 400, { error: "El nombre es obligatorio" });
    const result = await plants().insertOne({ userId, name: name.slice(0, 40), place: String(body.place || "").slice(0, 40), photo: photoOf(body.photo), createdAt: new Date() });
    return sendJson(res, 201, { plant: mapPlant(await plants().findOne({ _id: result.insertedId })) });
  }
  if (method === "POST" && pathname === "/api/waters") {
    const body = await readJson(req);
    const plant = await plants().findOne({ _id: toId(body.plantId), userId });
    if (!plant) return sendJson(res, 400, { error: "Planta no encontrada" });
    const result = await waters().insertOne({ userId, plantId: String(plant._id), day: dayKey(), createdAt: new Date() });
    return sendJson(res, 201, { water: mapWater(await waters().findOne({ _id: result.insertedId })) });
  }
  const match = pathname.match(/^\/api\/plants\/([a-fA-F0-9]{24})$/);
  if (match && method === "DELETE") {
    const result = await plants().deleteOne({ _id: toId(match[1]), userId });
    if (!result.deletedCount) return sendJson(res, 404, { error: "Planta no encontrada" });
    await waters().deleteMany({ userId, plantId: match[1] });
    return sendEmpty(res, 204);
  }
  sendJson(res, 404, { error: "Ruta no encontrada" });
});

server.listen(PORT, HOST, () => console.log(`Jardin en http://${HOST}:${PORT}`));
async function bootDb() { for (;;) { try { await connect(); return; } catch (err) { console.error("Mongo no disponible:", err.message); await new Promise((resolve) => setTimeout(resolve, 5000)); } } }
bootDb();
