// npx tsx --test shared/venue.test.ts
import test from "node:test";
import assert from "node:assert/strict";

test("venue lookup helpers", async () => {
  const { cityFromTimeZone, findClubByVenueName, formatNominatimAddress, googleMapsSearchUrl } = await import("./venue");
  assert.equal(cityFromTimeZone("Australia/Sydney"), "Sydney");
  assert.equal(cityFromTimeZone("America/New_York"), "New York");
  assert.equal(findClubByVenueName("cahill tennis park", [{ name: "Cahill Tennis Park" }])?.name, "Cahill Tennis Park");
  assert.equal(findClubByVenueName("Cahill", [{ name: "Cahill Tennis Park" }]), undefined, "no partial guesses");
  assert.equal(
    formatNominatimAddress({ house_number: "12", road: "Example Rd", suburb: "Moore Park", state: "New South Wales", postcode: "2021" }),
    "12 Example Rd, Moore Park NSW 2021",
  );
  assert.equal(formatNominatimAddress({}), null);
  assert.equal(googleMapsSearchUrl("Cahill Tennis Park, Sydney"), "https://www.google.com/maps/search/?api=1&query=Cahill%20Tennis%20Park%2C%20Sydney");
});

test("tile pixel maths", async () => {
  const { tilePixel, venueMapsQuery } = await import("./venue");
  const p = tilePixel(0, 0, 1);
  assert.equal(p.x, 256);
  assert.ok(Math.abs(p.y - 256) < 1e-9);
  // Sydney CBD at zoom 16 is OSM tile column 60294 ((151.2093 + 180) / 360 * 2^16)
  const s = tilePixel(-33.8688, 151.2093, 16);
  assert.equal(Math.floor(s.x / 256), 60294);
  assert.equal(venueMapsQuery("Cahill Tennis Park", "Australia/Sydney"), "Cahill Tennis Park, Sydney");
});
