import {
  Member,
  EventItem,
  EventBooking,
  GadgetOrder,
  AssociationRole,
  AssemblyMeeting,
  GrantItem,
  CashTransaction,
  NotificationItem,
  NotificationResolutionRecord,
  PreEventBriefing,
  PreEventParticipantAlert,
  CustomCriticalDeadline,
  DuplicateDetectionMode,
} from '../types';
import { detectDuplicateTransactions } from './duplicates';
import { formatEuro } from './finance';

/**
 * Parses Italian "DD/MM/YYYY" or ISO "YYYY-MM-DD" into a Date object (at midnight local)
 */
export function parseAnyDate(raw?: string): Date | null {
  if (!raw) return null;
  const clean = raw.trim().replace(/\\/g, '/');
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    const [y, m, d] = clean.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  const m = clean.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{2,4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const month = parseInt(m[2], 10);
    let year = parseInt(m[3], 10);
    if (year < 100) year += 2000;
    return new Date(year, month - 1, day);
  }
  return null;
}

export function diffDays(target: Date, ref: Date = new Date()): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  const tUTC = Date.UTC(target.getFullYear(), target.getMonth(), target.getDate());
  const rUTC = Date.UTC(ref.getFullYear(), ref.getMonth(), ref.getDate());
  return Math.round((tUTC - rUTC) / msPerDay);
}

/**
 * Generates a complete Pre-Event Briefing for every event, cross-referencing booked participants with the Members registry
 */
export function generatePreEventBriefings(
  events: EventItem[],
  bookings: EventBooking[],
  members: Member[],
  referenceDate: Date = new Date()
): PreEventBriefing[] {
  const briefings: PreEventBriefing[] = [];

  for (const ev of events) {
    const evDate = parseAnyDate(ev.date) || referenceDate;
    const daysUntil = diffDays(evDate, referenceDate);
    const evBookings = bookings.filter((b) => b.eventId === ev.id && b.confirmed);

    const missingOrExpiredCardList: PreEventParticipantAlert[] = [];
    const allergiesList: PreEventParticipantAlert[] = [];
    const specialNeedsList: PreEventParticipantAlert[] = [];
    const noPhotoConsentList: PreEventParticipantAlert[] = [];
    const pendingEmailsList: PreEventParticipantAlert[] = [];
    const allParticipants: PreEventParticipantAlert[] = [];

    for (const bk of evBookings) {
      const normalizedChild = bk.childName.trim().toLowerCase();
      const matchedMember = members.find(
        (m) =>
          (bk.memberId && m.id === bk.memberId) ||
          m.childName.trim().toLowerCase() === normalizedChild
      );

      let cardStatus: PreEventParticipantAlert['cardStatus'] = 'ok';
      let cardDetails = '';

      if (!matchedMember) {
        if (bk.extraInsurancePaid) {
          cardStatus = 'ok';
          cardDetails = 'Non presente in Anagrafica Soci (Assicurazione giornaliera evento attiva)';
        } else {
          cardStatus = 'missing';
          cardDetails = 'NON iscritto in Anagrafica Soci e privo di tessera/assicurazione registrata';
        }
      } else {
        const cardNum = (matchedMember.membershipCardNumber || '').trim();
        const cardExp = parseAnyDate(matchedMember.expiryDate);

        if (
          !cardNum ||
          cardNum.toLowerCase().includes('attesa') ||
          cardNum.toLowerCase().includes('mandare') ||
          cardNum.toLowerCase().includes('pagare')
        ) {
          cardStatus = 'missing';
          cardDetails = cardNum
            ? `Tessera non attiva ("${cardNum}")`
            : 'Numero tessera UsAcli mancante';
        } else if (!matchedMember.isPaid) {
          cardStatus = 'unpaid';
          cardDetails = `Tessera ${cardNum} (${matchedMember.insuranceType}) NON pagata`;
        } else if (cardExp) {
          const daysExpFromEvent = diffDays(cardExp, evDate);
          if (daysExpFromEvent < 0) {
            cardStatus = 'expired_before_event';
            cardDetails = `Tessera ${cardNum} SCADUTA il ${matchedMember.expiryDate} (prima dell'evento del ${ev.date})`;
          } else if (daysExpFromEvent <= 30) {
            cardStatus = 'expiring_soon';
            cardDetails = `Tessera ${cardNum} in scadenza il ${matchedMember.expiryDate} (${daysExpFromEvent} gg dall'evento)`;
          } else {
            cardDetails = `Tessera ${cardNum} (${matchedMember.insuranceType}) valida fino al ${matchedMember.expiryDate}`;
          }
        } else {
          cardDetails = `Tessera ${cardNum} (${matchedMember.insuranceType}) - data scadenza non indicata`;
        }
      }

      const allergies = matchedMember?.allergies || '';
      const specialConditions = [
        matchedMember?.notesConditions || '',
        bk.notes || '',
      ]
        .filter(Boolean)
        .join(' | ');
      const photoConsent = matchedMember ? matchedMember.photoConsent : true;
      const hasPhotoRestrictionNote =
        specialConditions.toLowerCase().includes('no social') ||
        specialConditions.toLowerCase().includes('coprire') ||
        specialConditions.toLowerCase().includes('foto senza viso');

      const paidSoFar =
        (bk.isDepositPaid ? bk.depositAmount : 0) +
        (bk.isBalancePaid ? bk.balanceAmount : 0);
      const balancePending = Math.max(0, bk.totalPrice - paidSoFar);

      const alertItem: PreEventParticipantAlert = {
        bookingId: bk.id,
        childName: bk.childName,
        parentName: bk.parentName || matchedMember?.parentName || '',
        parentPhone: bk.parentPhone || matchedMember?.parentPhone || '',
        parentEmail: bk.parentEmail || matchedMember?.parentEmail || '',
        memberFound: !!matchedMember,
        cardStatus,
        cardDetails,
        allergies,
        specialConditions,
        photoConsent: photoConsent && !hasPhotoRestrictionNote,
        emailSent: !!bk.confirmationEmailSent,
        balancePending,
      };

      allParticipants.push(alertItem);

      if (cardStatus !== 'ok') {
        missingOrExpiredCardList.push(alertItem);
      }
      if (allergies.trim().length > 0) {
        allergiesList.push(alertItem);
      }
      if (specialConditions.trim().length > 0) {
        specialNeedsList.push(alertItem);
      }
      if (!alertItem.photoConsent) {
        noPhotoConsentList.push(alertItem);
      }
      if (!bk.confirmationEmailSent) {
        pendingEmailsList.push(alertItem);
      }
    }

    briefings.push({
      event: ev,
      daysUntilEvent: daysUntil,
      totalConfirmed: evBookings.length,
      missingOrExpiredCardList,
      allergiesList,
      specialNeedsList,
      noPhotoConsentList,
      pendingEmailsList,
      allParticipants,
    });
  }

  return briefings;
}

/**
 * Generates all system notifications across Duplicate Movements, Pre-Event Checks, Pending Emails, Governance, Bandi, Memberships, and Payments
 */
export function generateSystemNotifications(
  members: Member[],
  bookings: EventBooking[],
  events: EventItem[] = [],
  gadgetOrders: GadgetOrder[] = [],
  roles: AssociationRole[] = [],
  assemblies: AssemblyMeeting[] = [],
  referenceDate: Date = new Date(),
  grants: GrantItem[] = [],
  transactions: CashTransaction[] = [],
  ignoredDuplicateSignatures: string[] = [],
  notificationResolutions?: Record<string, NotificationResolutionRecord>,
  customDeadlines: CustomCriticalDeadline[] = [],
  completedDeadlineIds: string[] = [],
  duplicateDetectionMode: DuplicateDetectionMode = 'strict'
): NotificationItem[] {
  const notifications: NotificationItem[] = [];
  const completedSet = new Set(completedDeadlineIds);

  // 0. DUPLICATE MOVEMENTS ALERT (Same person, same amount, within 7 days max)
  const duplicateGroups = detectDuplicateTransactions(
    transactions,
    members,
    [],
    7,
    ignoredDuplicateSignatures,
    duplicateDetectionMode
  );
  for (const grp of duplicateGroups) {
    const datesStr = grp.allTransactions.map((t) => t.date).join(' vs ');
    notifications.push({
      id: `notif-dup-${grp.groupId}`,
      type: 'urgent',
      category: 'duplicati',
      title: `Possibile Movimento Duplicato: ${grp.personName} (${
        grp.direction === 'income' ? '+' : '-'
      }${formatEuro(grp.amount)})`,
      description: `Rilevati ${grp.allTransactions.length} movimenti simili per "${grp.personName}" dello stesso importo (${formatEuro(
        grp.amount
      )}) entro ${grp.daysSpan} giorni (${datesStr}). Clicca per verificare ed eliminare i duplicati.`,
      date: grp.daysSpan === 0 ? 'Stesso giorno' : `Entro ${grp.daysSpan} gg`,
      targetId: grp.groupId,
      targetType: 'duplicate_group',
      actionLabel: 'Apri Popup Duplicati',
    });
  }

  // 1. PRE-EVENT BRIEFING ALERTS
  const briefings = generatePreEventBriefings(events, bookings, members, referenceDate);
  for (const b of briefings) {
    if (b.totalConfirmed === 0) continue;

    if (b.missingOrExpiredCardList.length > 0) {
      const names = b.missingOrExpiredCardList
        .map((p) => `${p.childName} (${p.cardDetails})`)
        .join('; ');
      notifications.push({
        id: `notif-preev-cards-${b.event.id}`,
        type: 'urgent',
        category: 'pre_evento',
        title: `[Evento: ${b.event.name}] ${b.missingOrExpiredCardList.length} partecipanti senza tessera valida o in scadenza`,
        description: `Verifica immediata prima dell'evento (${b.event.date}): ${names}.`,
        date: b.daysUntilEvent >= 0 ? `Tra ${b.daysUntilEvent} gg` : b.event.date,
        targetId: b.event.id,
        targetType: 'event',
        actionLabel: 'Apri Briefing Evento',
      });
    }

    if (
      b.allergiesList.length > 0 ||
      b.specialNeedsList.length > 0 ||
      b.noPhotoConsentList.length > 0
    ) {
      const parts: string[] = [];
      if (b.allergiesList.length > 0) {
        parts.push(
          `Allergie (${b.allergiesList.length}): ${b.allergiesList
            .map((a) => `${a.childName} [${a.allergies}]`)
            .join(', ')}`
        );
      }
      if (b.noPhotoConsentList.length > 0) {
        parts.push(
          `NO Foto/Social (${b.noPhotoConsentList.length}): ${b.noPhotoConsentList
            .map((p) => p.childName)
            .join(', ')}`
        );
      }
      if (b.specialNeedsList.length > 0) {
        parts.push(
          `Esigenze speciali (${b.specialNeedsList.length}): ${b.specialNeedsList
            .map((s) => `${s.childName} (${s.specialConditions})`)
            .join(', ')}`
        );
      }

      notifications.push({
        id: `notif-preev-safety-${b.event.id}`,
        type: b.allergiesList.length > 0 ? 'urgent' : 'warning',
        category: 'pre_evento',
        title: `Briefing Sicurezza & Privacy per "${b.event.name}" (${b.event.date})`,
        description: parts.join(' • '),
        date: b.event.date,
        targetId: b.event.id,
        targetType: 'event',
        actionLabel: 'Scheda Partecipanti',
      });
    }
  }

  // 2. ALERT EMAIL NON ANCORA INVIATE
  const membersPendingEmail = members.filter((m) => m.confirmationEmailSent === false);
  for (const m of membersPendingEmail) {
    notifications.push({
      id: `notif-email-member-${m.id}`,
      type: 'warning',
      category: 'email_non_inviate',
      title: `Email conferma tesseramento da inviare: ${m.childName}`,
      description: `Il socio ha compilato il modulo per la tessera (${m.insuranceType}). Invia il preventivo o la ricevuta a ${m.parentName} (${m.parentEmail || 'email mancante'}).`,
      date: 'Da inviare',
      targetId: m.id,
      targetType: 'member',
      actionLabel: 'Invia Email / Ricevuta',
    });
  }

  const bookingsPendingEmail = bookings.filter((bk) => bk.confirmationEmailSent === false);
  for (const bk of bookingsPendingEmail) {
    notifications.push({
      id: `notif-email-booking-${bk.id}`,
      type: 'warning',
      category: 'email_non_inviate',
      title: `Email conferma/preventivo evento da inviare: ${bk.childName}`,
      description: `Iscrizione a "${bk.eventName}" registrata. Email di conferma o ricevuta non ancora inviata a ${bk.parentName} (${bk.parentEmail || 'email non indicata'}).`,
      date: 'Da inviare',
      targetId: bk.id,
      targetType: 'booking',
      actionLabel: 'Prepara Email',
    });
  }

  const gadgetsPendingEmail = gadgetOrders.filter((go) => !go.confirmationEmailSent);
  for (const go of gadgetsPendingEmail) {
    notifications.push({
      id: `notif-email-gadget-${go.id}`,
      type: 'warning',
      category: 'email_non_inviate',
      title: `Email prenotazione Gadget da inviare: ${go.childName}`,
      description: `Prenotato "${go.gadgetName}" (${go.variant}, x${go.quantity} - € ${go.totalPrice}). Invia conferma/ricevuta a ${go.parentName} (${go.parentEmail || 'n/d'}).`,
      date: go.date,
      targetId: go.id,
      targetType: 'gadget_order',
      actionLabel: 'Gestisci Ordine Gadget',
    });
  }

  // 3. GOVERNANCE, CARICHE ASSOCIATIVE & ASSEMBLEA ANNUALE RENDICONTO
  for (const asm of assemblies) {
    if (asm.status !== 'svolta_approvata') {
      const deadlineDate = parseAnyDate(asm.approvalDeadline);
      const daysLeft = deadlineDate ? diffDays(deadlineDate, referenceDate) : 30;
      notifications.push({
        id: `notif-asm-${asm.id}`,
        type: daysLeft <= 30 ? 'urgent' : 'warning',
        category: 'governance_scadenze',
        title: `Promemoria Assemblea Soci: ${asm.title}`,
        description: `Data prevista: ${asm.scheduledDate} (Termine approvazione: ${asm.approvalDeadline}). Stato: ${
          asm.status === 'da_convocare' ? 'Da convocare' : 'Convocata'
        }. Ricordati di salvare il verbale su Google Drive.`,
        date: `Scad. ${asm.approvalDeadline}`,
        targetId: asm.id,
        targetType: 'governance',
        actionLabel: 'Vai a Governance & Drive',
      });
    }
  }

  for (const role of roles) {
    const expDate = parseAnyDate(role.expiryDate);
    const daysLeft = expDate ? diffDays(expDate, referenceDate) : 999;
    const isPlaceholder =
      role.personName.toLowerCase().includes('da verificare') || !role.personName.trim();

    if (isPlaceholder || daysLeft <= 60) {
      notifications.push({
        id: `notif-role-${role.id}`,
        type: daysLeft < 0 || isPlaceholder ? 'urgent' : 'warning',
        category: 'governance_scadenze',
        title: `Scadenza Carica Associativa: ${role.roleTitle}`,
        description: `${role.personName} — Scadenza mandato: ${role.expiryDate}${
          daysLeft < 0 ? ' (SCADUTO)' : ` (tra ${daysLeft} giorni)`
        }. ${role.notes || ''}`,
        date: role.expiryDate,
        targetId: role.id,
        targetType: 'governance',
        actionLabel: 'Aggiorna Carica',
      });
    }
  }

  // 4. SCADENZE BANDI (PRESENTAZIONE DOMANDA E RENDICONTAZIONE, ANCHE FUTURE ES. DICEMBRE 2027)
  for (const g of grants) {
    if (g.status === 'chiuso_rendicontato' || g.status === 'non_ammesso') continue;

    if (
      (g.status === 'in_valutazione' || g.status === 'in_preparazione') &&
      g.submissionDeadline
    ) {
      const subDate = parseAnyDate(g.submissionDeadline);
      const daysToSub = subDate ? diffDays(subDate, referenceDate) : 999;
      notifications.push({
        id: `notif-grant-sub-${g.id}`,
        type: daysToSub <= 14 ? 'urgent' : daysToSub <= 60 ? 'warning' : 'info',
        category: 'bandi_scadenze',
        title: `Scadenza Presentazione Bando: ${g.title}`,
        description: `Ente: ${g.promoter} — Termine invio domanda: ${g.submissionDeadline} (${
          daysToSub < 0 ? 'SCADUTO' : `tra ${daysToSub} gg`
        }). Importo richiesto: € ${g.requestedAmount}.`,
        date: g.submissionDeadline,
        targetId: g.id,
        targetType: 'grant',
        actionLabel: 'Apri Scheda Bando',
      });
    }

    if (
      (g.status === 'presentato' ||
        g.status === 'approvato_finanziato' ||
        g.status === 'in_rendicontazione') &&
      g.reportingDeadline
    ) {
      const repDate = parseAnyDate(g.reportingDeadline);
      const daysToRep = repDate ? diffDays(repDate, referenceDate) : 999;
      notifications.push({
        id: `notif-grant-rep-${g.id}`,
        type: daysToRep <= 20 ? 'urgent' : daysToRep <= 90 ? 'warning' : 'info',
        category: 'bandi_scadenze',
        title: `Scadenza Rendicontazione Bando: ${g.title}`,
        description: `Ente: ${g.promoter} — Termine rendicontazione spese: ${g.reportingDeadline} (${
          daysToRep < 0 ? 'SCADUTO' : `tra ${daysToRep} gg`
        }). Verifica fatture e allegati in Drive.`,
        date: g.reportingDeadline,
        targetId: g.id,
        targetType: 'grant',
        actionLabel: 'Rendiconta Bando',
      });
    }
  }

  // 4b. SCADENZE INSERITE MANUALMENTE DALL'UTENTE (Es. Nuovo Bando scadenza Dicembre 2027 o altro adempimento)
  for (const c of customDeadlines) {
    if (completedSet.has(c.id)) continue;
    const dueParsed = parseAnyDate(c.dueDate);
    const daysLeft = dueParsed ? diffDays(dueParsed, referenceDate) : 30;
    const countdownLabel =
      daysLeft < 0
        ? `SCADUTA da ${Math.abs(daysLeft)} gg`
        : daysLeft === 0
        ? 'Scade OGGI'
        : `tra ${daysLeft} gg`;

    notifications.push({
      id: `notif-custom-${c.id}`,
      type: daysLeft <= 14 ? 'urgent' : daysLeft <= 60 ? 'warning' : 'info',
      category:
        c.category === 'bandi_contributi'
          ? 'bandi_scadenze'
          : c.category === 'bilancio_governance'
          ? 'governance_scadenze'
          : 'scadenze_manuali',
      title: `[Scadenza Manuale] ${c.title}`,
      description: `${c.description} — Scadenza fissata al ${c.dueDate} (${countdownLabel})${
        c.recurrenceLabel ? ` · Ricorrenza: ${c.recurrenceLabel}` : ''
      }.`,
      date: `${c.dueDate} (${countdownLabel})`,
      targetId: c.id,
      targetType: 'custom_deadline',
      actionLabel:
        c.category === 'bandi_contributi' ? 'Apri Bandi & Progetti' : 'Modifica Scadenza',
      isCustomDeadline: true,
    });
  }

  // 5. TESSERE DA REGOLARIZZARE / IN SCADENZA (SOLO PER SOCI ISCRITTI AD EVENTI O ATTIVITÀ)
  // I soci degli anni precedenti restano salvati in Anagrafica ma non generano notifiche di rinnovo
  // finché non si iscrivono effettivamente a un evento o attività.
  for (const m of members) {
    const normalizedMemberName = m.childName.trim().toLowerCase();
    const memberBookings = bookings.filter(
      (b) =>
        b.confirmed &&
        ((b.memberId && b.memberId === m.id) ||
          b.childName.trim().toLowerCase() === normalizedMemberName)
    );
    const isEnrolledInActivity = memberBookings.length > 0;

    if (!isEnrolledInActivity) {
      continue;
    }

    const enrolledEventNames = Array.from(
      new Set(memberBookings.map((b) => b.eventName))
    ).join(', ');

    const cardNum = (m.membershipCardNumber || '').trim();
    const expDate = parseAnyDate(m.expiryDate);
    const daysToExp = expDate ? diffDays(expDate, referenceDate) : 999;

    if (
      !m.isPaid ||
      !cardNum ||
      cardNum.toLowerCase().includes('attesa') ||
      cardNum.toLowerCase().includes('mandare')
    ) {
      notifications.push({
        id: `notif-unpaid-${m.id}`,
        type: 'warning',
        category: 'tessere',
        title: `Rinnovo/ Emissione Tessera richiesto (Iscritto a: ${enrolledEventNames}): ${m.childName}`,
        description: cardNum
          ? `Iscritto all'attività "${enrolledEventNames}" con stato tessera "${cardNum}" (${m.insuranceType}). Regolarizzare prima dell'attività.`
          : `Iscritto all'attività "${enrolledEventNames}" ma privo di numero tessera UsAcli o quota non pagata. Genitore: ${m.parentName}.`,
        date: 'In attesa',
        targetId: m.id,
        targetType: 'member',
        actionLabel: 'Rinnova / Regolarizza Tessera',
      });
    } else if (daysToExp <= 30) {
      notifications.push({
        id: `notif-expiring-${m.id}`,
        type: daysToExp < 0 ? 'urgent' : 'warning',
        category: 'tessere',
        title: `Rinnovo Tessera ${daysToExp < 0 ? 'SCADUTA' : 'in scadenza'} (Iscritto a: ${enrolledEventNames}): ${m.childName}`,
        description: `Il socio è iscritto a "${enrolledEventNames}" e la tessera n. ${cardNum} (${m.insuranceType}) scade il ${m.expiryDate}. Contattare ${m.parentName} per il rinnovo.`,
        date: m.expiryDate,
        targetId: m.id,
        targetType: 'member',
        actionLabel: 'Rinnova Tessera',
      });
    }

    if (
      m.needsLevelUp ||
      (m.notesConditions && m.notesConditions.toLowerCase().includes('level up'))
    ) {
      notifications.push({
        id: `notif-levelup-${m.id}`,
        type: 'info',
        category: 'tessere',
        title: `Richiesta Level-Up Assicurazione: ${m.childName}`,
        description: `Richiesto passaggio a copertura superiore (${m.insuranceType}) per ${m.childName} (Iscritto a: ${enrolledEventNames}).`,
        date: 'Promemoria',
        targetId: m.id,
        targetType: 'member',
        actionLabel: 'Gestisci Socio',
      });
    }
  }

  // 6. SALDI EVENTI IN SOSPESO
  const pendingBookings = bookings.filter(
    (b) => b.confirmed && !b.isBalancePaid && b.balanceAmount > 0
  );
  for (const b of pendingBookings) {
    notifications.push({
      id: `notif-booking-${b.id}`,
      type: 'urgent',
      category: 'pagamenti',
      title: `Saldo evento da incassare (€ ${b.balanceAmount}): ${b.childName}`,
      description: `Evento "${b.eventName}". Caparra: € ${b.depositAmount}, saldo rimanente: € ${b.balanceAmount}. Genitore: ${b.parentName}.`,
      date: 'Saldo pendente',
      targetId: b.id,
      targetType: 'booking',
      actionLabel: 'Sollecita / Incassa',
    });
  }

  // 7. MODULI PRIVACY NON ARCHIVIATI
  const missingForms = members.filter((m) => !m.formSignedAndArchived);
  if (missingForms.length > 0) {
    notifications.push({
      id: 'notif-forms-count',
      type: 'info',
      category: 'moduli',
      title: `${missingForms.length} Moduli di iscrizione cartacei/digitali da archiviare`,
      description: `Elenco soci con modulo ancora segnato come non archiviato: ${missingForms
        .slice(0, 6)
        .map((m) => m.childName)
        .join(', ')}${missingForms.length > 6 ? '...' : ''}.`,
      date: 'Archivio CONI',
    });
  }

  if (notificationResolutions && Object.keys(notificationResolutions).length > 0) {
    return filterNotificationsByResolutions(
      notifications,
      notificationResolutions,
      referenceDate
    ).activeNotifications;
  }

  return notifications;
}

export function filterNotificationsByResolutions(
  rawNotifications: NotificationItem[],
  resolutions: Record<string, NotificationResolutionRecord> = {},
  referenceDate: Date = new Date()
): {
  activeNotifications: NotificationItem[];
  resolvedOrPostponedList: {
    notification?: NotificationItem;
    record: NotificationResolutionRecord;
  }[];
} {
  const activeNotifications: NotificationItem[] = [];
  const rawMap = new Map<string, NotificationItem>();

  for (const n of rawNotifications) {
    rawMap.set(n.id, n);
    const rec = resolutions[n.id];
    if (!rec) {
      activeNotifications.push(n);
      continue;
    }
    if (rec.status === 'resolved') {
      // Resolved by user -> hidden from active alerts
      continue;
    }
    if (rec.status === 'postponed' && rec.postponedUntilDate) {
      const targetDate = parseAnyDate(rec.postponedUntilDate);
      if (targetDate && diffDays(targetDate, referenceDate) > 0) {
        // Postponed to a future date -> hidden from active alerts until that date arrives
        continue;
      }
      // The postponed date has arrived -> show in active alerts with updated date and note
      activeNotifications.push({
        ...n,
        date: `Rimandata al ${rec.postponedUntilDate}`,
        description: rec.note ? `[Nota: ${rec.note}] ${n.description}` : n.description,
      });
    } else {
      activeNotifications.push(n);
    }
  }

  const resolvedOrPostponedList = Object.values(resolutions).map((rec) => ({
    notification: rawMap.get(rec.itemId),
    record: rec,
  }));

  return { activeNotifications, resolvedOrPostponedList };
}

