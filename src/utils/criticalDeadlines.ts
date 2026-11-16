import {
  AssemblyMeeting,
  AssociationRole,
  CriticalDeadlineItem,
  CustomCriticalDeadline,
  DeadlineOverrideRecord,
  GrantItem,
} from '../types';
import { parseAnyDate, diffDays } from './notifications';

const SHORT_MONTHS_IT = [
  'Gen',
  'Feb',
  'Mar',
  'Apr',
  'Mag',
  'Giu',
  'Lug',
  'Ago',
  'Set',
  'Ott',
  'Nov',
  'Dic',
];

const FULL_MONTHS_IT = [
  'Gennaio',
  'Febbraio',
  'Marzo',
  'Aprile',
  'Maggio',
  'Giugno',
  'Luglio',
  'Agosto',
  'Settembre',
  'Ottobre',
  'Novembre',
  'Dicembre',
];

export interface SolarYearProgressSummary {
  solarYear: number;
  currentMonthIndex: number; // 0-11
  currentMonthName: string;
  dayOfYear: number;
  totalDaysInYear: number;
  yearElapsedPercent: number; // 0-100
  monthElapsedPercent: number; // 0-100 (for monthly INPS deadline)
  daysLeftInMonth: number;
  endOfCurrentMonthDate: string; // YYYY-MM-DD
  endOfCurrentMonthLabel: string; // e.g. "30 Nov 2026"
  completedCount: number;
  totalDeadlinesCount: number;
  completionRatePercent: number;
  urgentOrOverdueCount: number;
}

export function formatItalianShortDate(dateStr: string): string {
  const parsed = parseAnyDate(dateStr);
  if (!parsed) return dateStr;
  const d = String(parsed.getDate()).padStart(2, '0');
  const m = SHORT_MONTHS_IT[parsed.getMonth()] || '';
  const y = parsed.getFullYear();
  return `${d} ${m} ${y}`;
}

export function getDayOfYear(date: Date): { dayOfYear: number; totalDays: number; percent: number } {
  const year = date.getFullYear();
  const start = Date.UTC(year, 0, 1);
  const end = Date.UTC(year, 11, 31);
  const current = Date.UTC(year, date.getMonth(), date.getDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  const totalDays = Math.round((end - start) / msPerDay) + 1;
  const dayOfYear = Math.max(1, Math.min(totalDays, Math.round((current - start) / msPerDay) + 1));
  const percent = Math.min(100, Math.max(1, Math.round((dayOfYear / totalDays) * 100)));
  return { dayOfYear, totalDays, percent };
}

export interface VisualAlertMeta {
  level: 'overdue' | 'critical' | 'urgent' | 'approaching' | 'scheduled' | 'completed';
  badgeText: string;
  shortAlertText: string;
  isPulsing: boolean;
  remainingWindowPercent: number;
}

export function formatRemainingTimeHuman(daysRemaining: number, isCompleted: boolean): string {
  if (isCompleted) return 'Adempimento completato ✓';
  if (daysRemaining === 0) return 'Scade OGGI (0 giorni rimasti)';
  if (daysRemaining < 0) {
    const past = Math.abs(daysRemaining);
    return `Scaduta da ${past} ${past === 1 ? 'giorno' : 'giorni'}`;
  }
  if (daysRemaining === 1) return 'Manca 1 giorno alla scadenza';
  if (daysRemaining <= 31) return `Mancano ${daysRemaining} giorni alla scadenza`;
  const months = Math.floor(daysRemaining / 30);
  const remDays = daysRemaining % 30;
  if (remDays === 0) {
    return `Mancano circa ${months} ${months === 1 ? 'mese' : 'mesi'} (${daysRemaining} gg)`;
  }
  return `Mancano ${months} ${months === 1 ? 'mese' : 'mesi'} e ${remDays} gg (${daysRemaining} gg totali)`;
}

/**
 * Calculates temporal progress bar percentage for an upcoming deadline using a preparation window (default 90 days)
 */
export function computeDeadlineTemporalProgress(
  daysRemaining: number,
  isCompleted: boolean,
  windowDays: number = 90
): number {
  if (isCompleted) return 100;
  if (daysRemaining <= 0) return 100;
  if (daysRemaining >= windowDays) {
    // Show a minimum baseline visibility based on how far within the 365-day year it is
    return Math.max(12, Math.round(((365 - Math.min(365, daysRemaining)) / 365) * 45));
  }
  const elapsedInWindow = windowDays - daysRemaining;
  return Math.min(98, Math.max(15, Math.round((elapsedInWindow / windowDays) * 100)));
}

export function getDeadlineStatus(
  daysRemaining: number,
  isCompleted: boolean
): CriticalDeadlineItem['status'] {
  if (isCompleted) return 'completed';
  if (daysRemaining < 0) return 'overdue';
  if (daysRemaining <= 20) return 'urgent';
  if (daysRemaining <= 50) return 'upcoming';
  return 'scheduled';
}

export function getVisualAlertMeta(
  daysRemaining: number,
  isCompleted: boolean,
  temporalProgressPercent: number
): VisualAlertMeta {
  const remainingWindowPercent = isCompleted
    ? 0
    : Math.max(0, Math.min(100, 100 - temporalProgressPercent));

  if (isCompleted) {
    return {
      level: 'completed',
      badgeText: 'COMPLETATA ✓',
      shortAlertText: 'Nessun avviso attivo',
      isPulsing: false,
      remainingWindowPercent: 0,
    };
  }
  if (daysRemaining < 0) {
    return {
      level: 'overdue',
      badgeText: `SCADUTA DA ${Math.abs(daysRemaining)} GG`,
      shortAlertText: 'Allerta Critica: Scadenza superata',
      isPulsing: true,
      remainingWindowPercent: 0,
    };
  }
  if (daysRemaining <= 7) {
    return {
      level: 'critical',
      badgeText: daysRemaining === 0 ? 'SCADE OGGI!' : `ALLERTA ROSSA · -${daysRemaining} GG`,
      shortAlertText: 'Scadenza imminente entro 7 giorni',
      isPulsing: true,
      remainingWindowPercent,
    };
  }
  if (daysRemaining <= 20) {
    return {
      level: 'urgent',
      badgeText: `AVVISO SCADENZA · -${daysRemaining} GG`,
      shortAlertText: 'Data in avvicinamento ravvicinato (entro 20 gg)',
      isPulsing: true,
      remainingWindowPercent,
    };
  }
  if (daysRemaining <= 50) {
    return {
      level: 'approaching',
      badgeText: `PREAVVISO · -${daysRemaining} GG`,
      shortAlertText: 'Data in avvicinamento (finestra 50 gg)',
      isPulsing: false,
      remainingWindowPercent,
    };
  }
  return {
    level: 'scheduled',
    badgeText: `PIANIFICATA · -${daysRemaining} GG`,
    shortAlertText: 'In programma nel calendario solare',
    isPulsing: false,
    remainingWindowPercent,
  };
}

/**
 * Builds the complete list of critical deadlines for the solar year,
 * combining statutory ASD obligations (US ACLI, Bilancio, Agenzia delle Entrate Settembre,
 * INPS Lavoro Sportivo fine mese, Tesserini Istruttori) with live Bandi & Governance data.
 */
export function buildCriticalYearDeadlines(params: {
  activeYear: number;
  referenceDate?: Date;
  assemblies?: AssemblyMeeting[];
  grants?: GrantItem[];
  roles?: AssociationRole[];
  completedDeadlineIds?: string[];
  customDeadlines?: CustomCriticalDeadline[];
  deadlineOverrides?: Record<string, DeadlineOverrideRecord>;
}): {
  deadlines: CriticalDeadlineItem[];
  summary: SolarYearProgressSummary;
} {
  const {
    activeYear,
    referenceDate = new Date(),
    assemblies = [],
    grants = [],
    roles = [],
    completedDeadlineIds = [],
    customDeadlines = [],
    deadlineOverrides = {},
  } = params;

  const completedSet = new Set(completedDeadlineIds);
  const refYear = referenceDate.getFullYear();
  const refMonth = referenceDate.getMonth(); // 0-11
  const refDay = referenceDate.getDate();

  // Last day of the current month for the recurring INPS Lavoro Sportivo deadline
  const lastDayOfCurrentMonth = new Date(refYear, refMonth + 1, 0);
  const totalDaysInCurrentMonth = lastDayOfCurrentMonth.getDate();
  const daysLeftInMonth = Math.max(0, totalDaysInCurrentMonth - refDay);
  const monthElapsedPercent = Math.min(
    100,
    Math.max(5, Math.round((refDay / totalDaysInCurrentMonth) * 100))
  );
  const endOfCurrentMonthIso = `${refYear}-${String(refMonth + 1).padStart(2, '0')}-${String(
    totalDaysInCurrentMonth
  ).padStart(2, '0')}`;

  // Helper to pick the next relevant occurrence of an annual (month, day) relative to referenceDate
  // so that deadlines already passed earlier in refYear roll forward to the next solar cycle (or activeYear)
  const resolveAnnualDateIso = (month1Based: number, day: number): string => {
    const candidateThisYear = new Date(refYear, month1Based - 1, day);
    const diffThisYear = diffDays(candidateThisYear, referenceDate);
    // If more than 30 days in the past in refYear, use next year (or activeYear)
    const targetYear =
      diffThisYear < -30 ? Math.max(refYear + 1, activeYear) : refYear;
    return `${targetYear}-${String(month1Based).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  };

  const items: CriticalDeadlineItem[] = [];

  // 1. COMUNICAZIONE MENSILE INPS / RASD LAVORO SPORTIVO (FINE OGNI MESE)
  const inpsId = `std-inps-mensile-${refYear}-${String(refMonth + 1).padStart(2, '0')}`;
  const inpsDone = completedSet.has(inpsId);
  const inpsYearPos = getDayOfYear(lastDayOfCurrentMonth).percent;
  items.push({
    id: inpsId,
    title: `Comunicazione INPS & RASD Lavoro Sportivo (Fine ${FULL_MONTHS_IT[refMonth]})`,
    description:
      'Invio mensile Uniemens / Registro RASD dei compensi erogati a collaboratori sportivi e istruttori e calcolo eventuali contributi INPS Gestione Separata (scadenza fine mese).',
    dueDate: endOfCurrentMonthIso,
    dueDateLabel: `${formatItalianShortDate(endOfCurrentMonthIso)} (Fine Mese)`,
    category: 'fisco_inps',
    recurrence: 'mensile',
    daysRemaining: daysLeftInMonth,
    temporalProgressPercent: inpsDone ? 100 : monthElapsedPercent,
    yearPositionPercent: inpsYearPos,
    status: getDeadlineStatus(daysLeftInMonth, inpsDone),
    isCompleted: inpsDone,
    actionTab: 'staff',
    actionLabel: 'Verifica Compensi Staff',
  });

  // 2. RINNOVO AFFILIAZIONE US ACLI & REGISTRO CONI/RASD (31 GENNAIO)
  const usacliDate = resolveAnnualDateIso(1, 31);
  const usacliDays = diffDays(parseAnyDate(usacliDate)!, referenceDate);
  const usacliId = 'std-affiliazione-usacli';
  const usacliDone = completedSet.has(usacliId);
  items.push({
    id: usacliId,
    title: 'Rinnovo Affiliazione Annuale US ACLI & Iscrizione RASD',
    description:
      'Rinnovo affiliazione dell\'ASD a US ACLI, verifica validità certificato iscrizione Registro Nazionale Attività Sportive Dilettantistiche (RASD) e polizze assicurative base/RCT.',
    dueDate: usacliDate,
    dueDateLabel: `${formatItalianShortDate(usacliDate)} (Inizio Anno)`,
    category: 'affiliazione_tesserini',
    recurrence: 'annuale',
    daysRemaining: usacliDays,
    temporalProgressPercent: computeDeadlineTemporalProgress(usacliDays, usacliDone, 60),
    yearPositionPercent: 8, // End of January (~8% of solar year)
    status: getDeadlineStatus(usacliDays, usacliDone),
    isCompleted: usacliDone,
    actionTab: 'members',
    actionLabel: 'Apri Tesseramento US ACLI',
  });

  // 3. CERTIFICAZIONE UNICA (CU) COLLABORATORI SPORTIVI (16 MARZO)
  const cuDate = resolveAnnualDateIso(3, 16);
  const cuDays = diffDays(parseAnyDate(cuDate)!, referenceDate);
  const cuId = 'std-cu-lavoro-sportivo';
  const cuDone = completedSet.has(cuId);
  items.push({
    id: cuId,
    title: 'Invio Certificazione Unica (CU) Lavoro Sportivo',
    description:
      'Trasmissione telematica all\'Agenzia delle Entrate e consegna delle Certificazioni Uniche (CU) ai collaboratori sportivi e guide per i compensi percepiti nell\'anno precedente.',
    dueDate: cuDate,
    dueDateLabel: `${formatItalianShortDate(cuDate)} (Annuale)`,
    category: 'fisco_inps',
    recurrence: 'annuale',
    daysRemaining: cuDays,
    temporalProgressPercent: computeDeadlineTemporalProgress(cuDays, cuDone, 75),
    yearPositionPercent: 21, // Mid March (~21% of solar year)
    status: getDeadlineStatus(cuDays, cuDone),
    isCompleted: cuDone,
    actionTab: 'staff',
    actionLabel: 'Riepilogo Compensi Staff',
  });

  // 4. ASSEMBLEA ORDINARIA DI BILANCIO & APPROVAZIONE RENDICONTO (30 APRILE)
  const rendicontoAsm = assemblies.find((a) => a.type === 'ordinaria_rendiconto');
  const bilancioDate =
    rendicontoAsm?.approvalDeadline || resolveAnnualDateIso(4, 30);
  const bilancioDays = diffDays(parseAnyDate(bilancioDate)!, referenceDate);
  const bilancioId = 'std-assemblea-bilancio';
  const bilancioDone =
    completedSet.has(bilancioId) || rendicontoAsm?.status === 'svolta_approvata';
  items.push({
    id: bilancioId,
    title: 'Assemblea di Bilancio & Approvazione Rendiconto Annuale',
    description:
      'Convocazione Assemblea Ordinaria dei Soci entro 4 mesi dalla chiusura dell\'esercizio (30 Aprile), approvazione del rendiconto economico-finanziario e caricamento verbale in Drive / RASD.',
    dueDate: bilancioDate,
    dueDateLabel: `${formatItalianShortDate(bilancioDate)} (Entro 30 Aprile)`,
    category: 'bilancio_governance',
    recurrence: 'annuale',
    daysRemaining: bilancioDays,
    temporalProgressPercent: computeDeadlineTemporalProgress(bilancioDays, bilancioDone, 90),
    yearPositionPercent: 33, // End of April (~33% of solar year)
    status: getDeadlineStatus(bilancioDays, bilancioDone),
    isCompleted: bilancioDone,
    actionTab: 'governance',
    actionLabel: 'Vai a Verbali & Assemblea',
  });

  // 5. VERIFICA SAFEGUARDING, CASELLARIO ISTRUTTORI & CERTIFICATI MEDICI (31 MAGGIO)
  const safeDate = resolveAnnualDateIso(5, 31);
  const safeDays = diffDays(parseAnyDate(safeDate)!, referenceDate);
  const safeId = 'std-safeguarding-pre-summer';
  const safeDone = completedSet.has(safeId);
  items.push({
    id: safeId,
    title: 'Verifica Safeguarding, Casellario Minori & Certificati (Pre-Summer Camp)',
    description:
      'Controllo certificati antipedofilia istruttori/staff a contatto con minori, rinnovo Responsabile Safeguarding (Tutela Minori) e verifica schede sanitarie prima dei campi estivi.',
    dueDate: safeDate,
    dueDateLabel: `${formatItalianShortDate(safeDate)} (Pre-Campi Estivi)`,
    category: 'bilancio_governance',
    recurrence: 'annuale',
    daysRemaining: safeDays,
    temporalProgressPercent: computeDeadlineTemporalProgress(safeDays, safeDone, 75),
    yearPositionPercent: 41, // End of May (~41% of solar year)
    status: getDeadlineStatus(safeDays, safeDone),
    isCompleted: safeDone,
    actionTab: 'governance',
    actionLabel: 'Controlla Safeguarding',
  });

  // 6. COMUNICAZIONE ANNUALE AGENZIA DELLE ENTRATE (INIZIO SETTEMBRE) & AVVIO TESSERA 365
  const adeDate = resolveAnnualDateIso(9, 5);
  const adeDays = diffDays(parseAnyDate(adeDate)!, referenceDate);
  const adeId = 'std-comunicazione-agenzia-entrate-settembre';
  const adeDone = completedSet.has(adeId);
  items.push({
    id: adeId,
    title: 'Comunicazione Annuale Agenzia delle Entrate (Inizio Settembre) & Apertura Tessera 365',
    description:
      'Adempimenti e comunicazioni annuali verso l\'Agenzia delle Entrate di inizio settembre, verifica requisiti fiscali ASD/ETS e attivazione finestra "Tessera 365" (dal 1° Settembre).',
    dueDate: adeDate,
    dueDateLabel: `${formatItalianShortDate(adeDate)} (Inizio Settembre)`,
    category: 'fisco_inps',
    recurrence: 'annuale',
    daysRemaining: adeDays,
    temporalProgressPercent: computeDeadlineTemporalProgress(adeDays, adeDone, 90),
    yearPositionPercent: 68, // Beginning of September (~68% of solar year)
    status: getDeadlineStatus(adeDays, adeDone),
    isCompleted: adeDone,
    actionTab: 'cashflow',
    actionLabel: 'Apri Contabilità & Fisco',
  });

  // 7. RINNOVO TESSERINI TECNICI ISTRUTTORI & GUIDE US ACLI / CONI (31 DICEMBRE)
  const tesseriniDate = resolveAnnualDateIso(12, 31);
  const tesseriniDays = diffDays(parseAnyDate(tesseriniDate)!, referenceDate);
  const tesseriniId = 'std-rinnovo-tesserini-istruttori';
  const tesseriniDone = completedSet.has(tesseriniId);
  items.push({
    id: tesseriniId,
    title: 'Rinnovo Tesserini Tecnici Istruttori & Albo Guide US ACLI',
    description:
      'Verifica scadenza e rinnovo dei tesserini tecnici nazionali degli istruttori, educatori e guide sportive/ambientali dell\'ASD, inclusa verifica crediti formativi e cariche in scadenza.',
    dueDate: tesseriniDate,
    dueDateLabel: `${formatItalianShortDate(tesseriniDate)} (Fine Anno Solare)`,
    category: 'affiliazione_tesserini',
    recurrence: 'annuale',
    daysRemaining: tesseriniDays,
    temporalProgressPercent: computeDeadlineTemporalProgress(tesseriniDays, tesseriniDone, 90),
    yearPositionPercent: 99, // End of December
    status: getDeadlineStatus(tesseriniDays, tesseriniDone),
    isCompleted: tesseriniDone,
    actionTab: 'staff',
    actionLabel: 'Gestisci Istruttori & Staff',
  });

  // 8. DYNAMIC BANDI & FINANZIAMENTI DEADLINES (Presentazione & Rendicontazione)
  for (const g of grants) {
    if (g.status === 'non_ammesso') continue;

    // Submission deadline
    if (g.submissionDeadline) {
      const subParsed = parseAnyDate(g.submissionDeadline);
      if (subParsed) {
        const subDays = diffDays(subParsed, referenceDate);
        const subId = `grant-sub-${g.id}`;
        const isSubCompleted =
          completedSet.has(subId) ||
          g.status === 'presentato' ||
          g.status === 'approvato_finanziato' ||
          g.status === 'in_rendicontazione' ||
          g.status === 'chiuso_rendicontato';

        items.push({
          id: subId,
          title: `Scadenza Presentazione Bando: ${g.title}`,
          description: `Ente: ${g.promoter} — Invio domanda e allegati progettuali (Contributo richiesto: € ${g.requestedAmount}).`,
          dueDate: g.submissionDeadline,
          dueDateLabel: `${formatItalianShortDate(g.submissionDeadline)} (Domanda Bando)`,
          category: 'bandi_contributi',
          recurrence: 'bando',
          daysRemaining: subDays,
          temporalProgressPercent: computeDeadlineTemporalProgress(subDays, isSubCompleted, 60),
          yearPositionPercent: getDayOfYear(subParsed).percent,
          status: getDeadlineStatus(subDays, isSubCompleted),
          isCompleted: isSubCompleted,
          actionTab: 'grants',
          actionLabel: 'Apri Scheda Bando',
        });
      }
    }

    // Reporting deadline (Rendicontazione)
    if (g.reportingDeadline) {
      const repParsed = parseAnyDate(g.reportingDeadline);
      if (repParsed) {
        const repDays = diffDays(repParsed, referenceDate);
        const repId = `grant-rep-${g.id}`;
        const isRepCompleted =
          completedSet.has(repId) || g.status === 'chiuso_rendicontato';

        items.push({
          id: repId,
          title: `Scadenza Rendicontazione Bando: ${g.title}`,
          description: `Ente: ${g.promoter} — Invio rendicontazione spese, fatture quietanzate e relazione finale su Drive.`,
          dueDate: g.reportingDeadline,
          dueDateLabel: `${formatItalianShortDate(g.reportingDeadline)} (Rendicontazione)`,
          category: 'bandi_contributi',
          recurrence: 'bando',
          daysRemaining: repDays,
          temporalProgressPercent: computeDeadlineTemporalProgress(repDays, isRepCompleted, 90),
          yearPositionPercent: getDayOfYear(repParsed).percent,
          status: getDeadlineStatus(repDays, isRepCompleted),
          isCompleted: isRepCompleted,
          actionTab: 'grants',
          actionLabel: 'Rendiconta Bando',
        });
      }
    }
  }

  // 9. EXPIRING GOVERNANCE / TECHNICAL ROLES WITHIN 90 DAYS
  for (const r of roles) {
    const expParsed = parseAnyDate(r.expiryDate);
    if (!expParsed) continue;
    const rDays = diffDays(expParsed, referenceDate);
    if (rDays <= 90) {
      const rId = `role-exp-${r.id}`;
      const rDone = completedSet.has(rId);
      items.push({
        id: rId,
        title: `Rinnovo Incarico / Nomina: ${r.roleTitle} (${r.personName})`,
        description: `Scadenza mandato o nomina registrata in Governance (${r.expiryDate}). ${
          r.notes || ''
        }`,
        dueDate: r.expiryDate,
        dueDateLabel: formatItalianShortDate(r.expiryDate),
        category: 'bilancio_governance',
        recurrence: 'governance',
        daysRemaining: rDays,
        temporalProgressPercent: computeDeadlineTemporalProgress(rDays, rDone, 60),
        yearPositionPercent: getDayOfYear(expParsed).percent,
        status: getDeadlineStatus(rDays, rDone),
        isCompleted: rDone,
        actionTab: 'governance',
        actionLabel: 'Aggiorna Carica',
      });
    }
  }

  // 10. CUSTOM CRITICAL DEADLINES ADDED MANUALLY BY USER (including future Bandi like Dec 2027 or any custom date)
  for (const c of customDeadlines) {
    const cParsed = parseAnyDate(c.dueDate) || referenceDate;
    const cDays = diffDays(cParsed, referenceDate);
    const cDone = completedSet.has(c.id);
    const actionTab =
      c.category === 'bandi_contributi'
        ? 'grants'
        : c.category === 'fisco_inps'
        ? 'cashflow'
        : c.category === 'affiliazione_tesserini'
        ? 'cards'
        : 'governance';
    const actionLabel =
      c.category === 'bandi_contributi'
        ? 'Apri Bandi & Progetti'
        : c.category === 'fisco_inps'
        ? 'Apri Flusso Cassa'
        : c.category === 'affiliazione_tesserini'
        ? 'Apri Tessere'
        : 'Vai a Governance';

    items.push({
      id: c.id,
      title: c.title,
      description: c.description,
      dueDate: c.dueDate,
      dueDateLabel: `${formatItalianShortDate(c.dueDate)}${
        c.recurrenceLabel ? ` (${c.recurrenceLabel})` : ' (Manuale)'
      }`,
      category: c.category,
      recurrence: 'personalizzata',
      daysRemaining: cDays,
      temporalProgressPercent: computeDeadlineTemporalProgress(cDays, cDone, 60),
      yearPositionPercent: getDayOfYear(cParsed).percent,
      status: getDeadlineStatus(cDays, cDone),
      isCompleted: cDone,
      actionTab: actionTab as CriticalDeadlineItem['actionTab'],
      actionLabel,
      isCustom: true,
    });
  }

  // Apply any user-configured deadlineOverrides (postponed dueDate or typed resolutionNote)
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const ov = deadlineOverrides[item.id];
    if (!ov) continue;

    let nextDueDate = item.dueDate;
    let nextDueDateLabel = item.dueDateLabel;
    let nextDaysRemaining = item.daysRemaining;
    let nextYearPos = item.yearPositionPercent;

    if (ov.customDueDate) {
      const parsedCustom = parseAnyDate(ov.customDueDate);
      if (parsedCustom) {
        nextDueDate = ov.customDueDate;
        nextDueDateLabel = `${formatItalianShortDate(ov.customDueDate)} (Rimandata)`;
        nextDaysRemaining = diffDays(parsedCustom, referenceDate);
        nextYearPos = getDayOfYear(parsedCustom).percent;
      }
    }

    const nextCompleted =
      ov.isCompleted !== undefined ? ov.isCompleted : item.isCompleted;
    const nextProgress = computeDeadlineTemporalProgress(
      nextDaysRemaining,
      nextCompleted,
      item.recurrence === 'mensile' ? 30 : 75
    );
    const nextStatus = getDeadlineStatus(nextDaysRemaining, nextCompleted);
    const nextDesc = ov.resolutionNote
      ? `[Nota registrata: "${ov.resolutionNote}"] — ${item.description}`
      : item.description;

    items[i] = {
      ...item,
      dueDate: nextDueDate,
      dueDateLabel: nextDueDateLabel,
      daysRemaining: nextDaysRemaining,
      yearPositionPercent: nextYearPos,
      temporalProgressPercent: nextProgress,
      status: nextStatus,
      isCompleted: nextCompleted,
      description: nextDesc,
    };
  }

  // Sort items: non-completed first ordered by daysRemaining ascending, then completed items
  items.sort((a, b) => {
    if (a.isCompleted !== b.isCompleted) {
      return a.isCompleted ? 1 : -1;
    }
    return a.daysRemaining - b.daysRemaining;
  });

  const yearStats = getDayOfYear(referenceDate);
  const completedCount = items.filter((i) => i.isCompleted).length;
  const urgentOrOverdueCount = items.filter(
    (i) => !i.isCompleted && (i.status === 'urgent' || i.status === 'overdue')
  ).length;

  const summary: SolarYearProgressSummary = {
    solarYear: refYear,
    currentMonthIndex: refMonth,
    currentMonthName: FULL_MONTHS_IT[refMonth],
    dayOfYear: yearStats.dayOfYear,
    totalDaysInYear: yearStats.totalDays,
    yearElapsedPercent: yearStats.percent,
    monthElapsedPercent,
    daysLeftInMonth,
    endOfCurrentMonthDate: endOfCurrentMonthIso,
    endOfCurrentMonthLabel: formatItalianShortDate(endOfCurrentMonthIso),
    completedCount,
    totalDeadlinesCount: items.length,
    completionRatePercent:
      items.length > 0 ? Math.round((completedCount / items.length) * 100) : 0,
    urgentOrOverdueCount,
  };

  return { deadlines: items, summary };
}
