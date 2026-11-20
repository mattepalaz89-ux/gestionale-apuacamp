import {
  AssociationProfile,
  DigitalCardFieldPlacement,
  DigitalCardTemplateConfig,
  DigitalCardThemePreset,
  InsuranceType,
  InsuranceTypeLabels,
  Member,
} from '../types';

export const DEFAULT_INSURANCE_TYPE_LABELS: InsuranceTypeLabels = {
  Base: 'Base / Giornaliera',
  Summer: 'Summer Camp',
  Gold: 'Gold Annuale',
  Platinum: 'Platinum Integrale',
};

export function resolveInsuranceTypeLabels(
  profile?: AssociationProfile
): InsuranceTypeLabels {
  const fromCardTypes: InsuranceTypeLabels = {};
  if (Array.isArray(profile?.cardTypes)) {
    for (const ct of profile.cardTypes) {
      if (ct?.id && ct?.label) {
        fromCardTypes[ct.id] = ct.label;
      }
    }
  }
  return {
    ...DEFAULT_INSURANCE_TYPE_LABELS,
    ...fromCardTypes,
    ...(profile?.insuranceTypeLabels || {}),
  };
}

export function getInsuranceDisplayLabel(
  insuranceType: InsuranceType,
  profile?: AssociationProfile,
  customOverride?: string
): string {
  if (customOverride && customOverride.trim()) {
    return customOverride.trim();
  }
  const labels = resolveInsuranceTypeLabels(profile);
  return labels[insuranceType] || insuranceType;
}

export const DEFAULT_DIGITAL_CARD_FIELDS: DigitalCardFieldPlacement[] = [
  {
    id: 'associationName',
    label: 'Nome Associazione Sportiva',
    visible: true,
    xPercent: 18,
    yPercent: 13,
    fontSize: 16,
    color: '#ffffff',
    align: 'left',
    showLabelPrefix: false,
    customPrefix: 'ASD',
  },
  {
    id: 'affiliation',
    label: 'Ente di Affiliazione (es. US ACLI)',
    visible: true,
    xPercent: 18,
    yPercent: 24,
    fontSize: 10,
    color: '#a7f3d0',
    align: 'left',
    showLabelPrefix: false,
    customPrefix: 'Affiliazione',
  },
  {
    id: 'cardTitle',
    label: 'Intestazione Tessera & Anno',
    visible: true,
    xPercent: 94,
    yPercent: 14,
    fontSize: 10,
    color: '#fde68a',
    align: 'right',
    showLabelPrefix: false,
    customPrefix: 'TESSERA ASSOCIATIVA',
  },
  {
    id: 'memberName',
    label: 'Nome e Cognome Socio',
    visible: true,
    xPercent: 7,
    yPercent: 46,
    fontSize: 20,
    color: '#ffffff',
    align: 'left',
    showLabelPrefix: true,
    customPrefix: 'SOCIO / TESSERATO',
  },
  {
    id: 'cardNumber',
    label: 'Numero di Tessera (US ACLI / Ente)',
    visible: true,
    xPercent: 7,
    yPercent: 70,
    fontSize: 15,
    color: '#fde68a',
    align: 'left',
    showLabelPrefix: true,
    customPrefix: 'N° TESSERA US ACLI',
  },
  {
    id: 'insuranceType',
    label: 'Tipo di Assicurazione / Copertura',
    visible: true,
    xPercent: 48,
    yPercent: 70,
    fontSize: 13,
    color: '#ffffff',
    align: 'left',
    showLabelPrefix: true,
    customPrefix: 'COPERTURA ASSICURATIVA',
  },
  {
    id: 'validityDates',
    label: 'Scadenza Tesserino & Formula',
    visible: true,
    xPercent: 7,
    yPercent: 88,
    fontSize: 11,
    color: '#e2e8f0',
    align: 'left',
    showLabelPrefix: true,
    customPrefix: 'VALIDITÀ / SCADENZA',
  },
  {
    id: 'fiscalCode',
    label: 'Codice Fiscale Socio',
    visible: true,
    xPercent: 48,
    yPercent: 88,
    fontSize: 11,
    color: '#cbd5e1',
    align: 'left',
    showLabelPrefix: true,
    customPrefix: 'CODICE FISCALE',
  },
  {
    id: 'customFooter',
    label: 'Dicitura / Nota Piè di Tessera',
    visible: true,
    xPercent: 94,
    yPercent: 92,
    fontSize: 9,
    color: '#94a3b8',
    align: 'right',
    showLabelPrefix: false,
    customPrefix: '',
  },
];

export const DEFAULT_DIGITAL_CARD_CONFIG: DigitalCardTemplateConfig = {
  themePreset: 'apuacamp_emerald',
  backgroundOpacity: 0.9,
  showLogo: true,
  logoXPercent: 9,
  logoYPercent: 18,
  logoScalePercent: 100,
  showQrVerificationBadge: true,
  qrXPercent: 88,
  qrYPercent: 52,
  customFooterText: 'Tessera Associativa Ufficiale',
  fields: DEFAULT_DIGITAL_CARD_FIELDS.map((f) => ({ ...f })),
};

export interface DigitalCardLayoutPresetMeta {
  id: 'standard_left' | 'bottom_strip' | 'centered_badge';
  name: string;
  description: string;
  applyToFields: (fields: DigitalCardFieldPlacement[]) => DigitalCardFieldPlacement[];
}

export const DIGITAL_CARD_LAYOUT_PRESETS: DigitalCardLayoutPresetMeta[] = [
  {
    id: 'standard_left',
    name: 'Classico Orizzontale (Consigliato)',
    description: 'Stemma in alto a sinistra, nome socio al centro, N° tessera e assicurazione in basso.',
    applyToFields: () => DEFAULT_DIGITAL_CARD_FIELDS.map((f) => ({ ...f })),
  },
  {
    id: 'bottom_strip',
    name: 'Fascia Inferiore (Per Sfondo PDF/Foto)',
    description: 'Lascia libera la metà superiore per la grafica/sfondo PDF e raccoglie i testi in basso.',
    applyToFields: (fields) =>
      fields.map((f) => {
        switch (f.id) {
          case 'associationName':
            return { ...f, xPercent: 8, yPercent: 10, fontSize: 14 };
          case 'affiliation':
            return { ...f, xPercent: 8, yPercent: 19, fontSize: 9 };
          case 'cardTitle':
            return { ...f, xPercent: 93, yPercent: 11, fontSize: 9 };
          case 'memberName':
            return { ...f, xPercent: 8, yPercent: 58, fontSize: 19 };
          case 'cardNumber':
            return { ...f, xPercent: 8, yPercent: 76, fontSize: 14 };
          case 'insuranceType':
            return { ...f, xPercent: 50, yPercent: 76, fontSize: 13 };
          case 'validityDates':
            return { ...f, xPercent: 8, yPercent: 91, fontSize: 10 };
          case 'fiscalCode':
            return { ...f, xPercent: 50, yPercent: 91, fontSize: 10 };
          default:
            return f;
        }
      }),
  },
  {
    id: 'centered_badge',
    name: 'Centrato Istituzionale',
    description: 'Allineamento centrale simmetrico per nome associazione, socio e numero tessera.',
    applyToFields: (fields) =>
      fields.map((f) => {
        switch (f.id) {
          case 'associationName':
            return { ...f, xPercent: 50, yPercent: 13, align: 'center', fontSize: 16 };
          case 'affiliation':
            return { ...f, xPercent: 50, yPercent: 23, align: 'center', fontSize: 10 };
          case 'cardTitle':
            return { ...f, xPercent: 50, yPercent: 32, align: 'center', fontSize: 9 };
          case 'memberName':
            return { ...f, xPercent: 50, yPercent: 50, align: 'center', fontSize: 20 };
          case 'cardNumber':
            return { ...f, xPercent: 28, yPercent: 73, align: 'center', fontSize: 14 };
          case 'insuranceType':
            return { ...f, xPercent: 72, yPercent: 73, align: 'center', fontSize: 13 };
          case 'validityDates':
            return { ...f, xPercent: 28, yPercent: 89, align: 'center', fontSize: 10 };
          case 'fiscalCode':
            return { ...f, xPercent: 72, yPercent: 89, align: 'center', fontSize: 10 };
          default:
            return f;
        }
      }),
  },
];

export function resolveDigitalCardConfig(
  profile?: AssociationProfile
): DigitalCardTemplateConfig {
  const saved = profile?.digitalCardConfig;
  if (!saved) {
    return {
      ...DEFAULT_DIGITAL_CARD_CONFIG,
      fields: DEFAULT_DIGITAL_CARD_FIELDS.map((f) => ({ ...f })),
    };
  }
  const mergedFields = DEFAULT_DIGITAL_CARD_FIELDS.map((defField) => {
    const found = saved.fields?.find((f) => f.id === defField.id);
    return found ? { ...defField, ...found } : { ...defField };
  });

  return {
    ...DEFAULT_DIGITAL_CARD_CONFIG,
    ...saved,
    fields: mergedFields,
  };
}

export function resolveCardFieldTextValue(
  field: DigitalCardFieldPlacement,
  member: Member,
  profile: AssociationProfile,
  customOverrides?: {
    cardNumber?: string;
    insuranceLabel?: string;
    expiryDate?: string;
  }
): { prefix: string; value: string } {
  const prefix = field.showLabelPrefix
    ? (field.customPrefix !== undefined ? field.customPrefix : field.label)
    : '';

  switch (field.id) {
    case 'associationName':
      return {
        prefix,
        value: profile.name || 'Associazione Sportiva Dilettantistica',
      };
    case 'affiliation':
      return { prefix, value: profile.affiliation || 'Ente di Affiliazione' };
    case 'cardTitle':
      return {
        prefix: '',
        value: `${field.customPrefix || 'TESSERA ASSOCIATIVA'} ${profile.activeYear}`,
      };
    case 'memberName':
      return { prefix, value: member.childName || 'Socio Tesserato' };
    case 'cardNumber': {
      const num =
        customOverrides?.cardNumber !== undefined
          ? customOverrides.cardNumber
          : member.membershipCardNumber || `TESS-${profile.activeYear}-001`;
      return { prefix, value: num };
    }
    case 'insuranceType': {
      const insLabel = getInsuranceDisplayLabel(
        member.insuranceType,
        profile,
        customOverrides?.insuranceLabel
      );
      return { prefix, value: insLabel };
    }
    case 'validityDates': {
      const exp =
        customOverrides?.expiryDate !== undefined
          ? customOverrides.expiryDate
          : member.expiryDate || `31/12/${profile.activeYear}`;
      const formula =
        member.cardValidityType === 'tessera_365' ? 'Tessera 365' : 'Annuale Solare';
      return { prefix, value: `${exp} (${formula})` };
    }
    case 'fiscalCode':
      return {
        prefix,
        value: member.childFiscalCode || member.parentFiscalCode || 'N/D',
      };
    case 'customFooter': {
      const defaultFooter =
        profile.showApuacampAttributionInDocs ||
        (profile.name || '').toLowerCase().includes('apuacamp')
          ? 'Ideato da ASD Apuacamp'
          : 'Tessera Associativa Ufficiale';
      return {
        prefix: '',
        value: profile.digitalCardConfig?.customFooterText || defaultFooter,
      };
    }
  }
}

/**
 * Generates an SVG data URL for the association's emblem / crest ("Stemma dell'Associazione")
 */
export function generateAsdEmblemDataUrl(
  asdName: string = 'Associazione Sportiva Dilettantistica',
  affiliation: string = 'ASD'
): string {
  const cleanName = (asdName || 'Associazione').trim().toUpperCase().slice(0, 26);
  const initials = cleanName
    .split(/\s+/)
    .filter((w) => !w.includes('A.S.D') && !w.includes('ASD'))
    .map((w) => w[0])
    .join('')
    .slice(0, 2) || 'AC';
  const shortAff = (affiliation || 'US ACLI').slice(0, 14).toUpperCase();

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" width="160" height="160">
    <defs>
      <linearGradient id="shieldGrad" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#065f46"/>
        <stop offset="55%" stop-color="#047857"/>
        <stop offset="100%" stop-color="#0f172a"/>
      </linearGradient>
    </defs>
    <circle cx="80" cy="80" r="74" fill="url(#shieldGrad)" stroke="#fbbf24" stroke-width="5"/>
    <circle cx="80" cy="80" r="65" fill="none" stroke="#a7f3d0" stroke-width="1.5" stroke-dasharray="4 3"/>
    <!-- Mountain & Outdoor Peaks -->
    <polygon points="34,102 64,52 92,102" fill="#10b981" opacity="0.85"/>
    <polygon points="62,102 96,44 128,102" fill="#34d399" opacity="0.95"/>
    <polygon points="96,44 85,63 107,63" fill="#ffffff" opacity="0.9"/>
    <text x="80" y="95" text-anchor="middle" font-family="Arial, sans-serif" font-weight="900" font-size="34" fill="#ffffff" stroke="#064e3b" stroke-width="1.5">${initials}</text>
    <rect x="26" y="106" width="108" height="20" rx="10" fill="#fbbf24"/>
    <text x="80" y="120" text-anchor="middle" font-family="Arial, sans-serif" font-weight="800" font-size="10" fill="#0f172a">${shortAff}</text>
  </svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Processes an uploaded file (either an image PNG/JPG/WEBP/SVG or a .PDF file)
 * to be used as the background of the digital membership card.
 */
export async function processDigitalCardBackgroundFile(file: File): Promise<{
  previewDataUrl: string;
  rawPdfDataUrl?: string;
  fileName: string;
}> {
  const isPdf =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  if (!isPdf) {
    // Standard image file -> compress/resize to crisp card canvas DataURL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('Errore lettura file immagine'));
      reader.readAsDataURL(file);
    });

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const targetW = 800;
        const targetH = 502;
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
          resolve({
            previewDataUrl: canvas.toDataURL('image/jpeg', 0.82),
            fileName: file.name,
          });
        } else {
          resolve({ previewDataUrl: dataUrl, fileName: file.name });
        }
      };
      img.onerror = () => resolve({ previewDataUrl: dataUrl, fileName: file.name });
      img.src = dataUrl;
    });
  }

  // Try to extract an embedded JPEG stream from the PDF binary if present;
  // otherwise generate a stylized PDF-template vector background canvas so the user immediately sees their PDF background active.
  try {
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    // Look for JPEG SOI (0xFF 0xD8 0xFF) and EOI (0xFF 0xD9) inside the PDF
    let startIdx = -1;
    let endIdx = -1;
    for (let i = 0; i < bytes.length - 3; i++) {
      if (bytes[i] === 0xff && bytes[i + 1] === 0xd8 && bytes[i + 2] === 0xff) {
        startIdx = i;
        break;
      }
    }
    if (startIdx >= 0) {
      for (let j = bytes.length - 2; j > startIdx + 100; j--) {
        if (bytes[j] === 0xff && bytes[j + 1] === 0xd9) {
          endIdx = j + 2;
          break;
        }
      }
    }

    if (startIdx >= 0 && endIdx > startIdx) {
      const jpegSlice = bytes.slice(startIdx, endIdx);
      const blob = new Blob([jpegSlice], { type: 'image/jpeg' });
      const extractedUrl = await new Promise<string>((resolve) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ''));
        r.readAsDataURL(blob);
      });
      if (extractedUrl.startsWith('data:image/')) {
        // Compress extracted JPEG to max 800x502
        const compressedPreview = await new Promise<string>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = 800;
            canvas.height = 502;
            const ctx = canvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(img, 0, 0, 800, 502);
              resolve(canvas.toDataURL('image/jpeg', 0.82));
            } else {
              resolve(extractedUrl);
            }
          };
          img.onerror = () => resolve(extractedUrl);
          img.src = extractedUrl;
        });
        return {
          previewDataUrl: compressedPreview,
          fileName: file.name,
        };
      }
    }
  } catch {
    // fallback to canvas rendering below
  }

  // Render a clean graphic background representing the loaded PDF template (800x502 JPEG)
  const canvas = document.createElement('canvas');
  canvas.width = 800;
  canvas.height = 502;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const grad = ctx.createLinearGradient(0, 0, 800, 502);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.5, '#065f46');
    grad.addColorStop(1, '#1e293b');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 502);

    // Subtle geometric pattern from PDF template
    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 2;
    for (let x = -200; x < 1000; x += 65) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 250, 502);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(251, 191, 36, 0.35)';
    ctx.lineWidth = 3;
    ctx.strokeRect(14, 14, 800 - 28, 502 - 28);
  }

  return {
    previewDataUrl: canvas.toDataURL('image/jpeg', 0.82),
    fileName: file.name,
  };
}

function loadImageElement(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

export interface RenderDigitalCardOptions {
  member: Member;
  profile: AssociationProfile;
  config: DigitalCardTemplateConfig;
  customOverrides?: {
    cardNumber?: string;
    insuranceLabel?: string;
    expiryDate?: string;
  };
}

/**
 * Renders the Digital Membership Card at high resolution (1020x640 CR80 ratio) onto an HTMLCanvasElement
 */
export async function renderDigitalCardToCanvas(
  options: RenderDigitalCardOptions
): Promise<HTMLCanvasElement> {
  const { member, profile, config, customOverrides } = options;
  const W = 1020;
  const H = 640;

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;

  // 1. Draw Theme Preset Base Background
  const theme: DigitalCardThemePreset = config.themePreset || 'apuacamp_emerald';
  if (theme === 'usacli_sport_blue') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#0f172a');
    grad.addColorStop(0.55, '#1e3a8a');
    grad.addColorStop(1, '#1d4ed8');
    ctx.fillStyle = grad;
  } else if (theme === 'gold_prestige') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#1c1917');
    grad.addColorStop(0.6, '#44403c');
    grad.addColorStop(1, '#78350f');
    ctx.fillStyle = grad;
  } else if (theme === 'minimal_light') {
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#f8fafc');
    grad.addColorStop(1, '#e2e8f0');
    ctx.fillStyle = grad;
  } else {
    // apuacamp_emerald default
    const grad = ctx.createLinearGradient(0, 0, W, H);
    grad.addColorStop(0, '#064e3b');
    grad.addColorStop(0.55, '#047857');
    grad.addColorStop(1, '#0f172a');
    ctx.fillStyle = grad;
  }
  ctx.fillRect(0, 0, W, H);

  // Decorative subtle circles on theme background
  ctx.save();
  ctx.fillStyle =
    theme === 'minimal_light' ? 'rgba(15, 23, 42, 0.04)' : 'rgba(255, 255, 255, 0.05)';
  ctx.beginPath();
  ctx.arc(W * 0.85, H * 0.2, 220, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(W * 0.15, H * 0.85, 180, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 2. Draw Custom Uploaded Background (Image or PDF page) if present
  if (config.backgroundDataUrl) {
    const bgImg = await loadImageElement(config.backgroundDataUrl);
    if (bgImg) {
      ctx.save();
      ctx.globalAlpha = Math.max(0.1, Math.min(1, config.backgroundOpacity ?? 0.9));
      ctx.drawImage(bgImg, 0, 0, W, H);
      ctx.restore();
    }
  }

  // Card border frame
  ctx.save();
  ctx.strokeStyle =
    theme === 'minimal_light' ? 'rgba(15, 23, 42, 0.2)' : 'rgba(255, 255, 255, 0.22)';
  ctx.lineWidth = 3;
  ctx.strokeRect(16, 16, W - 32, H - 32);
  ctx.restore();

  // 3. Draw Association Emblem / Logo ("Stemma dell'Associazione")
  const logoSrc =
    profile.logoImageDataUrl ||
    profile.stampImageDataUrl ||
    generateAsdEmblemDataUrl(profile.name, profile.affiliation);
  if (config.showLogo && logoSrc) {
    const logoImg = await loadImageElement(logoSrc);
    if (logoImg) {
      const scale = (config.logoScalePercent || 100) / 100;
      const baseSize = 115 * scale;
      const cx = (config.logoXPercent / 100) * W;
      const cy = (config.logoYPercent / 100) * H;
      ctx.save();
      ctx.drawImage(logoImg, cx - baseSize / 2, cy - baseSize / 2, baseSize, baseSize);
      ctx.restore();
    }
  }

  // 4. Draw Verification Badge / QR Simulation if enabled
  if (config.showQrVerificationBadge) {
    const qx = (config.qrXPercent / 100) * W;
    const qy = (config.qrYPercent / 100) * H;
    const boxSize = 112;
    ctx.save();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(qx - boxSize / 2, qy - boxSize / 2, boxSize, boxSize);
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 2;
    ctx.strokeRect(qx - boxSize / 2 + 4, qy - boxSize / 2 + 4, boxSize - 8, boxSize - 8);

    // Draw deterministic matrix pattern from member card number
    const seedStr = `${member.membershipCardNumber || member.id}-${profile.activeYear}`;
    ctx.fillStyle = '#0f172a';
    const cells = 7;
    const cellPx = Math.floor((boxSize - 24) / cells);
    const startX = qx - boxSize / 2 + 12;
    const startY = qy - boxSize / 2 + 12;
    for (let r = 0; r < cells; r++) {
      for (let c = 0; c < cells; c++) {
        const isCorner =
          (r < 2 && c < 2) || (r < 2 && c >= cells - 2) || (r >= cells - 2 && c < 2);
        const charCode = seedStr.charCodeAt((r * cells + c) % seedStr.length) || 42;
        if (isCorner || (charCode + r * 3 + c * 7) % 2 === 0) {
          ctx.fillRect(startX + c * cellPx, startY + r * cellPx, cellPx - 1, cellPx - 1);
        }
      }
    }
    ctx.restore();
  }

  // 5. Draw all Visible Text Fields at their user-configured X/Y coordinates
  const scaleFactor = 2.0; // Map UI preview font sizes (e.g. 14px) to 1020px canvas
  for (const field of config.fields) {
    if (!field.visible) continue;
    const { prefix, value } = resolveCardFieldTextValue(
      field,
      member,
      profile,
      customOverrides
    );
    if (!value) continue;

    const x = (field.xPercent / 100) * W;
    const y = (field.yPercent / 100) * H;

    ctx.save();
    ctx.textAlign = field.align || 'left';
    ctx.textBaseline = 'top';

    let currentY = y;
    if (prefix) {
      const prefixPx = Math.max(13, Math.round(field.fontSize * scaleFactor * 0.56));
      ctx.font = `700 ${prefixPx}px Inter, Arial, sans-serif`;
      ctx.fillStyle =
        theme === 'minimal_light' ? '#475569' : 'rgba(255, 255, 255, 0.72)';
      ctx.fillText(prefix.toUpperCase(), x, currentY);
      currentY += prefixPx + 4;
    }

    const valuePx = Math.max(16, Math.round(field.fontSize * scaleFactor));
    const isMono = field.id === 'cardNumber' || field.id === 'fiscalCode';
    ctx.font = `${field.id === 'memberName' || field.id === 'cardNumber' ? '800' : '700'} ${valuePx}px ${
      isMono ? 'Courier New, monospace' : 'Inter, Arial, sans-serif'
    }`;
    ctx.fillStyle = field.color || '#ffffff';
    ctx.fillText(value, x, currentY);
    ctx.restore();
  }

  return canvas;
}

/**
 * Exports the Digital Membership Card as a downloadable PNG image
 */
export async function exportDigitalCardToPng(
  options: RenderDigitalCardOptions
): Promise<void> {
  const canvas = await renderDigitalCardToCanvas(options);
  const dataUrl = canvas.toDataURL('image/png');
  const safeName = (options.member.childName || 'Socio').replace(/[^a-zA-Z0-9_-]/g, '_');
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `Tessera_Digitale_${safeName}_${options.profile.activeYear}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * Exports the Digital Membership Card as a printable PDF document (with the card in high-res + cut lines & summary)
 */
export async function exportDigitalCardToPdf(
  options: RenderDigitalCardOptions
): Promise<void> {
  const cardCanvas = await renderDigitalCardToCanvas(options);

  // Build an A4 sheet canvas containing the front card + institutional cut sheet
  const pageW = 1240;
  const pageH = 1754;
  const sheet = document.createElement('canvas');
  sheet.width = pageW;
  sheet.height = pageH;
  const ctx = sheet.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageW, pageH);

  // Header
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 32px Arial, sans-serif';
  ctx.fillText(
    `TESSERA ASSOCIATIVA DIGITALE ${options.profile.activeYear} — ${options.profile.name}`,
    90,
    110
  );
  ctx.fillStyle = '#475569';
  ctx.font = '20px Arial, sans-serif';
  ctx.fillText(
    `${options.profile.affiliation || 'US ACLI'} · Documento digitale per il socio: ${
      options.member.childName
    }`,
    90,
    148
  );

  // Draw the high-res card centered
  const cardDrawW = 920;
  const cardDrawH = Math.round((cardDrawW * 640) / 1020);
  const cardX = Math.round((pageW - cardDrawW) / 2);
  const cardY = 210;

  ctx.save();
  ctx.strokeStyle = '#94a3b8';
  ctx.setLineDash([8, 6]);
  ctx.lineWidth = 2;
  ctx.strokeRect(cardX - 10, cardY - 10, cardDrawW + 20, cardDrawH + 20);
  ctx.restore();

  ctx.drawImage(cardCanvas, cardX, cardY, cardDrawW, cardDrawH);

  // Summary box below the card
  const boxY = cardY + cardDrawH + 70;
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(90, boxY, pageW - 180, 260);
  ctx.strokeStyle = '#cbd5e1';
  ctx.lineWidth = 2;
  ctx.strokeRect(90, boxY, pageW - 180, 260);

  const insLabel = getInsuranceDisplayLabel(
    options.member.insuranceType,
    options.profile,
    options.customOverrides?.insuranceLabel
  );

  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 22px Arial, sans-serif';
  ctx.fillText('RIEPILOGO DATI TESSERAMENTO E COPERTURA ASSICURATIVA', 120, boxY + 46);

  ctx.font = '20px Arial, sans-serif';
  ctx.fillStyle = '#334155';
  ctx.fillText(`• Socio / Tesserato: ${options.member.childName}`, 120, boxY + 92);
  ctx.fillText(
    `• Numero Tessera: ${
      options.customOverrides?.cardNumber ||
      options.member.membershipCardNumber ||
      'In rilascio'
    }`,
    120,
    boxY + 130
  );
  ctx.fillText(`• Copertura Assicurativa: ${insLabel}`, 120, boxY + 168);
  ctx.fillText(
    `• Scadenza Tesserino: ${
      options.customOverrides?.expiryDate || options.member.expiryDate || '31/12'
    }`,
    120,
    boxY + 206
  );

  ctx.fillStyle = '#64748b';
  ctx.font = 'italic 16px Arial, sans-serif';
  const showAttribution =
    options.profile.showApuacampAttributionInDocs ||
    (options.profile.name || '').toLowerCase().includes('apuacamp');
  ctx.fillText(
    showAttribution
      ? `Generato da ${options.profile.name || 'Associazione'} — Piattaforma Gestionale ideata da ASD Apuacamp`
      : `Documento ufficiale generato da ${options.profile.name || 'Associazione Sportiva Dilettantistica'}`,
    90,
    pageH - 80
  );

  // Convert sheet canvas to a standalone single-page PDF
  const jpegDataUrl = sheet.toDataURL('image/jpeg', 0.92);
  const base64Data = jpegDataUrl.split(',')[1] || '';
  const binaryImg = atob(base64Data);
  const imgBytes = new Uint8Array(binaryImg.length);
  for (let i = 0; i < binaryImg.length; i++) {
    imgBytes[i] = binaryImg.charCodeAt(i);
  }

  const pdfW = 595.28;
  const pdfH = 841.89;
  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let byteLength = 0;

  const pushStr = (s: string) => {
    const arr = encoder.encode(s);
    chunks.push(arr);
    byteLength += arr.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    byteLength += b.length;
  };
  const markObj = () => {
    offsets.push(byteLength);
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');
  markObj();
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');
  markObj();
  pushStr('2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n');
  markObj();
  pushStr(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pdfW} ${pdfH}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`
  );
  markObj();
  pushStr(
    `4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${pageW} /Height ${pageH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`
  );
  pushBytes(imgBytes);
  pushStr('\nendstream\nendobj\n');

  const contentStream = `q\n${pdfW} 0 0 ${pdfH} 0 0 cm\n/Im0 Do\nQ\n`;
  markObj();
  pushStr(
    `5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`
  );

  const xrefOffset = byteLength;
  pushStr(`xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n`);
  for (const off of offsets) {
    pushStr(`${String(off).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  const safeName = (options.member.childName || 'Socio').replace(/[^a-zA-Z0-9_-]/g, '_');
  const blob = new Blob(chunks as unknown as BlobPart[], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Tessera_Digitale_${safeName}_${options.profile.activeYear}.pdf`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
