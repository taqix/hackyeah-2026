import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function ReviewRoute() {
  return (
    <PlaceholderScreen
      title="Review your answers"
      screenId="4"
      links={[
        { label: 'Build my plan', href: '/(tabs)', replace: true },
      ]}
    />
  );
}
