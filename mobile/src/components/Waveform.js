// Purpose: Animated bar waveform shown while recording (mirrors the M-02 .waveform).
// Pure presentational — no recording logic. When `active` is false the bars rest flat.
// Props: { active }

import React, { useEffect, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';

const TEAL = '#0a8f8f';
const BAR_COUNT = 24;

export function Waveform({ active }) {
  // One Animated.Value per bar; staggered looping pulse while active.
  const bars = useRef(
    Array.from({ length: BAR_COUNT }, () => new Animated.Value(0.2))
  ).current;

  useEffect(() => {
    if (!active) {
      bars.forEach((b) => b.setValue(0.2));
      return;
    }
    const loops = bars.map((b, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay((i % 6) * 80),
          Animated.timing(b, { toValue: 1, duration: 350, useNativeDriver: false }),
          Animated.timing(b, { toValue: 0.25, duration: 350, useNativeDriver: false }),
        ])
      )
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [active, bars]);

  return (
    <View style={styles.row}>
      {bars.map((b, i) => (
        <Animated.View
          key={i}
          style={[
            styles.bar,
            {
              transform: [{ scaleY: b }],
              opacity: active ? 1 : 0.35,
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 80,
    gap: 4,
  },
  bar: {
    width: 5,
    height: 60,
    borderRadius: 3,
    backgroundColor: TEAL,
  },
});
