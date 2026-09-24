import axios from 'axios';
import { UploadResponse, AnalysisResult } from '../types';

const api = axios.create({
  baseURL: '/api',
});

export const client = {
  async uploadImage(file: File): Promise<UploadResponse> {
    const formData = new FormData();
    formData.append('file', file);
    const { data } = await api.post<UploadResponse>('/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return data;
  },

  async fetchAoiImage(aoi: { north: number; south: number; east: number; west: number, year: number }): Promise<UploadResponse> {
    const { data } = await api.post<UploadResponse>('/upload/aoi', aoi);
    return data;
  },

  async analyze(imageIds: string[], query: string, taskHint?: string, bbox?: number[]): Promise<AnalysisResult> {
    const { data } = await api.post<AnalysisResult>('/analyze', {
      image_ids: imageIds,
      query,
      task_hint: taskHint,
      bbox,
    });
    return data;
  },

  async checkHealth() {
    const { data } = await api.get('/health');
    return data;
  },
  
  async getBenchmark() {
    const { data } = await api.get('/benchmark/20');
    return data;
  },

  async geoStatus(imageId: string) {
    const { data } = await api.get(`/gis/status/${imageId}`);
    return data;
  },

  /** Export detected objects as GeoJSON (returns Blob for download) */
  async exportGeojson(imageId: string, detectedObjects: any[], taskType: string): Promise<Blob> {
    const { data } = await api.post('/gis/export/geojson', {
      image_id: imageId,
      detected_objects: detectedObjects,
      task_type: taskType,
    }, { responseType: 'blob' });
    return data;
  },

  /** Export detected objects as ESRI Shapefile ZIP */
  async exportShapefile(imageId: string, detectedObjects: any[], taskType: string): Promise<Blob> {
    const { data } = await api.post('/gis/export/shapefile', {
      image_id: imageId,
      detected_objects: detectedObjects,
      task_type: taskType,
    }, { responseType: 'blob' });
    return data;
  },

  /** Export detected objects as GeoPackage */
  async exportGpkg(imageId: string, detectedObjects: any[], taskType: string): Promise<Blob> {
    const { data } = await api.post('/gis/export/gpkg', {
      image_id: imageId,
      detected_objects: detectedObjects,
      task_type: taskType,
    }, { responseType: 'blob' });
    return data;
  },
};

