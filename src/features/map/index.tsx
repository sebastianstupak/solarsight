import React, { useEffect, useRef, useState } from "react";
import {
  CameraFlyTo,
  CesiumComponentRef,
  ImageryLayer,
  Viewer,
  ScreenSpaceEvent,
  ScreenSpaceEventHandler,
  Globe,
} from "resium";
import {
  defined as cesiumDefined,
  Cesium3DTileset,
  Viewer as CesiumViewer,
  UrlTemplateImageryProvider,
  CesiumTerrainProvider,
  createWorldTerrainAsync,
  ScreenSpaceEventType,
  PostProcessStageLibrary,
  PostProcessStage,
  Cesium3DTileStyle,
} from "cesium";
import { featuresConfig, highlights, initialView } from "./mapconfig";
import GeoSearch from "../search";
import InitialLoad from "../loading";
import Fade from "../fade";
import * as Cesium from "cesium";
import FeatureInfoModal from "../feature-info";
import { FeatureInfo } from "@/types/featureInfo";

Cesium.Ion.defaultAccessToken = process.env
  .NEXT_PUBLIC_CESIUM_ACCESS_TOKEN as string;
const MAPBOX_ACCESS_TOKEN = process.env
  .NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN as string;

const MAPBOX_STYLE_USERNAME = process.env
  .NEXT_PUBLIC_MAPBOX_STYLE_USERNAME as string;
const MAPBOX_STYLE_ID = process.env.NEXT_PUBLIC_MAPBOX_STYLE_ID as string;
const CESIUM_ASSET_ID = process.env
  .NEXT_PUBLIC_CESIUM_ASSET_ID as unknown as number;

const mapbox = new UrlTemplateImageryProvider({
  url: `https://api.mapbox.com/styles/v1/${MAPBOX_STYLE_USERNAME}/${MAPBOX_STYLE_ID}/tiles/512/{z}/{x}/{y}@2x?access_token=${MAPBOX_ACCESS_TOKEN}`,
});

const SolarMap = () => {
  const cesium = useRef<CesiumComponentRef<CesiumViewer>>(null);
  const [terrainProvider, setTerrainProvider] =
    useState<CesiumTerrainProvider>();
  const [tilesetProvider, setTilesetProvider] = useState<Cesium3DTileset>();
  const [allTilesLoaded, setAllTilesLoaded] = useState<boolean>(false);
  const [mapReady, setMapReady] = useState<boolean>(false);
  const [hoverHighlight, setHoverHighlight] = useState<PostProcessStage>();
  const [hoveredFeatures, setHoveredFeatures] = useState<any[]>([]);
  const [selectHighlight, setSelectHighlight] = useState<PostProcessStage>();
  const [selectedFeatures, setSelectedFeatures] = useState<any[]>([]);
  const [featureInfo, setFeatureInfo] = useState<FeatureInfo | null>(null);

  useEffect(() => {
    if (
      !cesium.current?.cesiumElement ||
      !terrainProvider ||
      !tilesetProvider ||
      !hoverHighlight ||
      !selectHighlight ||
      !allTilesLoaded
    ) {
      return;
    }
    setMapReady(true);
  }, [
    cesium,
    terrainProvider,
    tilesetProvider,
    hoverHighlight,
    selectHighlight,
    allTilesLoaded,
  ]);

  useEffect(() => {
    if (!hoveredFeatures || hoveredFeatures.length === 0) return;
  }, [hoveredFeatures]);

  useEffect(() => {
    const fetchTerrain = async () => {
      const terrain = await createWorldTerrainAsync({
        requestVertexNormals: true,
      });
      setTerrainProvider(terrain);
    };
    const fetchCesiumAsset = async () => {
      const tileset = await Cesium3DTileset.fromIonAssetId(CESIUM_ASSET_ID);
      setTilesetProvider(tileset);
    };

    fetchTerrain();
    fetchCesiumAsset();

    const hoverStage = PostProcessStageLibrary.createEdgeDetectionStage();
    hoverStage.uniforms.color = Cesium.Color.fromCssColorString(
      highlights.hoveredHighlight.toCssColorString()
    );
    hoverStage.uniforms.length = 0.009;
    hoverStage.selected = hoveredFeatures;
    setHoverHighlight(hoverStage);

    const selectStage = PostProcessStageLibrary.createEdgeDetectionStage();
    selectStage.uniforms.color = Cesium.Color.fromCssColorString(
      highlights.selectedHighlight.toCssColorString()
    );
    selectStage.uniforms.length = 0.009;
    selectStage.selected = selectedFeatures;
    setSelectHighlight(selectStage);
  }, []);

  const handleTilesLoaded = () => setAllTilesLoaded(true);

  useEffect(() => {
    const primitives = cesium?.current?.cesiumElement?.scene?.primitives;
    if (!primitives || !tilesetProvider) {
      return;
    }

    if (cesium.current?.cesiumElement?.scene.primitives.length! > 0) {
      return;
    }

    tilesetProvider.allTilesLoaded.addEventListener(handleTilesLoaded);
    primitives.add(tilesetProvider);

    return () => {
      tilesetProvider.allTilesLoaded.removeEventListener(handleTilesLoaded);
    };
  }, [cesium, tilesetProvider]);

  useEffect(() => {
    var cesiumElement = cesium?.current?.cesiumElement;
    if (!cesiumElement || !terrainProvider) {
      return;
    }

    if (cesiumElement.terrainProvider instanceof CesiumTerrainProvider) {
      return;
    }

    cesiumElement!.terrainProvider = terrainProvider;
  }, [cesium, terrainProvider]);

  useEffect(() => {
    const scene = cesium.current?.cesiumElement?.scene;
    if (!scene || !hoverHighlight || !selectHighlight) {
      return;
    }

    scene.postProcessStages.add(
      PostProcessStageLibrary.createSilhouetteStage([
        hoverHighlight,
        selectHighlight,
      ])
    );
  }, [cesium, hoverHighlight, selectHighlight]);

  useEffect(() => {
    if (!hoverHighlight) {
      return;
    }

    const highlight = hoverHighlight;
    highlight!.selected = hoveredFeatures;
    setHoverHighlight(highlight);
  }, [hoveredFeatures]);

  useEffect(() => {
    if (selectedFeatures && selectedFeatures.length === 1) {
      const id = selectedFeatures[0].getProperty("gml:id");
      const name = selectedFeatures[0].getProperty("gml:name");
      const lon = selectedFeatures[0].getProperty("Longitude");
      const lat = selectedFeatures[0].getProperty("Latitude");

      setFeatureInfo({
        id,
        name,
        lat,
        lon,
      });
    }

    if (!selectHighlight) {
      return;
    }

    const highlight = selectHighlight;
    highlight!.selected = selectedFeatures;
    setSelectHighlight(highlight);
  }, [selectedFeatures]);

  useEffect(() => {
    if (tilesetProvider) {
      const colorStyle = new Cesium3DTileStyle({
        color: `color('${featuresConfig.color.toCssColorString()}')`,
      });
      tilesetProvider.style = colorStyle;
    }
  }, [tilesetProvider]);

  const handleMouseMove = (movement: any) => {
    const viewer = cesium.current?.cesiumElement;
    if (!viewer || !movement.endPosition) {
      return;
    }

    setHoveredFeatures([]);
    const targetFeature = viewer.scene.pick(movement.endPosition);
    if (!cesiumDefined(targetFeature)) {
      return;
    }

    if (selectedFeatures?.includes(targetFeature)) {
      return;
    }

    setHoveredFeatures([targetFeature]);
  };

  const handleLeftClick = (movement: any) => {
    const viewer = cesium.current?.cesiumElement;
    if (!viewer || !movement.position) {
      return;
    }

    setSelectedFeatures([]);
    const targetFeature = viewer.scene.pick(movement.position);

    if (!cesiumDefined(targetFeature)) {
      return;
    }

    if (hoveredFeatures.includes(targetFeature)) {
      const updatedHoveredFeatures = hoveredFeatures.filter(
        (feature) => feature !== targetFeature
      );
      setHoveredFeatures(updatedHoveredFeatures);
    }

    setSelectedFeatures([targetFeature]);
  };

  return (
    <div className="h-full w-full relative">
      <Viewer
        className="h-full w-full relative"
        ref={cesium}
        full
        timeline={false}
        animation={false}
        navigationHelpButton={false}
        fullscreenButton={false}
        shadows={false}
        baseLayerPicker={false}
        homeButton={false}
        vrButton={false}
        geocoder={false}
        sceneModePicker={false}
        selectionIndicator={false}
        navigationInstructionsInitiallyVisible={false}
        infoBox={false}
      >
        <Fade onlyFadeOut show={!mapReady}>
          <InitialLoad />
        </Fade>
        <GeoSearch />
        <ScreenSpaceEventHandler>
          <ScreenSpaceEvent
            action={handleMouseMove}
            type={ScreenSpaceEventType.MOUSE_MOVE}
          />
          <ScreenSpaceEvent
            action={handleLeftClick}
            type={ScreenSpaceEventType.LEFT_CLICK}
          />
        </ScreenSpaceEventHandler>
        <Globe depthTestAgainstTerrain={true} />
        <CameraFlyTo
          once
          duration={0}
          destination={initialView.position}
          orientation={{
            heading: initialView.heading,
            pitch: initialView.pitch,
            roll: initialView.roll,
          }}
        />
        <ImageryLayer imageryProvider={mapbox} />
        {featureInfo && (
          <FeatureInfoModal
            feature={featureInfo}
            onClose={() => setFeatureInfo(null)}
          />
        )}
      </Viewer>
    </div>
  );
};

export default SolarMap;
