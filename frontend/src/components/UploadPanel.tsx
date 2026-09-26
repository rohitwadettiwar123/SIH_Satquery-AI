import React, { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, X, Image as ImageIcon, CloudRain } from 'lucide-react';
import { client } from '../api/client';
import { UploadResponse } from '../types';

interface Props {
  uploads: UploadResponse[];
  setUploads: React.Dispatch<React.SetStateAction<UploadResponse[]>>;
}

export default function UploadPanel({ uploads, setUploads }: Props) {
  const [isUploading, setIsUploading] = useState(false);
  const [activeDemoPreset, setActiveDemoPreset] = useState<string | null>(null);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    setIsUploading(true);
    setActiveDemoPreset(null);
    try {
      for (const file of acceptedFiles) {
        if (uploads.length >= 2) break; // Max 2
        const res = await client.uploadImage(file);
        setUploads(prev => [...prev, res].slice(0, 2));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsUploading(false);
    }
  }, [uploads, setUploads]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ 
    onDrop,
    accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.tif', '.tiff'] },
    maxFiles: 2
  });

  const loadPreset = (type: string) => {
    setActiveDemoPreset(type);
    const makeEntry = (id: string, name: string, imgFile: string, modality: 'optical' | 'sar', cloud: number) => ({
      file_id: imgFile.replace('.jpg', '').replace('.png', ''), // must match filename on disk
      filename: name,
      content_type: modality === 'sar' ? 'image/tiff' : 'image/png',
      size_bytes: 14500000,
      upload_time: new Date().toISOString(),
      modality,
      cloud_coverage_pct: cloud,
      preview_url: `${(import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace('/api', '')}/uploads/${imgFile}`
    });

    if (type === 'optical') {
      setUploads([makeEntry('demo_opt', 'sentinel2-l2a-coastal-city.png', 'demo_optical.jpg', 'optical', 12)]);
    } else if (type === 'sar') {
      setUploads([makeEntry('demo_sar', 'sentinel1-grd-urban.tif', 'demo_sar.jpg', 'sar', 0)]);
    } else if (type === 'change') {
      setUploads([
        makeEntry('demo_t0', 'baseline-pre-flood-t0.png', 'demo_change_t0.jpg', 'optical', 5),
        makeEntry('demo_t1', 'current-post-flood-t1.png', 'demo_change_t1.jpg', 'optical', 18)
      ]);
    } else if (type === 'fusion') {
      setUploads([
        makeEntry('demo_fusion_opt', 'fusion-optical-cloudy.png', 'demo_fusion_optical.jpg', 'optical', 45),
        makeEntry('demo_fusion_sar', 'fusion-sar-penetrate.tif', 'demo_fusion_sar.jpg', 'sar', 0)
      ]);
    } else if (type === 'xview') {
      setUploads([
        makeEntry('xview_pre', 'xview2-pre-earthquake.png', 'demo_change_t0.jpg', 'optical', 0),
        makeEntry('xview_post', 'xview2-post-earthquake-damage.png', 'demo_xview.jpg', 'optical', 0)
      ]);
    } else if (type === 'mismatch') {
      setUploads([
        makeEntry('mis_a', 'location-A-africa-savanna.png', 'demo_optical.jpg', 'optical', 2),
        makeEntry('mis_b', 'location-B-arctic-tundra.png', 'demo_sar.jpg', 'sar', 5)
      ]);
    }
  };


  const getButtonClass = (type: string) => {
    return activeDemoPreset === type
      ? "p-2 border border-neon-cyan/50 rounded bg-neon-cyan/10 hover:bg-neon-cyan/20 transition-colors text-xs font-mono text-neon-cyan text-left"
      : "p-2 border border-panel-border rounded bg-space hover:bg-panel transition-colors text-xs font-mono text-gray-300 text-left";
  };

  return (
    <div className="mission-panel flex flex-col p-4 overflow-y-auto">
      <h2 className="font-mono text-gray-400 text-xs font-bold mb-3 tracking-wider">DEMO PRESETS</h2>
      
      {/* Presets Grid */}
      <div className="grid grid-cols-2 gap-2 mb-6">
        <button onClick={() => loadPreset('optical')} className={getButtonClass('optical')}>Optical</button>
        <button onClick={() => loadPreset('sar')} className={getButtonClass('sar')}>SAR Radar</button>
        <button onClick={() => loadPreset('change')} className={getButtonClass('change')}>Change (T0+T1)</button>
        <button onClick={() => loadPreset('fusion')} className={getButtonClass('fusion')}>Fusion (Same Area)</button>
        <button onClick={() => loadPreset('xview')} className={getButtonClass('xview')}>xView2 Disaster</button>
        <button onClick={() => loadPreset('mismatch')} className={getButtonClass('mismatch')}>Different Place (Mismatch)</button>
      </div>

      {/* Uploads Display matching design */}
      <div className="flex flex-col gap-4">
        {/* Slot 1: T0 / Baseline */}
        <div className="border border-panel-border border-dashed rounded-lg p-4 bg-space relative">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-sm text-white">Baseline (T0)</span>
            {uploads[0] ? (
              <span className="text-[10px] px-2 py-0.5 border border-neon-cyan text-neon-cyan rounded-full">Active</span>
            ) : null}
          </div>
          {uploads[0] ? (
            <div className="flex flex-col items-center justify-center gap-3">
              <span className="text-neon-cyan font-mono text-sm">✓ {uploads[0].filename.replace('.png', '').replace('.tif', '')}</span>
              <button onClick={() => setUploads(u => [u[1]].filter(Boolean))} className="text-xs text-gray-400 hover:text-white">Replace T0</button>
            </div>
          ) : (
            <div 
              {...getRootProps()} 
              className={`flex flex-col items-center justify-center cursor-pointer py-4 ${isDragActive ? 'opacity-50' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="w-5 h-5 mb-2 text-gray-500" />
              <span className="text-xs text-gray-500">Drop T0 image here</span>
            </div>
          )}
        </div>

        {/* Slot 2: T1 / Current */}
        <div className="border border-panel-border border-dashed rounded-lg p-4 bg-space relative">
          <div className="flex justify-between items-center mb-3">
            <span className="font-bold text-sm text-white">Current (T1)</span>
            {uploads[1] ? (
              <span className="text-[10px] px-2 py-0.5 border border-neon-cyan text-neon-cyan rounded-full">Active</span>
            ) : null}
          </div>
          {uploads[1] ? (
            <div className="flex flex-col items-center justify-center gap-3">
              <span className="text-neon-cyan font-mono text-sm">✓ {uploads[1].filename.replace('.png', '').replace('.tif', '')}</span>
              <button onClick={() => setUploads(u => [u[0]].filter(Boolean))} className="text-xs text-gray-400 hover:text-white">Replace T1</button>
            </div>
          ) : (
            <div 
              {...getRootProps()} 
              className={`flex flex-col items-center justify-center cursor-pointer py-4 ${isDragActive ? 'opacity-50' : ''}`}
            >
              <input {...getInputProps()} />
              <Upload className="w-5 h-5 mb-2 text-gray-500" />
              <span className="text-xs text-gray-500">Drop T1 image here</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
