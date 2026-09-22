// router.js: hash routes, so the app works from any static host with no
// server rewrite. #/ is home, #/p/<id> a project, #/demos the demo list,
// #/settings/<section>, #/activity the whole notification log.
const ROUTES = [
  { pattern: /^\/?$/, page: "home" },
  { pattern: /^\/p\/([^/]+)\/?$/, page: "project", params: ["id"] },
  { pattern: /^\/demos\/?$/, page: "demos" },
  { pattern: /^\/settings(?:\/([a-z]+))?\/?$/, page: "settings", params: ["section"] },
  { pattern: /^\/activity\/?$/, page: "activity" },
];

export function parseRoute(hash = location.hash) {
  const path = hash.replace(/^#/, "") || "/";
  for (const r of ROUTES) {
    const m = path.match(r.pattern);
    if (!m) continue;
    const params = {};
    (r.params || []).forEach((name, i) => (params[name] = m[i + 1] ? decodeURIComponent(m[i + 1]) : undefined));
    return { page: r.page, params, path };
  }
  return { page: "missing", params: {}, path };
}

export function navigate(path, { replace = false } = {}) {
  const next = `#${path}`;
  if (location.hash === next) return;
  if (replace) history.replaceState(null, "", next);
  else location.hash = path;
  if (replace) dispatchEvent(new HashChangeEvent("hashchange"));
}

export function onRoute(fn) {
  const handler = () => fn(parseRoute());
  addEventListener("hashchange", handler);
  handler();
  return () => removeEventListener("hashchange", handler);
}

export const projectPath = (id) => `/p/${encodeURIComponent(id)}`;
