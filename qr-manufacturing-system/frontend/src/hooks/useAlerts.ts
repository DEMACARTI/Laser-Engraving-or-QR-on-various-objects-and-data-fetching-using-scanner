import { useState, useEffect, useCallback } from 'react';

interface AIAlert {
  id?: number;
  uid: string;
  alert_type: string;
  priority: number;
  priority_name: string;
  title: string;
  description: string;
  component: string;
  location: string;
  created_at: string;
  acknowledged?: boolean;
  resolved?: boolean;
}

interface AlertSummary {
  total_alerts: number;
  unacknowledged: number;
  unresolved: number;
  critical_alerts: number;
}

const API_BASE = 'http://localhost:5002';

export const useAlerts = () => {
  const [alerts, setAlerts] = useState<AIAlert[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAlerts = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await fetch(`${API_BASE}/ai-alerts/list`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch alerts');
      }

      const data = await response.json();
      if (data.success) {
        setAlerts(data.alerts || []);
      } else {
        throw new Error(data.error || 'Failed to fetch alerts');
      }
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch alerts');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSummary = useCallback(async () => {
    try {
      const response = await fetch(`${API_BASE}/ai-alerts/summary`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch summary');
      }

      const data = await response.json();
      if (data.success) {
        setSummary(data.summary);
      }
    } catch (err) {
      console.error('Error fetching summary:', err);
    }
  }, []);

  const refreshAlerts = useCallback(async () => {
    await Promise.all([fetchAlerts(), fetchSummary()]);
  }, [fetchAlerts, fetchSummary]);

  // Initial load
  useEffect(() => {
    refreshAlerts();
  }, [refreshAlerts]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(refreshAlerts, 30000);
    return () => clearInterval(interval);
  }, [refreshAlerts]);

  const unacknowledgedCount = summary?.unacknowledged || 0;
  const criticalCount = summary?.critical_alerts || 0;
  
  // Show badge for unacknowledged alerts, with special handling for critical alerts
  const badgeCount = Math.max(unacknowledgedCount, criticalCount > 0 ? criticalCount : 0);

  return {
    alerts,
    summary,
    loading,
    error,
    badgeCount,
    unacknowledgedCount,
    criticalCount,
    refreshAlerts
  };
};

export type { AIAlert, AlertSummary };