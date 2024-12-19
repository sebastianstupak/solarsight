// https://developers.google.com/maps/documentation/solar/calculate-costs-non-us
// https://developers.google.com/maps/documentation/solar/calculate-costs-typescript

export interface SolarPotentialData {
  maxArrayPanelsCount: number;
  maxArrayAreaMeters2: number;
  maxSunshineHoursPerYear: number;
  carbonOffsetFactorKgPerMwh: number;
  panelCapacityWatts: number;
  panelHeightMeters: number;
  panelWidthMeters: number;
  panelLifetimeYears: number;
  solarPanelConfigs: {
    panelsCount: number;
    yearlyEnergyDcKwh: number;
  }[];
}

export interface FinancialData {
  yearlyEnergyDcKwh: number;
  yearlyEnergyCoverage: number;
  totalCostWithoutSolar: number;
  totalCostWithSolar: number;
  installationCost: number;
  yearsUntilBreakEven: number;
  lifetimeSavings: number;
}

// Basic settings
const ENERGY_COST_PER_KWH: number = 0.38; // €
const PANEL_CAPACITY_WATTS: number = 290;
const SOLAR_INCENTIVES: number = 0;
const COST_PER_KW_INSTALLED = 1557; // €
export const INSTALLATION_LIFE_SPAN = 25;

// Advanced settings
const DC_TO_AC_DERATE = 0.85;
const EFFICIENCY_DEPRECIATION_FACTOR = 0.995;
export const COST_INCREASE_FACTOR = 1.015;
const DISCOUNT_RATE = 1.04;

export function calculateFinancialData(
  potentialData: SolarPotentialData,
  panelsCount: number,
  monthlyAverageEnergyBill: number
): FinancialData | null {
  const selectedConfig = potentialData.solarPanelConfigs.find(
    (config) => config.panelsCount === panelsCount
  );
  if (!selectedConfig) {
    return null;
  }

  const yearlyEnergyDcKwh = selectedConfig.yearlyEnergyDcKwh;

  const totalCapacityKW = (panelsCount * PANEL_CAPACITY_WATTS) / 1000;
  const totalInstallationCost = totalCapacityKW * COST_PER_KW_INSTALLED;
  const installationCostPerWatt =
    totalInstallationCost / (totalCapacityKW * 1000);

  // Solar installation
  let installationSizeKw: number = (panelsCount * PANEL_CAPACITY_WATTS) / 1000;
  let installationCostTotal: number =
    installationCostPerWatt * installationSizeKw * 1000;

  // Energy consumption
  let monthlyKwhEnergyConsumption: number =
    monthlyAverageEnergyBill / ENERGY_COST_PER_KWH;
  let yearlyKwhEnergyConsumption: number = monthlyKwhEnergyConsumption * 12;

  // Energy produced for installation life span
  let initialAcKwhPerYear: number = yearlyEnergyDcKwh * DC_TO_AC_DERATE;
  let yearlyProductionAcKwh: number[] = Array(INSTALLATION_LIFE_SPAN)
    .fill(0)
    .map(
      (_, year) =>
        initialAcKwhPerYear * Math.pow(EFFICIENCY_DEPRECIATION_FACTOR, year)
    );

  // Cost with solar for installation life span
  let yearlyUtilityBillEstimates: number[] = yearlyProductionAcKwh.map(
    (yearlyKwhEnergyProduced, year) => {
      const billEnergyKwh =
        yearlyKwhEnergyConsumption - yearlyKwhEnergyProduced;
      const billEstimate =
        (billEnergyKwh * ENERGY_COST_PER_KWH * COST_INCREASE_FACTOR ** year) /
        DISCOUNT_RATE ** year;
      return Math.max(billEstimate, 0); // bill cannot be negative
    }
  );
  let remainingLifetimeUtilityBill: number = yearlyUtilityBillEstimates.reduce(
    (x, y) => x + y,
    0
  );
  let totalCostWithSolar: number =
    installationCostTotal + remainingLifetimeUtilityBill - SOLAR_INCENTIVES;

  // Cost without solar for installation life span
  let yearlyCostWithoutSolar: number[] = Array(INSTALLATION_LIFE_SPAN)
    .fill(0)
    .map(
      (_, year) =>
        (monthlyAverageEnergyBill * 12 * Math.pow(COST_INCREASE_FACTOR, year)) /
        Math.pow(DISCOUNT_RATE, year)
    );

  let totalCostWithoutSolar: number = yearlyCostWithoutSolar.reduce(
    (x, y) => x + y,
    0
  );

  // Savings with solar for installation life span
  let savings: number = totalCostWithoutSolar - totalCostWithSolar;

  const yearlyEnergyCoverage: number =
    (yearlyEnergyDcKwh / yearlyKwhEnergyConsumption) * 100;

  // Calculate years until break-even
  let cumulativeSavings: number = 0;
  let yearsUntilBreakEven: number = INSTALLATION_LIFE_SPAN; // Default to lifespan if doesnt break even

  for (let year = 0; year < INSTALLATION_LIFE_SPAN; year++) {
    const yearlySavings =
        (monthlyAverageEnergyBill * 12 * Math.pow(COST_INCREASE_FACTOR, year)) /
        Math.pow(DISCOUNT_RATE, year) - yearlyUtilityBillEstimates[year];
    cumulativeSavings += yearlySavings;
    if (cumulativeSavings >= installationCostTotal) {
      yearsUntilBreakEven = year + 1; // Year index starts from 0
      break;
    }
  }

  return {
    yearlyEnergyDcKwh: yearlyEnergyDcKwh,
    yearlyEnergyCoverage: yearlyEnergyCoverage,
    totalCostWithoutSolar: totalCostWithoutSolar,
    totalCostWithSolar: totalCostWithSolar,
    installationCost: installationCostTotal,
    yearsUntilBreakEven: yearsUntilBreakEven,
    lifetimeSavings: savings,
  };
}

export function findNearestConfigurations(
  configs: SolarPotentialData["solarPanelConfigs"],
  panels: number
): { lower: number | null; higher: number | null } {
  const sortedConfigs = [...configs].sort(
    (a, b) => a.panelsCount - b.panelsCount
  );
  let lower = null;
  let higher = null;

  for (const config of sortedConfigs) {
    if (config.panelsCount < panels) {
      lower = config.panelsCount;
    } else if (config.panelsCount > panels) {
      higher = config.panelsCount;
      break;
    }
  }

  return { lower, higher };
}
