import api from './api';

export interface InventoryItem {
  id: string;
  qr_code: string;
  component_type: string;
  status: string;
  location: string;
  created_at: string;
  updated_at: string;
}

export interface CreateInventoryItem {
  qr_code: string;
  component_type: string;
  location: string;
}

export const inventoryService = {
  // Get all inventory items
  getAllItems: async (): Promise<InventoryItem[]> => {
    const response = await api.get('/inventory/components');
    return response.data;
  },

  // Get single inventory item
  getItem: async (itemId: string): Promise<InventoryItem> => {
    const response = await api.get(`/inventory/components/${itemId}`);
    return response.data;
  },

  // Create new inventory item
  createItem: async (item: CreateInventoryItem): Promise<InventoryItem> => {
    const response = await api.post('/inventory/components', item);
    return response.data;
  },

  // Update inventory item
  updateItem: async (itemId: string, updates: Partial<InventoryItem>): Promise<InventoryItem> => {
    const response = await api.put(`/inventory/components/${itemId}`, updates);
    return response.data;
  },

  // Delete inventory item
  deleteItem: async (itemId: string): Promise<void> => {
    await api.delete(`/inventory/components/${itemId}`);
  },

  // Search inventory items
  searchItems: async (query: string): Promise<InventoryItem[]> => {
    const response = await api.get(`/inventory/components/search?q=${encodeURIComponent(query)}`);
    return response.data;
  },
};

export default inventoryService;