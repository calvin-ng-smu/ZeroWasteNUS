import { useEffect, useState } from 'react';
import { appData, vendorDrillDownData, studentData } from './data.js';

const DEFAULT_DATA = {
  appData,
  vendorDrillDownData,
  studentData,
  foodcourtLogistics: null,
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:3001';
const POLL_INTERVAL_MS = 5000;

export const useDashboardData = () => {
  const [data, setData] = useState(DEFAULT_DATA);
  const [status, setStatus] = useState({
    loading: true,
    error: null,
    lastUpdated: null
  });

  useEffect(() => {
    let isMounted = true;

    const fetchData = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/dashboard`);
        if (!response.ok) {
          throw new Error(`Request failed (${response.status})`);
        }
        const payload = await response.json();
        if (!isMounted) return;
        setData({
          appData: payload.appData,
          vendorDrillDownData: payload.vendorDrillDownData,
          studentData: payload.studentData,
          foodcourtLogistics: payload.foodcourtLogistics ?? null,
        });
        setStatus({
          loading: false,
          error: null,
          lastUpdated: payload.updatedAt || null
        });
      } catch (error) {
        if (!isMounted) return;
        setStatus((prev) => ({
          ...prev,
          loading: false,
          error: error?.message || 'Failed to load dashboard data.'
        }));
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, POLL_INTERVAL_MS);

    return () => {
      isMounted = false;
      clearInterval(intervalId);
    };
  }, []);

  return { data, status, apiBaseUrl: API_BASE_URL };
};
