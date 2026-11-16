import {
  CashTransaction,
  DuplicateTransactionGroup,
  Member,
  StaffMember,
} from '../types';
import { parseAnyDate, diffDays } from './notifications';
import { formatEuro } from './finance';

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
  'saldo',
  'iscrizione',
  'evento',
  'escursione',
  'rifugio',
  'summer',
  'camp',
  'summercamp',
  'wild',
  'selva',
  'bonifico',
  'bancario',
  'contanti',
  'pos',
  'bancomat',
  'paypal',
  'pagamento',
  'pagam',
  'online',
  'versamento',
  'incasso',
  'ricevuta',
  'fattura',
  'rimborso',
  'spese',
  'compenso',
  'collaborazione',
  'sportiva',
  'staff',
  'gadget',
  'maglietta',
  'tazza',
  'cappellino',
  'felpa',
  'usacli',
  'acli',
  'base',
  'gold',
  'platinum',
  'extra',
  'assicurazione',
  'integrativa',
  'socio',
  'soci',
  'bimbo',
  'bambino',
  'ragazzo',
  'genitore',
  'famiglia',
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
}

/**
 * Extracts the referred person (via relatedMemberName, known Member/Staff registry, or meaningful name tokens in description)
 */
export function extractTransactionIdentity(
  tx: CashTransaction,
  members: Member[] = [],
  staff: StaffMember[] = []
): ExtractedTransactionIdentity {
  const normDesc = normalizeTextForMatching(tx.description || '');
  const descTokens = normDesc.split(' ').filter(Boolean);
  const descTokenSet = new Set(descTokens);

  // 1. Check explicit relatedMemberName first
  if (tx.relatedMemberName && tx.relatedMemberName.trim()) {
    const normRelated = normalizeTextForMatching(tx.relatedMemberName);
    const relTokens = normRelated.split(' ').filter((t) => t.length >= 2);
    if (relTokens.length > 0) {
      const sortedKey = [...relTokens].sort().join('_');
      return {
        canonicalPersonKey: `person:${sortedKey}`,
        displayPersonName: toTitleCase(tx.relatedMemberName.trim()),
        meaningfulTokens: relTokens,
        normalizedFullDescription: normDesc,
      };
    }
  }

  // 2. Check against known Members (childName or parentName) and Staff
  for (const m of members) {
    const candidates = [m.childName, m.parentName].filter(Boolean);
    for (const candidate of candidates) {
      const normCand = normalizeTextForMatching(candidate);
      const candTokens = normCand.split(' ').filter((t) => t.length >= 2);
      if (candTokens.length >= 2 && candTokens.every((t) => descTokenSet.has(t))) {
        const sortedKey = [...candTokens].sort().join('_');
        return {
          canonicalPersonKey: `person:${sortedKey}`,
          displayPersonName: m.childName
            ? candidate === m.parentName && m.parentName !== m.childName
              ? `${m.childName} (Genitore: ${m.parentName})`
              : m.childName
            : toTitleCase(candidate),
          meaningfulTokens: candTokens,
          normalizedFullDescription: normDesc,
        };
      }
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
      };
    }
  }

  // 3. Extract meaningful non-boilerplate tokens from the description
  const meaningfulTokens = descTokens.filter(
    (t) =>
      t.length >= 2 &&
      !/^\d+$/.test(t) &&
      !ASD_BOILERPLATE_STOPWORDS.has(t)
  );

  if (meaningfulTokens.length >= 2) {
    // Take the last 2-3 tokens as the likely person name (e.g., "Caparra Rifugio Del Freo Mario Rossi" -> "Mario Rossi")
    const personSlice = meaningfulTokens.slice(-2);
    const sortedKey = [...personSlice].sort().join('_');
    return {
      canonicalPersonKey: `tokens:${sortedKey}`,
      displayPersonName: toTitleCase(personSlice.join(' ')),
      meaningfulTokens,
      normalizedFullDescription: normDesc,
    };
  }

  if (meaningfulTokens.length === 1) {
    return {
      canonicalPersonKey: `token:${meaningfulTokens[0]}`,
      displayPersonName: toTitleCase(meaningfulTokens[0]),
      meaningfulTokens,
      normalizedFullDescription: normDesc,
    };
  }

  return {
    canonicalPersonKey: null,
    displayPersonName: tx.description?.trim() || tx.category,
    meaningfulTokens: [],
    normalizedFullDescription: normDesc,
  };
}

/**
 * Checks whether two transactions represent a potential duplicate:
 * - Same direction (both income or both expense)
 * - Exact same positive amount (within € 0.005)
 * - Within maxDaysWindow days of each other (default 7 days max)
 * - Referring to the same person or having high movement similarity
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

  // Check date proximity (within 7 days maximum)
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

  const daysText =
    daysApart === 0
      ? 'nello stesso giorno'
      : daysApart === 1
      ? 'a 1 giorno di distanza'
      : `a ${daysApart} giorni di distanza (entro 7 gg)`;

  // Case 1: Identical canonical person key
  if (idA.canonicalPersonKey && idA.canonicalPersonKey === idB.canonicalPersonKey) {
    return {
      isDuplicate: true,
      daysApart,
      personName: idA.displayPersonName,
      reason: `Stesso riferimento (${idA.displayPersonName}) e stesso importo (${formatEuro(
        amountA
      )}) ${daysText}`,
    };
  }

  // Case 2: At least 2 shared meaningful tokens (e.g. first name + last name even with extra words)
  if (idA.meaningfulTokens.length > 0 && idB.meaningfulTokens.length > 0) {
    const setB = new Set(idB.meaningfulTokens);
    const shared = idA.meaningfulTokens.filter((t) => setB.has(t));

    if (shared.length >= 2) {
      const displayPerson = toTitleCase(shared.slice(-2).join(' '));
      return {
        isDuplicate: true,
        daysApart,
        personName: displayPerson,
        reason: `Stessa persona/riferimento (${displayPerson}) e stesso importo (${formatEuro(
          amountA
        )}) ${daysText}`,
      };
    }

    // If one or both have only 1 meaningful token (e.g. surname only "Rossi") and they share it in the same category
    if (
      shared.length === 1 &&
      shared[0].length >= 3 &&
      (txA.category === txB.category ||
        idA.meaningfulTokens.length === 1 ||
        idB.meaningfulTokens.length === 1)
    ) {
      const displayPerson =
        idA.meaningfulTokens.length >= idB.meaningfulTokens.length
          ? idA.displayPersonName
          : idB.displayPersonName;
      return {
        isDuplicate: true,
        daysApart,
        personName: displayPerson,
        reason: `Movimenti simili riferiti a "${displayPerson}" dello stesso importo (${formatEuro(
          amountA
        )}) ${daysText}`,
      };
    }
  }

  // Case 3: Identical normalized description
  if (
    idA.normalizedFullDescription.length >= 3 &&
    idA.normalizedFullDescription === idB.normalizedFullDescription
  ) {
    return {
      isDuplicate: true,
      daysApart,
      personName: idA.displayPersonName,
      reason: `Causale identica ("${txA.description}") e stesso importo (${formatEuro(
        amountA
      )}) ${daysText}`,
    };
  }

  return { isDuplicate: false, daysApart, personName: '', reason: '' };
}

/**
 * Detects all groups of potential duplicate transactions across the ledger.
 * Groups movements that refer to the same person with the same amount within 7 days max.
 */
export function detectDuplicateTransactions(
  transactions: CashTransaction[],
  members: Member[] = [],
  staff: StaffMember[] = [],
  maxDaysWindow: number = 7,
  ignoredSignatures: string[] = []
): DuplicateTransactionGroup[] {
  if (!transactions || transactions.length < 2) return [];

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

      // Check if candidateTx matches ANY transaction already in the cluster within 7 days of baseTx
      const check = areTransactionsPotentialDuplicates(
        baseTx,
        candidateTx,
        members,
        staff,
        maxDaysWindow
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
          `Movimenti simili dello stesso importo (${formatEuro(amount)}) entro ${daysSpan} giorni`,
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
 * Generates realistic sample duplicate transactions so the user can test and verify
 * the duplicate alert & popup deletion workflow on demand.
 */
export function createSampleDuplicateTransactions(activeYear: number = 2027): CashTransaction[] {
  const now = Date.now();
  return [
    {
      id: `tx-dup-demo-1a-${now}`,
      date: `${activeYear}-03-10`,
      category: 'Evento',
      income: 130,
      expense: null,
      method: 'Bonifico',
      description: 'Caparra Rifugio Del Freo Mario Rossi',
      relatedMemberName: 'Mario Rossi',
    },
    {
      id: `tx-dup-demo-1b-${now}`,
      date: `${activeYear}-03-13`,
      category: 'Evento',
      income: 130,
      expense: null,
      method: 'Bonifico',
      description: 'Quota iscrizione Rifugio Rossi Mario',
      relatedMemberName: 'Mario Rossi',
    },
    {
      id: `tx-dup-demo-2a-${now}`,
      date: `${activeYear}-04-02`,
      category: 'Tessere',
      income: 15,
      expense: null,
      method: 'Contanti',
      description: 'Quota Tessera Gold UsAcli Sofia Bianchi',
      relatedMemberName: 'Sofia Bianchi',
    },
    {
      id: `tx-dup-demo-2b-${now}`,
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
