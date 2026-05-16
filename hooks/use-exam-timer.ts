"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type UseExamTimerResult = {
  timeRemaining: number; // seconds
  formatted: string;
  isRunning: boolean;
  isWarning: boolean;
  isCritical: boolean;
  start: (seconds?: number) => void;
  stop: () => void;
};

function formatSeconds(sec: number) {
  const s = Math.max(0, Math.floor(sec));
  const mm = Math.floor(s / 60)
    .toString()
    .padStart(2, "0");
  const ss = Math.floor(s % 60)
    .toString()
    .padStart(2, "0");
  return `${mm}:${ss}`;
}

export function useExamTimer(initialSeconds: number | null, onExpire?: () => void): UseExamTimerResult {
  const [timeRemaining, setTimeRemaining] = useState<number>(initialSeconds ?? 0);
  const [isRunning, setIsRunning] = useState<boolean>(!!initialSeconds && initialSeconds > 0);
  const intervalRef = useRef<number | null>(null);

  const tick = useCallback(() => {
    setTimeRemaining((prev) => {
      if (prev <= 1) {
        // will expire
        setIsRunning(false);
        if (intervalRef.current) {
          window.clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        try {
          onExpire && onExpire();
        } catch (e) { }
        return 0;
      }
      return prev - 1;
    });
  }, [onExpire]);

  useEffect(() => {
    // start automatically when initialSeconds is provided
    if (typeof initialSeconds === "number" && initialSeconds > 0) {
      setTimeRemaining(initialSeconds);
      setIsRunning(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSeconds]);

  useEffect(() => {
    if (!isRunning) return;
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    intervalRef.current = window.setInterval(tick, 1000) as unknown as number;
    return () => {
      if (intervalRef.current) {
        window.clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isRunning, tick]);

  const start = useCallback((seconds?: number) => {
    if (typeof seconds === "number") setTimeRemaining(seconds);
    setIsRunning(true);
  }, []);

  const stop = useCallback(() => {
    setIsRunning(false);
    if (intervalRef.current) {
      window.clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const isWarning = timeRemaining <= 10 * 60 && timeRemaining > 5 * 60; // 10-5 minutes
  const isCritical = timeRemaining <= 5 * 60; // <=5 minutes

  return {
    timeRemaining,
    formatted: formatSeconds(timeRemaining),
    isRunning,
    isWarning,
    isCritical,
    start,
    stop,
  };
}

export default useExamTimer;
