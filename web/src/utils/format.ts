export function formatRelative(iso: string, now: number = Date.now()): string {
  const time = new Date(iso).getTime();
  if (Number.isNaN(time)) {
    return '—';
  }

  const seconds = Math.max(0, Math.floor((now - time) / 100));
  if (seconds < 60) {
    return `hace ${seconds} s`;
  }

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `hace ${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `hace ${hours} h`;
  }

  return `hace ${Math.floor(hours / 24)} d`;
}
