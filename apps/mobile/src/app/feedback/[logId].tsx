import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function FeedbackRoute() {
  return (
    <PlaceholderScreen
      title="Nice and steady."
      screenId="7"
      links={[
        { label: 'Done', href: '/(tabs)', replace: true },
      ]}
    />
  );
}
