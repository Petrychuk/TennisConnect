import { useEffect, useState } from "react";

function formatRemaining(ms: number, showHours: boolean) {
  if (ms <= 0) return showHours ? "00:00:00" : "00:00";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  return showHours
    ? `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
    : `${pad(minutes)}:${pad(seconds)}`;
}

interface CountdownTimerProps {
  target: string; // ISO timestamp being counted down to
  className?: string;
  "data-testid"?: string;
}

// Shows HH:MM:SS once there's more than an hour left, MM:SS once under an
// hour — matches "Starts in 01:18:24" vs "Round ends in 07:14" from the brief.
export function CountdownTimer({ target, className, "data-testid": testId }: CountdownTimerProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const remainingMs = new Date(target).getTime() - now;
  const showHours = remainingMs >= 60 * 60 * 1000;

  return (
    <span className={className} data-testid={testId}>
      {formatRemaining(remainingMs, showHours)}
    </span>
  );
}
