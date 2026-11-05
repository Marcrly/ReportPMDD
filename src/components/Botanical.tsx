/**
 * Delikatny motyw roślinny: gałązki eukaliptusa / oliwki generowane z krzywej Béziera
 * oraz małe kwiaty. Wszystko w SVG, bez plików graficznych.
 */

type Pt = [number, number];

function bezier(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): Pt {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

function tangent(p0: Pt, p1: Pt, p2: Pt, p3: Pt, t: number): number {
  const u = 1 - t;
  const dx = 3 * u * u * (p1[0] - p0[0]) + 6 * u * t * (p2[0] - p1[0]) + 3 * t * t * (p3[0] - p2[0]);
  const dy = 3 * u * u * (p1[1] - p0[1]) + 6 * u * t * (p2[1] - p1[1]) + 3 * t * t * (p3[1] - p2[1]);
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

const LEAF = 'M0 0 C 6 -7.5, 19 -8.5, 27 0 C 19 8.5, 6 7.5, 0 0 Z';

interface SprigProps {
  className?: string;
  /** kolor liści */
  leaf?: string;
  /** kolor łodygi i nerwów */
  stem?: string;
  leaves?: number;
  opacity?: number;
  /** odbicie w poziomie */
  flip?: boolean;
  rotate?: number;
}

export function Sprig({
  className,
  leaf = 'var(--sage-300)',
  stem = 'var(--sage-500)',
  leaves = 8,
  opacity = 1,
  flip = false,
  rotate = 0,
}: SprigProps) {
  const p0: Pt = [14, 128];
  const p1: Pt = [34, 96];
  const p2: Pt = [62, 44];
  const p3: Pt = [112, 14];
  const items = Array.from({ length: leaves }, (_, i) => {
    const t = 0.1 + (i * 0.82) / Math.max(1, leaves - 1);
    const [x, y] = bezier(p0, p1, p2, p3, t);
    const ang = tangent(p0, p1, p2, p3, t);
    const side = i % 2 === 0 ? -1 : 1;
    const scale = 1.05 - t * 0.45;
    return { x, y, rot: ang + side * 52, scale, shade: i % 3 === 0 ? 0.78 : 1 };
  });
  const tipAngle = tangent(p0, p1, p2, p3, 1);
  const transform = `${flip ? 'translate(130 0) scale(-1 1)' : ''} rotate(${rotate} 65 70)`;
  return (
    <svg className={className} viewBox="0 0 130 140" aria-hidden="true" focusable="false" style={{ opacity }}>
      <g transform={transform}>
        <path
          d={`M${p0[0]} ${p0[1]} C ${p1[0]} ${p1[1]}, ${p2[0]} ${p2[1]}, ${p3[0]} ${p3[1]}`}
          fill="none"
          stroke={stem}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
        {items.map((l, i) => (
          <g key={i} transform={`translate(${l.x} ${l.y}) rotate(${l.rot}) scale(${l.scale})`}>
            <path d={LEAF} fill={leaf} opacity={l.shade} />
            <path d="M1.5 0 L 22 0" stroke={stem} strokeWidth={0.9} strokeLinecap="round" opacity={0.55} />
          </g>
        ))}
        <g transform={`translate(${p3[0]} ${p3[1]}) rotate(${tipAngle}) scale(0.62)`}>
          <path d={LEAF} fill={leaf} />
          <path d="M1.5 0 L 22 0" stroke={stem} strokeWidth={0.9} opacity={0.55} />
        </g>
      </g>
    </svg>
  );
}

interface BloomProps {
  className?: string;
  size?: number;
  petal?: string;
  center?: string;
  petals?: number;
}

export function Bloom({ className, size = 28, petal = 'var(--rose-300)', center = 'var(--honey-600)', petals = 5 }: BloomProps) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 40 40" aria-hidden="true" focusable="false">
      {Array.from({ length: petals }, (_, i) => (
        <ellipse key={i} cx="20" cy="10.5" rx="6" ry="9" fill={petal} opacity={0.92} transform={`rotate(${(360 / petals) * i} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="4.6" fill={center} opacity={0.85} />
    </svg>
  );
}

/** Znak aplikacji: liść w zaokrąglonym kwadracie. */
export function LeafMark({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <rect width="32" height="32" rx="9" fill="var(--sage-700)" />
      <path d="M8.5 23.5c0-8.2 5.6-13.8 15-14.3-.4 9.4-6 15-14.3 15" fill="var(--beige-200)" />
      <path d="M8.8 23.2c3-4 6-6.6 10.2-8.7" stroke="var(--sage-700)" strokeWidth="1.4" strokeLinecap="round" fill="none" />
    </svg>
  );
}

/** Kompozycja do ekranów powitalnych i pustych stanów: mały bukiet. */
export function Bouquet({ size = 170 }: { size?: number }) {
  const stems: { d: string; leaves: [number, number, number, number][] }[] = [
    {
      d: 'M100 176 Q 82 128 70 74',
      leaves: [
        [86, 136, -150, 1.1],
        [77, 104, -30, 0.95],
      ],
    },
    {
      d: 'M100 176 Q 104 120 112 58',
      leaves: [
        [104, 118, -60, 0.9],
        [108, 86, -125, 0.8],
      ],
    },
    {
      d: 'M100 176 Q 124 136 140 96',
      leaves: [
        [118, 140, -10, 1.0],
        [130, 116, -95, 0.85],
      ],
    },
  ];
  return (
    <svg width={size} height={size} viewBox="0 0 200 200" aria-hidden="true" focusable="false">
      <circle cx="100" cy="104" r="80" fill="var(--sage-100)" />
      {stems.map((st, i) => (
        <g key={i}>
          <path d={st.d} fill="none" stroke="var(--sage-600)" strokeWidth={2.2} strokeLinecap="round" />
          {st.leaves.map(([x, y, r, k], j) => (
            <g key={j} transform={`translate(${x} ${y}) rotate(${r}) scale(${k})`}>
              <path d={LEAF} fill={j % 2 ? 'var(--sage-300)' : 'var(--sage-400)'} />
              <path d="M1.5 0 L 22 0" stroke="var(--sage-600)" strokeWidth={0.9} opacity={0.5} />
            </g>
          ))}
        </g>
      ))}
      <rect x="91" y="150" width="18" height="9" rx="3" fill="var(--rose-300)" transform="rotate(-8 100 154)" />
      <g transform="translate(50 52) scale(1.0)">
        <BloomShape petal="var(--rose-300)" />
      </g>
      <g transform="translate(96 40) scale(0.8)">
        <BloomShape petal="var(--beige-50)" />
      </g>
      <g transform="translate(126 80) scale(0.7)">
        <BloomShape petal="var(--berry-300)" />
      </g>
    </svg>
  );
}

function BloomShape({ petal }: { petal: string }) {
  return (
    <g>
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="20" cy="9" rx="7" ry="10.5" fill={petal} stroke="var(--sage-200)" strokeWidth={0.8} transform={`rotate(${a} 20 20)`} />
      ))}
      <circle cx="20" cy="20" r="5.2" fill="var(--honey-600)" opacity={0.85} />
    </g>
  );
}
