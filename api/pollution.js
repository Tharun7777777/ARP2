export default async function handler(req, res) {
  // Allow requests from your frontend
  res.setHeader("Access-Control-Allow-Origin", "*");

  const apiKey = process.env.OPENWEATHER_KEY;

  // Bounding box covering Tamil Nadu + Karnataka + Kerala region
  // We sample a grid of points across the region
  const latMin = 8.0, latMax = 13.5;
  const lngMin = 76.0, lngMax = 80.5;
  const steps = 6; // 6x6 = 36 sample points

  const latStep = (latMax - latMin) / steps;
  const lngStep = (lngMax - lngMin) / steps;

  const points = [];

  // Build grid of sample coordinates
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      points.push({
        lat: parseFloat((latMin + i * latStep).toFixed(4)),
        lng: parseFloat((lngMin + j * lngStep).toFixed(4)),
      });
    }
  }

  try {
    // Fetch pollution data for all points in parallel
    const results = await Promise.all(
      points.map(async (point) => {
        const url = `https://api.openweathermap.org/data/2.5/air_pollution?lat=${point.lat}&lon=${point.lng}&appid=${apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        // AQI is 1(good) to 5(very poor) — normalize to 0.0–1.0
        const aqi = data?.list?.[0]?.main?.aqi ?? 1;
        const normalized = parseFloat(((aqi - 1) / 4).toFixed(2));

        return {
          lat: point.lat,
          lng: point.lng,
          value: normalized,
        };
      })
    );

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch pollution data" });
  }
}
