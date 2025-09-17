import { CompressRecord, CompressConfig } from '../types/compress';

const STORAGE_KEY = 'compress_history';
const TEMP_DIR = 'moli-tutu-temp'; // 临时文件夹名称

// 获取临时目录路径
const getTempDir = async (): Promise<string> => {
  // 在浏览器环境中，我们使用 IndexedDB 来存储文件
  // 这里返回一个虚拟路径
  return `temp://${TEMP_DIR}`;
};

// 保存文件到临时目录（使用 IndexedDB）
const saveFileToTemp = async (file: File | Blob, filename: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MoliTuTuFiles', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains('files')) {
        db.createObjectStore('files', { keyPath: 'filename' });
      }
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      const fileData = {
        filename,
        data: file,
        timestamp: Date.now()
      };
      
      const addRequest = store.put(fileData);
      addRequest.onsuccess = () => {
        const tempPath = `temp://${TEMP_DIR}/${filename}`;
        resolve(tempPath);
      };
      addRequest.onerror = () => reject(addRequest.error);
    };
  });
};

// 从临时目录读取文件
const readFileFromTemp = async (tempPath: string): Promise<File | null> => {
  if (!tempPath.startsWith('temp://')) {
    return null;
  }
  
  const filename = tempPath.replace(`temp://${TEMP_DIR}/`, '');
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MoliTuTuFiles', 1);
    
    request.onerror = () => reject(request.error);
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readonly');
      const store = transaction.objectStore('files');
      
      const getRequest = store.get(filename);
      getRequest.onsuccess = () => {
        const result = getRequest.result;
        if (result) {
          resolve(result.data);
        } else {
          resolve(null);
        }
      };
      getRequest.onerror = () => resolve(null);
    };
  });
};

// 从本地文件路径读取文件
const readFileFromPath = async (filePath: string): Promise<File | null> => {
  try {
    if (filePath.startsWith('temp://')) {
      return await readFileFromTemp(filePath);
    }
    
    // 对于本地文件路径，浏览器环境下无法直接访问
    // 这里返回 null，实际上需要用户重新选择文件
    console.warn('无法访问本地文件路径:', filePath);
    return null;
  } catch (error) {
    console.error('读取文件失败:', error);
    return null;
  }
};

// 删除临时文件
const deleteFileFromTemp = async (tempPath: string): Promise<void> => {
  if (!tempPath.startsWith('temp://')) {
    console.log('跳过删除非临时文件:', tempPath);
    return;
  }
  
  const filename = tempPath.replace(`temp://${TEMP_DIR}/`, '');
  console.log('尝试删除临时文件:', filename);
  
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('MoliTuTuFiles', 1);
    
    request.onerror = () => {
      console.error('IndexedDB 打开失败:', request.error);
      reject(request.error);
    };
    
    request.onsuccess = () => {
      const db = request.result;
      const transaction = db.transaction(['files'], 'readwrite');
      const store = transaction.objectStore('files');
      
      const deleteRequest = store.delete(filename);
      deleteRequest.onsuccess = () => {
        console.log('临时文件删除成功:', filename);
        resolve();
      };
      deleteRequest.onerror = () => {
        console.error('删除临时文件失败:', filename, deleteRequest.error);
        // 即使删除失败也不要阻止整个操作
        resolve();
      };
    };
  });
};

// 保存压缩记录（使用文件路径策略）
export const saveCompressRecord = async (
  originalFile: File,
  compressedBlob: Blob,
  config: CompressConfig,
  compressionRatio: number,
  sourceType: 'file' | 'clipboard' | 'drag' = 'file'
): Promise<void> => {
  try {
    const records = getCompressRecords();
    
    // 检查是否已存在相同文件名的记录，如果存在则更新
    const existingIndex = records.findIndex(record => record.originalName === originalFile.name);
    
    let originalImagePath: string;
    let compressedImagePath: string;
    
    // 根据来源类型决定如何存储原始文件
    if (sourceType === 'file') {
      // 选择的文件：存储文件路径（注意：浏览器环境下无法获取真实路径）
      originalImagePath = `file://${originalFile.name}`; // 虚拟路径，实际需要用户重新选择
    } else {
      // 粘贴或拖拽的文件：保存到临时目录
      const originalTempName = `original_${Date.now()}_${originalFile.name}`;
      originalImagePath = await saveFileToTemp(originalFile, originalTempName);
    }
    
    // 压缩后的文件总是保存到临时目录
    const compressedExtension = config.format === 'mozjpeg' ? 'jpg' : 
                               config.format === 'oxipng' ? 'png' : 
                               config.format;
    const compressedTempName = `compressed_${Date.now()}_${originalFile.name.split('.')[0]}.${compressedExtension}`;
    compressedImagePath = await saveFileToTemp(compressedBlob, compressedTempName);
    
    const newRecord: CompressRecord = {
      id: existingIndex >= 0 ? records[existingIndex].id : Date.now().toString(),
      originalName: originalFile.name,
      originalSize: originalFile.size,
      compressedSize: compressedBlob.size,
      compressionRatio,
      compressTime: Date.now(),
      config: { ...config }, // 深拷贝配置
      originalImagePath,
      compressedImagePath,
      sourceType,
    };
    
    if (existingIndex >= 0) {
      // 清理旧的临时文件
      const oldRecord = records[existingIndex];
      if (oldRecord.originalImagePath.startsWith('temp://')) {
        await deleteFileFromTemp(oldRecord.originalImagePath);
      }
      if (oldRecord.compressedImagePath.startsWith('temp://')) {
        await deleteFileFromTemp(oldRecord.compressedImagePath);
      }
      // 更新现有记录
      records[existingIndex] = newRecord;
    } else {
      // 添加新记录
      records.unshift(newRecord); // 最新的记录放在前面
    }
    
    // 限制记录数量，最多保存10条
    const limitedRecords = records.slice(0, 10);
    
    // 清理超出限制的记录的临时文件
    for (let i = 10; i < records.length; i++) {
      const record = records[i];
      if (record.originalImagePath.startsWith('temp://')) {
        await deleteFileFromTemp(record.originalImagePath);
      }
      if (record.compressedImagePath.startsWith('temp://')) {
        await deleteFileFromTemp(record.compressedImagePath);
      }
    }
    
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(limitedRecords));
      console.log('压缩记录已保存:', newRecord.originalName, '来源:', sourceType);
    } catch (storageError) {
      console.error('保存记录到localStorage失败:', storageError);
      throw storageError;
    }
  } catch (error) {
    console.error('保存压缩记录失败:', error);
    throw error;
  }
};

// 获取所有压缩记录
export const getCompressRecords = (): CompressRecord[] => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      console.log('没有找到存储的记录');
      return [];
    }
    
    const parsed = JSON.parse(stored);
    if (!Array.isArray(parsed)) {
      console.warn('存储的数据格式不正确，不是数组');
      return [];
    }
    
    // 验证和清理记录数据
    const validRecords = parsed.filter(record => {
      if (!record || typeof record !== 'object') {
        console.warn('跃过无效记录（非对象）:', record);
        return false;
      }
      if (!record.id || !record.originalName) {
        console.warn('跃过缺少必要字段的记录:', record);
        return false;
      }
      // 为旧记录添加默认值
      if (!record.originalImagePath) {
        record.originalImagePath = `file://${record.originalName}`;
      }
      if (!record.compressedImagePath) {
        record.compressedImagePath = `temp://compressed_${record.id}_${record.originalName}`;
      }
      if (!record.sourceType) {
        record.sourceType = 'file';
      }
      return true;
    });
    
    console.log('从 localStorage 读取记录:', validRecords.length, '条（原始:', parsed.length, '条）');
    
    // 如果有无效记录被过滤掉，更新存储
    if (validRecords.length !== parsed.length) {
      console.log('清理无效记录，更新存储');
      localStorage.setItem(STORAGE_KEY, JSON.stringify(validRecords));
    }
    
    return validRecords;
  } catch (error) {
    console.error('获取压缩记录失败:', error);
    // 如果解析失败，清空损坏的数据
    console.log('清空损坏的localStorage数据');
    localStorage.removeItem(STORAGE_KEY);
    return [];
  }
};

// 测试 localStorage 访问
export const testLocalStorage = (): boolean => {
  try {
    const testKey = 'moli_test';
    localStorage.setItem(testKey, 'test');
    const result = localStorage.getItem(testKey);
    localStorage.removeItem(testKey);
    console.log('localStorage 测试结果:', result === 'test' ? '正常' : '异常');
    return result === 'test';
  } catch (error) {
    console.error('localStorage 不可用:', error);
    return false;
  }
};

// 删除压缩记录
export const deleteCompressRecord = async (id: string): Promise<void> => {
  try {
    console.log('开始删除记录:', id);
    const records = getCompressRecords();
    console.log('当前记录数量:', records.length);
    
    const recordToDelete = records.find(record => record.id === id);
    
    if (!recordToDelete) {
      console.warn('未找到要删除的记录:', id);
      console.log('现有记录IDs:', records.map(r => r.id));
      // 即使记录不存在，我们也继续尝试从localStorage中移除
      const filteredRecords = records.filter(record => record.id !== id);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecords));
      console.log('已尝试从存储中移除记录:', id);
      return;
    }
    
    console.log('找到要删除的记录:', recordToDelete.originalName);
    
    // 清理临时文件
    const tempFilePromises = [];
    if (recordToDelete.originalImagePath && recordToDelete.originalImagePath.startsWith('temp://')) {
      console.log('删除原始文件:', recordToDelete.originalImagePath);
      tempFilePromises.push(deleteFileFromTemp(recordToDelete.originalImagePath));
    }
    if (recordToDelete.compressedImagePath && recordToDelete.compressedImagePath.startsWith('temp://')) {
      console.log('删除压缩文件:', recordToDelete.compressedImagePath);
      tempFilePromises.push(deleteFileFromTemp(recordToDelete.compressedImagePath));
    }
    
    // 等待所有临时文件删除完成
    if (tempFilePromises.length > 0) {
      await Promise.all(tempFilePromises);
      console.log('临时文件清理完成');
    }
    
    // 从记录列表中移除
    const filteredRecords = records.filter(record => record.id !== id);
    console.log('过滤后的记录数量:', filteredRecords.length);
    
    // 更新 localStorage
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filteredRecords));
    console.log('压缩记录已删除:', id);
    
    // 验证删除是否成功
    const updatedRecords = getCompressRecords();
    const stillExists = updatedRecords.find(record => record.id === id);
    if (stillExists) {
      console.error('记录删除失败，记录仍然存在');
      throw new Error('记录删除失败');
    } else {
      console.log('记录删除验证成功');
    }
    
  } catch (error) {
    console.error('删除压缩记录失败:', error);
    throw error;
  }
};

// 根据ID获取压缩记录
export const getCompressRecordById = (id: string): CompressRecord | null => {
  const records = getCompressRecords();
  return records.find(record => record.id === id) || null;
};

// 从记录恢复图片数据（使用文件路径）
export const restoreImagesFromRecord = async (record: CompressRecord): Promise<{
  originalFile: File;
  compressedBlob: Blob;
} | null> => {
  try {
    // 读取原始文件
    const originalFile = await readFileFromPath(record.originalImagePath);
    if (!originalFile) {
      console.warn('无法读取原始文件:', record.originalImagePath);
      return null;
    }
    
    // 读取压缩后的文件
    const compressedFile = await readFileFromPath(record.compressedImagePath);
    if (!compressedFile) {
      console.warn('无法读取压缩文件:', record.compressedImagePath);
      return null;
    }
    
    // 转换为 Blob
    const compressedBlob = new Blob([compressedFile], { type: compressedFile.type });
    
    return { originalFile, compressedBlob };
  } catch (error) {
    console.error('恢复图片数据失败:', error);
    return null;
  }
};

// 清空所有记录
export const clearAllCompressRecords = async (): Promise<void> => {
  try {
    const records = getCompressRecords();
    
    // 清理所有临时文件
    for (const record of records) {
      if (record.originalImagePath.startsWith('temp://')) {
        await deleteFileFromTemp(record.originalImagePath);
      }
      if (record.compressedImagePath.startsWith('temp://')) {
        await deleteFileFromTemp(record.compressedImagePath);
      }
    }
    
    localStorage.removeItem(STORAGE_KEY);
    console.log('所有压缩记录已清空');
  } catch (error) {
    console.error('清空压缩记录失败:', error);
    throw error;
  }
};