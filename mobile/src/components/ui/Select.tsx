import React, { memo, useCallback, useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  FlatList,
  StyleSheet,
  ViewStyle,
  TextStyle,
  Pressable,
  Dimensions,
  LayoutChangeEvent,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/theme/ThemeProvider';

export interface SelectOption<T = string> {
  label: string;
  value: T;
  icon?: React.ReactNode;
  disabled?: boolean;
}

interface SelectProps<T = string> {
  options: SelectOption<T>[];
  value?: T;
  onChange?: (value: T) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  disabled?: boolean;
  containerStyle?: ViewStyle;
  accessibilityLabel?: string;
}

function SelectComponent<T = string>({
  options,
  value,
  onChange,
  placeholder = 'Select an option',
  label,
  error,
  disabled = false,
  containerStyle,
  accessibilityLabel,
}: SelectProps<T>) {
  const { theme } = useTheme();
  const [isOpen, setIsOpen] = useState(false);
  const [triggerLayout, setTriggerLayout] = useState({ width: 0, x: 0, y: 0 });

  const selectedOption = options.find((opt) => opt.value === value);

  const handleOpen = useCallback(() => {
    if (!disabled) {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setIsOpen(true);
    }
  }, [disabled]);

  const handleClose = useCallback(() => {
    setIsOpen(false);
  }, []);

  const handleSelect = useCallback(
    (option: SelectOption<T>) => {
      if (!option.disabled) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onChange?.(option.value);
        setIsOpen(false);
      }
    },
    [onChange]
  );

  const handleLayout = useCallback((event: LayoutChangeEvent) => {
    const { width, x, y, height } = event.nativeEvent.layout;
    setTriggerLayout({ width, x, y: y + height });
  }, []);

  const triggerStyle: ViewStyle = {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: theme.colors.input,
    borderWidth: theme.borderWidths.base,
    borderColor: error ? theme.colors.destructive : theme.colors.border,
    paddingHorizontal: theme.spacing[3],
    paddingVertical: theme.spacing[3],
    minHeight: theme.touchTargets.comfortable,
    opacity: disabled ? 0.5 : 1,
  };

  const labelStyle: TextStyle = {
    fontFamily: theme.typography.fonts.bold,
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.foreground,
    textTransform: 'uppercase',
    letterSpacing: theme.typography.letterSpacing.wide,
    marginBottom: theme.spacing[1],
  };

  const valueStyle: TextStyle = {
    fontFamily: theme.typography.fonts.regular,
    fontSize: theme.typography.sizes.base,
    color: selectedOption ? theme.colors.foreground : theme.colors.mutedForeground,
    flex: 1,
  };

  const renderOption = useCallback(
    ({ item }: { item: SelectOption<T> }) => {
      const isSelected = item.value === value;
      const optionStyle: ViewStyle = {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[3],
        minHeight: theme.touchTargets.comfortable,
        backgroundColor: isSelected ? theme.colors.primary : theme.colors.card,
        borderBottomWidth: 1,
        borderBottomColor: theme.colors.border,
        opacity: item.disabled ? 0.5 : 1,
        gap: theme.spacing[2],
      };

      const optionTextStyle: TextStyle = {
        fontFamily: theme.typography.fonts.regular,
        fontSize: theme.typography.sizes.base,
        color: isSelected ? theme.colors.primaryForeground : theme.colors.foreground,
        flex: 1,
      };

      return (
        <TouchableOpacity
          style={optionStyle}
          onPress={() => handleSelect(item)}
          disabled={item.disabled}
          accessibilityRole="menuitem"
          accessibilityState={{ selected: isSelected, disabled: item.disabled }}
        >
          {item.icon}
          <Text style={optionTextStyle}>{item.label}</Text>
          {isSelected && (
            <Ionicons
              name="checkmark"
              size={20}
              color={theme.colors.primaryForeground}
            />
          )}
        </TouchableOpacity>
      );
    },
    [value, theme, handleSelect]
  );

  return (
    <View style={containerStyle}>
      {label && <Text style={labelStyle}>{label}</Text>}
      
      <TouchableOpacity
        style={triggerStyle}
        onPress={handleOpen}
        onLayout={handleLayout}
        disabled={disabled}
        accessibilityRole="combobox"
        accessibilityLabel={accessibilityLabel || label}
        accessibilityState={{ expanded: isOpen, disabled }}
      >
        <Text style={valueStyle} numberOfLines={1}>
          {selectedOption?.label || placeholder}
        </Text>
        <Ionicons
          name={isOpen ? 'chevron-up' : 'chevron-down'}
          size={20}
          color={theme.colors.foreground}
        />
      </TouchableOpacity>

      {error && (
        <Text
          style={{
            fontFamily: theme.typography.fonts.regular,
            fontSize: theme.typography.sizes.xs,
            color: theme.colors.destructive,
            marginTop: theme.spacing[1],
          }}
        >
          {error}
        </Text>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType="none"
        onRequestClose={handleClose}
      >
        <Pressable
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.5)',
            justifyContent: 'flex-end',
          }}
          onPress={handleClose}
        >
          <Animated.View
            entering={SlideInDown.duration(200)}
            exiting={SlideOutDown.duration(150)}
            style={{
              backgroundColor: theme.colors.card,
              borderTopWidth: theme.borderWidths.thick,
              borderColor: theme.colors.border,
              maxHeight: Dimensions.get('window').height * 0.5,
            }}
          >
            <View
              style={{
                paddingHorizontal: theme.spacing[4],
                paddingVertical: theme.spacing[3],
                borderBottomWidth: theme.borderWidths.base,
                borderBottomColor: theme.colors.border,
                backgroundColor: theme.colors.muted,
              }}
            >
              <Text
                style={{
                  fontFamily: theme.typography.fonts.heading,
                  fontSize: theme.typography.sizes.md,
                  color: theme.colors.foreground,
                  textTransform: 'uppercase',
                  letterSpacing: theme.typography.letterSpacing.wide,
                }}
              >
                {label || 'Select Option'}
              </Text>
            </View>
            <FlatList
              data={options}
              renderItem={renderOption}
              keyExtractor={(item, index) => `${item.value}-${index}`}
              showsVerticalScrollIndicator={false}
            />
          </Animated.View>
        </Pressable>
      </Modal>
    </View>
  );
}

export const Select = memo(SelectComponent) as typeof SelectComponent;
