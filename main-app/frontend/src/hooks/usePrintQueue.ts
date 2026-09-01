import { useEffect, useRef } from 'react';
import api from '../utils/api';

const AGENT_URL     = 'http://localhost:3001';
const POLL_MS       = 5000;   // poll backend every 5s
const AGENT_CHECK_MS = 15000; // re-check agent liveness every 15s

async function isAgentAlive(): Promise<boolean> {
  try {
    const res = await fetch(`${AGENT_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function forwardToAgent(job: { id: number; type: string; payload: any }) {
  let status: 'done' | 'failed' = 'failed';
  let errorMessage: string | null = null;

  try {
    const endpoint = job.type === 'kot' ? '/print/kot' : '/print/invoice';
    const body = job.type === 'kot'
      ? { kotData: job.payload.kotData }
      : { receiptData: job.payload.receiptData };

    const res = await fetch(`${AGENT_URL}${endpoint}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      throw new Error(d.error || `Agent error ${res.status}`);
    }
    status = 'done';
  } catch (e: any) {
    errorMessage = e.message;
  }

  // Report result back to backend (best effort)
  try {
    await api.patch(`/settings/print-queue/${job.id}`, {
      status,
      error_message: errorMessage,
    });
  } catch {
    // ignore
  }
}

// Mount this hook in Layout — it runs silently in the background.
// Only processes jobs if the Printer Agent is running on localhost:3001.
// If no agent → jobs stay pending, no error shown to user.
export function usePrintQueue() {
  const busyRef       = useRef(false);
  const agentAlive    = useRef(false);
  const lastAgentCheck = useRef(0);

  useEffect(() => {
    let mounted = true;

    // Initial agent check (don't wait for first poll interval)
    isAgentAlive().then(alive => {
      agentAlive.current = alive;
      lastAgentCheck.current = Date.now();
    });

    const tick = async () => {
      if (!mounted || busyRef.current) return;

      // Re-check agent liveness periodically
      if (Date.now() - lastAgentCheck.current > AGENT_CHECK_MS) {
        agentAlive.current = await isAgentAlive();
        lastAgentCheck.current = Date.now();
      }

      if (!agentAlive.current) return;

      busyRef.current = true;
      try {
        const res = await api.get('/settings/print-queue/pending');
        const jobs: any[] = res.data?.jobs || [];
        for (const job of jobs) {
          if (!mounted) break;
          await forwardToAgent(job);
        }
      } catch {
        // Backend unreachable — skip silently
      } finally {
        busyRef.current = false;
      }
    };

    const timer = setInterval(tick, POLL_MS);
    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, []);
}
