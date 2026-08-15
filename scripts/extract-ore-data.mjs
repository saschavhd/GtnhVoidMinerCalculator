import { readFile, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const regularOreSourcePath = resolve(projectRoot, "data", "Ores.java");
const smallOreSourcePath = resolve(projectRoot, "data", "SmallOres.java");
const outputPath = resolve(projectRoot, "data", "void-miner-data.js");
const regularOreOutputPath = resolve(projectRoot, "data", "void-miner-regular-ores-only-data.js");

const dimensionAliases = new Map([
  ["ASTEROIDS", "Asteroids"],
  ["KUIPERBELT", "KuiperBelt"],
  ["DimensionDef.Europa", "Europa"]
]);

function friendlyName(identifier) {
  const rawName = identifier.split(".").at(-1);
  return rawName
    .replaceAll("_", " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\bGtpp\b/gi, "GTPP");
}

function normalizeDimension(identifier) {
  return dimensionAliases.get(identifier) ?? identifier;
}

function extractArguments(segment, methodName) {
  const matches = [...segment.matchAll(new RegExp(`\\.${methodName}\\(([\\s\\S]*?)\\)`, "g"))];
  if (matches.length === 0) {
    throw new Error(`Missing .${methodName}() in ore mix.`);
  }

  return matches.flatMap((match) => match[1]
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean));
}

function parseOreMixes(source) {
  const segments = source.split("new OreMixBuilder()").slice(1);

  return segments.map((segment, index) => {
    const beforeBuilder = source.split("new OreMixBuilder()")[index];
    const enumNameMatch = beforeBuilder.match(/([A-Za-z][A-Za-z0-9]*)\s*\($/);
    const weightMatch = segment.match(/\.weight\((\d+)\)/);
    const nameMatch = segment.match(/\.name\("([^"]+)"\)/);

    if (!enumNameMatch || !weightMatch || !nameMatch) {
      throw new Error(`Unable to parse ore mix ${index + 1}.`);
    }

    return {
      id: enumNameMatch[1],
      sourceName: nameMatch[1],
      weight: Number(weightMatch[1]),
      dimensions: [...new Set(extractArguments(segment, "enableInDim").map(normalizeDimension))],
      ores: {
        primary: extractArguments(segment, "primary")[0],
        secondary: extractArguments(segment, "secondary")[0],
        inBetween: extractArguments(segment, "inBetween")[0],
        sporadic: extractArguments(segment, "sporadic")[0]
      }
    };
  });
}

function parseSmallOres(source) {
  const segments = source.split("new SmallOreBuilder()").slice(1);

  return segments
    .filter((segment) => segment.includes(".enableInDim("))
    .map((segment, index) => {
      const amountMatch = segment.match(/\.amount\((\d+)\)/);
      const nameMatch = segment.match(/\.name\("([^"]+)"\)/);

      if (!amountMatch || !nameMatch) {
        throw new Error(`Unable to parse small ore ${index + 1}.`);
      }

      return {
        id: nameMatch[1],
        amount: Number(amountMatch[1]),
        dimensions: [...new Set(extractArguments(segment, "enableInDim").map(normalizeDimension))],
        sourceIdentifier: extractArguments(segment, "ore")[0]
      };
    });
}

function buildData(oreMixes, smallOres = []) {
  const dimensions = new Map();
  const materials = new Map();

  for (const oreMix of oreMixes) {
    for (const dimension of oreMix.dimensions) {
      const data = dimensions.get(dimension) ?? { materialWeights: {}, contributions: [] };

      for (const [role, sourceIdentifier] of Object.entries(oreMix.ores)) {
        const contribution = role === "primary" || role === "secondary" ? oreMix.weight : oreMix.weight / 8;
        data.materialWeights[sourceIdentifier] = (data.materialWeights[sourceIdentifier] ?? 0) + contribution;
        data.contributions.push({
          oreMixId: oreMix.id,
          oreMixName: oreMix.sourceName,
          role,
          sourceIdentifier,
          contribution
        });
        materials.set(sourceIdentifier, { sourceIdentifier, name: friendlyName(sourceIdentifier) });
      }

      dimensions.set(dimension, data);
    }
  }

  for (const smallOre of smallOres) {
    for (const dimension of smallOre.dimensions) {
      const data = dimensions.get(dimension) ?? { materialWeights: {}, contributions: [] };
      data.materialWeights[smallOre.sourceIdentifier] = (data.materialWeights[smallOre.sourceIdentifier] ?? 0) + smallOre.amount;
      data.contributions.push({
        oreMixId: smallOre.id,
        oreMixName: smallOre.id,
        role: "smallOre",
        sourceIdentifier: smallOre.sourceIdentifier,
        contribution: smallOre.amount
      });
      materials.set(smallOre.sourceIdentifier, { sourceIdentifier: smallOre.sourceIdentifier, name: friendlyName(smallOre.sourceIdentifier) });
      dimensions.set(dimension, data);
    }
  }

  const normalizedDimensions = Object.fromEntries(
    [...dimensions.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([name, data]) => [name, {
        ...data,
        totalWeight: Object.values(data.materialWeights).reduce((total, weight) => total + weight, 0)
      }])
  );

  return {
    sourceVeinCount: oreMixes.length,
    sourceSmallOreCount: smallOres.length,
    materials: [...materials.values()].sort((left, right) => left.name.localeCompare(right.name)),
    dimensions: normalizedDimensions
  };
}

const [regularOreSource, smallOreSource] = await Promise.all([
  readFile(regularOreSourcePath, "utf8"),
  readFile(smallOreSourcePath, "utf8")
]);
const oreMixes = parseOreMixes(regularOreSource);
const smallOres = parseSmallOres(smallOreSource);
const regularOreData = buildData(oreMixes);
const data = buildData(oreMixes, smallOres);
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(
  regularOreOutputPath,
  `// Generated by scripts/extract-ore-data.mjs from data/Ores.java. Does not include SmallOres.java.\nexport const voidMinerRegularOresOnlyData = ${JSON.stringify(regularOreData, null, 2)};\n`,
  "utf8"
);
await writeFile(
  outputPath,
  `// Generated by scripts/extract-ore-data.mjs from data/Ores.java and data/SmallOres.java. Do not edit manually.\nexport const voidMinerData = ${JSON.stringify(data, null, 2)};\n`,
  "utf8"
);

console.log(`Generated regular and combined data from ${data.sourceVeinCount} ore veins and ${data.sourceSmallOreCount} small ores across ${Object.keys(data.dimensions).length} dimensions.`);