import api from './api';

export interface QRBatchRequest {
  prefix: string;
  start_number: number;
  count: number;
  format: string;
  size: number;
}

export interface QRBatch {
  id: string;
  prefix: string;
  count: number;
  status: string;
  created_at: string;
  download_url?: string;
}

export const qrService = {
  // Generate QR batch
  generateBatch: async (request: QRBatchRequest): Promise<QRBatch> => {
    const response = await api.post('/qr-generation/generate-batch', request);
    return response.data;
  },

  // Get batch status
  getBatchStatus: async (batchId: string): Promise<QRBatch> => {
    const response = await api.get(`/qr-generation/batch/${batchId}`);
    return response.data;
  },

  // Get all batches
  getAllBatches: async (): Promise<QRBatch[]> => {
    const response = await api.get('/qr-generation/batches');
    return response.data;
  },

  // Download batch
  downloadBatch: async (batchId: string): Promise<Blob> => {
    const response = await api.get(`/qr-generation/batch/${batchId}/download`, {
      responseType: 'blob',
    });
    return response.data;
  },
};

export default qrService;