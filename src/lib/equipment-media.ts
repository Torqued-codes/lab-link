export function getEquipmentPreviewSvg(equipmentId: string, name: string, department: string): string {
  const palette: Record<string, { bg: string; accent: string; chip: string; label: string }> = {
    CSE: { bg: "#090D16", accent: "#2CBEF1", chip: "#014BBE", label: "GPU / COMPUTE NODE" },
    Robotics: { bg: "#090D16", accent: "#A2FA8F", chip: "#014BBE", label: "LIDAR / AUTONOMY RIG" },
    ECE: { bg: "#090D16", accent: "#2CBEF1", chip: "#014BBE", label: "RF / MIXED-SIGNAL BENCH" },
    Mechanical: { bg: "#090D16", accent: "#A2FA8F", chip: "#014BBE", label: "ADDITIVE / CAD CELL" },
  };

  const theme = palette[department] || palette.CSE;
  const shortCode = equipmentId.replace("eq_", "").toUpperCase().slice(0, 14);
  const safeTitle = name.replace(/[<>&"']/g, "").slice(0, 26);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="320" height="140" viewBox="0 0 320 140">
    <rect width="320" height="140" rx="6" fill="${theme.bg}"/>
    <g stroke="${theme.accent}" stroke-opacity="0.18" stroke-width="1">
      <line x1="0" y1="28" x2="320" y2="28"/><line x1="0" y1="56" x2="320" y2="56"/>
      <line x1="0" y1="84" x2="320" y2="84"/><line x1="0" y1="112" x2="320" y2="112"/>
      <line x1="64" y1="0" x2="64" y2="140"/><line x1="128" y1="0" x2="128" y2="140"/>
      <line x1="192" y1="0" x2="192" y2="140"/><line x1="256" y1="0" x2="256" y2="140"/>
    </g>
    <rect x="18" y="22" width="84" height="62" rx="5" fill="${theme.chip}" fill-opacity="0.45" stroke="${theme.accent}" stroke-width="1.5"/>
    <rect x="30" y="34" width="60" height="38" rx="3" fill="${theme.bg}" stroke="${theme.accent}" stroke-width="1"/>
    <circle cx="44" cy="48" r="4" fill="${theme.accent}"/>
    <line x1="54" y1="45" x2="80" y2="45" stroke="${theme.accent}" stroke-width="2"/>
    <line x1="54" y1="53" x2="74" y2="53" stroke="#F8FAFC" stroke-opacity="0.6" stroke-width="1.5"/>
    <text x="116" y="42" fill="${theme.accent}" font-family="monospace" font-size="10" font-weight="bold">${theme.label}</text>
    <text x="116" y="61" fill="#F8FAFC" font-family="sans-serif" font-size="12" font-weight="bold">${safeTitle}</text>
    <text x="116" y="79" fill="#94A3B8" font-family="monospace" font-size="10">ASSET_ID: ${shortCode}</text>
    <rect x="18" y="102" width="284" height="22" rx="4" fill="#FFFFFF" fill-opacity="0.06"/>
    <circle cx="30" cy="113" r="4" fill="#A2FA8F"/>
    <text x="42" y="117" fill="#E2E8F0" font-family="monospace" font-size="10">TELEMETRY_VERIFIED • LABLINK_ASSET_TAG</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}