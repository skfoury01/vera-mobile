import { VeraScreen } from '@/components/vera-screen';

export default function DiscoverScreen() {
  return (
    <VeraScreen
      eyebrow="Discover"
      title="Find creators with signal, not noise."
      body="A future surface for curated rooms, fresh posts, live sessions, and creator recommendations."
      symbol="sparkle.magnifyingglass"
      highlights={[
        { value: 'New', label: 'Creators' },
        { value: 'Live', label: 'Moments' },
        { value: 'Soon', label: 'Search' },
      ]}
    />
  );
}
