import * as Network from 'expo-network';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { createTelemetryEngine, type TelemetrySummary } from '../telemetry/engine';

const UDP_PORT = 20777;

export function useUdpTelemetry() {
  const engineRef = useRef(createTelemetryEngine());
  const [summary, setSummary] = useState<TelemetrySummary>(() => engineRef.current.getSummary());
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [localIp, setLocalIp] = useState<string>('');

  useEffect(() => {
    Network.getIpAddressAsync().then(setLocalIp).catch(() => setLocalIp(''));
  }, []);

  const refresh = useCallback(() => {
    setSummary(engineRef.current.getSummary());
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') {
      setListening(false);
      setError('Web önizleme: UDP yok — canlı telemetry için Android/iOS build kullan.');
      return;
    }

    // Metro resolves native module; default export typing does not match runtime.
    const dgram = require('react-native-udp') as {
      createSocket: (opts: { type: string }) => {
        on: (ev: string, fn: (...args: unknown[]) => void) => void;
        bind: (port: number, addr: string, cb: () => void) => void;
        close: () => void;
        setBroadcast?: (flag: boolean) => void;
      };
    };
    const socket = dgram.createSocket({ type: 'udp4' });

    const onMsg = (msg: unknown, rinfo: { address: string; port: number }) => {
      engineRef.current.onUdpMessage(msg, rinfo);
      setSummary(engineRef.current.getSummary());
    };

    socket.on('message', (...args: unknown[]) => {
      const [msg, rinfo] = args as [unknown, { address: string; port: number }];
      onMsg(msg, rinfo);
    });
    socket.on('error', (err: unknown) => {
      setError(err instanceof Error ? err.message : String(err));
    });

    try {
      socket.bind(UDP_PORT, '0.0.0.0', () => {
        setListening(true);
        setError(null);
        try {
          socket.setBroadcast?.(true);
        } catch {
          /* optional */
        }
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'UDP bind failed');
    }

    return () => {
      try {
        socket.close();
      } catch {
        /* */
      }
    };
  }, []);

  return {
    summary,
    listening,
    error,
    localIp,
    udpPort: UDP_PORT,
    refresh,
    uptimeMs: engineRef.current.getMeta().uptimeMs,
  };
}
