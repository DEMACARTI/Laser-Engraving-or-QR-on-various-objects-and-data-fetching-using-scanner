export interface InventoryStatsResponse {
  success: boolean;
  stats: {
    total_items: number;
    status_breakdown: Record<string, number>;
    low_stock_alerts: number;
    pending_actions: number;
  };
}

export interface ServiceStatsResponse {
  service: string;
  version: string;
  status: string;
  database: string;
  engraving_state: any;
  worker_running: boolean;
  timestamp: string;
}

export interface ManufacturedItem {
  uid: string;
  qr_path: string;
  component: string;
  vendor: string;
  lot: string;
  mfg_date?: string;
  created_at?: string;
}
