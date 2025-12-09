import fetch from "node-fetch";

// Get nearest building name
export async function getNearbyBuilding(lat, lng) {
  try {
    const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=50&key=${process.env.GOOGLE_API_KEY}`;

    const res = await fetch(url).then(r => r.json());

    if (!res.results?.length) return "";

    // Best match building name
    return res.results[0].name || "";
  } catch (err) {
    console.log("Nearby Places Error:", err);
    return "";
  }
}
