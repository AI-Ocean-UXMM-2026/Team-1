import { estimateDeliveryFee, PARCEL_WEIGHT_KG } from "/Users/happer/Projects/oern/src/lib/delivery/delivery-fee.ts";

const cases = [
  ["Kamayut -> Tamwe, Small, 5 km",   { d: 5,   size: "Small",  p: [16.82,96.13], q: [16.80,96.17] }],
  ["Shwe Pyi Thar -> Thanlyin, Large", { d: 30,  size: "Large",  p: [16.96,96.09], q: [16.77,96.25] }],
  ["Hmawbi -> Kyauktan, Large",        { d: 60,  size: "Large",  p: [17.10,96.05], q: [16.64,96.30] }],
  ["Bago -> Yangon, Large",            { d: 90,  size: "Large",  p: [17.335,96.481], q: [16.80,96.16] }],
  ["Mandalay -> Yangon, Large",        { d: 630, size: "Large",  p: [21.975,96.083], q: [16.80,96.16] }],
];
for (const [name, c] of cases) {
  const fee = estimateDeliveryFee({
    distanceKm: c.d as number,
    weightKg: PARCEL_WEIGHT_KG[c.size as keyof typeof PARCEL_WEIGHT_KG],
    method: "cod",
    pickupPoint: { latitude: c.p[0], longitude: c.p[1] },
    deliveryPoint: { latitude: c.q[0], longitude: c.q[1] },
  });
  console.log(`${name}\n  ${fee.lines.map(l=>`${l.label}=${l.amount}`).join("  ")}\n  TOTAL = ${fee.total}`);
}
