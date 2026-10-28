import { expandCronField, isValidTimezone, minimumCronIntervalMinutes } from './schedule-policy';
import { scheduledMillis } from './schedule-tick.consumer';

describe('Política de agendamento T12', () => {
  it.each([
    ['0 * * * *', 60], ['*/15 * * * *', 15], ['*/5 * * * *', 5], ['0,10 * * * *', 10],
    ['50,5 * * * *', 15], ['55,5 * * * *', 10], ['0 9 * * 1-5', 1440], ['0 9,10 * * *', 60],
    ['30 23,0 * * *', 60], ['0-59/20 8-18 * * *', 20],
  ])('menor intervalo de %s = %d min', (cron, expected) => {
    expect(minimumCronIntervalMinutes(cron)).toBe(expected);
  });

  it.each(['* * * *', '61 * * * *', '5-1 * * * *', 'a * * * *', '*/0 * * * *'])('recusa expressão inválida %s', (cron) => {
    expect(minimumCronIntervalMinutes(cron)).toBeNull();
  });

  it('expande campos com passo e listas', () => {
    expect(expandCronField('1-10/3,20', 0, 59)).toEqual([1, 4, 7, 10, 20]);
    expect(expandCronField('5/20', 0, 59)).toEqual([5, 25, 45]);
  });

  it('valida fuso IANA', () => {
    expect(isValidTimezone('America/Sao_Paulo')).toBe(true);
    expect(isValidTimezone('UTC')).toBe(true);
    expect(isValidTimezone('Marte/Base')).toBe(false);
    expect(isValidTimezone('<script>')).toBe(false);
  });

  it('extrai o horário previsto do id do job scheduler', () => {
    expect(scheduledMillis({ id: 'repeat:abc:1761235200000', timestamp: 5 })).toBe(1761235200000);
    expect(scheduledMillis({ id: 'sem-sufixo', timestamp: 5 })).toBe(5);
  });
});
