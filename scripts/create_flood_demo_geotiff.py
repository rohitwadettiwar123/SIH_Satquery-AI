"""Generate synthetic flood demo GeoTIFF pair for SatQuery AI SIH demonstration.

Creates:
  backend/data/uploads/demo_flood_t0.tif  — pre-flood (dry land)
  backend/data/uploads/demo_flood_t1.tif  — post-flood (flood zone visible)

Both files are:
  - Clearly labeled SYNTHETIC DATA — SIH DEMO
  - Georeferenced with real affine transform (simulated 10m/pixel Sentinel-2 GSD)
  - Centered on a representative region in EPSG:32644 (UTM Zone 44N, India)
  - Co-registered (identical transform, same extent)
  - Small (512 × 512 pixels) for fast processing
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

# Add project root to path
ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT))


def create_flood_geotiffs():
    try:
        import rasterio
        from rasterio.transform import from_bounds
        from rasterio.crs import CRS
    except ImportError:
        print("ERROR: rasterio not installed. Run: pip install rasterio")
        return

    output_dir = ROOT / "backend" / "data" / "uploads"
    output_dir.mkdir(parents=True, exist_ok=True)

    # ── Spatial parameters ───────────────────────────────────────────────────
    # Simulate a 5.12 km × 5.12 km area (512 px × 10m GSD)
    # Centered roughly on Brahmaputra valley region, Assam, India (UTM 44N)
    WIDTH, HEIGHT = 512, 512
    GSD_M = 10.0  # metres per pixel (Sentinel-2 equivalent)

    # Easting / Northing (EPSG:32644, UTM Zone 44N)
    WEST  = 450_000.0
    NORTH = 2_750_000.0
    EAST  = WEST + WIDTH * GSD_M
    SOUTH = NORTH - HEIGHT * GSD_M

    crs = CRS.from_epsg(32644)
    transform = from_bounds(WEST, SOUTH, EAST, NORTH, WIDTH, HEIGHT)

    rasterio_kwargs = {
        "driver": "GTiff",
        "dtype": "uint8",
        "width": WIDTH,
        "height": HEIGHT,
        "count": 3,  # RGB
        "crs": crs,
        "transform": transform,
        "compress": "lzw",
    }

    # ── T0: Pre-flood image ──────────────────────────────────────────────────
    # Mostly green/brown farmland with a small river channel
    rng = np.random.default_rng(42)
    t0_r = rng.integers(80, 140, (HEIGHT, WIDTH), dtype=np.uint8)
    t0_g = rng.integers(100, 160, (HEIGHT, WIDTH), dtype=np.uint8)
    t0_b = rng.integers(50, 100, (HEIGHT, WIDTH), dtype=np.uint8)

    # River channel (thin, dark-blue strip)
    t0_r[:, 200:220] = 30
    t0_g[:, 200:220] = 60
    t0_b[:, 200:220] = 130

    t0_path = output_dir / "demo_flood_t0.tif"
    with rasterio.open(str(t0_path), "w", **rasterio_kwargs) as dst:
        dst.write(t0_r, 1)
        dst.write(t0_g, 2)
        dst.write(t0_b, 3)
        dst.update_tags(
            DATA_NOTE="SYNTHETIC DATA — SIH DEMO",
            DESCRIPTION="Pre-flood baseline (T0) — simulated Brahmaputra valley, Assam",
            SOURCE_CRS="EPSG:32644",
            GSD_METRES="10",
            GENERATOR="SatQuery AI v2.0 create_flood_demo_geotiff.py",
        )
    print(f"✅ Wrote T0: {t0_path}")

    # ── T1: Post-flood image ─────────────────────────────────────────────────
    # Flood inundation zone: rows 100-380, cols 150-400 turned blue-grey
    t1_r = t0_r.copy()
    t1_g = t0_g.copy()
    t1_b = t0_b.copy()

    # Flood zone
    flood_r0, flood_r1 = 100, 380
    flood_c0, flood_c1 = 150, 400
    t1_r[flood_r0:flood_r1, flood_c0:flood_c1] = rng.integers(20, 60, (flood_r1-flood_r0, flood_c1-flood_c0), dtype=np.uint8)
    t1_g[flood_r0:flood_r1, flood_c0:flood_c1] = rng.integers(40, 90, (flood_r1-flood_r0, flood_c1-flood_c0), dtype=np.uint8)
    t1_b[flood_r0:flood_r1, flood_c0:flood_c1] = rng.integers(140, 210, (flood_r1-flood_r0, flood_c1-flood_c0), dtype=np.uint8)

    t1_path = output_dir / "demo_flood_t1.tif"
    with rasterio.open(str(t1_path), "w", **rasterio_kwargs) as dst:
        dst.write(t1_r, 1)
        dst.write(t1_g, 2)
        dst.write(t1_b, 3)
        dst.update_tags(
            DATA_NOTE="SYNTHETIC DATA — SIH DEMO",
            DESCRIPTION="Post-flood event (T1) — flood zone rows 100-380, cols 150-400",
            SOURCE_CRS="EPSG:32644",
            GSD_METRES="10",
            FLOOD_ZONE_PIXELS=f"rows {flood_r0}-{flood_r1}, cols {flood_c0}-{flood_c1}",
            GENERATOR="SatQuery AI v2.0 create_flood_demo_geotiff.py",
        )
    print(f"✅ Wrote T1: {t1_path}")

    # ── Summary ──────────────────────────────────────────────────────────────
    flood_area_km2 = ((flood_r1 - flood_r0) * (flood_c1 - flood_c0) * GSD_M ** 2) / 1e6
    print(f"\n🌊 Synthetic flood zone: {flood_area_km2:.2f} km² ({flood_area_km2 * 100:.1f} ha)")
    print(f"   Pixel extent: rows {flood_r0}-{flood_r1}, cols {flood_c0}-{flood_c1}")
    print(f"   CRS: EPSG:32644 (UTM Zone 44N)")
    print(f"   Center approx: 24.8°N, 88.7°E (Brahmaputra valley, Assam — SYNTHETIC)")
    print(f"\n📂 Files ready for upload in SatQuery AI:")
    print(f"   {t0_path}")
    print(f"   {t1_path}")
    print(f"\n⚠️  These are CLEARLY LABELED SYNTHETIC files for SIH demo purposes only.")


if __name__ == "__main__":
    create_flood_geotiffs()
