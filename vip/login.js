// api/login.js
import fs from "fs";
import path from "path";

/**
 * Utility: stringify -> base64
 */
function toBase64(obj) {
  const s = JSON.stringify(obj);
  return Buffer.from(s, "utf8").toString("base64");
}

/**
 * Try parse form-urlencoded raw string -> object
 */
function parseFormString(raw) {
  try {
    // some clients may send JSON string even with urlencoded content-type
    if (raw.trim().startsWith("{")) {
      return JSON.parse(raw);
    }
    const p = new URLSearchParams(raw);
    return Object.fromEntries(p.entries());
  } catch (e) {
    return null;
  }
}

/**
 * Main handler
 */
export default async function handler(req, res) {
  console.log("=== /api/login invoked ===");
  console.log("method:", req.method);
  console.log("headers:", req.headers ? Object.keys(req.headers).slice(0,20) : "no-headers");

  // collect inputs from query + body (support several shapes)
  let input = {};

  // 1) query string always accepted
  if (req.query && Object.keys(req.query).length) {
    console.log("query:", req.query);
    input = { ...input, ...req.query };
  }

  // 2) body handling: Vercel often auto-parses JSON into req.body object.
  let rawBody = req.body;

  // If body is a string (form-urlencoded), try parse it
  if (typeof rawBody === "string") {
    console.log("raw body string (first200):", rawBody.slice(0, 200));
    const parsed = parseFormString(rawBody);
    if (parsed) rawBody = parsed;
  }

  // If body is Buffer (rare), convert to string then parse
  if (rawBody && typeof rawBody !== "object" && rawBody.toString) {
    try {
      const s = rawBody.toString();
      const parsed = parseFormString(s);
      if (parsed) rawBody = parsed;
    } catch (e) {
      // ignore
    }
  }

  if (rawBody && typeof rawBody === "object") {
    console.log("parsed body keys:", Object.keys(rawBody).slice(0,20));
    input = { ...input, ...rawBody };
  } else {
    console.log("no parseable body");
  }

  // common fields fallback names (app may send different param names)
  const username = (input.username || input.user || input.app_Us || "").toString();
  const password = (input.password || input.pass || input.app_Pa || "").toString();
  const uid = (input.uid || input.app_ID || "").toString();
  const token6 = (input.token6 || input.token || "").toString();
  console.log("effective fields:", { username, password, uid, token6 });

  // Try load loader.zip (if you placed it in public/ or api/ or project root)
  let loaderB64 = "";
  try {
    const candidates = [
      path.join(process.cwd(), "public", "loader.zip"),
      path.join(process.cwd(), "api", "loader.zip"),
      path.join(process.cwd(), "loader.zip"),
    ];
    for (const p of candidates) {
      if (fs.existsSync(p)) {
        console.log("Found loader at:", p);
        loaderB64 = fs.readFileSync(p).toString("base64");
        break;
      }
    }
    if (!loaderB64) console.log("loader.zip not found in candidates.");
  } catch (e) {
    console.error("loader read error:", e && e.message);
  }

  // VALID credentials (ganti sesuai kebutuhan)
  const VALID_USER = "brmod";
  const VALID_PASS = "123";

  // Response structure for success - tailor fields below to match app expectations
  if (username === VALID_USER && password === VALID_PASS) {
    const responseObj = {
      // Data biasanya berisi base64 string (app-specific). Ganti sesuai yang diperlukan.
      Data: "Sm9obkRvZVZh...REPLACE_WITH_REAL_BASE64_IF_NEEDED==",
      Sign: "U0lHTkFSRU5BTkQ=",   // contoh
      Hash: "A1079D45981C1DF8F2B93B5C287770AA77FF1D4F83760737A9BE00", // contoh
      Status: "Success",
      Loader: loaderB64, // jika kosong, client harus handle
      MessageString: { Cliente: username, Dias: "5" },
      CurrUser: username,
      CurrPass: password,
      CurrToken: token6 || "",
      CurrVersion: "2.0",
      SubscriptionLeft: "5"
    };

    const out = toBase64(responseObj);
    console.log("SUCCESS response base64 len:", out.length);
    res.setHeader("content-type", "text/plain");
    return res.status(200).send(out);
  }

  // If here -> invalid credentials / bad body
  const failedObj = {
    Status: "Failed",
    Message: "Invalid JSON body or credentials",
    SubscriptionLeft: "0"
  };
  const outFailed = toBase64(failedObj);
  console.log("FAILED response base64 len:", outFailed.length);
  res.setHeader("content-type", "text/plain");
  return res.status(200).send(outFailed);
}
