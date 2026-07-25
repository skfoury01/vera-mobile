import { VeraScreen } from '@/components/vera-screen';

export default function AccountScreen() {
  return (
    <VeraScreen
      eyebrow="Account"
      title="Your mobile identity hub."
      body="Profile, billing, security, and creator tools will live here after native auth and account endpoints are verified."
      symbol="person.crop.circle.fill"
      highlights={[
        { value: 'Vera', label: 'Display name' },
        { value: 'Secure', label: 'Token storage' },
        { value: 'No', label: 'Server secrets' },
      ]}
    />
  );
}
