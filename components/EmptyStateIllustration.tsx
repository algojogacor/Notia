import React, { useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import Svg, {
  Path,
  Rect,
  Circle,
  G,
  Defs,
  LinearGradient,
  Stop,
} from 'react-native-svg';
import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';

export type EmptyStateVariant =
  | 'notes'
  | 'search'
  | 'trash'
  | 'flashcard'
  | 'topic';

export interface EmptyStateIllustrationProps {
  variant: EmptyStateVariant;
  message: string;
  subMessage?: string;
  action?: {
    label: string;
    onPress: () => void;
  };
}

export default function EmptyStateIllustration({
  variant,
  message,
  subMessage,
  action,
}: EmptyStateIllustrationProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  // Slow, calm breathing float animation (up & down)
  const floatY = useSharedValue(0);

  useEffect(() => {
    floatY.value = withRepeat(
      withTiming(-8, {
        duration: 2600,
        easing: Easing.inOut(Easing.sin),
      }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: floatY.value }],
    };
  });

  const isDark = colorScheme === 'dark';
  const strokeColor = isDark ? '#d4cbbe' : '#2c251e';
  const paperFill = isDark ? '#2a241c' : '#fcfaf6';
  const paperBorder = isDark ? '#473d30' : '#e6decb';
  const accentInk = theme.tint; // Living notebook primary ink
  const subtleInk = isDark ? '#7a6f5e' : '#b2a694';

  const renderSvg = () => {
    switch (variant) {
      case 'notes':
        return (
          <Svg width="150" height="130" viewBox="0 0 150 130" fill="none">
            <Defs>
              <LinearGradient id="inkGrad" x1="0" y1="0" x2="1" y2="1">
                <Stop offset="0%" stopColor={accentInk} stopOpacity="0.8" />
                <Stop offset="100%" stopColor={accentInk} stopOpacity="0.1" />
              </LinearGradient>
            </Defs>
            {/* Ink spill pool underneath */}
            <Path
              d="M35 105 C50 100, 80 102, 115 106 C125 107, 130 114, 115 116 C85 120, 45 118, 30 114 C20 111, 25 108, 35 105 Z"
              fill={isDark ? '#332b21' : '#ede5d5'}
            />
            {/* Open notebook back cover */}
            <Rect
              x="28"
              y="38"
              width="94"
              height="68"
              rx="6"
              fill={isDark ? '#231d16' : '#ded4c0'}
              stroke={paperBorder}
              strokeWidth="1.5"
            />
            {/* Left Page */}
            <Path
              d="M34 42 C45 40, 70 41, 74 44 L74 96 C70 93, 45 92, 34 94 Z"
              fill={paperFill}
              stroke={paperBorder}
              strokeWidth="1.5"
            />
            {/* Right Page */}
            <Path
              d="M76 44 C80 41, 105 40, 116 42 L116 94 C105 92, 80 93, 76 96 Z"
              fill={paperFill}
              stroke={paperBorder}
              strokeWidth="1.5"
            />
            {/* Spine seam thread */}
            <Path
              d="M75 42 L75 96"
              stroke={accentInk}
              strokeWidth="2"
              strokeDasharray="2,2"
            />
            {/* Ruled lines left page */}
            <Path d="M42 54 L66 54" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            <Path d="M42 63 L68 63" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            <Path d="M42 72 L62 72" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            <Path d="M42 81 L65 81" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            {/* Ruled lines right page */}
            <Path d="M82 54 L108 54" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            <Path d="M82 63 L104 63" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            <Path d="M82 72 L106 72" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            {/* Feather Quill Pen dipping in ink */}
            <G transform="rotate(18 100 35)">
              <Path
                d="M102 12 C108 24, 114 42, 103 62 C101 65, 99 66, 98 68 L97 73 L99 67 C100 63, 102 54, 98 44 C96 39, 94 28, 102 12 Z"
                fill="url(#inkGrad)"
                stroke={accentInk}
                strokeWidth="1.4"
              />
              <Path d="M102 12 L97 73" stroke={accentInk} strokeWidth="1.2" />
            </G>
            {/* Floating ink drops & sparkles */}
            <Circle cx="120" cy="30" r="2.5" fill={accentInk} />
            <Circle cx="128" cy="42" r="1.5" fill={accentInk} />
            <Circle cx="26" cy="50" r="2" fill={subtleInk} />
          </Svg>
        );

      case 'search':
        return (
          <Svg width="150" height="130" viewBox="0 0 150 130" fill="none">
            {/* Rolled manuscript scroll */}
            <Path
              d="M32 75 C32 68, 40 65, 48 65 L106 65 C114 65, 122 68, 122 75 L122 96 C122 103, 114 106, 106 106 L48 106 C40 106, 32 103, 32 96 Z"
              fill={paperFill}
              stroke={paperBorder}
              strokeWidth="1.6"
            />
            {/* Scroll curled ends */}
            <Path
              d="M32 75 C26 75, 24 82, 24 87 C24 93, 28 98, 34 98 L34 75"
              fill={isDark ? '#332b21' : '#ede5d5'}
              stroke={paperBorder}
              strokeWidth="1.4"
            />
            <Path
              d="M120 75 C126 75, 128 82, 128 87 C128 93, 124 98, 118 98 L118 75"
              fill={isDark ? '#332b21' : '#ede5d5'}
              stroke={paperBorder}
              strokeWidth="1.4"
            />
            {/* Text lines inside scroll */}
            <Path d="M42 78 L80 78" stroke={subtleInk} strokeWidth="1.3" strokeLinecap="round" />
            <Path d="M42 86 L72 86" stroke={subtleInk} strokeWidth="1.3" strokeLinecap="round" />
            <Path d="M42 94 L85 94" stroke={subtleInk} strokeWidth="1.3" strokeLinecap="round" />

            {/* Brass Magnifying Monocle / Glass */}
            <G transform="translate(10, -4)">
              {/* Glass Lens */}
              <Circle
                cx="78"
                cy="48"
                r="26"
                fill={isDark ? '#3b3226' : '#fff9ee'}
                fillOpacity="0.85"
                stroke={accentInk}
                strokeWidth="3"
              />
              <Circle
                cx="78"
                cy="48"
                r="22"
                stroke={isDark ? '#5a4d3b' : '#d8cbb5'}
                strokeWidth="1"
                strokeDasharray="3,2"
              />
              {/* Monocle Handle */}
              <Path
                d="M97 66 L118 87 C120 89, 120 92, 118 94 C116 96, 113 96, 111 94 L90 73"
                fill={accentInk}
                stroke={strokeColor}
                strokeWidth="1.5"
              />
              {/* Lens highlight */}
              <Path
                d="M66 38 C70 34, 78 33, 84 35"
                stroke="#FFFFFF"
                strokeWidth="2"
                strokeLinecap="round"
                strokeOpacity="0.7"
              />
            </G>

            {/* Searching ink droplets */}
            <Circle cx="36" cy="42" r="2" fill={accentInk} />
            <Circle cx="126" cy="38" r="3" fill={accentInk} />
            <Circle cx="134" cy="50" r="1.5" fill={subtleInk} />
          </Svg>
        );

      case 'trash':
        return (
          <Svg width="150" height="130" viewBox="0 0 150 130" fill="none">
            {/* Basket Shadow */}
            <Path
              d="M45 112 C55 110, 95 110, 105 112 C112 113, 110 118, 98 119 C82 120, 68 120, 52 119 C40 118, 38 113, 45 112 Z"
              fill={isDark ? '#332b21' : '#ede5d5'}
            />
            {/* Wire Waste-Paper Basket */}
            <Path
              d="M46 62 L55 112 L95 112 L104 62 Z"
              fill={paperFill}
              stroke={paperBorder}
              strokeWidth="2"
            />
            {/* Basket Top Rim */}
            <Rect
              x="42"
              y="58"
              width="66"
              height="6"
              rx="3"
              fill={isDark ? '#3d3326' : '#d8cbb5'}
              stroke={paperBorder}
              strokeWidth="1.2"
            />
            {/* Wire cross grid on basket */}
            <Path d="M52 64 L59 110" stroke={subtleInk} strokeWidth="1" strokeDasharray="3,2" />
            <Path d="M65 64 L68 110" stroke={subtleInk} strokeWidth="1" strokeDasharray="3,2" />
            <Path d="M85 64 L82 110" stroke={subtleInk} strokeWidth="1" strokeDasharray="3,2" />
            <Path d="M98 64 L91 110" stroke={subtleInk} strokeWidth="1" strokeDasharray="3,2" />
            <Path d="M49 76 L101 76" stroke={subtleInk} strokeWidth="1" strokeDasharray="3,2" />
            <Path d="M52 92 L98 92" stroke={subtleInk} strokeWidth="1" strokeDasharray="3,2" />

            {/* Crumpled Parchment Ball hovering out */}
            <G transform="translate(60, 32)">
              <Path
                d="M10 2 C16 0, 24 5, 27 12 C30 19, 26 27, 19 30 C12 33, 4 29, 2 22 C-1 15, 3 4, 10 2 Z"
                fill={isDark ? '#3d3428' : '#fffdf9'}
                stroke={accentInk}
                strokeWidth="1.6"
              />
              <Path d="M6 10 C12 14, 18 8, 24 14" stroke={subtleInk} strokeWidth="1" />
              <Path d="M8 20 C14 18, 18 24, 23 20" stroke={subtleInk} strokeWidth="1" />
              <Path d="M14 4 L14 26" stroke={subtleInk} strokeWidth="1" strokeDasharray="2,2" />
            </G>

            {/* Faint floating paper scraps */}
            <Rect x="30" y="38" width="12" height="15" rx="2" transform="rotate(-25 30 38)" fill={paperFill} stroke={paperBorder} strokeWidth="1" />
            <Circle cx="120" cy="65" r="2.5" fill={accentInk} />
            <Circle cx="128" cy="78" r="1.5" fill={subtleInk} />
          </Svg>
        );

      case 'flashcard':
        return (
          <Svg width="150" height="130" viewBox="0 0 150 130" fill="none">
            {/* Back flashcard (depth) */}
            <Rect
              x="42"
              y="28"
              width="66"
              height="84"
              rx="8"
              transform="rotate(14 75 70)"
              fill={isDark ? '#231d16' : '#e2d7c3'}
              stroke={paperBorder}
              strokeWidth="1.5"
            />
            {/* Middle flashcard */}
            <Rect
              x="42"
              y="28"
              width="66"
              height="84"
              rx="8"
              transform="rotate(-8 75 70)"
              fill={isDark ? '#2c251d' : '#ede3cf'}
              stroke={paperBorder}
              strokeWidth="1.5"
            />
            {/* Front Main flashcard */}
            <Rect
              x="42"
              y="26"
              width="66"
              height="84"
              rx="8"
              fill={paperFill}
              stroke={accentInk}
              strokeWidth="2"
            />
            {/* Card Header Hairline */}
            <Rect x="44" y="28" width="62" height="5" fill={accentInk} opacity="0.85" rx="2" />

            {/* Question Mark Calligraphy */}
            <Path
              d="M71 52 C71 47, 75 44, 79 44 C84 44, 87 47, 86 52 C85 57, 79 59, 78 64 L78 67"
              stroke={strokeColor}
              strokeWidth="2.5"
              strokeLinecap="round"
            />
            <Circle cx="78" cy="74" r="1.8" fill={strokeColor} />

            {/* Card lines below */}
            <Path d="M54 84 L96 84" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            <Path d="M58 92 L92 92" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />

            {/* Bookmark ribbon hanging off corner */}
            <Path
              d="M48 26 L48 42 L53 38 L58 42 L58 26 Z"
              fill="#D97706"
            />

            {/* Ink sparkles */}
            <Path
              d="M122 34 L124 28 L126 34 L132 36 L126 38 L124 44 L122 38 L116 36 Z"
              fill={accentInk}
            />
            <Circle cx="28" cy="46" r="2.5" fill="#D97706" />
            <Circle cx="34" cy="36" r="1.5" fill={subtleInk} />
          </Svg>
        );

      case 'topic':
        return (
          <Svg width="150" height="130" viewBox="0 0 150 130" fill="none">
            {/* Manuscript folder tab back */}
            <Path
              d="M30 42 L65 42 L72 48 L120 48 C124 48, 126 51, 126 55 L126 102 C126 106, 123 109, 119 109 L31 109 C27 109, 24 106, 24 102 L24 48 C24 44, 27 42, 30 42 Z"
              fill={isDark ? '#262018' : '#ded3bd'}
              stroke={paperBorder}
              strokeWidth="1.5"
            />
            {/* Sheets inside folder */}
            <Rect
              x="32"
              y="36"
              width="86"
              height="60"
              rx="4"
              fill={paperFill}
              stroke={paperBorder}
              strokeWidth="1.2"
            />
            <Path d="M42 46 L76 46" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            <Path d="M42 54 L98 54" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />
            <Path d="M42 62 L88 62" stroke={subtleInk} strokeWidth="1.2" strokeLinecap="round" />

            {/* Folder Front flap */}
            <Path
              d="M24 58 L58 58 L66 65 L126 65 L126 102 C126 106, 123 109, 119 109 L31 109 C27 109, 24 106, 24 102 Z"
              fill={isDark ? '#30281e' : '#f0e6d2'}
              stroke={accentInk}
              strokeWidth="1.8"
            />

            {/* Red Wax Seal Stamp */}
            <Circle
              cx="98"
              cy="86"
              r="12"
              fill="#DC2626"
              stroke="#B91C1C"
              strokeWidth="1.5"
            />
            <Circle
              cx="98"
              cy="86"
              r="9"
              fill="#EF4444"
              stroke="#991B1B"
              strokeWidth="1"
              strokeDasharray="2,1"
            />
            <Path
              d="M95 82 L101 82 L98 90 Z"
              fill="#FFFFFF"
              opacity="0.8"
            />

            {/* Ink droplets */}
            <Circle cx="20" cy="40" r="2.5" fill={accentInk} />
            <Circle cx="132" cy="58" r="2" fill={subtleInk} />
          </Svg>
        );
    }
  };

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.illustrationWrapper, animatedStyle]}>
        {renderSvg()}
      </Animated.View>

      <Text
        style={[
          styles.message,
          {
            color: theme.text,
            fontFamily: Platform.OS === 'ios' ? 'Georgia' : 'serif',
          },
        ]}>
        {message}
      </Text>

      {subMessage ? (
        <Text style={[styles.subMessage, { color: theme.subtext }]}>
          {subMessage}
        </Text>
      ) : null}

      {action ? (
        <TouchableOpacity
          style={[styles.actionBtn, { backgroundColor: theme.tint }]}
          activeOpacity={0.8}
          onPress={action.onPress}>
          <Text style={styles.actionBtnText}>{action.label}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 24,
  },
  illustrationWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  message: {
    fontSize: 17,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 8,
    lineHeight: 24,
  },
  subMessage: {
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    maxWidth: 290,
    marginBottom: 20,
  },
  actionBtn: {
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 10,
    marginTop: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },
  actionBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 13.5,
  },
});
