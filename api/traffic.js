export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");

  const apiKey = process.env.TOMTOM_KEY;

  // Same grid as pollution — covers Tamil Nadu + Karnataka + Kerala
  const latMin = 8.0, latMax = 13.5;
  const lngMin = 76.0, lngMax = 80.5;
  const steps = 6;

  const latStep = (latMax - latMin) / steps;
  const lngStep = (lngMax - lngMin) / steps;

  const points = [];

  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      points.push({
        lat: parseFloat((latMin + i * latStep).toFixed(4)),
        lng: parseFloat((lngMin + j * lngStep).toFixed(4)),
      });
    }
  }

  try {
    const results = await Promise.all(
      points.map(async (point) => {
        // TomTom Flow Segment Data API
        // zoom=10 gives city-level traffic, style=absolute gives raw speeds
        const url = `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json?point=${point.lat},${point.lng}&key=${apiKey}`;

        const response = await fetch(url);
        const data = await response.json();

        const flowData = data?.flowSegmentData;

        let normalized = 0.5; // default mid value if data unavailable

        if (flowData) {
          const currentSpeed = flowData.currentSpeed;
          const freeFlowSpeed = flowData.freeFlowSpeed;

          // Congestion = how much slower than free flow
          // 1.0 = completely jammed, 0.0 = free flowing
          const congestion = freeFlowSpeed > 0
            ? parseFloat((1 - currentSpeed / freeFlowSpeed).toFixed(2))
            : 0.5;

          // Clamp between 0 and 1
          normalized = Math.min(1, Math.max(0, congestion));
        }

        return {
          lat: point.lat,
          lng: point.lng,
          value: normalized,
        };
      })
    );

    res.status(200).json(results);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch traffic data" });
  }
}
