import * as Haptics from 'expo-haptics';

export type HapticType = 
  | 'light' 
  | 'medium' 
  | 'heavy' 
  | 'success' 
  | 'warning' 
  | 'error' 
  | 'selection';

/**
 * Trigger haptic feedback
 */
export async function haptic(type: HapticType = 'light'): Promise<void> {
  switch (type) {
    case 'light':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      break;
    case 'medium':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      break;
    case 'heavy':
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
      break;
    case 'success':
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      break;
    case 'warning':
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      break;
    case 'error':
      await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      break;
    case 'selection':
      await Haptics.selectionAsync();
      break;
    default:
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/**
 * Create a haptic-enabled press handler
 */
export function withHaptic<T extends (...args: unknown[]) => unknown>(
  handler: T,
  type: HapticType = 'light'
): (...args: Parameters<T>) => Promise<Awaited<ReturnType<T>>> {
  const wrapped = async (...args: Parameters<T>): Promise<Awaited<ReturnType<T>>> => {
    await haptic(type);
    return (await handler(...args)) as Awaited<ReturnType<T>>;
  };

  return wrapped;
}

/**
 * Haptic feedback for button press
 */
export const hapticPress = () => haptic('light');

/**
 * Haptic feedback for selection
 */
export const hapticSelection = () => haptic('selection');

/**
 * Haptic feedback for success action
 */
export const hapticSuccess = () => haptic('success');

/**
 * Haptic feedback for error
 */
export const hapticError = () => haptic('error');

/**
 * Haptic feedback for warning
 */
export const hapticWarning = () => haptic('warning');
