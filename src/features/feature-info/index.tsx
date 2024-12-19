import React, { useState, useEffect, useRef } from "react";
import { FeatureInfo } from "../../types/featureInfo";
import {
  SolarPotentialData,
  FinancialData,
  calculateFinancialData,
  findNearestConfigurations,
  COST_INCREASE_FACTOR,
  INSTALLATION_LIFE_SPAN,
} from "./solar-calculations.ts";

type FeatureInfoProps = {
  feature: FeatureInfo;
  onClose: () => void;
};

const FeatureInfoModal: React.FC<FeatureInfoProps> = ({ feature, onClose }) => {
  const [address, setAddress] = useState<string>("");
  const [addressError, setAddressError] = useState<string>("");
  const [solarPotentialData, setSolarPotentialData] =
    useState<SolarPotentialData | null>(null);
  const [financialData, setFinancialData] = useState<FinancialData | null>(
    null
  );
  const [isCalculating, setIsCalculating] = useState<boolean>(false);
  const [calculationError, setCalculationError] = useState<string>("");
  const [warning, setWarning] = useState<string>("");
  const [solarPanels, setSolarPanels] = useState<number>(0);
  const [minPanels, setMinPanels] = useState<number>(0);
  const [maxPanels, setMaxPanels] = useState<number>(0);
  const [monthlyAverageEnergyBill, setMonthlyAverageEnergyBill] =
    useState<number>(100);

  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSolarPotentialData(null);
    setFinancialData(null);
    setSolarPanels(0);
    setCalculationError("");
    setWarning("");
    const fetchAddress = async () => {
      if (!feature.lat || !feature.lon) {
        setAddressError("Latitude and longitude are required");
        return;
      }
      try {
        const response = await fetch(
          `/api/reverse-geocode?lat=${feature.lat}&lon=${feature.lon}`
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (data.error) {
          setAddressError(data.error);
        } else {
          setAddress(data.address);
          setAddressError("");
        }
      } catch (error) {
        console.error("Error fetching address:", error);
        setAddressError("Failed to fetch address");
      }
    };
    fetchAddress();
  }, [feature.lat, feature.lon]);

  useEffect(() => {
    if (solarPotentialData) {
      const configs = solarPotentialData.solarPanelConfigs;
      if (configs.length > 0) {
        const panelCounts = configs.map((config) => config.panelsCount);
        setMinPanels(Math.min(...panelCounts));
        setMaxPanels(Math.max(...panelCounts));
        const initialPanels = Math.min(4, Math.max(...panelCounts));
        setSolarPanels(initialPanels);
        recalculate(initialPanels, monthlyAverageEnergyBill);
      }
    }
  }, [solarPotentialData]);

  const recalculate = (panels: number, bill: number) => {
    if (solarPotentialData) {
      const newFinancialData = calculateFinancialData(
        solarPotentialData,
        panels,
        bill
      );
      if (newFinancialData) {
        setFinancialData(newFinancialData);
        setWarning("");
      } else {
        setFinancialData(null);
        const { lower, higher } = findNearestConfigurations(
          solarPotentialData.solarPanelConfigs,
          panels
        );
        if (lower === null && higher === null) {
          setWarning("No valid panel configurations found.");
        } else if (lower === null) {
          setWarning(
            `The lowest available panel configuration is ${higher} panels.`
          );
        } else if (higher === null) {
          setWarning(
            `The highest available panel configuration is ${lower} panels.`
          );
        } else {
          setWarning(
            `Nearest configurations: ${lower} panels (lower) and ${higher} panels (higher).`
          );
        }
      }
    }
  };

  const handlePanelChange = (newPanels: number) => {
    newPanels = Math.max(minPanels, Math.min(maxPanels, newPanels));
    setSolarPanels(newPanels);
    recalculate(newPanels, monthlyAverageEnergyBill);
  };

  const handleBillChange = (newBill: number) => {
    setMonthlyAverageEnergyBill(newBill);
    recalculate(solarPanels, newBill);
  };

  const handleCalculateSolarPotential = async () => {
    if (!feature.lat || !feature.lon) {
      return;
    }
    setIsCalculating(true);
    setCalculationError("");
    setWarning("");
    try {
      const response = await fetch(
        `/api/solar?lat=${feature.lat}&lon=${feature.lon}`
      );
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();

      if (!data.solarPotential) {
        throw new Error("No solar potential data found in the response");
      }

      const solarPotential = data.solarPotential;

      const potentialData: SolarPotentialData = {
        maxArrayPanelsCount: solarPotential.maxArrayPanelsCount || 0,
        maxArrayAreaMeters2: solarPotential.maxArrayAreaMeters2 || 0,
        maxSunshineHoursPerYear: solarPotential.maxSunshineHoursPerYear || 0,
        carbonOffsetFactorKgPerMwh:
          solarPotential.carbonOffsetFactorKgPerMwh || 0,
        panelCapacityWatts: solarPotential.panelCapacityWatts || 0,
        panelHeightMeters: solarPotential.panelHeightMeters || 0,
        panelWidthMeters: solarPotential.panelWidthMeters || 0,
        panelLifetimeYears: solarPotential.panelLifetimeYears || 20,
        solarPanelConfigs: solarPotential.solarPanelConfigs || [],
      };

      setSolarPotentialData(potentialData);

      if (potentialData.solarPanelConfigs.length > 0) {
        const panelCounts = potentialData.solarPanelConfigs.map(
          (config) => config.panelsCount
        );
        const minPanels = Math.min(...panelCounts);
        const maxPanels = Math.max(...panelCounts);
        setMinPanels(minPanels);
        setMaxPanels(maxPanels);
        const initialPanels = Math.min(4, maxPanels);
        setSolarPanels(initialPanels);
        const initialFinancialData = calculateFinancialData(
          potentialData,
          initialPanels,
          monthlyAverageEnergyBill
        );
        if (initialFinancialData) {
          setFinancialData(initialFinancialData);
        } else {
          setWarning(
            "Unable to calculate financial data for the initial panel configuration."
          );
        }
      }
    } catch (error) {
      console.error("Error calculating solar potential:", error);
      setCalculationError(
        `Failed to calculate solar potential: ${(error as Error).message}`
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const convertToDMS = (coordinate: number, isLatitude: boolean): string => {
    const absolute = Math.abs(coordinate);
    const degrees = Math.floor(absolute);
    const minutesNotTruncated = (absolute - degrees) * 60;
    const minutes = Math.floor(minutesNotTruncated);
    const seconds = Math.floor((minutesNotTruncated - minutes) * 60);

    const direction = isLatitude
      ? coordinate >= 0
        ? "N"
        : "S"
      : coordinate >= 0
      ? "E"
      : "W";

    return `${degrees}° ${minutes}′ ${seconds}″ ${direction}`;
  };

  const formatNumber = (num: number): string => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(2) + "M";
    } else if (num >= 1000) {
      return (num / 1000).toFixed(2) + "K";
    } else {
      return num.toFixed(2);
    }
  };

  const formatCurrency = (num: number): string => {
    if (num >= 1000) {
      return formatNumber(num) + " €";
    } else {
      return num.toFixed(2) + " €";
    }
  };

  const getRecommendation = (
    financialData: FinancialData
  ): { text: string; color: string } => {
    const { lifetimeSavings, yearsUntilBreakEven, installationCost } =
      financialData;

    if (lifetimeSavings <= 0) {
      return {
        text: "This solar installation is not cost-effective. Consider alternatives or wait for more favorable conditions.",
        color: "text-red-500",
      };
    } else if (yearsUntilBreakEven > 15) {
      return {
        text: "This installation is profitable in the long term, but it takes a significant time to break even. Consider if you'll stay in the property long enough to benefit.",
        color: "text-yellow-500",
      };
    } else if (yearsUntilBreakEven > 10) {
      return {
        text: "This installation is a good long-term investment. It will take some time to break even, but the lifetime savings are substantial.",
        color: "text-green-500",
      };
    } else {
      return {
        text: "This solar installation is an excellent investment! It offers quick returns and substantial lifetime savings.",
        color: "text-green-600",
      };
    }
  };

  return (
    <div className="absolute inset-y-0 right-2 flex items-center">
      <div
        ref={modalRef}
        className="
          w-96 max-w-full
          bg-slate-800 text-slate-200
          rounded-md
          border border-slate-700
          drop-shadow-sm hover:drop-shadow-lg
          flex flex-col
          p-6
          overflow-y-auto
        "
        style={{
          maxHeight:
            modalRef.current && modalRef.current.parentElement
              ? `${modalRef.current.parentElement.clientHeight - 16}px`
              : "calc(100% - 32px)",
        }}
      >
        <div className="space-y-4">
          <div className="bg-slate-700 border border-slate-600 rounded-md p-4">
            <h2 className="text-lg font-semibold mb-2">Building Information</h2>
            <div className="flex justify-between mb-2">
              <span className="text-slate-400 text-sm">Address:</span>
              <span className="text-right">{address || "Loading..."}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-slate-400 text-sm">Long.:</span>
              <span>{convertToDMS(feature.lon, false)}</span>
            </div>
            <div className="flex justify-between mb-2">
              <span className="text-slate-400 text-sm">Lat.:</span>
              <span>{convertToDMS(feature.lat, true)}</span>
            </div>
            {solarPotentialData && (
              <>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400 text-sm">Area:</span>
                  <span>
                    {solarPotentialData.maxArrayAreaMeters2.toFixed(2)} m²
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400 text-sm">
                    Max sunshine hours/year:
                  </span>
                  <span>
                    {solarPotentialData.maxSunshineHoursPerYear.toFixed(0)} h
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">
                    Max solar panels:
                  </span>
                  <span>{solarPotentialData.maxArrayPanelsCount}</span>
                </div>
              </>
            )}
          </div>

          {addressError && (
            <div className="text-red-500 mb-4">{addressError}</div>
          )}

          {warning && (
            <div className="bg-yellow-800 text-yellow-200 p-2 rounded mb-4">
              {warning}
            </div>
          )}

          <div className="bg-slate-700 border border-slate-600 rounded-md p-4 mb-4">
            <h2 className="text-lg font-semibold mb-2">Inputs</h2>
            <div className="flex flex-col mb-4">
              <label
                htmlFor="monthlyBill"
                className="text-slate-400 text-sm mb-1"
              >
                Monthly Average Energy Bill (€)
              </label>
              <input
                id="monthlyBill"
                type="number"
                min="0"
                step="0.01"
                value={monthlyAverageEnergyBill}
                onChange={(e) =>
                  handleBillChange(Math.max(0, parseFloat(e.target.value) || 0))
                }
                className="
                  px-3 py-2 bg-slate-600 rounded
                  text-lg
                  h-11
                  [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
          </div>

          {!solarPotentialData && (
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleCalculateSolarPotential}
                disabled={isCalculating}
                className="
                  flex-1 text-white bg-blue-600 hover:bg-blue-700
                  focus:ring-4 focus:ring-blue-300 font-medium rounded-lg
                  text-sm px-5 py-2.5 focus:outline-none disabled:opacity-50
                "
              >
                {isCalculating ? "Calculating..." : "Calculate"}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="
                  flex-1 text-slate-200 bg-slate-600 hover:bg-slate-700
                  focus:ring-4 focus:ring-slate-300 font-medium rounded-lg
                  text-sm px-5 py-2.5 focus:outline-none
                "
              >
                Close
              </button>
            </div>
          )}

          {calculationError && (
            <div className="text-red-500 mb-4">{calculationError}</div>
          )}

          {solarPotentialData && (
            <>
              <div className="bg-slate-700 border border-slate-600 rounded-md p-4 mb-4">
                <h2 className="text-lg font-semibold mb-2">
                  Panel Configuration
                </h2>
                <div className="flex flex-col items-center mb-4">
                  <div className="flex items-center">
                    <button
                      onClick={() => handlePanelChange(solarPanels - 1)}
                      className="px-2 py-1 bg-slate-600 rounded-l"
                      disabled={solarPanels <= minPanels}
                    >
                      -
                    </button>
                    <input
                      type="number"
                      value={solarPanels}
                      onChange={(e) =>
                        handlePanelChange(parseInt(e.target.value) || minPanels)
                      }
                      min={minPanels}
                      max={maxPanels}
                      className="
                        px-2 py-1 bg-slate-600 text-center w-20
                        [-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none
                      "
                    />
                    <button
                      onClick={() => handlePanelChange(solarPanels + 1)}
                      className="px-2 py-1 bg-slate-600 rounded-r"
                      disabled={solarPanels >= maxPanels}
                    >
                      +
                    </button>
                  </div>
                  <span className="text-slate-400 text-sm mt-1">
                    Number of Solar Panels (Min: {minPanels}, Max: {maxPanels})
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400 text-sm">
                    Yearly energy production:
                  </span>
                  <span>
                    {financialData
                      ? formatNumber(financialData.yearlyEnergyDcKwh) + " kWh"
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 text-sm">
                    Yearly energy coverage:
                  </span>
                  <span>
                    {financialData
                      ? financialData.yearlyEnergyCoverage.toFixed(2) + "%"
                      : "N/A"}
                  </span>
                </div>
              </div>

              <div className="bg-slate-700 border border-slate-600 rounded-md p-4 mb-4">
                <h2 className="text-lg font-semibold mb-2">
                  Solar Cost Analysis
                </h2>
                <div className="flex justify-between mb-3">
                  <span className="text-slate-400 text-sm">
                    Calculated with {COST_INCREASE_FACTOR} cost increase factor
                    and {INSTALLATION_LIFE_SPAN} year lifespan of solar panels.
                  </span>
                </div>

                <div className="flex justify-between mb-2">
                  <span className="text-slate-400 text-sm">
                    Lifetime cost without solar:
                  </span>
                  <span>
                    {financialData
                      ? formatCurrency(financialData.totalCostWithoutSolar)
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400 text-sm">
                    Lifetime cost with solar:
                  </span>
                  <span>
                    {financialData
                      ? formatCurrency(financialData.totalCostWithSolar)
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400 text-sm">
                    Installation cost:
                  </span>
                  <span>
                    {financialData
                      ? formatCurrency(financialData.installationCost)
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-slate-400 text-sm">
                    Years until break even:
                  </span>
                  <span>
                    {financialData
                      ? financialData.yearsUntilBreakEven.toFixed(1) + " Y"
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between mb-4">
                  <span className="text-slate-400 text-sm">
                    Lifetime savings:
                  </span>
                  <span>
                    {financialData
                      ? formatCurrency(financialData.lifetimeSavings)
                      : "N/A"}
                  </span>
                </div>
                {financialData && (
                  <div
                    className={`text-center font-semibold ${
                      getRecommendation(financialData).color
                    }`}
                  >
                    {getRecommendation(financialData).text}
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={onClose}
                className="
                  w-full text-slate-200 bg-slate-600 hover:bg-slate-700
                  focus:ring-4 focus:ring-slate-300 font-medium rounded-lg
                  text-sm px-5 py-2.5 focus:outline-none
                "
              >
                Close
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default FeatureInfoModal;
