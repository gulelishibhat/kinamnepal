import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { API_BASE_URL } from '@/lib/api';
import { useAuthStore } from '@/store/auth.store';

type SseStatus = 'connecting' | 'connected' | 'disconnected';

export function useOrderSSE(enabled: boolean) {
  const qc = useQueryClient();
  const [status, setStatus] = useState<SseStatus>('disconnected');
  const esRef = useRef<EventSource | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) return;

    function connect() {
      setStatus('connecting');
      // EventSource can't send an Authorization header, so pass the token as a
      // query param (the API's SSE route accepts ?token=). withCredentials also
      // sends the cookie when same-origin (dev).
      const token = useAuthStore.getState().accessToken;
      const url = `${API_BASE_URL}/sse/orders${token ? `?token=${encodeURIComponent(token)}` : ''}`;
      const es = new EventSource(url, { withCredentials: true });
      esRef.current = es;

      es.addEventListener('connected', () => setStatus('connected'));

      es.addEventListener('new_order', (e) => {
        try {
          const payload = JSON.parse(e.data);
          toast.success(`New order: ${payload.orderNumber} — NPR ${payload.total?.toLocaleString()}`, { duration: 6000 });
          // Refresh dashboard and orders list
          qc.invalidateQueries({ queryKey: ['dashboard-summary'] });
          qc.invalidateQueries({ queryKey: ['admin-orders'] });
        } catch { /* ignore parse errors */ }
      });

      es.onerror = () => {
        setStatus('disconnected');
        es.close();
        // Retry after 5 seconds
        retryRef.current = setTimeout(connect, 5000);
      };
    }

    connect();

    return () => {
      esRef.current?.close();
      if (retryRef.current) clearTimeout(retryRef.current);
    };
  }, [enabled]);

  return status;
}
