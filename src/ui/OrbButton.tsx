// The main action button: a small turning sphere of particles. When the assistant is active
// (listening / working) the particles glide into an animated cross; tapping it then cancels.
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { Canvas, Circle, Points, useClock } from '@shopify/react-native-skia';
import { Easing, useDerivedValue, useSharedValue, withTiming, type SharedValue } from 'react-native-reanimated';

type Props = {
  size?: number;
  /** true -> particles form the cross (tap to cancel); false -> sphere (tap to talk) */
  active: boolean;
  onPress: () => void;
  /** optional 0..1 mic level: makes the sphere pulse while listening */
  level?: SharedValue<number>;
  disabled?: boolean;
};

const RINGS: [number, number][] = [[0.3, 7], [0.52, 12], [0.74, 18], [0.94, 24]]; // [radius fraction, dot count]
const BUCKETS = [
  { w: 1.6, o: 0.4 },
  { w: 2.4, o: 0.65 },
  { w: 3.2, o: 0.85 },
  { w: 4.0, o: 1 },
];

export function OrbButton({ size = 84, active, onPress, level, disabled }: Props) {
  const clock = useClock();
  const morph = useSharedValue(0);
  useEffect(() => {
    morph.value = withTiming(active ? 1 : 0, { duration: 520, easing: Easing.inOut(Easing.cubic) });
  }, [active, morph]);

  // Per-dot ring placement and its target place on the cross (two diagonals).
  const dots = useMemo(() => {
    const out: { ring: number; ang: number; dir: number; tx: number; ty: number }[] = [];
    const total = RINGS.reduce((n, r) => n + r[1], 0);
    let k = 0;
    RINGS.forEach(([frac, count], ri) => {
      for (let i = 0; i < count; i++, k++) {
        const line = k % 2;
        const s = ((k >> 1) / (total / 2 - 1)) * 2 - 1; // -1..1 along the diagonal
        out.push({
          ring: frac,
          ang: (2 * Math.PI * i) / count,
          dir: ri % 2 === 0 ? 1 : -1,
          tx: s * 0.36,
          ty: s * 0.36 * (line === 0 ? 1 : -1),
        });
      }
    });
    return out;
  }, []);

  const buckets = useDerivedValue(() => {
    'worklet';
    const t = clock.value / 1000;
    const c = size / 2;
    const R = c - 3;
    const e = morph.value;
    const lv = level ? level.value : 0;
    const out: { x: number; y: number }[][] = [[], [], [], []];
    for (let i = 0; i < dots.length; i++) {
      const d = dots[i];
      const spin = t * 1.75 * d.dir;
      const a = d.ang + spin * (1 - e) + e * 2.2 * d.dir; // dots swirl while they travel to the cross
      const rad = R * 0.86 * d.ring * (1 + 0.05 * Math.sin(2 * t * 1.75) + 0.1 * lv);
      const rx = c + rad * Math.cos(a);
      const ry = c + rad * Math.sin(a);
      const x = rx + (c + R * 2 * d.tx - rx) * e;
      const y = ry + (c + R * 2 * d.ty - ry) * e;
      const sweep = 0.5 + 0.5 * Math.cos(d.ang - spin);
      const b = sweep * (1 - e) + 0.95 * e;
      const bi = b > 0.8 ? 3 : b > 0.55 ? 2 : b > 0.3 ? 1 : 0;
      out[bi].push({ x, y });
    }
    return out;
  });

  const p0 = useDerivedValue(() => buckets.value[0]);
  const p1 = useDerivedValue(() => buckets.value[1]);
  const p2 = useDerivedValue(() => buckets.value[2]);
  const p3 = useDerivedValue(() => buckets.value[3]);
  const sets = [p0, p1, p2, p3];

  const c = size / 2;
  return (
    <Pressable onPress={onPress} disabled={disabled} style={[{ width: size, height: size, opacity: disabled ? 0.45 : 1 }, s.wrap]} hitSlop={8}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={c} cy={c} r={c - 1.5} color="#0B0704" opacity={0.85} />
        <Circle cx={c} cy={c} r={c - 1.5} color="#FF6A1A" opacity={0.6} style="stroke" strokeWidth={1.5} />
        {sets.map((pts, i) => (
          <Points key={i} points={pts} mode="points" color="#FFF4E6" opacity={BUCKETS[i].o} style="stroke" strokeWidth={BUCKETS[i].w} strokeCap="round" />
        ))}
      </Canvas>
    </Pressable>
  );
}

const s = StyleSheet.create({
  wrap: { shadowColor: '#FF5A00', shadowOpacity: 0.55, shadowRadius: 18, shadowOffset: { width: 0, height: 4 }, elevation: 10, borderRadius: 999 },
});
