import assert from "node:assert/strict";
import test from "node:test";
import {
  pickPlaceLabel,
  reverseGeocodeUrl,
} from "../src/lib/delivery/mapbox.ts";

const yangon = { latitude: 16.8007, longitude: 96.15 };

test("reverseGeocodeUrl asks for every place level, not only addresses", () => {
  const url = new URL(reverseGeocodeUrl(yangon));
  assert.equal(
    url.searchParams.get("types"),
    "address,poi,neighborhood,locality,place",
  );
  assert.equal(url.searchParams.get("limit"), "5");
  assert.match(url.pathname, /96\.15,16\.8007\.json$/);
});

test("pickPlaceLabel prefers a street address over a township", () => {
  const label = pickPlaceLabel([
    { place_name: "Kamayut Township, Yangon, Myanmar", place_type: ["place"] },
    {
      place_name: "No. 12, Pyay Road, Kamayut Township, Yangon, Myanmar",
      place_type: ["address"],
    },
  ]);
  assert.equal(label, "No. 12, Pyay Road, Kamayut Township, Yangon");
});

test("pickPlaceLabel falls back to the township where there is no street address", () => {
  const label = pickPlaceLabel([
    {
      place_name: "Hlaingthaya Township, Yangon, Myanmar (Burma)",
      place_type: ["place"],
    },
    { place_name: "Yangon, Myanmar (Burma)", place_type: ["place"] },
  ]);
  assert.equal(label, "Hlaingthaya Township, Yangon");
});

test("pickPlaceLabel keeps relevance order between features of equal rank", () => {
  const label = pickPlaceLabel([
    {
      place_name: "Sule Pagoda Road, Kyauktada, Yangon",
      place_type: ["address"],
    },
    {
      place_name: "Mahabandoola Road, Kyauktada, Yangon",
      place_type: ["address"],
    },
  ]);
  assert.equal(label, "Sule Pagoda Road, Kyauktada, Yangon");
});

test("pickPlaceLabel ignores features without a name and returns null when nothing is left", () => {
  assert.equal(pickPlaceLabel([]), null);
  assert.equal(pickPlaceLabel([{ place_type: ["address"] }]), null);
  assert.equal(
    pickPlaceLabel([
      { place_type: ["address"] },
      { place_name: "Dagon, Yangon", place_type: ["locality"] },
    ]),
    "Dagon, Yangon",
  );
});
