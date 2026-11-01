import { CLASS_INFO, STYLE_INFO } from '../data/championTypes';

export function ClassBadges({ classes, official = true, small = false }) {
  if (!classes || classes.length === 0) {
    return <span className="type-badge-empty">—</span>;
  }

  return (
    <span className="type-badges">
      {classes.map((cls) => {
        const info = CLASS_INFO[cls];
        const tooltip = info
          ? `${info.family} · ${cls}: ${info.description}${official ? '' : ' (clase aproximada de Data Dragon)'}`
          : cls;
        return (
          <span
            key={cls}
            className={`type-badge class-${cls.toLowerCase()} ${small ? 'small' : ''} ${official ? '' : 'unofficial'}`}
            title={tooltip}
          >
            {info?.label || cls}
          </span>
        );
      })}
    </span>
  );
}

export function StyleBadge({ style, small = false }) {
  const info = STYLE_INFO[style];
  if (!info) return <span className="type-badge-empty">—</span>;
  return (
    <span className={`style-badge style-${style} ${small ? 'small' : ''}`} title={info.description}>
      {info.label}
    </span>
  );
}
