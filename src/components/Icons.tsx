import type { SVGProps } from 'react';

type P = SVGProps<SVGSVGElement> & { size?: number };

function Svg({ size = 22, children, ...rest }: P) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

export const IconCalendar = (p: P) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="3" />
    <path d="M3.5 10h17M8 3v4M16 3v4" />
    <path d="M8 14h.01M12 14h.01M16 14h.01M8 17h.01M12 17h.01" strokeWidth={2.4} />
  </Svg>
);

export const IconChart = (p: P) => (
  <Svg {...p}>
    <path d="M4 4v15.5a.5.5 0 0 0 .5.5H20" />
    <path d="m7.5 15 3.5-4.5 3 2.5 5-6.5" />
  </Svg>
);

export const IconFolder = (p: P) => (
  <Svg {...p}>
    <path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.2h7.4a2 2 0 0 1 2 2v7.8a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2Z" />
    <path d="M12 11v5M9.5 13.5 12 16l2.5-2.5" />
  </Svg>
);

export const IconLeaf = (p: P) => (
  <Svg {...p}>
    <path d="M5 19c0-8 5.5-13.5 15-14-.4 9.5-6 15-14 15" />
    <path d="M5 19c3-4 6-6.5 10-8.5" />
  </Svg>
);

export const IconDrop = ({ filled = true, ...p }: P & { filled?: boolean }) => (
  <Svg {...p} strokeWidth={filled ? 0 : 2}>
    <path
      d="M12 3.2c3.2 4 5.8 7.4 5.8 10.6a5.8 5.8 0 0 1-11.6 0C6.2 10.6 8.8 7.2 12 3.2Z"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
    />
  </Svg>
);

export const IconFlower = (p: P) => (
  <Svg {...p} strokeWidth={0}>
    <g fill="currentColor">
      {[0, 72, 144, 216, 288].map((a) => (
        <ellipse key={a} cx="12" cy="7.2" rx="3.1" ry="4.4" transform={`rotate(${a} 12 12)`} opacity={0.9} />
      ))}
    </g>
    <circle cx="12" cy="12" r="2.6" fill="#fff" opacity={0.9} />
  </Svg>
);

export const IconBack = (p: P) => (
  <Svg {...p}>
    <path d="M15 5 8 12l7 7" />
  </Svg>
);

export const IconChevronLeft = (p: P) => (
  <Svg {...p}>
    <path d="M14.5 6 9 12l5.5 6" />
  </Svg>
);

export const IconChevronRight = (p: P) => (
  <Svg {...p}>
    <path d="m9.5 6 5.5 6-5.5 6" />
  </Svg>
);

export const IconCheck = (p: P) => (
  <Svg {...p}>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
);

export const IconCheckCircle = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="m8.3 12.3 2.6 2.6 5-5.3" />
  </Svg>
);

export const IconAlert = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 7.8v5M12 16.2h.01" strokeWidth={2.2} />
  </Svg>
);

export const IconPlus = (p: P) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
);

export const IconMinus = (p: P) => (
  <Svg {...p}>
    <path d="M5 12h14" />
  </Svg>
);

export const IconLink = (p: P) => (
  <Svg {...p}>
    <path d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1" />
    <path d="M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1" />
  </Svg>
);

export const IconTrash = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 7h15M10 4h4M6.5 7l.8 11.2a2 2 0 0 0 2 1.8h5.4a2 2 0 0 0 2-1.8L17.5 7" />
  </Svg>
);

export const IconDownload = (p: P) => (
  <Svg {...p}>
    <path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14" />
  </Svg>
);

export const IconUpload = (p: P) => (
  <Svg {...p}>
    <path d="M12 15.5V4.5M7.5 9 12 4.5 16.5 9M5 19.5h14" />
  </Svg>
);

export const IconShield = (p: P) => (
  <Svg {...p}>
    <path d="M12 3.5 5 6v5.5c0 4.3 3 7.8 7 9 4-1.2 7-4.7 7-9V6Z" />
    <path d="m9 12 2.2 2.2L15.5 10" />
  </Svg>
);

export const IconPhone = (p: P) => (
  <Svg {...p}>
    <path d="M6.6 3.5h2.6l1.5 4-2 1.3a11 11 0 0 0 6.5 6.5l1.3-2 4 1.5v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2Z" />
  </Svg>
);

export const IconInfo = (p: P) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M12 11v5.2M12 7.8h.01" strokeWidth={2.2} />
  </Svg>
);

export const IconMoon = (p: P) => (
  <Svg {...p}>
    <path d="M19.5 14.5A8 8 0 0 1 9.5 4.5a8 8 0 1 0 10 10Z" />
  </Svg>
);

export const IconWalk = (p: P) => (
  <Svg {...p}>
    <circle cx="13" cy="4.8" r="1.8" />
    <path d="m9 21 2.5-6 2.5 2.5V21M8 11.5l2.5-3.5 3.5.5 2 3.5 2.5 1" />
    <path d="M11.5 15 10 8" />
  </Svg>
);

export const IconEdit = (p: P) => (
  <Svg {...p}>
    <path d="M4.5 19.5h4l10-10a2.8 2.8 0 0 0-4-4l-10 10Z" />
    <path d="m13.5 6.5 4 4" />
  </Svg>
);

export const IconClose = (p: P) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6 6 18" />
  </Svg>
);

export const IconBell = (p: P) => (
  <Svg {...p}>
    <path d="M6 16.5V11a6 6 0 1 1 12 0v5.5l1.5 2h-15Z" />
    <path d="M10 20.5a2 2 0 0 0 4 0" />
  </Svg>
);

export const IconShare = (p: P) => (
  <Svg {...p}>
    <path d="M12 14.5V3.5M8 7.5l4-4 4 4" />
    <path d="M7.5 11H6a1.5 1.5 0 0 0-1.5 1.5v6A1.5 1.5 0 0 0 6 20h12a1.5 1.5 0 0 0 1.5-1.5v-6A1.5 1.5 0 0 0 18 11h-1.5" />
  </Svg>
);

export const IconHome = (p: P) => (
  <Svg {...p}>
    <rect x="5" y="5" width="14" height="14" rx="3.5" />
    <path d="M12 9v6M9 12h6" />
  </Svg>
);

export const IconTable = (p: P) => (
  <Svg {...p}>
    <rect x="4" y="5" width="16" height="14" rx="2.5" />
    <path d="M4 10h16M4 14.5h16M10 10v9" />
  </Svg>
);
