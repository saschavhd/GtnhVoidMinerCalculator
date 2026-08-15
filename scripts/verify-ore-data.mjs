import assert from "node:assert/strict";
import { voidMinerData } from "../data/void-miner-data.js";

assert.equal(voidMinerData.sourceVeinCount, 122, "All source veins must be extracted.");
assert.ok(voidMinerData.dimensions.Asteroids, "Asteroids aliases must normalize together.");
assert.ok(voidMinerData.dimensions.KuiperBelt, "Kuiper Belt aliases must normalize together.");
assert.ok(voidMinerData.dimensions.Europa, "Qualified Europa references must normalize.");

const asteroids = voidMinerData.dimensions.Asteroids;
const naquadahContributions = asteroids.contributions.filter(
  (contribution) => contribution.oreMixId === "Naquadah" && contribution.sourceIdentifier === "Materials.Naquadah"
);
assert.equal(naquadahContributions.length, 3, "Naquadah must retain both primary/secondary and between contributions.");
assert.deepEqual(
  naquadahContributions.map((contribution) => contribution.contribution).sort((left, right) => left - right),
  [3.75, 30, 30],
  "Role weights must follow the documented formula."
);
assert.equal(asteroids.materialWeights["Materials.Naquadah"], 63.75, "Duplicate role weights must aggregate.");

for (const [dimension, data] of Object.entries(voidMinerData.dimensions)) {
  assert.ok(data.totalWeight > 0, `${dimension} must have a positive total weight.`);
}

console.log(`Verified ${voidMinerData.sourceVeinCount} veins and ${Object.keys(voidMinerData.dimensions).length} dimensions.`);