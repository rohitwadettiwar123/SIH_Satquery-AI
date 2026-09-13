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

  async analyze(imageIds: string[], query: string, taskHint?: string): Promise<AnalysisResult> {
    const { data } = await api.post<AnalysisResult>('/analyze', {
      image_ids: imageIds,
      query,
      task_hint: taskHint,
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
  }
};
