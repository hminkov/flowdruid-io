import { Avatar } from './Avatar';

type User = { id: string; initials: string; name: string };

export function AvatarStack({
  users,
  size = 24,
  max = 5,
  onClickUser,
}: {
  users: User[];
  size?: number;
  max?: number;
  onClickUser?: (id: string) => void;
}) {
  const shown = users.slice(0, max);
  const overflow = users.length - shown.length;

  return (
    <div className="flex -space-x-1.5">
      {shown.map((u) => {
        if (onClickUser) {
          return (
            <button
              key={u.id}
              type="button"
              title={`View ${u.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onClickUser(u.id);
              }}
              onPointerDown={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              className="relative transition-transform duration-fast hover:z-10 hover:scale-110 focus-visible:z-10 focus-visible:scale-110"
            >
              <Avatar userId={u.id} initials={u.initials} name={u.name} size={size} ring />
            </button>
          );
        }
        return <Avatar key={u.id} userId={u.id} initials={u.initials} name={u.name} size={size} ring />;
      })}
      {overflow > 0 && (
        <span
          className="flex items-center justify-center rounded-full bg-surface-secondary text-[10px] text-text-tertiary ring-2 ring-surface-primary"
          style={{ width: size, height: size }}
        >
          +{overflow}
        </span>
      )}
    </div>
  );
}
