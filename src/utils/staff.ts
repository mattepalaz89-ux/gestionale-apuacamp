import {
  CashTransaction,
  Member,
  StaffMember,
  StaffPaymentKind,
  StaffThresholdsConfig,
} from '../types';
import { parseToIsoDate } from './dates';
import { isPlaceholderFiscalCode } from './receipts';

export const DEFAULT_STAFF_THRESHOLDS: StaffThresholdsConfig = {
  inpsExemption: 5000,
  irpefExemption: 15000,
  warningPercent: 80,
};

export const STAFF_PAYMENT_KIND_LABELS: Record<StaffPaymentKind, string> = {
  compenso_sportivo: 'Quota lavoro sportivo dilettantistico',
  servizi_guida: 'Servizi guida ed escursioni',
  progettazione: 'Progettazione e coordinamento',
  rimborso_spese: 'Rimborso spese vive (piè di lista - escluso da soglie)',
};

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Verifica la corrispondenza sul NOME COMPLETO a parola intera (regex con \b, case-insensitive)
 * per i movimenti storici privi di `staffId`.
 * Non effettua MAI corrispondenze sul solo nome di battesimo ("Emma" non fa match con "Gemma",
 * e "Nicola Rossi" non fa match con "Nicola Bianchi").
 */
export function matchesLegacyStaffFullName(
  description: string | undefined | null,
  staffFullName: string | undefined | null
): boolean {
  if (!description || !staffFullName) return false;
  const cleanName = staffFullName.trim().replace(/\s+/g, ' ');
  if (!cleanName) return false;
  const pattern = escapeRegExp(cleanName).replace(/\s+/g, '\\s+');
  const regex = new RegExp(`\\b${pattern}\\b`, 'i');
  return regex.test(description);
}

/**
 * Determina se un movimento Staff è un rimborso spese a piè di lista
 * (che non concorre al calcolo delle soglie contributive INPS 5.000 € e fiscali IRPEF 15.000 €).
 */
export function isStaffReimbursement(tx: CashTransaction): boolean {
  if (tx.staffPaymentKind) {
    return tx.staffPaymentKind === 'rimborso_spese';
  }
  const desc = (tx.description || '').toLowerCase();
  return (
    desc.includes('rimborso spese') ||
    desc.includes('piè di lista') ||
    desc.includes('pie di lista') ||
    desc.includes('rimborso chilometrico') ||
    desc.includes('rimborso documentato')
  );
}

/**
 * Estrae l'anno solare di un movimento (da YYYY-MM-DD o DD/MM/YYYY), con fallback all'anno attivo.
 */
export function getTransactionSolarYear(
  tx: CashTransaction,
  fallbackYear: number
): number {
  const iso = parseToIsoDate(tx.date);
  if (iso) {
    const yr = parseInt(iso.slice(0, 4), 10);
    if (Number.isFinite(yr) && yr >= 1900 && yr <= 2100) return yr;
  }
  const m = (tx.date || '').match(/\b(20\d{2})\b/);
  if (m) {
    return parseInt(m[1], 10);
  }
  return fallbackYear;
}

/**
 * Restituisce i compensi sportivi percepiti dal collaboratore presso ALTRE ASD/SSD/enti
 * nell'anno solare specificato (autocertificazione lavoratore sportivo D.Lgs. 36/2021).
 */
export function getStaffExternalCompensationForYear(
  member: StaffMember,
  year: number
): number {
  if (
    member.otherAssociationsCompensationByYear &&
    typeof member.otherAssociationsCompensationByYear[year] === 'number' &&
    Number.isFinite(member.otherAssociationsCompensationByYear[year])
  ) {
    return Math.max(0, member.otherAssociationsCompensationByYear[year]);
  }
  if (
    typeof member.otherAssociationsCompensation === 'number' &&
    Number.isFinite(member.otherAssociationsCompensation)
  ) {
    return Math.max(0, member.otherAssociationsCompensation);
  }
  return 0;
}

export type StaffThresholdStatus =
  | 'ok'
  | 'warning_inps'
  | 'exceeded_inps'
  | 'exceeded_irpef';

export interface StaffAnnualSummary {
  member: StaffMember;
  year: number;
  /** Compensi sportivi erogati dalla nostra ASD nell'anno solare (esclusi rimborsi a piè di lista) */
  asdCompensation: number;
  /** Rimborsi spese a piè di lista erogati dalla nostra ASD nell'anno solare */
  asdReimbursements: number;
  /** Totale complessivo uscito dalla cassa ASD per il collaboratore (compensi + rimborsi) */
  totalAsdPaid: number;
  /** Compensi percepiti dal lavoratore presso altre ASD/SSD/enti nello stesso anno solare */
  otherAssociationsCompensation: number;
  /** Totale cumulativo annuo su cui si calcolano le soglie D.Lgs. 36/2021 (asdCompensation + otherAssociationsCompensation) */
  cumulativeAnnualCompensation: number;
  paymentCount: number;
  lastPaymentDate: string;
  transactions: CashTransaction[];
  legacyUnlinkedTransactions: CashTransaction[];
  thresholdStatus: StaffThresholdStatus;
  warningThresholdAmount: number;
  inpsExemptionLimit: number;
  irpefExemptionLimit: number;
  inpsExcessAmount: number;
  irpefExcessAmount: number;
  inpsProgressPercent: number;
}

/**
 * Calcola il riepilogo annuale per un collaboratore sportivo nell'anno solare specificato:
 * - include i movimenti con `tx.staffId === member.id`;
 * - per i movimenti vecchi senza `tx.staffId` (e categoria 'Staff'), verifica il nome completo a parola intera;
 * - esclude i rimborsi spese a piè di lista (`staffPaymentKind === 'rimborso_spese'`) dal calcolo delle soglie;
 * - somma i compensi percepiti presso altre associazioni (`otherAssociationsCompensation`);
 * - valuta le soglie D.Lgs. 36/2021 (80% di 5.000 € = 4.000 € avviso arancione; > 5.000 € avviso rosso INPS; > 15.000 € avviso rosso IRPEF).
 */
export function calculateStaffAnnualSummary(
  member: StaffMember,
  transactions: CashTransaction[],
  year: number,
  customThresholds?: Partial<StaffThresholdsConfig>
): StaffAnnualSummary {
  const rules: StaffThresholdsConfig = {
    ...DEFAULT_STAFF_THRESHOLDS,
    ...(customThresholds || {}),
  };
  const warningThresholdAmount =
    Math.round(((rules.inpsExemption * rules.warningPercent) / 100) * 100) / 100;

  const matchedTxs: CashTransaction[] = [];
  const legacyUnlinked: CashTransaction[] = [];

  for (const tx of transactions) {
    if ((tx.expense || 0) <= 0) continue;
    const txYear = getTransactionSolarYear(tx, year);
    if (txYear !== year) continue;

    if (tx.staffId) {
      if (tx.staffId === member.id) {
        matchedTxs.push(tx);
      }
    } else if (tx.category === 'Staff' && matchesLegacyStaffFullName(tx.description, member.name)) {
      matchedTxs.push(tx);
      legacyUnlinked.push(tx);
    }
  }

  let asdCompensation = 0;
  let asdReimbursements = 0;

  for (const tx of matchedTxs) {
    const amt = tx.expense || 0;
    if (isStaffReimbursement(tx)) {
      asdReimbursements += amt;
    } else {
      asdCompensation += amt;
    }
  }

  asdCompensation = Math.round(asdCompensation * 100) / 100;
  asdReimbursements = Math.round(asdReimbursements * 100) / 100;
  const totalAsdPaid = Math.round((asdCompensation + asdReimbursements) * 100) / 100;
  const otherAssociationsCompensation =
    Math.round(getStaffExternalCompensationForYear(member, year) * 100) / 100;
  const cumulativeAnnualCompensation =
    Math.round((asdCompensation + otherAssociationsCompensation) * 100) / 100;

  let thresholdStatus: StaffThresholdStatus = 'ok';
  if (cumulativeAnnualCompensation > rules.irpefExemption) {
    thresholdStatus = 'exceeded_irpef';
  } else if (cumulativeAnnualCompensation > rules.inpsExemption) {
    thresholdStatus = 'exceeded_inps';
  } else if (cumulativeAnnualCompensation >= warningThresholdAmount) {
    thresholdStatus = 'warning_inps';
  }

  const inpsExcessAmount =
    Math.round(Math.max(0, cumulativeAnnualCompensation - rules.inpsExemption) * 100) / 100;
  const irpefExcessAmount =
    Math.round(Math.max(0, cumulativeAnnualCompensation - rules.irpefExemption) * 100) / 100;
  const inpsProgressPercent =
    rules.inpsExemption > 0
      ? Math.min(100, Math.round((cumulativeAnnualCompensation / rules.inpsExemption) * 100))
      : 0;

  const sortedByDate = [...matchedTxs].sort((a, b) => {
    const isoA = parseToIsoDate(a.date) || a.date;
    const isoB = parseToIsoDate(b.date) || b.date;
    return isoA.localeCompare(isoB);
  });

  return {
    member,
    year,
    asdCompensation,
    asdReimbursements,
    totalAsdPaid,
    otherAssociationsCompensation,
    cumulativeAnnualCompensation,
    paymentCount: matchedTxs.length,
    lastPaymentDate: sortedByDate[sortedByDate.length - 1]?.date || '-',
    transactions: matchedTxs,
    legacyUnlinkedTransactions: legacyUnlinked,
    thresholdStatus,
    warningThresholdAmount,
    inpsExemptionLimit: rules.inpsExemption,
    irpefExemptionLimit: rules.irpefExemption,
    inpsExcessAmount,
    irpefExcessAmount,
    inpsProgressPercent,
  };
}

export interface LegacyStaffPaymentMatch {
  transaction: CashTransaction;
  staffMember: StaffMember;
  inferredKind: StaffPaymentKind;
}

/**
 * Individua tutti i vecchi pagamenti Staff privi di `staffId` che trovano corrispondenza
 * univoca sul nome completo a parola intera di un collaboratore, pronti per essere collegati
 * previa conferma dell'utente ("Collega i vecchi pagamenti").
 */
export function findLegacyUnlinkedStaffPayments(
  staff: StaffMember[],
  transactions: CashTransaction[]
): LegacyStaffPaymentMatch[] {
  const results: LegacyStaffPaymentMatch[] = [];
  for (const tx of transactions) {
    if (tx.staffId || tx.category !== 'Staff' || (tx.expense || 0) <= 0) continue;
    const matchingMembers = staff.filter((s) =>
      matchesLegacyStaffFullName(tx.description, s.name)
    );
    if (matchingMembers.length === 1) {
      const descLower = (tx.description || '').toLowerCase();
      let inferredKind: StaffPaymentKind = 'compenso_sportivo';
      if (isStaffReimbursement(tx)) {
        inferredKind = 'rimborso_spese';
      } else if (descLower.includes('guida') || descLower.includes('escursion')) {
        inferredKind = 'servizi_guida';
      } else if (descLower.includes('progettazione') || descLower.includes('coordinamento')) {
        inferredKind = 'progettazione';
      }
      results.push({
        transaction: tx,
        staffMember: matchingMembers[0],
        inferredKind,
      });
    }
  }
  return results;
}

export interface MemberMatchResult {
  status: 'unique' | 'ambiguous' | 'none';
  member?: Member;
  candidates: Member[];
}

/**
 * Associa un'iscrizione / risposta Google Form al socio nell'anagrafica (Fase 4.2):
 * 1. Prima per Codice Fiscale del bambino/socio (se presente e non segnaposto);
 * 2. Poi per Nome completo + Data di nascita (se entrambi presenti);
 * 3. Infine per Nome completo: se c'è un solo socio con quel nome -> unique;
 *    se ci sono più omonimi -> ambiguous (così l'interfaccia chiede all'utente quale socio collegare).
 */
export function matchMemberForRegistration(
  members: Member[],
  criteria: {
    childFiscalCode?: string;
    childName?: string;
    birthDate?: string;
  }
): MemberMatchResult {
  if (!Array.isArray(members) || members.length === 0) {
    return { status: 'none', candidates: [] };
  }

  const cf = (criteria.childFiscalCode || '').trim().toUpperCase();
  if (cf && !isPlaceholderFiscalCode(cf)) {
    const byCf = members.filter(
      (m) => (m.childFiscalCode || '').trim().toUpperCase() === cf
    );
    if (byCf.length === 1) {
      return { status: 'unique', member: byCf[0], candidates: byCf };
    }
    if (byCf.length > 1) {
      return { status: 'ambiguous', candidates: byCf };
    }
  }

  const normName = (criteria.childName || '').trim().toLowerCase().replace(/\s+/g, ' ');
  if (!normName) {
    return { status: 'none', candidates: [] };
  }

  const isoBirth = parseToIsoDate(criteria.birthDate);
  if (isoBirth) {
    const byNameAndBirth = members.filter((m) => {
      const mName = (m.childName || '').trim().toLowerCase().replace(/\s+/g, ' ');
      const mBirth = parseToIsoDate(m.birthDate);
      return mName === normName && mBirth === isoBirth;
    });
    if (byNameAndBirth.length === 1) {
      return { status: 'unique', member: byNameAndBirth[0], candidates: byNameAndBirth };
    }
    if (byNameAndBirth.length > 1) {
      return { status: 'ambiguous', candidates: byNameAndBirth };
    }
  }

  const byNameOnly = members.filter(
    (m) => (m.childName || '').trim().toLowerCase().replace(/\s+/g, ' ') === normName
  );
  if (byNameOnly.length === 1) {
    return { status: 'unique', member: byNameOnly[0], candidates: byNameOnly };
  }
  if (byNameOnly.length > 1) {
    return { status: 'ambiguous', candidates: byNameOnly };
  }

  return { status: 'none', candidates: [] };
}
