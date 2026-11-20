// Halftone ring "orb" from the design: a grid of white dots whose size follows a ring profile
// modulated by moving noise. Drawn with Skia; dots are bucketed by size so only 4 draw calls run.
import { useMemo } from 'react';
import { Canvas, Points, vec } from '@shopify/react-native-skia';
import { useClock } from '@shopify/react-native-skia';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

type Props = {
  size?: number;
  /** 0..1 microphone level; pulses the ring while listening */
  level: SharedValue<number>;
  /** 'thinking' spins the highlight faster and breathes the ring */
  mode?: 'idle' | 'listening' | 'thinking';
};

const SPACING = 6;
// strokeWidth (dot diameter) and opacity per bucket, small -> large
const BUCKETS = [
  { w: 1.3, o: 0.35 },
  { w: 2.0, o: 0.55 },
  { w: 2.9, o: 0.8 },
  { w: 3.8, o: 1 },
];

export function Orb({ size = 300, level, mode = 'listening' }: Props) {
  const clock = useClock();
  const cells = useMemo(() => {
    const n = Math.floor(size / SPACING);
    const off = (size - (n - 1) * SPACING) / 2;
    const out: number[] = [];
    for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) out.push(off + i * SPACING, off + j * SPACING);
    return out;
  }, [size]);

  const buckets = useDerivedValue(() => {
    'worklet';
    const t = clock.value / 1000;
    const c = size / 2;
    const lv = level.value;
    const thinking = mode === 'thinking';
    const breathe = thinking ? 0.04 * Math.sin(t * 2.2) : 0;
    const R = size * (0.335 + 0.03 * lv + breathe);
    const w = size * (0.085 + 0.03 * lv);
    const spin = t * (thinking ? 1.6 : 0.35);
    const out: { x: number; y: number }[][] = [[], [], [], []];
    for (let k = 0; k < cells.length; k += 2) {
      const x = cells[k];
      const y = cells[k + 1];
      const dx = x - c;
      const dy = y - c;
      const r = Math.sqrt(dx * dx + dy * dy);
      const d = (r - R) / w;
      if (d > 2.4 || d < -2.4) continue;
      const prof = Math.exp(-d * d);
      const ang = Math.atan2(dy, dx);
      const n =
        0.5 * Math.sin(x * 0.11 + t * 0.9) +
        0.5 * Math.sin(y * 0.13 - t * 0.7) +
        0.5 * Math.sin((x + y) * 0.07 + t * 1.3);
      const bias = 0.28 * Math.cos(ang - (-0.9 + spin));
      const v = prof * (0.62 + 0.3 * (n / 1.5) + bias + 0.25 * lv);
      let b = -1;
      if (v > 0.8) b = 3;
      else if (v > 0.56) b = 2;
      else if (v > 0.32) b = 1;
      else if (v > 0.14) b = 0;
      if (b >= 0) out[b].push({ x, y });
    }
    return out;
  });

  const p0 = useDerivedValue(() => buckets.value[0]);
  const p1 = useDerivedValue(() => buckets.value[1]);
  const p2 = useDerivedValue(() => buckets.value[2]);
  const p3 = useDerivedValue(() => buckets.value[3]);
  const sets = [p0, p1, p2, p3];

  return (
    <Canvas style={{ width: size, height: size }}>
      {sets.map((pts, i) => (
        <Points
          key={i}
          points={pts}
          mode="points"
          color="white"
          opacity={BUCKETS[i].o}
          style="stroke"
          strokeWidth={BUCKETS[i].w}
          strokeCap="round"
        />
      ))}
    </Canvas>
  );
}

export { vec };
