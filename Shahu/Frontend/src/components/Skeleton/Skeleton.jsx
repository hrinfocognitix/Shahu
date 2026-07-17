import Skeleton from 'react-loading-skeleton';
import 'react-loading-skeleton/dist/skeleton.css';

export function SkeletonBlock({ count = 3 }) {
  return <Skeleton count={count} height={48} borderRadius={8} />;
}
