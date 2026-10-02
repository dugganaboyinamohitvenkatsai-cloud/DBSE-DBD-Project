import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, RADIUS } from '../constants/theme';

export function InputField({
  label,
  value,
  onChangeText,
  placeholder,
  secureTextEntry = false,
  keyboardType = 'default',
  autoCapitalize = 'none',
  error,
  leftIcon,
  rightIcon,
  onRightIconPress,
}) {
  const [isFocused, setIsFocused] = useState(false);

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.inputWrapper,
          isFocused ? styles.inputFocused : null,
          error ? styles.inputError : null,
        ]}
      >
        {leftIcon ? <View style={styles.leftIconWrapper}>{leftIcon}</View> : null}
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={COLORS.textMuted}
          secureTextEntry={secureTextEntry}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
        {rightIcon ? (
          <TouchableOpacity
            style={styles.rightIconButton}
            onPress={onRightIconPress}
            activeOpacity={0.7}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            {rightIcon}
          </TouchableOpacity>
        ) : null}
      </View>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.textSecondary,
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputWrapper: {
    minHeight: 52,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  inputFocused: {
    borderColor: COLORS.blue,
    backgroundColor: '#FFFFFF',
  },
  inputError: {
    borderColor: COLORS.danger,
    backgroundColor: COLORS.dangerLight,
  },
  leftIconWrapper: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: COLORS.text,
    paddingVertical: 12,
  },
  rightIconButton: {
    padding: 6,
  },
  errorText: {
    color: COLORS.danger,
    fontSize: 12,
    marginTop: 5,
    fontWeight: '600',
  },
});

export default InputField;
