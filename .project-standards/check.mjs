import { createHash } from "node:crypto";
import { existsSync, readFileSync, realpathSync } from "node:fs";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

export const documentPaths = {
  agents: "AGENTS.md",
  readme: "README.md",
  architecture: "ARCHITECTURE.md",
  product: "docs/PRODUCT.md",
  frontend: "docs/FRONTEND.md",
  security: "docs/SECURITY.md",
  testing: "docs/TESTING.md",
  operations: "docs/OPERATIONS.md",
  plans: "docs/PLANS.md",
  standards: "docs/STANDARDS.md",
};

// The bundle contains UTF-8 text only. Git CRLF conversion is not policy drift.
export function digest(text) {
  return createHash("sha256").update(text.replace(/\r\n/g, "\n")).digest("hex");
}

export function safePath(root, path) {
  if (typeof path !== "string" || !path || isAbsolute(path) || path.includes("\\") || path.split("/").some((part) => ["..", ".git", "node_modules"].includes(part))) {
    throw new Error(`Ruta no permitida: ${path}`);
  }
  const base = realpathSync(root);
  const target = resolve(base, path);
  let ancestor = target;
  while (!existsSync(ancestor)) ancestor = dirname(ancestor);
  const rel = relative(base, realpathSync(ancestor));
  if (rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    throw new Error(`Ruta fuera del checkout: ${path}`);
  }
  return target;
}

export function isManagedPath(path) {
  return typeof path === "string" && (
    path.startsWith(".project-standards/") ||
    path.startsWith(".agents/skills/project-standards/") ||
    path === ".github/workflows/standards.yml"
  ) && path !== ".project-standards/manifest.json";
}

export function reviewDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mazatlan", year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  const value = (type) => parts.find((part) => part.type === type).value;
  return `${value("year")}-${value("month")}-${value("day")}`;
}

export function checkProject(root, { today = reviewDate() } = {}) {
  const findings = [];
  const add = (code, file, detail) => findings.push({ severity: "error", code, file, detail });
  function read(path) {
    try { return readFileSync(safePath(root, path), "utf8"); }
    catch (error) { add("FILE", path, error.message); return null; }
  }
  function json(path) {
    const text = read(path);
    if (text === null) return null;
    try { return JSON.parse(text); }
    catch (error) { add("JSON", path, error.message); return null; }
  }
  const config = json("standards.config.json");
  const manifest = json(".project-standards/manifest.json");
  if (!config || !manifest) return { root, ok: false, findings };
  const versionPattern = /^\d+\.\d+\.\d+$/;
  if (config.schemaVersion !== 1 || typeof config.project !== "string" || !versionPattern.test(config.standardVersion ?? "")) {
    add("CONFIG", "standards.config.json", "Identidad, schemaVersion o versión inválidas.");
  }
  if (manifest.schemaVersion !== 1 || !versionPattern.test(manifest.version ?? "") || config.standardVersion !== manifest.version) {
    add("VERSION", ".project-standards/manifest.json", "La versión adoptada y el manifiesto deben coincidir.");
  }
  const files = manifest.files;
  if (!files || typeof files !== "object" || Array.isArray(files) || !Object.keys(files).length) {
    add("MANIFEST", ".project-standards/manifest.json", "Lista de archivos inválida.");
  } else {
    for (const [path, hash] of Object.entries(files)) {
      if (!isManagedPath(path) || !/^[a-f0-9]{64}$/.test(hash)) {
        add("MANIFEST", path, "Ruta o hash inválido."); continue;
      }
      const text = read(path);
      if (text !== null && digest(text) !== hash) add("INTEGRITY", path, "Copia compartida modificada; proponer el cambio en la fuente central.");
    }
    for (const path of [".project-standards/CORE.md", ".project-standards/DOCUMENTATION.md", ".project-standards/FRONTEND.md", ".project-standards/ENGINEERING.md", ".project-standards/check.mjs", ".agents/skills/project-standards/SKILL.md", ".github/workflows/standards.yml"]) {
      if (!(path in files)) add("MANIFEST", path, "Archivo compartido obligatorio fuera del manifiesto.");
    }
  }
  for (const [topic, path] of Object.entries(documentPaths)) {
    if (config.documents?.[topic] !== path) add("DOCUMENT-MAP", "standards.config.json", `La entrada ${topic} debe ser ${path}.`);
    read(path);
  }
  const exceptions = Array.isArray(config.exceptions) ? config.exceptions : [];
  if (!Array.isArray(config.exceptions)) add("EXCEPTIONS", "standards.config.json", "exceptions debe ser una lista.");
  const ids = new Set();
  for (const exception of exceptions) {
    if (!exception || typeof exception !== "object") { add("EXCEPTION", "standards.config.json", "Excepción inválida."); continue; }
    const { id, rule, scope, reason, owner, reviewOn, action } = exception;
    if ([id, rule, scope, reason, owner, reviewOn, action].some((value) => typeof value !== "string" || !value.trim()) || ids.has(id)) {
      add("EXCEPTION", "standards.config.json", "Diferencia sin campos requeridos o ID repetido."); continue;
    }
    ids.add(id);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(reviewOn) || Number.isNaN(Date.parse(`${reviewOn}T00:00:00Z`)) || new Date(`${reviewOn}T00:00:00Z`).toISOString().slice(0, 10) !== reviewOn) {
      add("EXCEPTION-DATE", "standards.config.json", `Fecha inválida en ${id}.`);
    } else if (reviewOn < today) {
      add("EXCEPTION-REVIEW", "standards.config.json", `${id}: revisión vencida desde ${reviewOn}; evaluar y registrar decisión.`);
    }
  }
  const agents = read("AGENTS.md");
  if (agents !== null) {
    if (!agents.includes("[Estándar compartido](docs/STANDARDS.md)")) add("AGENTS-ENTRY", "AGENTS.md", "Falta la entrada al estándar compartido.");
    if (agents.trimEnd().split(/\r?\n/).length > 120 && !exceptions.some((item) => item?.rule === "DOC-AGENTS-LENGTH" && item.scope === "AGENTS.md")) {
      add("DOC-AGENTS-LENGTH", "AGENTS.md", "Más de 120 líneas sin excepción de transición.");
    }
  }
  const standards = read("docs/STANDARDS.md");
  if (standards !== null && !standards.includes(`Versión adoptada: **${config.standardVersion}**`)) add("VERSION-DOC", "docs/STANDARDS.md", "Actualizar la versión visible en la guía de adopción.");
  const packageJson = json("package.json");
  if (packageJson?.scripts?.["standards:check"] !== "node .project-standards/check.mjs") add("COMMAND", "package.json", "standards:check debe ejecutar el verificador compartido.");
  if (!packageJson?.scripts?.["docs:check"]?.includes("standards:check")) add("COMMAND", "package.json", "docs:check debe incluir standards:check.");

  // Validate owned entry pages; legacy domain documents retain their local check.
  const entryPages = config.linkCheckFiles;
  if (!Array.isArray(entryPages) || !entryPages.includes("docs/STANDARDS.md")) add("LINK-CONFIG", "standards.config.json", "Declarar las entradas nuevas en linkCheckFiles.");
  else for (const path of entryPages) {
    if (!Object.values(documentPaths).includes(path)) {
      add("LINK-CONFIG", "standards.config.json", "Solo comprobar enlaces de entradas documentales declaradas."); continue;
    }
    const text = read(path);
    if (text === null) continue;
    for (const match of text.matchAll(/!?\[[^\]]*\]\(([^)]+)\)/g)) {
      const raw = match[1].trim().replace(/^<([^>]+)>.*$/, "$1").split(/\s+["']/)[0];
      if (/^(https?:|mailto:|#)/.test(raw)) continue;
      try {
        const target = decodeURIComponent(raw.split("#")[0]);
        if (!target) continue;
        const abs = resolve(dirname(safePath(root, path)), target);
        const rel = relative(resolve(root), abs).split(sep).join("/");
        if (!existsSync(safePath(root, rel))) add("LINK", path, `Enlace roto: ${raw}`);
      } catch (error) { add("LINK", path, error.message); }
    }
  }
  return { root, project: config.project, version: config.standardVersion, ok: !findings.length, exceptions: exceptions.length, findings };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = checkProject(resolve(dirname(fileURLToPath(import.meta.url)), ".."));
  if (process.argv.includes("--json")) console.log(JSON.stringify(result, null, 2));
  else {
    console.log(`${result.project ?? "Proyecto"}: estándar ${result.version ?? "desconocido"} — ${result.ok ? "válido" : "falló"}.`);
    for (const item of result.findings) console.error(`[${item.code}] ${item.file}: ${item.detail}`);
    if (result.ok) console.log(`Estructura e integridad verificadas; ${result.exceptions} diferencias con revisión. UI/negocio requieren evidencia adicional.`);
  }
  process.exitCode = result.ok ? 0 : 1;
}
