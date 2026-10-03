import { PlaceholderScreen } from '@/navigation/placeholder-screen';

export default function SettingsRoute() {
  return (
    <PlaceholderScreen
      title="Settings"
      screenId="9.6"
      links={[
        { label: 'Data and privacy', href: '/settings/privacy' },
        { label: 'Demo controls', href: '/settings/demo' },
      ]}
    />
  );
}
