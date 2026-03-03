export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  // Overpass QL query — fetches real road hazard & accident nodes
  // from OpenStreetMap within your map region
  const query = `
    [out:json][timeout:25];
    (
      node["hazard"](8.0,76.0,13.5,80.5);
      node["accident"](8.0,76.0,13.5,80.5);
      node["highway"="speed_camera"](8.0,76.0,13.5,80.5);
      node["highway"="traffic_signals"](8.0,76.0,13.5,80.5);
      node["highway"="crossing"](8.0,76.0,13.5,80.5);
      node["junction"="yes"](8.0,76.0,13.5,80.5);
    );
    out body;
  `;

  try {
    const response = await fetch("https://overpass-api.de/api/interpreter", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
    });

    const data = await response.json();
    const elements = data?.elements ?? [];

    if (elements.length === 0) {
      return res.status(200).json(getFallbackGrid());
    }

    // Score each node based on its type
    // More dangerous node types get higher risk values
    const typeScores = {
      hazard: 0.9,
      accident: 1.0,
      speed_camera: 0.6,
      traffic_signals: 0.5,
      crossing: 0.4,
      junction: 0.7,
    };

    const results = elements.map((el) => {
      const tags = el.tags ?? {};

      // Determine the risk score based on node tags
      let value = 0.3; // base score

      if (tags.hazard) value = Math.max(value, typeScores.hazard);
      if (tags.accident) value = Math.max(value, typeScores.accident);
      if (tags.highway === "speed_camera") value = Math.max(value, typeScores.speed_camera);
      if (tags.highway === "traffic_signals") value = Math.max(value, typeScores.traffic_signals);
      if (tags.highway === "crossing") value = Math.max(value, typeScores.crossing);
      if (tags.junction === "yes") value = Math.max(value, typeScores.junction);

      return {
        lat: parseFloat(el.lat.toFixed(4)),
        lng: parseFloat(el.lon.toFixed(4)),
        value: parseFloat(value.toFixed(2)),
      };
    });

    // Limit to 500 points max to keep response fast
    const trimmed = results.slice(0, 500);

    res.status(200).json(trimmed);

  } catch (error) {
    // If Overpass is down, return a basic fallback grid
    res.status(200).json(getFallbackGrid());
  }
}

// Fallback — simple grid with neutral values if Overpass is unavailable
function getFallbackGrid() {
  const points = [];
  const latMin = 8.0, latMax = 13.5;
  const lngMin = 76.0, lngMax = 80.5;
  const steps = 5;

  const latStep = (latMax - latMin) / steps;
  const lngStep = (lngMax - lngMin) / steps;

  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      points.push({
        lat: parseFloat((latMin + i * latStep).toFixed(4)),
        lng: parseFloat((lngMin + j * lngStep).toFixed(4)),
        value: 0.4,
      });
    }
  }
  return points;
}
```

---

### What this does

Queries OpenStreetMap for **real physical hazard nodes** in your region:

| Node Type | What it means | Risk Score |
|---|---|---|
| `accident` | Recorded accident spot | 1.0 🔴 |
| `hazard` | Marked road hazard | 0.9 🔴 |
| `junction` | Road junction | 0.7 🟠 |
| `speed_camera` | Speed enforcement zone | 0.6 🟠 |
| `traffic_signals` | Signaled intersection | 0.5 🟡 |
| `crossing` | Pedestrian crossing | 0.4 🟡 |

- **No API key needed** — Overpass is fully open
- If Overpass is slow or down, the fallback grid kicks in automatically so your map never breaks
- Returns same `{lat, lng, value}` format as before

---

### Test it

Push to GitHub then visit:
```
https://your-vercel-app.vercel.app/api/accidents
