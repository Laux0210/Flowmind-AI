// Política aprovada em 23/10/2026 (PROJECT_CONTEXT, T12 agendamento).
export const SCHEDULE_POLICY = { minIntervalMinutes: 15, maxActivePerOrg: 5, defaultTimezone: 'America/Sao_Paulo' };

const LIMITS = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]] as const;

/** Expande um campo cron (*, * /n, a-b, a-b/n, listas) em valores; null se inválido. */
export function expandCronField(field: string, min: number, max: number): number[] | null {
  const values = new Set<number>();
  for (const part of field.split(',')) {
    const match = part.match(/^(\*|(\d+)(?:-(\d+))?)(?:\/(\d+))?$/);
    if (!match) return null;
    const step = match[4] ? Number(match[4]) : 1;
    const start = match[1] === '*' ? min : Number(match[2]);
    const end = match[1] === '*' ? max : match[3] !== undefined ? Number(match[3]) : match[4] ? max : start;
    if (step < 1 || start < min || end > max || start > end) return null;
    for (let value = start; value <= end; value += step) values.add(value);
  }
  return [...values].sort((a, b) => a - b);
}

/**
 * Menor intervalo, em minutos, entre dois disparos da expressão. Só minuto e hora
 * encurtam o intervalo; dia, mês e dia da semana apenas removem disparos.
 */
export function minimumCronIntervalMinutes(cron: string): number | null {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return null;
  const expanded = parts.map((part, index) => expandCronField(part, LIMITS[index][0], LIMITS[index][1]));
  if (expanded.some((values) => !values?.length)) return null;
  const [minutes, hours] = expanded as number[][];
  const times = hours.flatMap((hour) => minutes.map((minute) => hour * 60 + minute));
  if (times.length === 1) return 24 * 60;
  let smallest = 24 * 60 - times[times.length - 1] + times[0];
  for (let i = 1; i < times.length; i++) smallest = Math.min(smallest, times[i] - times[i - 1]);
  return smallest;
}

export function isValidTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: timezone });
    return /^[A-Za-z_]+(\/[A-Za-z0-9_+-]+)*$/.test(timezone);
  } catch {
    return false;
  }
}
