import {
  NavigationControl,
  FullscreenControl,
  ScaleControl,
  GeolocateControl,
} from "react-map-gl/maplibre";

/**
  * Wrapper component to render maplibre navigation tools.
  *
  * @return various map navigation components
  * @author Jia Yang
  */
function MapControl () {
  return (
    <>
      <GeolocateControl
        position="bottom-right"
        showAccuracyCircle={false}
        trackUserLocation={false}
      />
      <FullscreenControl position="bottom-right" />
      <NavigationControl position="bottom-right" />
      <ScaleControl />
    </>
  );
}

export default MapControl;
