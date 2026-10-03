import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function YouRoute() {
  return (
    <PlaceholderScreen
      title="You"
      screenId="9 / 9.1"
      tab
      links={[
        { label: 'How we see you', href: '/profile/summary' },
        { label: 'Edit time answers', href: routes.profileEdit('time') },
        { label: 'Your feedback', href: '/profile/feedback' },
        { label: 'Settings', href: '/settings' },
      ]}
    />
  );
}
