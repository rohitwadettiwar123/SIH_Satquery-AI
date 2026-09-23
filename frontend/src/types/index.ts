export interface UploadResponse {
  file_id: string;
  filename: string;
  content_type?: string;
  size_bytes: number;
  upload_time?: string;
  modality?: 'optical' | 'sar';
  cloud_coverage_pct?: number;
  width?: number;
  height?: number;
  bands?: number;
  metadata?: Record<string, any>;
  preview_url?: string;
  geo_metadata?: GeoMetadata | null;
}

export interface BoundingBox {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface DetectedObject {
  class_name?: string;
  label?: string;
  confidence: number;
  bbox?: BoundingBox;
  area_hectares?: number;
  severity_score?: number;
}

export interface ChangeMetrics {
  ssim_score: number;
  change_ratio_pct: number;
  affected_area_km2: number;
  mean_delta: number;
  confidence_interval_95?: number[];
}

export interface NdviStats {
  mean: number;
  median: number;
  std: number;
  class_percentages: Record<string, number>;
  delta_ndvi?: Record<string, { t0: number; t1: number; delta: number; pct: number }>;
}

export interface CloudReconstructionInfo {
  triggered: boolean;
  coverage_pct: number;
  method: string;
  avg_confidence: number;
  disclosure_text: string;
  original_url?: string;
  reconstructed_url?: string;
}

export interface GeoMetadata {
  is_georeferenced: boolean;
  crs_epsg?: number | null;
  crs_wkt?: string | null;
  width?: number;
  height?: number;
  bounds_wgs84?: {
    west: number;
    south: number;
    east: number;
    north: number;
  } | null;
  source_bounds?: {
    west: number;
    south: number;
    east: number;
    north: number;
  } | null;
  message?: string;
}

export interface LandCoverCategory {
  pct: number;
  ha: number;
  px2: number;
  sub_metric: { label: string; value: number };
  color: string;
  emoji: string;
}

export interface AnalysisResult {
  query_id: string;
  task_type: string;
  query: string;
  answer: string;
  confidence: number;
  detected_objects: DetectedObject[];
  change_metrics?: ChangeMetrics;
  ndvi_stats?: NdviStats;
  land_cover_analysis?: Record<string, LandCoverCategory>;
  geo_metadata?: GeoMetadata | null;
  cloud_reconstruction: CloudReconstructionInfo;
  execution_trace: string[];
  gate_verdicts: Record<string, string>;
  requires_expert_escalation: boolean;
  escalation_reason: string;
  processing_time_ms: number;
  audit_hash: string;
  primary_image_id?: string;
}
