import { NativeTabs } from 'expo-router/unstable-native-tabs';

const colors = {
  background: '#08050C',
  elevated: '#160C1E',
  active: '#F8F5FC',
  muted: '#95899F',
  indicator: '#321A42',
  accent: '#B56CFF',
};

export default function TabsLayout() {
  return (
    <NativeTabs
      backgroundColor={colors.background}
      iconColor={{ default: colors.muted, selected: colors.accent }}
      indicatorColor={colors.indicator}
      labelStyle={{
        default: { color: colors.muted },
        selected: { color: colors.active },
      }}
      rippleColor={colors.elevated}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'house', selected: 'house.fill' }}
          md={{ default: 'home', selected: 'home' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="discover">
        <NativeTabs.Trigger.Label>Discover</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'sparkle.magnifyingglass', selected: 'sparkle.magnifyingglass' }}
          md={{ default: 'travel_explore', selected: 'travel_explore' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="messages">
        <NativeTabs.Trigger.Label>Messages</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bubble.left.and.bubble.right', selected: 'bubble.left.and.bubble.right.fill' }}
          md={{ default: 'chat_bubble', selected: 'chat_bubble' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="notifications">
        <NativeTabs.Trigger.Label>Notifications</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'bell', selected: 'bell.fill' }}
          md={{ default: 'notifications', selected: 'notifications' }}
        />
      </NativeTabs.Trigger>

      <NativeTabs.Trigger name="account">
        <NativeTabs.Trigger.Label>Account</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'person.crop.circle', selected: 'person.crop.circle.fill' }}
          md={{ default: 'account_circle', selected: 'account_circle' }}
        />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
