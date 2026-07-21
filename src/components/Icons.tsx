type P = { size?: number; color?: string; strokeWidth?: number };

const base = (size: number) => ({
  width: size,
  height: size,
  viewBox: '0 0 24 24',
  fill: 'none' as const,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export const IconPlusCircle = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v8M8 12h8" />
  </svg>
);

export const IconSearch = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

export const IconList = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);

export const IconSettings = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);

export const IconLogout = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);

export const IconCalendar = ({ size = 16, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <path d="M16 2v4M8 2v4M3 10h18" />
  </svg>
);

export const IconCopy = ({ size = 15, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <rect x="9" y="9" width="13" height="13" rx="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

export const IconBolt = ({ size = 18, color = 'currentColor', strokeWidth = 2.2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z" />
  </svg>
);

export const IconCheck = ({ size = 12, color = 'currentColor', strokeWidth = 3.5 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

export const IconAlert = ({ size = 22, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 8v4M12 16h.01" />
  </svg>
);

export const IconUsers = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

export const IconUpload = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12" />
  </svg>
);

export const IconBell = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
);

export const IconBuilding = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <rect x="4" y="2" width="16" height="20" rx="2" />
    <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M8 10h.01M16 10h.01M12 10h.01M8 14h.01M16 14h.01M12 14h.01" />
  </svg>
);

export const IconPalette = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <circle cx="13.5" cy="6.5" r=".5" />
    <circle cx="17.5" cy="10.5" r=".5" />
    <circle cx="8.5" cy="7.5" r=".5" />
    <circle cx="6.5" cy="12.5" r=".5" />
    <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10c.926 0 1.648-.746 1.648-1.688 0-.437-.18-.835-.437-1.125-.29-.289-.438-.652-.438-1.125a1.64 1.64 0 0 1 1.668-1.668h1.996c3.051 0 5.555-2.503 5.555-5.554C21.965 6.012 17.461 2 12 2z" />
  </svg>
);

export const IconArrowLeft = ({ size = 18, color = 'currentColor', strokeWidth = 2 }: P) => (
  <svg {...base(size)} stroke={color} strokeWidth={strokeWidth}>
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);
