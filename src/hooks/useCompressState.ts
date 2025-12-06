import { useState, useCallback } from 'react';
import { CompressRecord } from '../types/compress';
import { restoreImagesFromRecord } from '../utils/compressStorage';

interface CompressState {
  originalFile: File | null;
  compressedBlob: Blob | null;
  config: any;
  isRestored: boolean;
}

export const useCompressState = () => {
  const [compressState, setCompressState] = useState<CompressState>({
    originalFile: null,
    compressedBlob: null,
    config: null,
    isRestored: false
  });

  const restoreFromRecord = useCallback(async (record: CompressRecord) => {
    const images = await restoreImagesFromRecord(record);
    if (images) {
      setCompressState({
        originalFile: images.originalFile,
        compressedBlob: images.compressedBlob,
        config: record.config,
        isRestored: true
      });
      return true;
    }
    return false;
  }, []);

  const clearState = useCallback(() => {
    setCompressState({
      originalFile: null,
      compressedBlob: null,
      config: null,
      isRestored: false
    });
  }, []);

  return {
    compressState,
    restoreFromRecord,
    clearState
  };
};