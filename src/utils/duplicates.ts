import {
  CashTransaction,
  DuplicateDetectionMode,
  DuplicateTransactionGroup,
  Member,
  StaffMember,
} from '../types';
import { parseAnyDate, diffDays } from './notifications';
import { formatEuro } from './finance';
import { newId } from './ids';

const ASD_BOILERPLATE_STOPWORDS = new Set([
  'quota',
  'quote',
  'tessera',
  'tessere',
  'tesseramento',
  'associativa',
  'associativo',
  'annuale',
  'caparra',
  'acconto',
  'anticipo',
  'saldo',
  'totale',
  'intera',
  'completa',
  'iscrizione',
  'iscrizioni',
  'evento',
  'eventi',
  'escursione',
  'escursioni',
  'trekking',
  'uscita',
  'uscite',
  'rifugio',
  'summer',
  'camp',
  'summercamp',
  'wild',
  'selva',
  'academy',
  'branco',
  'progetto',
  'doposcuola',
  'laboratorio',
  'laboratori',
  'attivita',
  'invernale',
  'estivo',
  'estiva',
  'primaverile',
  'autunnale',
  'settimana',
  'settimanale',
  'mensile',
  'giornaliero',
  'giornaliera',
  'giornata',
  'weekend',
  'turno',
  'primo',
  'secondo',
  'terzo',
  'quarto',
  'rata',
  'rate',
  'gennaio',
  'febbraio',
  'marzo',
  'aprile',
  'maggio',
  'giugno',
  'luglio',
  'agosto',
  'settembre',
  'ottobre',
  'novembre',
  'dicembre',
  'bonifico',
  'bancario',
  'banca',
  'conto',
  'corrente',
  'cassa',
  'contanti',
  'contante',
  'pos',
  'bancomat',
  'carta',
  'paypal',
  'pagamento',
  'pagam',
  'online',
  'versamento',
  'incasso',
  'entrata',
  'entrate',
  'spesa',
  'spese',
  'acquisto',
  'acquisti',
  'materiale',
  'materiali',
  'attrezzatura',
  'alimentari',
  'merenda',
  'pranzo',
  'cena',
  'pernottamento',
  'notte',
  'ricevuta',
  'fattura',
  'rimborso',
  'compenso',
  'compensi',
  'collaborazione',
  'sportiva',
  'sportivo',
  'staff',
  'istruttore',
  'istruttori',
  'educatore',
  'educatori',
  'guida',
  'guide',
  'gadget',
  'maglietta',
  'magliette',
  'tazza',
  'tazze',
  'cappellino',
  'felpa',
  'zaino',
  'zainetto',
  'sacco',
  'usacli',
  'acli',
  'coni',
  'rasd',
  'base',
  'gold',
  'platinum',
  'extra',
  'assicurazione',
  'assicurativa',
  'integrativa',
  'copertura',
  'rinnovo',
  'nuovo',
  'nuova',
  'socio',
  'soci',
  'bimbo',
  'bambino',
  'bambini',
  'ragazzo',
  'ragazzi',
  'genitore',
  'genitori',
  'famiglia',
  'fratelli',
  'fratello',
  'sorella',
  'sconto',
  'riduzione',
  'isee',
  'buono',
  'voucher',
  'contributo',
  'erogazione',
  'liberale',
  'donazione',
  'bando',
  'servizi',
  'esterni',
  'tasse',
  'formalita',
  'bollo',
  'imposta',
  'commissione',
  'commissioni',
  'f24',
  'inps',
  'del',
  'dello',
  'della',
  'dei',
  'degli',
  'delle',
  'al',
  'allo',
  'alla',
  'ai',
  'agli',
  'alle',
  'dal',
  'dallo',
  'dalla',
  'dai',
  'dagli',
  'dalle',
  'nel',
  'nello',
  'nella',
  'nei',
  'negli',
  'nelle',
  'sul',
  'sullo',
  'sulla',
  'sui',
  'sugli',
  'sulle',
  'per',
  'con',
  'tra',
  'fra',
  'da',
  'in',
  'su',
  'il',
  'lo',
  'la',
  'un',
  'uno',
  'una',
  'ed',
  'od',
  'freo',
  'mosceta',
  'forte',
  'marmi',
  'massa',
  'carrara',
  'pietrasanta',
  'seravezza',
  'camaiore',
  'viareggio',
  'lucca',
  'lunigiana',
  'garfagnana',
  'apuane',
  'alpi',
  'pania',
  'forato',
  'procinto',
  'matanna',
  'monte',
  'bosco',
  'natura',
  'outdoor',
  'apuacamp',
  'asd',
]);

export function normalizeTextForMatching(text: string): string {
  return (text || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function toTitleCase(str: string): string {
  return str
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

export interface ExtractedTransactionIdentity {
  canonicalPersonKey: string | null;
  displayPersonName: string;
  meaningfulTokens: string[];
  normalizedFullDescription: string;
  isVerifiedPerson: boolean;
}

/**
 * Extracts the referred person strictly from:
 * 1) Explicit relatedMemberName (with at least 2 name tokens)
 * 2) Registered Member (childName or parentName with >= 2 tokens) or StaffMember
 * 3) Distinct two-token personal name (Nome + Cognome) remaining after stripping all ASD/event/location/month stopwords
 */
export function extractTransactionIdentity(
  tx: CashTransaction,
  members: Member[] = [],
  staff: StaffMember[] = []
): ExtractedTransactionIdentity {
  const normDesc = normalizeTextForMatching(tx.description || '');
  const descTokens = normDesc.split(' ').filter(Boolean);
  const descTokenSet = new Set(descTokens);

  // 0a. Structured memberId link (Phase 4.2): authoritative person key
  if (tx.memberId && tx.memberId.trim()) {
    const matchedMember = members.find((m) => m.id === tx.memberId);
    const displayName =
      matchedMember?.childName ||
      (tx.relatedMemberName && tx.relatedMemberName.trim()
        ? toTitleCase(tx.relatedMemberName.trim())
        : `Socio #${tx.memberId}`);
    const nameTokens = normalizeTextForMatching(
      matchedMember?.childName || tx.relatedMemberName || ''
    )
      .split(' ')
      .filter((t) => t.length >= 2 && !ASD_BOILERPLATE_STOPWORDS.has(t));
    return {
      canonicalPersonKey: `member:${tx.memberId.trim()}`,
      displayPersonName: displayName,
      meaningfulTokens: nameTokens,
      normalizedFullDescription: normDesc,
      isVerifiedPerson: true,
    };
  }

  // 0b. Structured staffId link (Phase 4.2): authoritative person key
  if (tx.staffId && tx.staffId.trim()) {
    const matchedStaff = staff.find((s) => s.id === tx.staffId);
    const displayName =
      matchedStaff?.name ||
      (tx.relatedMemberName && tx.relatedMemberName.trim()
        ? toTitleCase(tx.relatedMemberName.trim())
        : `Collaboratore #${tx.staffId}`);
    const nameTokens = normalizeTextForMatching(
      matchedStaff?.name || tx.relatedMemberName || ''
    )
      .split(' ')
      .filter((t) => t.length >= 2 && !ASD_BOILERPLATE_STOPWORDS.has(t));
    return {
      canonicalPersonKey: `staff:${tx.staffId.trim()}`,
      displayPersonName: displayName,
      meaningfulTokens: nameTokens,
      normalizedFullDescription: normDesc,
      isVerifiedPerson: true,
    };
  }

  // 1. Check explicit relatedMemberName first (legacy transactions without memberId/staffId)
  if (tx.relatedMemberName && tx.relatedMemberName.trim()) {
    const normRelated = normalizeTextForMatching(tx.relatedMemberName);
    const relTokens = normRelated
      .split(' ')
      .filter((t) => t.length >= 2 && !ASD_BOILERPLATE_STOPWORDS.has(t));
    if (relTokens.length >= 2) {
      const sortedKey = [...relTokens].sort().join('_');
      return {
        canonicalPersonKey: `person:${sortedKey}`,
        displayPersonName: toTitleCase(tx.relatedMemberName.trim()),
        meaningfulTokens: relTokens,
        normalizedFullDescription: normDesc,
        isVerifiedPerson: true,
      };
    }
  }

  // 2a. Check against known Members' childName FIRST across all members
  // (prevents attributing a movement to the first sibling in the array when two siblings share the same parentName)
  for (const m of members) {
    if (!m.childName) continue;
    const normChild = normalizeTextForMatching(m.childName);
    const childTokens = normChild.split(' ').filter((t) => t.length >= 2);
    if (childTokens.length >= 2 && childTokens.every((t) => descTokenSet.has(t))) {
      const sortedKey = [...childTokens].sort().join('_');
      return {
        canonicalPersonKey: `person:${sortedKey}`,
        displayPersonName: m.childName,
        meaningfulTokens: childTokens,
        normalizedFullDescription: normDesc,
        isVerifiedPerson: true,
      };
    }
  }

  // 2b. Only if no childName matched, check against known Members' parentName
  for (const m of members) {
    if (!m.parentName) continue;
    const normParent = normalizeTextForMatching(m.parentName);
    const parentTokens = normParent.split(' ').filter((t) => t.length >= 2);
    if (parentTokens.length >= 2 && parentTokens.every((t) => descTokenSet.has(t))) {
      const sortedKey = [...parentTokens].sort().join('_');
      const siblingsWithSameParent = members.filter(
        (other) =>
          other.parentName &&
          normalizeTextForMatching(other.parentName) === normParent
      );
      const displayName =
        siblingsWithSameParent.length === 1 && m.childName && m.parentName !== m.childName
          ? `${m.childName} (Genitore: ${m.parentName})`
          : `Genitore: ${m.parentName}`;
      return {
        canonicalPersonKey: `person:${sortedKey}`,
        displayPersonName: displayName,
        meaningfulTokens: parentTokens,
        normalizedFullDescription: normDesc,
        isVerifiedPerson: true,
      };
    }
  }

  for (const s of staff) {
    if (!s.name) continue;
    const normStaff = normalizeTextForMatching(s.name);
    const staffTokens = normStaff.split(' ').filter((t) => t.length >= 2);
    if (staffTokens.length >= 2 && staffTokens.every((t) => descTokenSet.has(t))) {
      const sortedKey = [...staffTokens].sort().join('_');
      return {
        canonicalPersonKey: `person:${sortedKey}`,
        displayPersonName: s.name,
        meaningfulTokens: staffTokens,
        normalizedFullDescription: normDesc,
        isVerifiedPerson: true,
      };
    }
  }

  // 3. Extract remaining personal name tokens (must be >= 2 alphabetic words of length >= 3 that are NOT stopwords or numbers)
  const meaningfulTokens = descTokens.filter(
    (t) =>
      t.length >= 3 &&
      /^[a-z]+$/.test(t) &&
      !ASD_BOILERPLATE_STOPWORDS.has(t)
  );

  if (meaningfulTokens.length >= 2) {
    // Take the last 2 tokens as the person's full name (e.g., "Caparra Rifugio Del Freo Mario Rossi" -> "Mario Rossi")
    const personSlice = meaningfulTokens.slice(-2);
    const sortedKey = [...personSlice].sort().join('_');
    return {
      canonicalPersonKey: `person:${sortedKey}`,
      displayPersonName: toTitleCase(personSlice.join(' ')),
      meaningfulTokens: personSlice,
      normalizedFullDescription: normDesc,
      isVerifiedPerson: true,
    };
  }

  // If fewer than 2 personal name tokens exist, this is a generic movement (e.g. "Quota Tessera", "Summer Camp", "Spesa Conad")
  // and must NOT be treated as a named person!
  return {
    canonicalPersonKey: null,
    displayPersonName: tx.description?.trim() || tx.category,
    meaningfulTokens: [],
    normalizedFullDescription: normDesc,
    isVerifiedPerson: false,
  };
}

/**
 * Checks whether two transactions represent a true potential duplicate:
 * - Same direction (both income or both expense)
 * - Exact same positive amount (within € 0.005)
 * - Within maxDaysWindow days of each other (default 7 days max)
 * - Strictly referring to the EXACT SAME person (Nome + Cognome, >= 2 shared name tokens)
 */
export function areTransactionsPotentialDuplicates(
  txA: CashTransaction,
  txB: CashTransaction,
  members: Member[] = [],
  staff: StaffMember[] = [],
  maxDaysWindow: number = 7
): { isDuplicate: boolean; daysApart: number; personName: string; reason: string } {
  if (txA.id === txB.id) {
    return { isDuplicate: false, daysApart: 0, personName: '', reason: '' };
  }

  // If both transactions have explicit structured memberId, staffId, bookingId, or gadgetOrderId and they differ, they are NEVER duplicates
  if (txA.memberId && txB.memberId && txA.memberId !== txB.memberId) {
    return { isDuplicate: false, daysApart: 0, personName: '', reason: '' };
  }
  if (txA.staffId && txB.staffId && txA.staffId !== txB.staffId) {
    return { isDuplicate: false, daysApart: 0, personName: '', reason: '' };
  }
  if (txA.bookingId && txB.bookingId && txA.bookingId !== txB.bookingId) {
    return { isDuplicate: false, daysApart: 0, personName: '', reason: '' };
  }
  if (txA.gadgetOrderId && txB.gadgetOrderId && txA.gadgetOrderId !== txB.gadgetOrderId) {
    return { isDuplicate: false, daysApart: 0, personName: '', reason: '' };
  }

  // Never flag auto-generated recurring installments of different dates as duplicates
  if (
    txA.recurringPlanId &&
    txB.recurringPlanId &&
    txA.recurringPlanId === txB.recurringPlanId &&
    txA.recurringInstallmentNumber !== txB.recurringInstallmentNumber
  ) {
    return { isDuplicate: false, daysApart: 0, personName: '', reason: '' };
  }

  const isIncomeA = (txA.income || 0) > 0;
  const isIncomeB = (txB.income || 0) > 0;
  const isExpenseA = (txA.expense || 0) > 0;
  const isExpenseB = (txB.expense || 0) > 0;

  if (isIncomeA !== isIncomeB || isExpenseA !== isExpenseB) {
    return { isDuplicate: false, daysApart: 0, personName: '', reason: '' };
  }

  const amountA = isIncomeA ? txA.income || 0 : txA.expense || 0;
  const amountB = isIncomeB ? txB.income || 0 : txB.expense || 0;

  if (amountA <= 0 || Math.abs(amountA - amountB) >= 0.01) {
    return { isDuplicate: false, daysApart: 0, personName: '', reason: '' };
  }

  // Check date proximity (within maxDaysWindow days maximum)
  const dateA = parseAnyDate(txA.date);
  const dateB = parseAnyDate(txB.date);
  let daysApart = 0;

  if (dateA && dateB) {
    daysApart = Math.abs(diffDays(dateA, dateB));
    if (daysApart > maxDaysWindow) {
      return { isDuplicate: false, daysApart, personName: '', reason: '' };
    }
  } else if ((txA.date || '').trim() !== (txB.date || '').trim()) {
    return { isDuplicate: false, daysApart: 999, personName: '', reason: '' };
  }

  const idA = extractTransactionIdentity(txA, members, staff);
  const idB = extractTransactionIdentity(txB, members, staff);

  // If either movement does NOT identify a specific person (Nome + Cognome), do NOT flag generic movements as duplicates!
  if (!idA.isVerifiedPerson || !idB.isVerifiedPerson || !idA.canonicalPersonKey || !idB.canonicalPersonKey) {
    return { isDuplicate: false, daysApart, personName: '', reason: '' };
  }

  const daysText =
    daysApart === 0
      ? 'nello stesso giorno'
      : daysApart === 1
      ? 'a 1 giorno di distanza'
      : `a ${daysApart} giorni di distanza (entro ${maxDaysWindow} gg)`;

  // Case 1: Identical canonical person key (both first and last name match)
  if (idA.canonicalPersonKey === idB.canonicalPersonKey) {
    return {
      isDuplicate: true,
      daysApart,
      personName: idA.displayPersonName,
      reason: `Stessa persona (${idA.displayPersonName}) e stesso importo (${formatEuro(
        amountA
      )}) ${daysText}`,
    };
  }

  // Case 2: Both have at least 2 shared personal name tokens (e.g. "Mario Rossi" in both)
  const setB = new Set(idB.meaningfulTokens);
  const shared = idA.meaningfulTokens.filter((t) => setB.has(t));
  if (shared.length >= 2) {
    const displayPerson = toTitleCase(shared.slice(-2).join(' '));
    return {
      isDuplicate: true,
      daysApart,
      personName: displayPerson,
      reason: `Stessa persona (${displayPerson}) e stesso importo (${formatEuro(
        amountA
      )}) ${daysText}`,
    };
  }

  return { isDuplicate: false, daysApart, personName: '', reason: '' };
}

/**
 * Detects all groups of potential duplicate transactions across the ledger.
 * Groups movements that refer to the exact same person with the same amount within maxDaysWindow days.
 */
export function detectDuplicateTransactions(
  transactions: CashTransaction[],
  members: Member[] = [],
  staff: StaffMember[] = [],
  maxDaysWindow: number = 7,
  ignoredSignatures: string[] = [],
  mode: DuplicateDetectionMode = 'strict'
): DuplicateTransactionGroup[] {
  if (mode === 'off') return [];
  if (!transactions || transactions.length < 2) return [];

  const effectiveMaxDays = mode === 'same_day' ? 0 : maxDaysWindow;
  const ignoredSet = new Set(ignoredSignatures);
  const n = transactions.length;
  const visited = new Set<string>();
  const groups: DuplicateTransactionGroup[] = [];

  for (let i = 0; i < n; i++) {
    const baseTx = transactions[i];
    if (visited.has(baseTx.id)) continue;

    const cluster: CashTransaction[] = [baseTx];
    let detectedPerson = '';
    let detectedReason = '';
    let maxSpan = 0;

    for (let j = i + 1; j < n; j++) {
      const candidateTx = transactions[j];
      if (visited.has(candidateTx.id)) continue;

      const check = areTransactionsPotentialDuplicates(
        baseTx,
        candidateTx,
        members,
        staff,
        effectiveMaxDays
      );

      if (check.isDuplicate) {
        cluster.push(candidateTx);
        if (!detectedPerson && check.personName) {
          detectedPerson = check.personName;
        }
        if (!detectedReason && check.reason) {
          detectedReason = check.reason;
        }
        if (check.daysApart > maxSpan) {
          maxSpan = check.daysApart;
        }
      }
    }

    if (cluster.length >= 2) {
      for (const item of cluster) {
        visited.add(item.id);
      }

      // Sort chronologically by date (earliest first as originalTransaction)
      const sortedCluster = [...cluster].sort((a, b) => {
        const dA = parseAnyDate(a.date)?.getTime() || 0;
        const dB = parseAnyDate(b.date)?.getTime() || 0;
        if (dA !== dB) return dA - dB;
        return a.id.localeCompare(b.id);
      });

      const firstDate = parseAnyDate(sortedCluster[0].date);
      const lastDate = parseAnyDate(sortedCluster[sortedCluster.length - 1].date);
      const daysSpan =
        firstDate && lastDate ? Math.abs(diffDays(lastDate, firstDate)) : maxSpan;

      const sortedIds = sortedCluster.map((t) => t.id).sort();
      const signature = `dup:${sortedIds.join('|')}`;

      if (ignoredSet.has(signature)) {
        continue;
      }

      const firstTx = sortedCluster[0];
      const isInc = (firstTx.income || 0) > 0;
      const amount = isInc ? firstTx.income || 0 : firstTx.expense || 0;

      groups.push({
        groupId: `dup-group-${sortedCluster[0].id}`,
        signature,
        personName: detectedPerson || firstTx.description,
        matchReason:
          detectedReason ||
          `Stessa persona e stesso importo (${formatEuro(amount)}) entro ${daysSpan} giorni`,
        amount,
        direction: isInc ? 'income' : 'expense',
        category: firstTx.category,
        daysSpan,
        originalTransaction: sortedCluster[0],
        duplicateTransactions: sortedCluster.slice(1),
        allTransactions: sortedCluster,
      });
    }
  }

  return groups;
}

/**
 * Tests ONLY a specific subset of newly added or newly imported transactions (by ID)
 * against the full transaction list. Returns only duplicate groups that involve at least
 * one transaction from `newTransactionIds`.
 */
export function detectDuplicatesForNewTransactions(
  newTransactionIds: string[],
  allTransactions: CashTransaction[],
  members: Member[] = [],
  staff: StaffMember[] = [],
  maxDaysWindow: number = 7,
  ignoredSignatures: string[] = [],
  mode: DuplicateDetectionMode = 'strict'
): DuplicateTransactionGroup[] {
  if (mode === 'off') return [];
  if (!newTransactionIds || newTransactionIds.length === 0) return [];
  const targetIdSet = new Set(newTransactionIds);
  const allGroups = detectDuplicateTransactions(
    allTransactions,
    members,
    staff,
    maxDaysWindow,
    ignoredSignatures,
    mode
  );
  return allGroups.filter((grp) =>
    grp.allTransactions.some((t) => targetIdSet.has(t.id))
  );
}

/**
 * Generates realistic sample duplicate transactions so the user can test and verify
 * the duplicate alert & popup deletion workflow on demand.
 */
export function createSampleDuplicateTransactions(activeYear: number = 2027): CashTransaction[] {
  return [
    {
      id: newId('tx-dup-demo-1a'),
      date: `${activeYear}-03-10`,
      category: 'Evento',
      income: 130,
      expense: null,
      method: 'Bonifico',
      description: 'Caparra Rifugio Del Freo Mario Rossi',
      relatedMemberName: 'Mario Rossi',
    },
    {
      id: newId('tx-dup-demo-1b'),
      date: `${activeYear}-03-13`,
      category: 'Evento',
      income: 130,
      expense: null,
      method: 'Bonifico',
      description: 'Quota iscrizione Rifugio Rossi Mario',
      relatedMemberName: 'Mario Rossi',
    },
    {
      id: newId('tx-dup-demo-2a'),
      date: `${activeYear}-04-02`,
      category: 'Tessere',
      income: 15,
      expense: null,
      method: 'Contanti',
      description: 'Quota Tessera Gold UsAcli Sofia Bianchi',
      relatedMemberName: 'Sofia Bianchi',
    },
    {
      id: newId('tx-dup-demo-2b'),
      date: `${activeYear}-04-05`,
      category: 'Tessere',
      income: 15,
      expense: null,
      method: 'Bonifico',
      description: 'Tesseramento Gold Sofia Bianchi',
      relatedMemberName: 'Sofia Bianchi',
    },
  ];
}
