import { Cartesian3 } from "cesium";
import {
  ChangeEvent,
  KeyboardEvent,
  useCallback,
  useRef,
  useState,
} from "react";
import { useCesium } from "resium";
import { debounce } from "lodash";
import Fade from "../fade";

interface PlacePrediction {
  placeId: string;
  displayName: string;
}

const GeoSearch = () => {
  const cesium = useCesium();
  const inputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState<string>("");
  const [searchFocus, setSearchFocus] = useState<boolean>(false);
  const [results, setResults] = useState<PlacePrediction[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number>(-1);
  const showDropdown = searchFocus && results.length > 0;

  const handleSearch = useCallback(async (input: string) => {
    if (!input.trim()) {
      setResults([]);
      return;
    }

    try {
      const response = await fetch(
        `/api/places-autocomplete?input=${encodeURIComponent(input)}`
      );
      if (!response.ok) {
        throw new Error("Place Autocomplete request failed");
      }
      const data = await response.json();
      if (Array.isArray(data)) {
        setResults(data);
      } else {
        console.error("Unexpected response format:", data);
        setResults([]);
      }
    } catch (error) {
      console.error("Error during place autocomplete:", error);
      setResults([]);
    }
  }, []);

  const debouncedHandleSearch = useCallback(debounce(handleSearch, 300), [
    handleSearch,
  ]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearch(value);
    setSelectedIndex(-1);
    debouncedHandleSearch(value);
  };

  const handleSelectResult = async (result: PlacePrediction) => {
    if (!cesium.camera || !inputRef.current) {
      return;
    }

    try {
      // Fetch place details to get coordinates
      const response = await fetch(
        `/api/place-details?placeId=${result.placeId}`
      );
      if (!response.ok) {
        throw new Error("Failed to fetch place details");
      }
      const data = await response.json();

      if (data.location) {
        const destination = Cartesian3.fromDegrees(
          data.location.lng,
          data.location.lat,
          1000
        );
        cesium.camera.flyTo({
          destination: destination,
          duration: 1,
        });

        setSearchFocus(false);
        inputRef.current.blur();
        setSearch("");
        setResults([]);
        setSelectedIndex(-1);
      } else {
        console.error("No location data in place details");
      }
    } catch (error) {
      console.error("Error fetching place details:", error);
    }
  };

  const handleFocusKeyPress = (e: KeyboardEvent<HTMLDivElement>) => {
    if (!inputRef.current) {
      return;
    }

    if (e.key === "Escape") {
      inputRef.current.blur();
      setSearchFocus(false);
    } else if (e.key === "ArrowDown") {
      setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : prev));
    } else if (e.key === "ArrowUp") {
      setSelectedIndex((prev) => (prev > -1 ? prev - 1 : -1));
    } else if (e.key === "Enter") {
      if (selectedIndex > -1 && selectedIndex < results.length) {
        handleSelectResult(results[selectedIndex]);
      } else {
        debouncedHandleSearch(search);
      }
    }
  };

  return (
    <>
      <Fade onlyFadeOut={false} show={searchFocus}>
        <div
          className="animate-fade-in absolute inset-0 backdrop-blur-sm bg-opacity-20 bg-slate-950"
          onClick={() => setSearchFocus(false)}
        />
      </Fade>
      <div
        className="
          absolute top-2 inset-x-2/4 translate-x-[-50%]
          max-w-sm w-full
          bg-slate-800 bg-opacity-95
          rounded-2xl overflow-hidden
          border border-slate-700
          drop-shadow-sm hover:drop-shadow-lg
          flex justify-center align-middle"
        onFocus={() => setSearchFocus(true)}
      >
        <div className="flex flex-col w-full">
          <form
            className={`
              w-full h-10 overflow-hidden
              ${showDropdown ? "border-b border-slate-700" : ""}
            `}
            onSubmit={(e) => e.preventDefault()}
          >
            <input
              ref={inputRef}
              className="
                cursor-text
                w-full h-full overflow-hidden
                focus:outline-none bg-transparent
                text-slate-200 text-opacity-70 hover:text-opacity-100 text-center"
              placeholder="Search"
              value={search}
              onChange={handleChange}
              onKeyDown={handleFocusKeyPress}
            />
          </form>
          {showDropdown && (
            <div className="divide-y divide-slate-700 divide-opacity-30">
              {results.map((x, i) => (
                <div
                  key={`${x.placeId}-${i}`}
                  className={`
                    cursor-pointer min-h-[2.5rem] text-slate-200 px-4 py-2
                    flex items-center transition-colors duration-150
                    ${
                      i === selectedIndex
                        ? "bg-slate-700 text-white"
                        : "hover:bg-slate-700 hover:bg-opacity-50"
                    }
                  `}
                  onClick={() => handleSelectResult(x)}
                  onMouseEnter={() => setSelectedIndex(i)}
                  onMouseLeave={() => setSelectedIndex(-1)}
                >
                  <span>{x.displayName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GeoSearch;
