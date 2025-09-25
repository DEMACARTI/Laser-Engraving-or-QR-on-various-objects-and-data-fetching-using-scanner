import { API_BASE } from '../../config/api';
import { InventoryStatsResponse, ServiceStatsResponse, ManufacturedItem } from './types';

export async function fetchInventoryStats(): Promise<InventoryStatsResponse> {
  const res = await fetch(`${API_BASE}/inventory/stats`);
  if (!res.ok) throw new Error('Failed to fetch inventory stats');
  return res.json();
}

export async function fetchServiceStats(): Promise<ServiceStatsResponse> {
  const res = await fetch(`${API_BASE}/stats`);
  if (!res.ok) throw new Error('Failed to fetch service stats');
  return res.json();
}

export async function fetchManufacturedItems(limit = 500): Promise<ManufacturedItem[]> {
  const res = await fetch(`${API_BASE}/items/manufactured?limit=${limit}`);
  if (!res.ok) throw new Error('Failed to fetch manufactured items');
  const data = await res.json();
  if (data && data.items) return data.items as ManufacturedItem[];
  return [];
}
