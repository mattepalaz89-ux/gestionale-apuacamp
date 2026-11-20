import React from 'react';
import { ShieldCheck, FileText, Lock, HardDrive, ArrowLeft, X } from 'lucide-react';

export type LegalPageType = 'privacy' | 'termini';

interface LegalPagesViewProps {
  page: LegalPageType;
  onSwitchPage: (page: LegalPageType) => void;
  onClose: () => void;
  isStandalonePage?: boolean;
}

export const LegalPagesView: React.FC<LegalPagesViewProps> = ({
  page,
  onSwitchPage,
  onClose,
  isStandalonePage = false,
}) => {
  const content = (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-4xl w-full overflow-hidden">
      {/* Header */}
      <div className="bg-slate-900 text-white px-6 py-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-400 shrink-0">
            {page === 'privacy' ? (
              <ShieldCheck className="w-5 h-5" />
            ) : (
              <FileText className="w-5 h-5" />
            )}
          </div>
          <div>
            <div className="text-[11px] font-mono uppercase tracking-wider text-emerald-400 font-bold">
              Gestionale Associazioni Apuacamp — Creato da Matteo Palazzi
            </div>
            <h1 className="text-lg font-extrabold">
              {page === 'privacy'
                ? 'Informativa sulla Privacy e Utilizzo dei Permessi Google OAuth (/privacy)'
                : 'Termini di Servizio e Licenza Open-Source (/termini)'}
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="inline-flex rounded-lg bg-slate-800 p-1 text-xs">
            <button
              type="button"
              onClick={() => onSwitchPage('privacy')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                page === 'privacy'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Privacy (/privacy)
            </button>
            <button
              type="button"
              onClick={() => onSwitchPage('termini')}
              className={`px-3 py-1 rounded-md font-semibold transition-colors ${
                page === 'termini'
                  ? 'bg-emerald-600 text-white'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Termini (/termini)
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition-colors"
          >
            {isStandalonePage ? (
              <>
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Torna al Gestionale</span>
              </>
            ) : (
              <X className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="p-6 sm:p-8 space-y-6 text-xs sm:text-sm text-slate-700 leading-relaxed max-h-[80vh] overflow-y-auto">
        {page === 'privacy' ? (
          <>
            <div className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-950 flex items-start gap-3">
              <Lock className="w-5 h-5 text-emerald-700 shrink-0 mt-0.5" />
              <div>
                <h2 className="font-bold text-sm">
                  Principio Fondamentale: Nessun Server Terzo Riceve i Dati dell&apos;Associazione
                </h2>
                <p className="text-xs mt-1">
                  <strong>Gestionale Associazioni Apuacamp</strong> è un&apos;applicazione web
                  client-side (eseguita interamente nel browser dell&apos;utente). Tutti i dati
                  inseriti (soci, minori, genitori, contabilità, ricevute, collaboratori e verbali)
                  restano <strong>esclusivamente</strong> nel <strong>Google Drive</strong>{' '}
                  dell&apos;account Google collegato dall&apos;associazione e/o nel file locale{' '}
                  <code className="font-mono">.json</code> sul computer dell&apos;associazione.
                  Nessun database esterno o server di terze parti raccoglie, legge o conserva i dati
                  dell&apos;associazione.
                </p>
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-base flex items-center gap-2">
                <HardDrive className="w-4 h-4 text-emerald-700" />
                <span>1. Dove vengono memorizzati i dati</span>
              </h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs">
                <li>
                  <strong>Google Drive dell&apos;Associazione:</strong> quando l&apos;utente
                  effettua l&apos;accesso con il proprio account Google, il gestionale crea e
                  aggiorna la cartella <code className="font-mono">Gestionale ASD</code> sul Google
                  Drive di quell&apos;account, salvando il database{' '}
                  <code className="font-mono">database_gestionale_asd.json</code>, i punti di
                  ripristino automatici, gli archivi annuali e i PDF delle ricevute.
                </li>
                <li>
                  <strong>Copia di sicurezza locale sul computer (IndexedDB):</strong> durante la
                  sessione di lavoro, il browser mantiene una copia locale isolata per account
                  (<code className="font-mono">snapshot:&lt;email&gt;</code>) per garantire il
                  funzionamento offline e prevenire perdite di dati in caso di chiusura accidentale
                  della scheda.
                </li>
                <li>
                  <strong>Cancellazione immediata al Logout sui PC condivisi:</strong> al momento
                  della disconnessione dall&apos;account Google, l&apos;applicazione propone come
                  scelta predefinita{' '}
                  <em>&ldquo;Sì, esci e cancella i dati da questo computer&rdquo;</em>, rimuovendo
                  integralmente lo snapshot locale IndexedDB e i token di sessione.
                </li>
              </ul>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-base">
                2. Permessi Google OAuth richiesti e relative finalità
              </h3>
              <p className="text-xs text-slate-600">
                L&apos;applicazione richiede esclusivamente i permessi strettamente necessari per
                automatizzare il lavoro di segreteria dell&apos;associazione tramite le API
                ufficiali di Google Workspace:
              </p>
              <div className="space-y-2 text-xs">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-mono font-bold text-slate-900">
                    https://www.googleapis.com/auth/drive.file
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    Consente all&apos;applicazione di creare, leggere e aggiornare{' '}
                    <strong>esclusivamente i file e le cartelle creati dall&apos;app stessa</strong>{' '}
                    (cartella <code className="font-mono">Gestionale ASD</code>, file database JSON,
                    backup automatici e PDF ricevute). L&apos;app non ha accesso ad alcun altro file
                    personale presente sul Google Drive dell&apos;utente.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-mono font-bold text-slate-900">
                    https://www.googleapis.com/auth/spreadsheets
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    Utilizzato per esportare e sincronizzare su richiesta dell&apos;utente il Libro
                    Cassa, l&apos;Anagrafica Soci e le liste iscritti in Fogli Google Sheets, e per
                    importare dati da un Foglio Google indicato dall&apos;utente.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-mono font-bold text-slate-900">
                    https://www.googleapis.com/auth/forms.body &amp; forms.responses.readonly
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    Utilizzato per generare automaticamente i Moduli Google di tesseramento o
                    iscrizione agli eventi dell&apos;associazione e per importare nel gestionale le
                    risposte compilate dai soci.
                  </p>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                  <div className="font-mono font-bold text-slate-900">
                    https://www.googleapis.com/auth/gmail.send
                  </div>
                  <p className="text-slate-600 mt-0.5">
                    Utilizzato esclusivamente quando l&apos;operatore clicca su &ldquo;Invia via
                    Gmail&rdquo; per spedire al socio la ricevuta PDF o la tessera digitale
                    dall&apos;indirizzo Gmail dell&apos;associazione. L&apos;app non può leggere le
                    email ricevute nella casella di posta.
                  </p>
                </div>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-base">
                3. Tutela dei dati sanitari e dei minori negli archivi storici
              </h3>
              <p className="text-xs">
                Ciascuna associazione utilizzatrice agisce in qualità di{' '}
                <strong>Titolare del Trattamento</strong> ai sensi del Regolamento UE 2016/679
                (GDPR) per i dati dei propri soci. Il gestionale mette a disposizione nella sezione{' '}
                <em>Backup &amp; Drive</em> una politica configurabile di conservazione dei dati
                sanitari (allergie, intolleranze, note BES) che permette di anonimizzare
                automaticamente o con un clic i dati medici negli archivi delle annualità passate,
                conservando inalterati i dati contabili e fiscali.
              </p>
            </section>
          </>
        ) : (
          <>
            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-base">
                1. Titolarità del Software e Licenza Open-Source
              </h3>
              <p className="text-xs">
                <strong>Gestionale Associazioni Apuacamp</strong> è un progetto software open-source
                ideato e realizzato da <strong>Matteo Palazzi (ASD Apuacamp)</strong> e rilasciato
                con licenza pubblica aperta compatibile <strong>GNU AGPL-3.0 / EUPL-1.2</strong>{' '}
                (consultabile nel file <code className="font-mono">LICENSE</code> del repository).
              </p>
              <p className="text-xs">
                Qualsiasi Associazione Sportiva Dilettantistica (ASD), Associazione di Promozione
                Sociale (APS) o Ente del Terzo Settore (ETS) può utilizzare gratuitamente
                l&apos;applicazione con il proprio account Google o in locale, personalizzando i
                propri dati istituzionali, l&apos;ente di affiliazione, le tipologie di tessera e le
                categorie contabili.
              </p>
            </section>

            <section className="space-y-2">
              <h3 className="font-bold text-slate-900 text-base">
                2. Responsabilità dell&apos;Associazione Utilizzatrice
              </h3>
              <ul className="list-disc pl-5 space-y-1.5 text-xs">
                <li>
                  L&apos;associazione che utilizza il software è l&apos;unica proprietaria e
                  responsabile dei dati inseriti nel proprio account Google Drive o nei propri file
                  locali.
                </li>
                <li>
                  I controlli automatici presenti nel software (quali gli avvisi per la detrazione
                  fiscale 730 ex art. 15 TUIR, il monitoraggio delle soglie contributive INPS
                  5.000 € e fiscali IRPEF 15.000 € per il lavoro sportivo ex D.Lgs. 36/2021 e lo
                  scadenzario statutario) costituiscono strumenti di ausilio operativo e{' '}
                  <strong>non sostituiscono la consulenza professionale</strong> del commercialista
                  o consulente fiscale dell&apos;associazione.
                </li>
                <li>
                  Il software viene fornito <em>&ldquo;così com&apos;è&rdquo; (AS IS)</em>, senza
                  garanzie esplicite o implicite. Si raccomanda di conservare regolarmente copie di
                  backup tramite le funzioni integrate di esportazione JSON ed Excel.
                </li>
              </ul>
            </section>
          </>
        )}
      </div>
    </div>
  );

  if (isStandalonePage) {
    return (
      <div className="min-h-screen bg-slate-100 text-slate-900 p-4 sm:p-8 flex items-start justify-center">
        {content}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/65 backdrop-blur-xs flex items-center justify-center p-4">
      {content}
    </div>
  );
};
