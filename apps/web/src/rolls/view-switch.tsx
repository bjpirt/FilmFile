/** The layout the rolls are shown in. */
export type RollsView = 'grid' | 'list';

function Icon({ view }: { readonly view: RollsView }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {view === 'grid' ? (
        <>
          <rect x="4" y="4" width="7" height="7" rx="1" />
          <rect x="13" y="4" width="7" height="7" rx="1" />
          <rect x="4" y="13" width="7" height="7" rx="1" />
          <rect x="13" y="13" width="7" height="7" rx="1" />
        </>
      ) : (
        <path d="M4 6h16M4 12h16M4 18h16" />
      )}
    </svg>
  );
}

/** Grid | List, as two icons, named for screen readers and on hover. */
export function ViewSwitch({
  view,
  show,
}: {
  readonly view: RollsView;
  readonly show: (view: RollsView) => void;
}) {
  return (
    <div role="group" aria-label="View" className="segmented">
      {(['grid', 'list'] as const).map((option) => {
        const name = option === 'grid' ? 'Grid' : 'List';
        return (
          <button
            key={option}
            type="button"
            aria-label={name}
            title={name}
            aria-pressed={view === option}
            onClick={() => {
              show(option);
            }}
          >
            <Icon view={option} />
          </button>
        );
      })}
    </div>
  );
}
