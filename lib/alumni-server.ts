export function slugifyAlumniName(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "alumni";
}

export function normalizeOptionalSocialUrl(value: unknown) {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return "";

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error(`Invalid URL: ${raw}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error(`URL must start with http or https: ${raw}`);
  }

  return raw;
}
