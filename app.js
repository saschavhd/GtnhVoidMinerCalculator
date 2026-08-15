import { voidMinerData } from "./data/void-miner-data.js";

const oreSelect = document.querySelector("#ore-select");
const oreIdentifier = document.querySelector("#ore-identifier");
const resultsPanel = document.querySelector("#results-panel");
const resultsTitle = document.querySelector("#results-title");
const resultCount = document.querySelector("#result-count");
const dimensionResults = document.querySelector("#dimension-results");
const throughputPanel = document.querySelector("#throughput-panel");
const throughputTitle = document.querySelector("#throughput-title");
const tierSelect = document.querySelector("#tier-select");
const gasSelect = document.querySelector("#gas-select");
const outputCard = document.querySelector("#output-card");
const outputRate = document.querySelector("#output-rate");
const outputDetail = document.querySelector("#output-detail");
const excludedDimensions = new Set(["EndAsteroids", "Asteroids", "KuiperBelt", "MehenBelt"]);

let selectedDimension = null;

for (const material of voidMinerData.materials) {
  const option = new Option(material.name, material.sourceIdentifier);
  oreSelect.add(option);
}

function formatPercent(value) {
  return new Intl.NumberFormat("en", { style: "percent", maximumFractionDigits: 3 }).format(value);
}

function materialName(identifier) {
  return voidMinerData.materials.find((material) => material.sourceIdentifier === identifier)?.name ?? identifier;
}

function matchingDimensions(oreIdentifier) {
  return Object.entries(voidMinerData.dimensions)
    .filter(([name]) => !excludedDimensions.has(name))
    .map(([name, data]) => ({ name, probability: (data.materialWeights[oreIdentifier] ?? 0) / data.totalWeight }))
    .filter((dimension) => dimension.probability > 0)
    .sort((left, right) => right.probability - left.probability || left.name.localeCompare(right.name));
}

function renderResults() {
  const oreIdentifierValue = oreSelect.value;
  const matches = matchingDimensions(oreIdentifierValue);
  selectedDimension = null;
  throughputPanel.hidden = true;
  outputCard.hidden = true;
  tierSelect.value = "";
  gasSelect.value = "";

  oreIdentifier.textContent = oreIdentifierValue;
  oreIdentifier.hidden = false;
  resultsTitle.textContent = `Best sources for ${materialName(oreIdentifierValue)}`;
  resultCount.textContent = `${matches.length} dimensions`;
  dimensionResults.replaceChildren(...matches.map((dimension, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "dimension-row";
    button.role = "option";
    button.dataset.dimension = dimension.name;
    button.innerHTML = `<span class="rank">${String(index + 1).padStart(2, "0")}</span><span class="dimension-name">${dimension.name}</span><strong>${formatPercent(dimension.probability)}</strong>`;
    button.addEventListener("click", () => selectDimension(dimension.name));
    return button;
  }));
  resultsPanel.hidden = false;
}

function selectDimension(dimension) {
  selectedDimension = dimension;
  document.querySelectorAll(".dimension-row").forEach((row) => {
    const isSelected = row.dataset.dimension === dimension;
    row.classList.toggle("selected", isSelected);
    row.setAttribute("aria-selected", String(isSelected));
  });
  throughputTitle.textContent = dimension;
  throughputPanel.hidden = false;
  throughputPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  updateOutput();
}

function updateOutput() {
  if (!selectedDimension || !tierSelect.value || !gasSelect.value) {
    outputCard.hidden = true;
    return;
  }

  const dimension = voidMinerData.dimensions[selectedDimension];
  const probability = dimension.materialWeights[oreSelect.value] / dimension.totalWeight;
  const baseRate = Number(tierSelect.value);
  const multiplier = Number(gasSelect.value);
  const expectedRate = probability * baseRate * multiplier;

  outputRate.textContent = `${expectedRate.toLocaleString("en", { maximumFractionDigits: 4 })} ores/s`;
  outputDetail.textContent = `${formatPercent(probability)} chance × ${baseRate} ores/s × ${multiplier} booster multiplier`;
  outputCard.hidden = false;
}

oreSelect.addEventListener("change", () => {
  if (!oreSelect.value) {
    resultsPanel.hidden = true;
    throughputPanel.hidden = true;
    oreIdentifier.hidden = true;
    return;
  }
  renderResults();
});
tierSelect.addEventListener("change", updateOutput);
gasSelect.addEventListener("change", updateOutput);
document.querySelector("#change-dimension").addEventListener("click", () => {
  throughputPanel.hidden = true;
  document.querySelector(".dimension-row")?.focus();
});