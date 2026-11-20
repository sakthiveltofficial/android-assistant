import { StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

type Tone = 'orange' | 'amber' | 'dim';

const TONES: Record<Tone, [string, string, string]> = {
  // matches the three states in the design: listening (deep orange), transcript (amber), paused (dark)
  orange: ['rgba(120,45,0,0)', 'rgba(105,40,0,0.55)', 'rgba(150,62,0,0.95)'],
  amber: ['rgba(120,80,0,0)', 'rgba(120,80,0,0.5)', 'rgba(150,100,0,0.95)'],
  dim: ['rgba(80,30,0,0)', 'rgba(60,25,0,0.45)', 'rgba(70,32,0,0.9)'],
};

export function BottomGlow({ tone = 'orange', height = 320 }: { tone?: Tone; height?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={TONES[tone]}
      locations={[0, 0.55, 1]}
      style={[styles.glow, { height }]}
    />
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute', left: 0, right: 0, bottom: 0 },
});
