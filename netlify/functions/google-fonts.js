const GOOGLE_FONTS_API_URL = "https://www.googleapis.com/webfonts/v1/webfonts";
const DEFAULT_LIMIT = 40;
const MAX_LIMIT = 100;

const json = (statusCode, payload) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "public, max-age=3600"
  },
  body: JSON.stringify(payload)
});

export const handler = async (event) => {
  const apiKey = process.env.GOOGLE_FONTS_API_KEY;
  if (!apiKey) {
    return json(500, { error: "Missing GOOGLE_FONTS_API_KEY in server environment." });
  }

  const rawLimit = Number.parseInt(event.queryStringParameters?.limit ?? `${DEFAULT_LIMIT}`, 10);
  const limit = Number.isFinite(rawLimit)
    ? Math.max(1, Math.min(rawLimit, MAX_LIMIT))
    : DEFAULT_LIMIT;

  try {
    const response = await fetch(`${GOOGLE_FONTS_API_URL}?key=${apiKey}&sort=popularity`);
    if (!response.ok) {
      return json(response.status, { error: `Google Fonts API failed with HTTP ${response.status}.` });
    }

    const payload = await response.json();
    const items = (payload.items ?? []).slice(0, limit).map((font) => ({
      family: font.family,
      category: font.category
    }));

    return json(200, { items });
  } catch (error) {
    return json(500, {
      error: error instanceof Error ? error.message : "Unexpected server error."
    });
  }
};
