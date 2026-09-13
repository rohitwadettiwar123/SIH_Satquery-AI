import React from 'react';
import { Viewer, Entity } from 'resium';
import { Cartesian3, Color } from 'cesium';

// Use a placeholder terrain/imagery if needed, or default
export default function CesiumGlobe() {
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
        position={Cartesian3.fromDegrees(-122.4194, 37.7749, 100000)}
        point={{ pixelSize: 10, color: Color.GREEN }}
        description="Active Target Region"
      />
    </Viewer>
  );
}
