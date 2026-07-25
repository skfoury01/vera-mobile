import { VeraScreen } from '@/components/vera-screen';

export default function MessagesScreen() {
  return (
    <VeraScreen
      eyebrow="Messages"
      title="Private threads, designed for focus."
      body="This tab will hold Vera conversations, unlock flows, read states, and direct creator updates once the API contract lands."
      symbol="bubble.left.and.bubble.right.fill"
      highlights={[
        { value: '0', label: 'Open threads' },
        { value: 'Safe', label: 'No cookies copied' },
        { value: 'Next', label: 'Native token' },
      ]}
    />
  );
}
