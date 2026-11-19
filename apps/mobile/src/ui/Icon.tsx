import Feather from '@expo/vector-icons/Feather';
import type { ColorValue } from 'react-native';
import { colors } from '../theme/colors';

// Thin wrapper over Feather (visually close to the lucide set used on web/desktop).
// Kept as the single import site so the icon backend can be swapped in one place.
export type IconName = React.ComponentProps<typeof Feather>['name'];

export function Icon({
  name,
  size = 20,
  color = colors.text,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
}) {
  return <Feather name={name} size={size} color={color} />;
}
