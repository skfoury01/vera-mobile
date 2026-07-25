import { VeraScreen } from '@/components/vera-screen';

export default function NotificationsScreen() {
  return (
    <VeraScreen
      eyebrow="Notifications"
      title="Updates worth returning for."
      body="A placeholder for subscription alerts, message badges, creator activity, and account notices."
      symbol="bell.fill"
      highlights={[
        { value: '0', label: 'Unread' },
        { value: 'Quiet', label: 'Defaults' },
        { value: 'Ready', label: 'Badge route' },
      ]}
    />
  );
}
