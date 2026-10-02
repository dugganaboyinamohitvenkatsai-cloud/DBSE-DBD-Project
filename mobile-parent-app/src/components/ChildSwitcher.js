import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { User } from 'lucide-react-native';
import { COLORS, RADIUS, SHADOWS } from '../constants/theme';

export function ChildSwitcher({
  children,
  childrenList,
  students,
  selectedIndex,
  activeChildId,
  onSelectChild,
}) {
  const list = childrenList || students || children || [];
  if (!list || list.length <= 1) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.eyebrow}>MONITORED STUDENT</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {list.map((item, idx) => {
          const student = item.student || item;
          const childId = student.student_id || student.id || idx;
          const isSelected =
            selectedIndex !== undefined
              ? selectedIndex === idx
              : activeChildId !== undefined
              ? activeChildId === childId
              : idx === 0;

          return (
            <TouchableOpacity
              key={childId}
              style={[styles.pill, isSelected ? styles.pillSelected : null]}
              onPress={() => onSelectChild && onSelectChild(childId !== undefined ? childId : idx)}
              activeOpacity={0.7}
            >
              <User
                size={14}
                color={isSelected ? '#FFFFFF' : COLORS.textSecondary}
                strokeWidth={2.4}
              />
              <Text style={[styles.pillText, isSelected ? styles.pillTextSelected : null]}>
                {student.name || 'Student'} ({student.class || student.class_grade || '—'})
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
}

export default ChildSwitcher;

const styles = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: '800',
    color: COLORS.textSecondary,
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  scroll: {
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.surface,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: RADIUS.full,
    ...SHADOWS.sm,
  },
  pillSelected: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  pillText: {
    fontSize: 12,
    fontWeight: '800',
    color: COLORS.text,
  },
  pillTextSelected: {
    color: '#FFFFFF',
  },
});
