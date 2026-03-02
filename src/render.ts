import { Context } from 'koishi'

// =====================================================================
// Interfaces
// =====================================================================
export interface NodeInfo {
    uuid: string
    name: string
    address: string
    port: number
    status: string
    cpuUsage: number
    memoryUsage: number
    maxMemory: number
    instanceCount: number
    runningInstanceCount?: number
    hostname?: string
    system?: string
    version?: string
    uptime?: number
    cpuMemChart?: Array<{ cpu: number, mem: number }>
}

export interface InstanceInfo {
    uuid: string
    name: string
    status: string
    nodeUuid: string
}

// =====================================================================
// Helpers
// =====================================================================
const escapeHtml = (str: any): string => {
    if (str === null || str === undefined) return ''
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;')
        .replace(/\//g, '&#x2F;')
}

const formatUptime = (seconds: number): string => {
    if (!seconds || seconds <= 0) return '-'
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    if (d > 0) return `${d}天${h}时`
    if (h > 0) return `${h}时${m}分`
    return `${m}分`
}

// =====================================================================
// Material Icons (inline SVG)
// =====================================================================
const ICONS = {
    server: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4 1h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V3c0-1.1.9-2 2-2m0 6h16V3H4v4m2-3.5c-.83 0-1.5.67-1.5 1.5S5.17 6.5 6 6.5s1.5-.67 1.5-1.5S6.83 3.5 6 3.5M4 9h16c1.1 0 2 .9 2 2v4c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-4c0-1.1.9-2 2-2m0 6h16v-4H4v4m2-3.5c-.83 0-1.5.67-1.5 1.5s.67 1.5 1.5 1.5 1.5-.67 1.5-1.5-.67-1.5-1.5-1.5M4 17h16c1.1 0 2 .9 2 2v2c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2v-2c0-1.1.9-2 2-2m0 4h16v-2H4v2m2-1.5c.83 0 1.5-.67 1.5-1.5s-.67-1.5-1.5-1.5-1.5.67-1.5 1.5.67 1.5 1.5 1.5z"/></svg>`,
    dns: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 13H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1v-6c0-.55-.45-1-1-1zM7 19c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zM20 3H4c-.55 0-1 .45-1 1v6c0 .55.45 1 1 1h16c.55 0 1-.45 1-1V4c0-.55-.45-1-1-1zM7 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2z"/></svg>`,
    clock: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
    nodes: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 16l-4-4V8.82C14.16 8.4 15 7.3 15 6c0-1.66-1.34-3-3-3S9 4.34 9 6c0 1.3.84 2.4 2 2.82V12l-4 4H3v5h5v-3.05l4-4.2 4 4.2V21h5v-5h-4z"/></svg>`,
    instance: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zM7 10h2v7H7zm4-3h2v10h-2zm4 6h2v4h-2z"/></svg>`,
    cpu: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M15 9H9v6h6V9zm-2 4h-2v-2h2v2zm8-2V9h-2V7c0-1.1-.9-2-2-2h-2V3h-2v2h-2V3H9v2H7c-1.1 0-2 .9-2 2v2H3v2h2v2H3v2h2v2c0 1.1.9 2 2 2h2v2h2v-2h2v2h2v-2h2c1.1 0 2-.9 2-2v-2h2v-2h-2v-2h2zm-4 6H7V7h10v10z"/></svg>`,
    memory: `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M2 7v9c0 1.1.9 2 2 2h2v-2H4V7h2V5H4c-1.1 0-2 .9-2 2zm18-2h-2v2h2v9h-2v2h2c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zM15 5H9c-1.1 0-2 .9-2 2v9c0 1.1.9 2 2 2h6c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 11H9V7h6v9z"/></svg>`,
}

// =====================================================================
// Theme System
// =====================================================================
interface ThemeTokens {
    // Primary
    primary: string
    onPrimary: string
    primaryContainer: string
    onPrimaryContainer: string
    primary08: string
    primary12: string
    // Secondary
    secondary: string
    secondaryContainer: string
    onSecondaryContainer: string
    // Tertiary
    tertiary: string
    tertiaryContainer: string
    onTertiaryContainer: string
    // Error
    error: string
    errorContainer: string
    onErrorContainer: string
    // Surface
    surface: string
    surfaceContainerLowest: string
    surfaceContainerLow: string
    surfaceContainer: string
    surfaceContainerHigh: string
    surfaceContainerHighest: string
    onSurface: string
    onSurfaceVariant: string
    outline: string
    outlineVariant: string
    // Status
    good: string
    goodContainer: string
    onGoodContainer: string
    caution: string
    cautionContainer: string
    onCautionContainer: string
    // Elevation
    elev1: string
    elev2: string
    // Chart colors
    chartCpu: string
    chartCpuFill: string
    chartMem: string
    chartMemFill: string
}

export type ThemeName = 'purple' | 'blue' | 'green' | 'rose' | 'dark'

const THEMES: Record<ThemeName, ThemeTokens> = {
    purple: {
        primary: '#6750A4', onPrimary: '#fff', primaryContainer: '#EADDFF', onPrimaryContainer: '#21005D',
        primary08: 'rgba(103,80,164,0.08)', primary12: 'rgba(103,80,164,0.12)',
        secondary: '#625B71', secondaryContainer: '#E8DEF8', onSecondaryContainer: '#1D192B',
        tertiary: '#7D5260', tertiaryContainer: '#FFD8E4', onTertiaryContainer: '#31111D',
        error: '#B3261E', errorContainer: '#F9DEDC', onErrorContainer: '#410E0B',
        surface: '#FFFBFE', surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#F7F2FA',
        surfaceContainer: '#F3EDF7', surfaceContainerHigh: '#ECE6F0', surfaceContainerHighest: '#E6E0E9',
        onSurface: '#1D1B20', onSurfaceVariant: '#49454F', outline: '#79747E', outlineVariant: '#CAC4D0',
        good: '#386A20', goodContainer: '#C3EFAB', onGoodContainer: '#042100',
        caution: '#6D5E00', cautionContainer: '#FBE365', onCautionContainer: '#211B00',
        elev1: '0 1px 3px 1px rgba(0,0,0,0.15), 0 1px 2px 0 rgba(0,0,0,0.3)',
        elev2: '0 2px 6px 2px rgba(0,0,0,0.15), 0 1px 2px 0 rgba(0,0,0,0.3)',
        chartCpu: '#6750A4', chartCpuFill: 'rgba(103,80,164,0.20)',
        chartMem: '#7D5260', chartMemFill: 'rgba(125,82,96,0.16)',
    },
    blue: {
        primary: '#1B6EF3', onPrimary: '#fff', primaryContainer: '#D6E3FF', onPrimaryContainer: '#001B3E',
        primary08: 'rgba(27,110,243,0.08)', primary12: 'rgba(27,110,243,0.12)',
        secondary: '#565E71', secondaryContainer: '#DAE2F9', onSecondaryContainer: '#131C2B',
        tertiary: '#006B5F', tertiaryContainer: '#74F8E2', onTertiaryContainer: '#00201C',
        error: '#BA1A1A', errorContainer: '#FFDAD6', onErrorContainer: '#410002',
        surface: '#FAFBFF', surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#F3F4F9',
        surfaceContainer: '#EDEEF3', surfaceContainerHigh: '#E7E8ED', surfaceContainerHighest: '#E1E2E8',
        onSurface: '#1A1C20', onSurfaceVariant: '#44474E', outline: '#74777F', outlineVariant: '#C4C6D0',
        good: '#1E6B34', goodContainer: '#A8F5AE', onGoodContainer: '#002109',
        caution: '#6D5E00', cautionContainer: '#FBE365', onCautionContainer: '#211B00',
        elev1: '0 1px 3px 1px rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.24)',
        elev2: '0 2px 6px 2px rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.24)',
        chartCpu: '#1B6EF3', chartCpuFill: 'rgba(27,110,243,0.18)',
        chartMem: '#006B5F', chartMemFill: 'rgba(0,107,95,0.15)',
    },
    green: {
        primary: '#006C4C', onPrimary: '#fff', primaryContainer: '#89F8C7', onPrimaryContainer: '#002115',
        primary08: 'rgba(0,108,76,0.08)', primary12: 'rgba(0,108,76,0.12)',
        secondary: '#4D6356', secondaryContainer: '#CFE9D7', onSecondaryContainer: '#0A1F15',
        tertiary: '#3D6373', tertiaryContainer: '#C1E8FB', onTertiaryContainer: '#001F29',
        error: '#BA1A1A', errorContainer: '#FFDAD6', onErrorContainer: '#410002',
        surface: '#FBFDF8', surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#F2F5EF',
        surfaceContainer: '#ECEFE9', surfaceContainerHigh: '#E6EAE4', surfaceContainerHighest: '#E1E4DE',
        onSurface: '#191C19', onSurfaceVariant: '#414942', outline: '#717971', outlineVariant: '#C1C9BF',
        good: '#006C4C', goodContainer: '#89F8C7', onGoodContainer: '#002115',
        caution: '#6D5E00', cautionContainer: '#FBE365', onCautionContainer: '#211B00',
        elev1: '0 1px 3px 1px rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.24)',
        elev2: '0 2px 6px 2px rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.24)',
        chartCpu: '#006C4C', chartCpuFill: 'rgba(0,108,76,0.18)',
        chartMem: '#3D6373', chartMemFill: 'rgba(61,99,115,0.15)',
    },
    rose: {
        primary: '#9A4057', onPrimary: '#fff', primaryContainer: '#FFD9E0', onPrimaryContainer: '#3F0017',
        primary08: 'rgba(154,64,87,0.08)', primary12: 'rgba(154,64,87,0.12)',
        secondary: '#75565C', secondaryContainer: '#FFD9E0', onSecondaryContainer: '#2C151A',
        tertiary: '#7C5635', tertiaryContainer: '#FFDCC2', onTertiaryContainer: '#2E1500',
        error: '#BA1A1A', errorContainer: '#FFDAD6', onErrorContainer: '#410002',
        surface: '#FFFBFF', surfaceContainerLowest: '#FFFFFF', surfaceContainerLow: '#FBF0F1',
        surfaceContainer: '#F5EAEB', surfaceContainerHigh: '#F0E4E6', surfaceContainerHighest: '#EADFE0',
        onSurface: '#201A1B', onSurfaceVariant: '#524345', outline: '#847375', outlineVariant: '#D7C1C4',
        good: '#386A20', goodContainer: '#C3EFAB', onGoodContainer: '#042100',
        caution: '#6D5E00', cautionContainer: '#FBE365', onCautionContainer: '#211B00',
        elev1: '0 1px 3px 1px rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.24)',
        elev2: '0 2px 6px 2px rgba(0,0,0,0.12), 0 1px 2px 0 rgba(0,0,0,0.24)',
        chartCpu: '#9A4057', chartCpuFill: 'rgba(154,64,87,0.20)',
        chartMem: '#7C5635', chartMemFill: 'rgba(124,86,53,0.16)',
    },
    dark: {
        primary: '#D0BCFF', onPrimary: '#381E72', primaryContainer: '#4F378B', onPrimaryContainer: '#EADDFF',
        primary08: 'rgba(208,188,255,0.08)', primary12: 'rgba(208,188,255,0.12)',
        secondary: '#CCC2DC', secondaryContainer: '#4A4458', onSecondaryContainer: '#E8DEF8',
        tertiary: '#EFB8C8', tertiaryContainer: '#633B48', onTertiaryContainer: '#FFD8E4',
        error: '#F2B8B5', errorContainer: '#8C1D18', onErrorContainer: '#F9DEDC',
        surface: '#141218', surfaceContainerLowest: '#0F0D13', surfaceContainerLow: '#1D1B20',
        surfaceContainer: '#211F26', surfaceContainerHigh: '#2B2930', surfaceContainerHighest: '#36343B',
        onSurface: '#E6E0E9', onSurfaceVariant: '#CAC4D0', outline: '#938F99', outlineVariant: '#49454F',
        good: '#A1D395', goodContainer: '#1E5A0E', onGoodContainer: '#B7F397',
        caution: '#E4C54A', cautionContainer: '#514600', onCautionContainer: '#FBE365',
        elev1: '0 1px 3px 1px rgba(0,0,0,0.4), 0 1px 2px 0 rgba(0,0,0,0.6)',
        elev2: '0 2px 6px 2px rgba(0,0,0,0.4), 0 1px 2px 0 rgba(0,0,0,0.6)',
        chartCpu: '#D0BCFF', chartCpuFill: 'rgba(208,188,255,0.20)',
        chartMem: '#EFB8C8', chartMemFill: 'rgba(239,184,200,0.16)',
    },
}

// =====================================================================
// Material Design 3 Styles
// =====================================================================
const getStyles = (t: ThemeTokens): string => `

  /* ====== MD3 Design Tokens ====== */
  :root {
    --md-primary:              ${t.primary};
    --md-on-primary:           ${t.onPrimary};
    --md-primary-container:    ${t.primaryContainer};
    --md-on-primary-container: ${t.onPrimaryContainer};
    --md-primary-08:           ${t.primary08};
    --md-primary-12:           ${t.primary12};

    --md-secondary:              ${t.secondary};
    --md-secondary-container:    ${t.secondaryContainer};
    --md-on-secondary-container: ${t.onSecondaryContainer};

    --md-tertiary:              ${t.tertiary};
    --md-tertiary-container:    ${t.tertiaryContainer};
    --md-on-tertiary-container: ${t.onTertiaryContainer};

    --md-error:             ${t.error};
    --md-error-container:   ${t.errorContainer};
    --md-on-error-container:${t.onErrorContainer};

    --md-surface:                    ${t.surface};
    --md-surface-container-lowest:   ${t.surfaceContainerLowest};
    --md-surface-container-low:      ${t.surfaceContainerLow};
    --md-surface-container:          ${t.surfaceContainer};
    --md-surface-container-high:     ${t.surfaceContainerHigh};
    --md-surface-container-highest:  ${t.surfaceContainerHighest};
    --md-on-surface:          ${t.onSurface};
    --md-on-surface-variant:  ${t.onSurfaceVariant};
    --md-outline:             ${t.outline};
    --md-outline-variant:     ${t.outlineVariant};
    --md-surface-tint:        var(--md-primary);

    --md-good:                 ${t.good};
    --md-good-container:       ${t.goodContainer};
    --md-on-good-container:    ${t.onGoodContainer};
    --md-caution:              ${t.caution};
    --md-caution-container:    ${t.cautionContainer};
    --md-on-caution-container: ${t.onCautionContainer};

    --md-elev-1: ${t.elev1};
    --md-elev-2: ${t.elev2};

    --md-corner-xs:   4px;
    --md-corner-s:    8px;
    --md-corner-m:    12px;
    --md-corner-l:    16px;
    --md-corner-xl:   28px;
    --md-corner-full: 9999px;

    --md-motion-standard: cubic-bezier(0.2, 0, 0, 1);
    --md-motion-duration-medium: 0.3s;
  }

  *, *::before, *::after { margin: 0; padding: 0; box-sizing: border-box; }

  body {
    font-family: 'Google Sans', 'Roboto', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', system-ui, sans-serif;
    background: var(--md-surface-container-low);
    color: var(--md-on-surface);
    padding: 40px 20px 48px;
    min-height: 100vh;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
  }

  .page {
    max-width: 960px;
    margin: 0 auto;
  }

  /* ============================================================
     Top App Bar — MD3 Large
     ============================================================ */
  .top-app-bar {
    background: var(--md-surface-container-lowest);
    border-radius: var(--md-corner-xl);
    box-shadow: var(--md-elev-1);
    padding: 28px 32px 24px;
    margin-bottom: 20px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    /* MD3 Level 1 tonal elevation */
    background-image: linear-gradient(var(--md-primary-08), var(--md-primary-08));
  }

  .app-bar-left h1 {
    font-size: 26px;
    font-weight: 500;
    color: var(--md-on-surface);
    letter-spacing: 0;
    line-height: 32px;
  }
  .app-bar-left .subtitle {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 14px;
    color: var(--md-on-surface-variant);
    margin-top: 6px;
    line-height: 20px;
    letter-spacing: 0.25px;
  }
  .subtitle-dot {
    display: inline-block;
    width: 6px; height: 6px;
    border-radius: 50%;
    background: var(--md-primary);
  }

  .time-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 32px;
    padding: 0 16px 0 8px;
    border-radius: var(--md-corner-full);
    background: var(--md-surface-container-high);
    color: var(--md-on-surface-variant);
    font-size: 13px;
    font-weight: 500;
    letter-spacing: 0.1px;
    white-space: nowrap;
  }
  .time-chip .icon {
    width: 18px; height: 18px;
    display: flex; align-items: center; justify-content: center;
    color: var(--md-on-surface-variant);
  }
  .time-chip .icon svg { width: 18px; height: 18px; }

  /* ============================================================
     Summary Row — MD3 Filled Tonal Cards
     ============================================================ */
  .summary-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    margin-bottom: 20px;
  }

  .summary-card {
    background: var(--md-surface-container-lowest);
    border-radius: var(--md-corner-l);
    box-shadow: var(--md-elev-1);
    padding: 20px;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    position: relative;
    /* Tonal elevation */
    background-image: linear-gradient(var(--md-primary-08), var(--md-primary-08));
  }

  .summary-icon-wrap {
    width: 44px; height: 44px;
    border-radius: var(--md-corner-m);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .summary-icon-wrap svg { width: 22px; height: 22px; }

  .summary-card:nth-child(1) .summary-icon-wrap { background: var(--md-primary-container); color: var(--md-on-primary-container); }
  .summary-card:nth-child(2) .summary-icon-wrap { background: var(--md-good-container); color: var(--md-on-good-container); }
  .summary-card:nth-child(3) .summary-icon-wrap { background: var(--md-tertiary-container); color: var(--md-on-tertiary-container); }
  .summary-card:nth-child(4) .summary-icon-wrap { background: var(--md-secondary-container); color: var(--md-on-secondary-container); }

  .summary-text {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .summary-label {
    font-size: 11px;
    font-weight: 500;
    color: var(--md-on-surface-variant);
    letter-spacing: 0.5px;
    line-height: 16px;
  }
  .summary-value {
    font-size: 28px;
    font-weight: 500;
    line-height: 1.1;
    color: var(--md-on-surface);
    font-variant-numeric: tabular-nums;
  }
  .summary-sub {
    font-size: 14px;
    font-weight: 400;
    color: var(--md-on-surface-variant);
  }

  /* ============================================================
     Nodes Grid
     ============================================================ */
  .nodes-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(430px, 1fr));
    gap: 12px;
  }

  /* ============================================================
     Node Card — MD3 Elevated Card
     ============================================================ */
  .node-card {
    background: var(--md-surface-container-lowest);
    border-radius: var(--md-corner-l);
    box-shadow: var(--md-elev-1);
    overflow: hidden;
    display: flex;
    flex-direction: column;
    transition: box-shadow var(--md-motion-duration-medium) var(--md-motion-standard);
    /* Tonal elevation level 1 */
    background-image: linear-gradient(var(--md-primary-08), var(--md-primary-08));
  }
  .node-card.offline {
    opacity: 0.55;
    background-image: none;
  }

  /* — Node Header — */
  .node-hd {
    padding: 18px 20px 14px;
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .node-hd-left {
    display: flex;
    gap: 14px;
    align-items: center;
    min-width: 0;
  }

  .node-avatar {
    width: 44px; height: 44px;
    border-radius: var(--md-corner-m);
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .node-card:not(.offline) .node-avatar {
    background: var(--md-primary-container);
    color: var(--md-on-primary-container);
  }
  .node-card.offline .node-avatar {
    background: var(--md-surface-container-highest);
    color: var(--md-outline);
  }
  .node-avatar svg { width: 24px; height: 24px; }

  .node-label {
    font-size: 16px;
    font-weight: 500;
    color: var(--md-on-surface);
    letter-spacing: 0.15px;
    line-height: 24px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* — Status badge — */
  .status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    height: 28px;
    padding: 0 14px 0 10px;
    border-radius: var(--md-corner-full);
    font-size: 12px;
    font-weight: 500;
    letter-spacing: 0.5px;
    flex-shrink: 0;
  }
  .pill-dot {
    width: 6px; height: 6px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .status-online {
    background: var(--md-good-container);
    color: var(--md-on-good-container);
  }
  .status-online .pill-dot { background: var(--md-good); }
  .status-warn {
    background: var(--md-caution-container);
    color: var(--md-on-caution-container);
  }
  .status-warn .pill-dot { background: var(--md-caution); }
  .status-off {
    background: var(--md-error-container);
    color: var(--md-on-error-container);
  }
  .status-off .pill-dot { background: var(--md-error); }

  /* — Divider — */
  .node-divider {
    height: 1px;
    background: var(--md-outline-variant);
    margin: 0 20px;
  }

  /* — Node Body — */
  .node-bd {
    padding: 16px 20px 20px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    flex: 1;
  }

  /* — Info chips row — */
  .info-row {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
  }
  .info-item {
    background: var(--md-surface-container);
    border-radius: var(--md-corner-s);
    padding: 10px 8px;
    text-align: center;
    transition: background var(--md-motion-duration-medium) var(--md-motion-standard);
  }
  .info-item-label {
    display: block;
    font-size: 10px;
    font-weight: 500;
    color: var(--md-outline);
    text-transform: uppercase;
    letter-spacing: 1px;
    margin-bottom: 4px;
    line-height: 14px;
  }
  .info-item-value {
    display: block;
    font-size: 13px;
    font-weight: 500;
    color: var(--md-on-surface);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    line-height: 18px;
  }
  .info-item-value .secondary { color: var(--md-on-surface-variant); font-weight: 400; font-size: 11px; }

  /* — Metric bars — */
  .metric-block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .metric-row {
    display: flex;
    align-items: center;
    gap: 10px;
  }
  .metric-icon {
    width: 20px; height: 20px;
    color: var(--md-on-surface-variant);
    flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
  }
  .metric-icon svg { width: 18px; height: 18px; }
  .metric-texts {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    flex: 1;
    min-width: 0;
  }
  .metric-name {
    font-size: 13px;
    font-weight: 500;
    color: var(--md-on-surface-variant);
    letter-spacing: 0.1px;
  }
  .metric-num {
    font-size: 13px;
    font-weight: 500;
    color: var(--md-on-surface);
    font-family: 'Roboto Mono', monospace;
    letter-spacing: -0.2px;
  }

  .progress-track {
    height: 8px;
    background: var(--md-surface-container-highest);
    border-radius: var(--md-corner-full);
    overflow: hidden;
    margin-left: 30px; /* align with text after icon */
  }
  .progress-bar {
    height: 100%;
    border-radius: var(--md-corner-full);
    transition: width 0.6s var(--md-motion-standard);
    min-width: 2px;
  }
  .bar-primary  { background: var(--md-primary); }
  .bar-tertiary { background: var(--md-tertiary); }
  .bar-error    { background: var(--md-error); }

  /* — Chart — */
  .chart-section {
    margin-top: auto;
    position: relative;
  }
  .chart-divider {
    height: 1px;
    background: var(--md-outline-variant);
    margin-bottom: 12px;
  }
  .chart-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    padding: 0 2px;
  }
  .chart-title {
    font-size: 11px;
    font-weight: 500;
    color: var(--md-outline);
    letter-spacing: 0.5px;
  }
  .chart-legend {
    display: flex;
    gap: 12px;
  }
  .legend-item {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 10px;
    font-weight: 500;
    color: var(--md-on-surface-variant);
    letter-spacing: 0.3px;
  }
  .legend-dot {
    width: 8px; height: 3px;
    border-radius: 2px;
  }

  .chart-canvas-wrap {
    height: 64px;
    position: relative;
    border-radius: var(--md-corner-s);
    background: var(--md-surface-container);
    overflow: hidden;
  }
  .trend-chart {
    width: 100%; height: 100%; display: block;
  }

  /* — Empty — */
  .empty-state {
    grid-column: 1 / -1;
    text-align: center;
    padding: 56px 24px;
    color: var(--md-on-surface-variant);
    font-size: 14px;
    letter-spacing: 0.25px;
  }

  /* ============================================================
     Footer
     ============================================================ */
  .footer {
    text-align: center;
    margin-top: 28px;
    font-size: 12px;
    color: var(--md-outline);
    letter-spacing: 0.4px;
    line-height: 16px;
  }
`

// =====================================================================
// Chart Script
// =====================================================================
const getChartScript = (): string => `
  document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.trend-chart').forEach(function(canvas) {
      try {
        var raw = decodeURIComponent(canvas.getAttribute('data-cpu-mem') || '[]');
        drawChart(canvas, JSON.parse(raw));
      } catch(e) { console.error(e); }
    });
  });

  function drawChart(canvas, data) {
    var ctx = canvas.getContext('2d');
    var dpr = window.devicePixelRatio || 2;
    var rect = canvas.getBoundingClientRect();
    canvas.width  = rect.width  * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    var W = rect.width, H = rect.height;
    ctx.clearRect(0, 0, W, H);

    if (!data || data.length === 0) {
      ctx.fillStyle = '#79747E';
      ctx.font = '500 11px "Google Sans", Roboto, "Noto Sans SC", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('暂无趋势数据', W / 2, H / 2);
      return;
    }

    var pad = 4, cW = W - pad * 2, cH = H - pad * 2;

    function smooth(points) {
      if (points.length < 3) return points;
      var result = [points[0]];
      for (var i = 1; i < points.length - 1; i++) {
        result.push({
          x: points[i].x,
          y: points[i-1].y * 0.15 + points[i].y * 0.7 + points[i+1].y * 0.15
        });
      }
      result.push(points[points.length - 1]);
      return result;
    }

    function drawLine(key, stroke, gradTop, gradBot) {
      if (!data.some(function(d){ return d[key] !== undefined; })) return;

      var points = data.map(function(item, i) {
        return {
          x: pad + (i / Math.max(data.length - 1, 1)) * cW,
          y: pad + cH - ((item[key] || 0) / 100) * cH
        };
      });
      points = smooth(points);

      ctx.beginPath();
      points.forEach(function(p, i) {
        i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y);
      });
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = stroke;
      ctx.stroke();

      // Fill area
      ctx.lineTo(pad + cW, pad + cH);
      ctx.lineTo(pad, pad + cH);
      ctx.closePath();
      var grad = ctx.createLinearGradient(0, 0, 0, H);
      grad.addColorStop(0, gradTop);
      grad.addColorStop(1, gradBot);
      ctx.fillStyle = grad;
      ctx.fill();
    }

    var cpuColor = canvas.getAttribute('data-chart-cpu') || '#6750A4';
    var memColor = canvas.getAttribute('data-chart-mem') || '#7D5260';
    var cpuFill  = canvas.getAttribute('data-chart-cpu-fill') || 'rgba(103,80,164,0.20)';
    var memFill  = canvas.getAttribute('data-chart-mem-fill') || 'rgba(125,82,96,0.16)';
    drawLine('mem', memColor, memFill, memFill.replace(/[\d.]+\)$/, '0.0)'));
    drawLine('cpu', cpuColor, cpuFill, cpuFill.replace(/[\d.]+\)$/, '0.0)'));
  }
`

// =====================================================================
// Node Card HTML
// =====================================================================
const renderNodeCard = (node: NodeInfo, highLoadThreshold: number, t: ThemeTokens): string => {
    const cpuPct = parseFloat(node.cpuUsage.toFixed(1))
    const memPct = node.maxMemory > 0
        ? parseFloat(((node.memoryUsage / node.maxMemory) * 100).toFixed(1))
        : 0
    const isHighLoad = cpuPct >= highLoadThreshold || memPct >= highLoadThreshold
    const isOffline = node.status !== 'online'

    let pillClass = 'status-online', pillText = '运行中'
    if (isOffline) { pillClass = 'status-off'; pillText = '离线' }
    else if (isHighLoad) { pillClass = 'status-warn'; pillText = '高负载' }

    const cpuBarCls = cpuPct > 80 ? 'progress-bar bar-error' : 'progress-bar bar-primary'
    const memBarCls = memPct > 85 ? 'progress-bar bar-error' : 'progress-bar bar-tertiary'
    const memUsed = node.memoryUsage ? node.memoryUsage.toFixed(1) : '0'
    const memTotal = node.maxMemory ? node.maxMemory.toFixed(1) : '0'

    return `
    <div class="node-card ${isOffline ? 'offline' : ''}">
      <div class="node-hd">
        <div class="node-hd-left">
          <div class="node-avatar">${ICONS.dns}</div>
          <span class="node-label">${escapeHtml(node.name)}</span>
        </div>
        <span class="status-pill ${pillClass}"><span class="pill-dot"></span>${pillText}</span>
      </div>

      <div class="node-divider"></div>

      <div class="node-bd">
        <div class="info-row">
          <div class="info-item">
            <span class="info-item-label">系统</span>
            <span class="info-item-value">${escapeHtml(node.system || 'N/A')}</span>
          </div>
          <div class="info-item">
            <span class="info-item-label">版本</span>
            <span class="info-item-value" title="${escapeHtml(node.version)}">${escapeHtml((node.version || 'N/A').split(' ')[0])}</span>
          </div>
          <div class="info-item">
            <span class="info-item-label">实例</span>
            <span class="info-item-value">${node.runningInstanceCount || 0} <span class="secondary">/ ${node.instanceCount || 0}</span></span>
          </div>
          <div class="info-item">
            <span class="info-item-label">运行</span>
            <span class="info-item-value">${formatUptime(node.uptime)}</span>
          </div>
        </div>

        <div class="metric-block">
          <div class="metric-row">
            <div class="metric-icon">${ICONS.cpu}</div>
            <div class="metric-texts">
              <span class="metric-name">CPU</span>
              <span class="metric-num">${cpuPct}%</span>
            </div>
          </div>
          <div class="progress-track">
            <div class="${cpuBarCls}" style="width:${cpuPct}%"></div>
          </div>
        </div>

        <div class="metric-block">
          <div class="metric-row">
            <div class="metric-icon">${ICONS.memory}</div>
            <div class="metric-texts">
              <span class="metric-name">内存</span>
              <span class="metric-num">${memUsed} / ${memTotal} GB</span>
            </div>
          </div>
          <div class="progress-track">
            <div class="${memBarCls}" style="width:${memPct}%"></div>
          </div>
        </div>

        <div class="chart-section">
          <div class="chart-divider"></div>
          <div class="chart-header">
            <span class="chart-title">趋势</span>
            <div class="chart-legend">
              <span class="legend-item"><span class="legend-dot" style="background:${t.chartCpu}"></span>CPU</span>
              <span class="legend-item"><span class="legend-dot" style="background:${t.chartMem}"></span>MEM</span>
            </div>
          </div>
          <div class="chart-canvas-wrap">
            <canvas class="trend-chart" data-cpu-mem="${encodeURIComponent(JSON.stringify(node.cpuMemChart || []))}" data-chart-cpu="${t.chartCpu}" data-chart-mem="${t.chartMem}" data-chart-cpu-fill="${t.chartCpuFill}" data-chart-mem-fill="${t.chartMemFill}" width="240" height="64"></canvas>
          </div>
        </div>
      </div>
    </div>
  `
}

// =====================================================================
// Full Page HTML
// =====================================================================
export function generateHtml(
    nodes: NodeInfo[],
    instances: InstanceInfo[],
    title: string,
    highLoadThreshold: number,
    fontCSS: string = '',
    theme: ThemeName = 'blue'
): string {
    const t = THEMES[theme] || THEMES.blue
    const totalNodes = nodes.length
    const onlineNodes = nodes.filter(n => n.status === 'online').length
    const totalInstances = nodes.reduce((s, n) => s + (n.instanceCount || 0), 0)
    const runningInstances = nodes.reduce((s, n) => s + (n.runningInstanceCount || 0), 0)

    const onlineList = nodes.filter(n => n.status === 'online')
    const avgCpu = onlineList.length > 0
        ? (onlineList.reduce((s, n) => s + n.cpuUsage, 0) / onlineList.length).toFixed(1)
        : '0'
    const avgMem = onlineList.length > 0
        ? (onlineList.reduce((s, n) => s + (n.maxMemory > 0 ? (n.memoryUsage / n.maxMemory) * 100 : 0), 0) / onlineList.length).toFixed(1)
        : '0'

    const nodesHtml = nodes.length > 0
        ? nodes.map(n => renderNodeCard(n, highLoadThreshold, t)).join('')
        : '<div class="empty-state">暂无节点信息</div>'

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>MCSM Status</title>
  ${fontCSS ? `<style>${fontCSS}</style>` : ''}
  <style>${getStyles(t)}</style>
</head>
<body>
  <div class="page">

    <div class="top-app-bar">
      <div class="app-bar-left">
        <h1>${escapeHtml(title || 'MCSManager Monitor')}</h1>
        <div class="subtitle"><span class="subtitle-dot"></span>System Status Dashboard</div>
      </div>
      <div class="time-chip">
        <span class="icon">${ICONS.clock}</span>
        ${new Date().toLocaleString('zh-CN', { hour12: false })}
      </div>
    </div>

    <div class="summary-row">
      <div class="summary-card">
        <div class="summary-icon-wrap">${ICONS.nodes}</div>
        <div class="summary-text">
          <span class="summary-label">在线节点</span>
          <span class="summary-value">${onlineNodes}<span class="summary-sub"> / ${totalNodes}</span></span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon-wrap">${ICONS.instance}</div>
        <div class="summary-text">
          <span class="summary-label">运行实例</span>
          <span class="summary-value">${runningInstances}<span class="summary-sub"> / ${totalInstances}</span></span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon-wrap">${ICONS.cpu}</div>
        <div class="summary-text">
          <span class="summary-label">平均 CPU</span>
          <span class="summary-value">${avgCpu}<span class="summary-sub">%</span></span>
        </div>
      </div>
      <div class="summary-card">
        <div class="summary-icon-wrap">${ICONS.memory}</div>
        <div class="summary-text">
          <span class="summary-label">平均内存</span>
          <span class="summary-value">${avgMem}<span class="summary-sub">%</span></span>
        </div>
      </div>
    </div>

    <div class="nodes-grid">
      ${nodesHtml}
    </div>

    <div class="footer">
      Powered by koishi-plugin-mcsm-status · MCSManager
    </div>
  </div>

  <script>${getChartScript()}</script>
</body>
</html>`
}

// =====================================================================
// Puppeteer Render
// =====================================================================
export async function renderToImage(ctx: Context, html: string): Promise<Buffer> {
    const page = await ctx.puppeteer.page()
    try {
        await page.setContent(html, { waitUntil: 'networkidle0' })
        await page.setViewport({
            width: 960,
            height: 600,
            deviceScaleFactor: 2
        })
        return await page.screenshot({ type: 'png', fullPage: true })
    } finally {
        await page.close().catch(() => { })
    }
}
