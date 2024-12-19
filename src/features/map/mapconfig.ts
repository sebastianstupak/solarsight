import { Cartesian3, Color, Math as CesiumMath } from "cesium";

type Highlights = {
  hoveredHighlight: Color;
  selectedHighlight: Color;
};

type FeaturesConfig = {
  color: Color;
};

const featuresConfig: FeaturesConfig = {
  color: Color.fromCssColorString("#4D6285"),
};

const highlights: Highlights = {
  hoveredHighlight: Color.fromCssColorString("#000000"),
  selectedHighlight: Color.fromCssColorString("#FFB054"),
};

const initialView = {
  position: new Cartesian3(
    4162475.596154987,
    667623.5172857676,
    4771741.809133388
  ),
  heading: CesiumMath.toRadians(318.0975327258499),
  pitch: CesiumMath.toRadians(-34.10098255463114),
  roll: CesiumMath.toRadians(0.0006126146139260513),
};

export { featuresConfig, highlights, initialView };
