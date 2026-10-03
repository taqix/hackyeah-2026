import { PlaceholderScreen } from '@/navigation/placeholder-screen';
import { routes } from '@/navigation/routes';

export default function GymReviewRoute() {
  return (
    <PlaceholderScreen
      title="What you did"
      screenId="6.8"
      links={[
        { label: 'Save', href: routes.feedback('demo-log') },
      ]}
    />
  );
}
