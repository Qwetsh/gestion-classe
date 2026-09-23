import { useAuth } from '../../../hooks/useAuth';
import { BoardsPanel } from '../../classroom/BoardsPanel';

export function BoardsModule() {
  const { user } = useAuth();
  if (!user) return null;
  return <BoardsPanel userId={user.id} />;
}
