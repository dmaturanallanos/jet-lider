'use client';
import { useState } from 'react';
import { OVERTIME_NET } from './calculations';
export function parseOvertime(value: string) {
  const text = value.trim();
  let minutes: number;
  if (/^\d{1,3}:\d{2}$/.test(text)) {
    const [h, m] = text.split(':').map(Number);
    if (m > 59) throw new Error('Los minutos deben ser menores que 60.');
    minutes = h * 60 + m;
  } else {
    if (!/^\d+(?:[,.]\d+)?$/.test(text))
      throw new Error('Ingresa horas como 1,5 o duración como 1:30.');
    minutes = Math.round(Number(text.replace(',', '.')) * 60);
  }
  if (!Number.isSafeInteger(minutes) || minutes < 0 || minutes > 10080)
    throw new Error('Máximo 168 horas extra por semana.');
  return minutes;
}
export function OvertimeInput({ initialMinutes }: { initialMinutes: number }) {
  const [value, setValue] = useState(
    `${Math.floor(initialMinutes / 60)}:${String(initialMinutes % 60).padStart(2, '0')}`,
  );
  let minutes = 0,
    error = '';
  try {
    minutes = parseOvertime(value);
  } catch (e) {
    error = e instanceof Error ? e.message : 'Revisa las horas';
  }
  const formatted = (n: number) => `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
  return (
    <div className="stack">
      <label>
        Cantidad de horas extra
        <input
          name="overtime_hours"
          type="text"
          inputMode="decimal"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="1,5 o 1:30"
          required
        />
      </label>
      <div className="row wrap">
        {[30, 60, 120].map((n) => (
          <button
            type="button"
            className="btn"
            key={n}
            onClick={() => setValue(formatted(Math.min(10080, minutes + n)))}
          >
            +{n === 30 ? '30 min' : `${n / 60} h`}
          </button>
        ))}
        <button type="button" className="btn ghost" onClick={() => setValue('0:00')}>
          Quitar HE
        </button>
      </div>
      {error ? (
        <p role="alert">{error}</p>
      ) : (
        <p className="notice">
          {Math.floor(minutes / 60)} h {minutes % 60} min · Adicional líquido:{' '}
          <strong>
            {new Intl.NumberFormat('es-CL', {
              style: 'currency',
              currency: 'CLP',
              maximumFractionDigits: 0,
            }).format(Math.round((minutes * OVERTIME_NET) / 60))}
          </strong>
        </p>
      )}
      <small className="muted">
        Puedes escribir 1,5 para una hora y media o usar los botones. Se guarda al minuto más
        cercano, nunca se deduce del turno planificado.
      </small>
    </div>
  );
}
