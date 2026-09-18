import React, { useEffect } from 'react';
import { Viewer, Entity, CameraFlyTo } from 'resium';
import { Cartesian3, Color, Math as CesiumMath } from 'cesium';

export default function CesiumGlobe() {
  // Hide the default Ion access token warning and credits
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      .cesium-widget-errorPanel {
        display: none !important;
      }
      .cesium-viewer-bottom {
        display: none !important;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  // San Francisco target
  const lng = -122.4194;
  const lat = 37.7749;

  return (
    <Viewer 
      full 
      animation={false}
      timeline={false}
      infoBox={false}
      navigationHelpButton={false}
      homeButton={false}
      geocoder={false}
      baseLayerPicker={false}
      sceneModePicker={false}
      className="absolute inset-0 z-0"
    >
      <Entity
        name="SatQuery Target"
        position={Cartesian3.fromDegrees(lng, lat, 100)}
        point={{ pixelSize: 15, color: Color.GREEN, outlineColor: Color.WHITE, outlineWidth: 2 }}
        description="Active Target Region"
      />
      <CameraFlyTo 
        duration={3.5}
        destination={Cartesian3.fromDegrees(lng, lat - 0.05, 4000)}
        orientation={{
          heading: CesiumMath.toRadians(0),
          pitch: CesiumMath.toRadians(-35),
          roll: 0.0,
        }}
      />
    </Viewer>
  );
}
