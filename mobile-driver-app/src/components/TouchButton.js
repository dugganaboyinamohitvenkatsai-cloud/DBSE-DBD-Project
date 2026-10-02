import React from 'react';
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export function TouchButton({
  title,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary', // 'primary' | 'secondary' | 'danger' | 'success' | 'outline' | 'subtle'
  icon,
  iconPosition = 'left',
  style,
  textStyle,
}) {
  const getBackgroundColor = () => {
    if (disabled) return '#CBD5E1';
    switch (variant) {
      case 'secondary':
        return '#334155';
      case 'danger':
        return COLORS.danger;
      case 'success':
        return COLORS.success;
      case 'outline':
      case 'subtle':
        return 'transparent';
      case 'primary':
      default:
        return COLORS.primary;
    }
  };

  const getBorderColor = () => {
    if (disabled) return '#CBD5E1';
    if (variant === 'outline') return COLORS.borderStrong;
    return 'transparent';
  };

  const getTextColor = () => {
    if (disabled) return '#94A3B8';
    if (variant === 'outline') return COLORS.text;
    if (variant === 'subtle') return COLORS.blue;
    return COLORS.textInverse;
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
          borderWidth: variant === 'outline' ? 1.5 : 0,
        },
        variant === 'outline' || variant === 'subtle' ? null : SHADOWS.sm,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.75}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? COLORS.primary : '#FFFFFF'} size="small" />
      ) : (
        <View style={styles.contentRow}>
          {icon && iconPosition === 'left' ? <View style={styles.iconLeft}>{icon}</View> : null}
          <Text style={[styles.text, { color: getTextColor() }, textStyle]}>{title}</Text>
          {icon && iconPosition === 'right' ? <View style={styles.iconRight}>{icon}</View> : null}
        </View>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 52,
    borderRadius: RADIUS.md,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 18,
    flexDirection: 'row',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: 0.4,
  },
  iconLeft: {
    marginRight: 8,
  },
  iconRight: {
    marginLeft: 8,
  },
});
