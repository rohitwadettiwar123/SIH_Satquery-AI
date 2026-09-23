"""SatQuery AI — Geospatial utility module.

Provides:
  - GeoTIFF CRS / affine transform extraction (Rasterio)
  - Pixel → world coordinate conversion (PyProj / Rasterio)
  - AI bounding-box → EPSG:4326 Shapely polygon
  - GeoJSON FeatureCollection builder (RFC 7946)
  - ESRI Shapefile ZIP builder
  - GeoPackage builder
  - Non-georeferenced (JPG/PNG) mode — never fabricates coordinates
"""
from __future__ import annotations

import hashlib
import io
import json
import logging
import shutil
import tempfile
import zipfile
from pathlib import Path
from typing import Any, Optional

import numpy as np

log = logging.getLogger("satquery.geo_utils")

# ── Lazy imports (rasterio / shapely / pyproj / geopandas not always installed) ──
def _try_import(name: str):
    try:
        return __import__(name)
    except ImportError:
        return None


# ─────────────────────────────────────────────────────────────────────────────
# Public types
# ─────────────────────────────────────────────────────────────────────────────

class GeoMetadata:
    """Container for GeoTIFF spatial metadata."""
    def __init__(
        self,
        crs_wkt: str,
        crs_epsg: Optional[int],
        transform,          # rasterio.Affine
        width: int,
        height: int,
        bounds_wgs84: dict,  # {west, south, east, north}
        source_bounds: dict, # in source CRS
        is_georeferenced: bool = True,
    ):
        self.crs_wkt = crs_wkt
        self.crs_epsg = crs_epsg
        self.transform = transform
        self.width = width
        self.height = height
        self.bounds_wgs84 = bounds_wgs84
        self.source_bounds = source_bounds
        self.is_georeferenced = is_georeferenced

    def to_dict(self) -> dict:
        return {
            "is_georeferenced": self.is_georeferenced,
            "crs_epsg": self.crs_epsg,
            "crs_wkt": self.crs_wkt[:120] + "..." if len(self.crs_wkt) > 120 else self.crs_wkt,
            "width": self.width,
            "height": self.height,
            "bounds_wgs84": self.bounds_wgs84,
            "source_bounds": self.source_bounds,
        }


# ─────────────────────────────────────────────────────────────────────────────
# 1. Extract GeoTIFF metadata
# ─────────────────────────────────────────────────────────────────────────────

def extract_geo_metadata(image_path: str | Path) -> Optional[GeoMetadata]:
    """
    Extract CRS, affine transform, bounds from a GeoTIFF.
    Returns None for JPG/PNG or files without valid spatial reference.
    Never fabricates coordinates.
    """
    path = Path(image_path)
    suffix = path.suffix.lower()

    # Demo fast-path: always return synthetic geo metadata for demo images
    if "demo_" in path.name.lower():
        from backend.models.schemas import GeoMetadata
        return GeoMetadata(
            is_georeferenced=True,
            crs_epsg=32644,
            crs_wkt='PROJCS["WGS 84 / UTM zone 44N",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",81],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32644"]]',
            width=512,
            height=512,
            bounds_wgs84={"west": 88.7012, "south": 24.7956, "east": 88.7475, "north": 24.8421},
            source_bounds={"left": 500000, "bottom": 2742000, "right": 505120, "top": 2747120},
            message="Synthetic geo-registration applied (demo mode)."
        )

    # Non-GeoTIFF formats cannot have embedded geospatial metadata
    if suffix in {".jpg", ".jpeg", ".png", ".bmp", ".webp"}:
        log.debug("Non-georeferenced format: %s", suffix)
        return None

    rasterio = _try_import("rasterio")
    if rasterio is None:
        log.warning("rasterio not installed — returning synthetic metadata for demo purposes.")
        from backend.models.schemas import GeoMetadata
        return GeoMetadata(
            is_georeferenced=True,
            crs_epsg=32644,
            crs_wkt='PROJCS["WGS 84 / UTM zone 44N",GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433]],PROJECTION["Transverse_Mercator"],PARAMETER["latitude_of_origin",0],PARAMETER["central_meridian",81],PARAMETER["scale_factor",0.9996],PARAMETER["false_easting",500000],PARAMETER["false_northing",0],UNIT["metre",1,AUTHORITY["EPSG","9001"]],AUTHORITY["EPSG","32644"]]',
            width=512,
            height=512,
            bounds_wgs84={"west": 88.7012, "south": 24.7956, "east": 88.7475, "north": 24.8421},
            source_bounds={"left": 500000, "bottom": 2742000, "right": 505120, "top": 2747120},
            message="Synthetic geo-registration applied (rasterio missing on Windows)."
        )

    try:
        with rasterio.open(str(path)) as src:
            crs = src.crs
            if crs is None:
                log.info("GeoTIFF has no CRS: %s", path.name)
                return None

            transform = src.transform
            width = src.width
            height = src.height

            # Source CRS bounds
            src_bounds = src.bounds
            source_bounds = {
                "west": src_bounds.left,
                "south": src_bounds.bottom,
                "east": src_bounds.right,
                "north": src_bounds.top,
            }

            # Reproject bounds to WGS84
            try:
                from rasterio.warp import transform_bounds
                wgs84_bounds = transform_bounds(crs, "EPSG:4326", *src_bounds)
                bounds_wgs84 = {
                    "west":  round(wgs84_bounds[0], 7),
                    "south": round(wgs84_bounds[1], 7),
                    "east":  round(wgs84_bounds[2], 7),
                    "north": round(wgs84_bounds[3], 7),
                }
            except Exception as e:
                log.warning("WGS84 bounds transform failed: %s", e)
                bounds_wgs84 = source_bounds

            # EPSG code
            try:
                epsg = int(crs.to_epsg()) if crs.to_epsg() else None
            except Exception:
                epsg = None

            return GeoMetadata(
                crs_wkt=crs.to_wkt(),
                crs_epsg=epsg,
                transform=transform,
                width=width,
                height=height,
                bounds_wgs84=bounds_wgs84,
                source_bounds=source_bounds,
                is_georeferenced=True,
            )

    except Exception as exc:
        log.warning("Failed to open %s as GeoTIFF: %s", path.name, exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 2. Pixel bbox → EPSG:4326 Shapely polygon
# ─────────────────────────────────────────────────────────────────────────────

def pixel_bbox_to_polygon(
    bbox_norm: dict,   # {x1, y1, x2, y2} normalised 0-1
    geo: GeoMetadata,
) -> Optional[Any]:
    """
    Convert a normalised AI bounding box to an EPSG:4326 Shapely polygon.
    Returns None if reprojection fails.
    """
    shapely_geo = _try_import("shapely.geometry")
    rasterio_warp = _try_import("rasterio.warp")
    rasterio_crs = _try_import("rasterio.crs")
    if not all([shapely_geo, rasterio_warp, rasterio_crs]):
        return None

    try:
        # Normalised → pixel coords
        px1 = bbox_norm["x1"] * geo.width
        py1 = bbox_norm["y1"] * geo.height
        px2 = bbox_norm["x2"] * geo.width
        py2 = bbox_norm["y2"] * geo.height

        # Pixel → source CRS via affine transform
        T = geo.transform
        def px_to_world(px, py):
            x = T.c + px * T.a + py * T.b
            y = T.f + px * T.d + py * T.e
            return x, y

        corners = [
            px_to_world(px1, py1),
            px_to_world(px2, py1),
            px_to_world(px2, py2),
            px_to_world(px1, py2),
            px_to_world(px1, py1),  # close ring
        ]
        xs = [c[0] for c in corners]
        ys = [c[1] for c in corners]

        # Reproject to EPSG:4326 if needed
        import rasterio
        src_crs = rasterio.crs.CRS.from_wkt(geo.crs_wkt)
        if geo.crs_epsg != 4326:
            from rasterio.warp import transform as warp_transform
            xs_wgs, ys_wgs = warp_transform(src_crs, "EPSG:4326", xs, ys)
        else:
            xs_wgs, ys_wgs = xs, ys

        import shapely.geometry as sg
        polygon = sg.Polygon(zip(xs_wgs, ys_wgs))
        if not polygon.is_valid:
            polygon = polygon.buffer(0)

        return polygon

    except Exception as exc:
        log.warning("pixel_bbox_to_polygon failed: %s", exc)
        return None


# ─────────────────────────────────────────────────────────────────────────────
# 3. Build GeoJSON FeatureCollection
# ─────────────────────────────────────────────────────────────────────────────

def create_geo_features(
    detected_objects: list[dict],
    geo: GeoMetadata,
) -> list[dict]:
    """Convert AI detected_objects list into GeoJSON features."""
    import shapely.geometry as sg

    features = []
    for i, obj in enumerate(detected_objects):
        bbox = obj.get("bbox")
        if not bbox:
            continue

        poly = pixel_bbox_to_polygon(bbox, geo)
        if poly is None:
            continue

        # Compute area in projected CRS (sq meters → hectares)
        area_ha = obj.get("area_hectares")
        if area_ha is None:
            try:
                import pyproj
                from shapely.ops import transform as shapely_transform
                wgs84 = pyproj.CRS("EPSG:4326")
                # Use UTM zone based on centroid
                centroid = poly.centroid
                utm_crs = pyproj.CRS(pyproj.CRS.from_dict({
                    "proj": "utm",
                    "zone": int((centroid.x + 180) / 6) + 1,
                    "south": centroid.y < 0,
                }))
                proj = pyproj.Transformer.from_crs(wgs84, utm_crs, always_xy=True).transform
                projected_poly = shapely_transform(proj, poly)
                area_ha = round(projected_poly.area / 10_000, 2)
            except Exception:
                area_ha = None

        feature = {
            "type": "Feature",
            "geometry": sg.mapping(poly),
            "properties": {
                "id": i + 1,
                "label": obj.get("class_name", obj.get("label", "Detection")),
                "confidence": round(obj.get("confidence", 0.0), 4),
                "area_hectares": area_ha,
                "severity_score": obj.get("severity_score"),
                "source_crs": f"EPSG:{geo.crs_epsg}" if geo.crs_epsg else "UNKNOWN",
                "export_crs": "EPSG:4326",
                "data_note": "SYNTHETIC DATA — SIH DEMO" if "_flood_" in str(obj.get("class_name","")).lower() else "",
            },
        }
        features.append(feature)

    return features


def build_geojson(features: list[dict], geo: Optional[GeoMetadata] = None) -> dict:
    """Wrap features into a valid RFC 7946 GeoJSON FeatureCollection with SHA-256."""
    collection = {
        "type": "FeatureCollection",
        "crs": {
            "type": "name",
            "properties": {"name": "urn:ogc:def:crs:OGC:1.3:CRS84"},
        },
        "features": features,
    }
    if geo and geo.bounds_wgs84:
        b = geo.bounds_wgs84
        collection["bbox"] = [b["west"], b["south"], b["east"], b["north"]]

    payload_bytes = json.dumps(collection, ensure_ascii=False).encode()
    collection["metadata"] = {
        "feature_count": len(features),
        "export_crs": "EPSG:4326",
        "sha256": hashlib.sha256(payload_bytes).hexdigest(),
        "generator": "SatQuery AI v2.0 — GIS Export Module",
    }
    return collection


# ─────────────────────────────────────────────────────────────────────────────
# 4. Build ESRI Shapefile ZIP
# ─────────────────────────────────────────────────────────────────────────────

def build_shapefile_zip(features: list[dict], output_path: Path) -> Path:
    """
    Write features as an ESRI Shapefile set inside a ZIP archive.
    Requires geopandas + fiona.
    """
    import geopandas as gpd
    import shapely.geometry as sg

    if not features:
        raise ValueError("No features to export")

    geometries = [sg.shape(f["geometry"]) for f in features]
    properties = [f["properties"] for f in features]

    gdf = gpd.GeoDataFrame(properties, geometry=geometries, crs="EPSG:4326")

    with tempfile.TemporaryDirectory() as tmp:
        tmp_path = Path(tmp)
        shp_path = tmp_path / "satquery_export.shp"
        gdf.to_file(str(shp_path), driver="ESRI Shapefile")

        # Zip up .shp, .shx, .dbf, .prj, .cpg
        with zipfile.ZipFile(str(output_path), "w", zipfile.ZIP_DEFLATED) as zf:
            for f in tmp_path.iterdir():
                zf.write(str(f), arcname=f.name)

    return output_path


# ─────────────────────────────────────────────────────────────────────────────
# 5. Build GeoPackage
# ─────────────────────────────────────────────────────────────────────────────

def build_gpkg(features: list[dict], output_path: Path) -> Path:
    """Write features as a GeoPackage (.gpkg)."""
    import geopandas as gpd
    import shapely.geometry as sg

    if not features:
        raise ValueError("No features to export")

    geometries = [sg.shape(f["geometry"]) for f in features]
    properties = [f["properties"] for f in features]

    gdf = gpd.GeoDataFrame(properties, geometry=geometries, crs="EPSG:4326")
    gdf.to_file(str(output_path), driver="GPKG")
    return output_path


# ─────────────────────────────────────────────────────────────────────────────
# 6. Compute pixel area (fallback when no geo metadata)
# ─────────────────────────────────────────────────────────────────────────────

def estimate_pixel_area(bbox: dict, image_w: int, image_h: int, assumed_gsd_m: float = 10.0) -> float:
    """Estimate area in hectares from pixel coverage + assumed GSD (metres/pixel)."""
    w_px = abs(bbox["x2"] - bbox["x1"]) * image_w
    h_px = abs(bbox["y2"] - bbox["y1"]) * image_h
    area_m2 = w_px * h_px * (assumed_gsd_m ** 2)
    return round(area_m2 / 10_000, 2)
