// GIF search — proxies the Tenor API (v2) so the API key stays secret on the
// server. The frontend only ever calls our own /api/gifs endpoint.

export const searchGifs = async (req, res) => {
  try {
    const key = process.env.TENOR_API_KEY;
    if (!key) {
      return res
        .status(503)
        .json({ message: "GIF search is not set up (missing TENOR_API_KEY)." });
    }

    const q = (req.query.q || "").trim();
    if (!q) return res.json([]);

    const url =
      "https://tenor.googleapis.com/v2/search" +
      `?q=${encodeURIComponent(q)}&key=${key}&limit=24&media_filter=tinygif,gif`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Tenor responded ${response.status}`);
    const data = await response.json();

    // Trim Tenor's big payload to just what the picker needs:
    // preview = small gif for the grid, url = full gif to send as a message.
    const gifs = (data.results || []).map((r) => ({
      id: r.id,
      preview: r.media_formats?.tinygif?.url,
      url: r.media_formats?.gif?.url,
    }));

    res.json(gifs.filter((g) => g.preview && g.url));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
