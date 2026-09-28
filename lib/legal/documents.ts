import type { Locale } from "../i18n/dictionaries";

export type LegalSection = { heading: string; paragraphs: string[] };

export type LegalDocument = {
  title: string;
  updated: string;
  back: string;
  intro: string;
  sections: LegalSection[];
};

const termsOfUse: Record<Locale, LegalDocument> = {
  en: {
    title: "Terms of use",
    updated: "Last updated: 28 September 2026",
    back: "Back to registration",
    intro: "These terms of use govern access to QualityFriend, the hotel operations platform. By creating an account you agree to these terms for the company you register.",
    sections: [
      {
        heading: "1. The service",
        paragraphs: [
          "QualityFriend helps hotels organize daily work, including tasks, schedules, housekeeping, repairs, and related operations.",
          "We may update, add, or remove features to keep the service secure and useful. We do not guarantee that every feature will remain available without change.",
        ],
      },
      {
        heading: "2. Your account",
        paragraphs: [
          "You must provide accurate company, hotel, and contact details, and you must be allowed to register that business.",
          "You are responsible for keeping passwords confidential and for activity that happens under your account. Tell us promptly if you believe the account has been used without permission.",
        ],
      },
      {
        heading: "3. Acceptable use",
        paragraphs: [
          "Use the service only for lawful hotel operations. Do not attempt to access another hotel’s data, disrupt the platform, or upload content you are not allowed to store.",
          "You are responsible for the information your team enters, including personal data of staff and guests, and for having a lawful basis to process it.",
        ],
      },
      {
        heading: "4. Customer data",
        paragraphs: [
          "You keep ownership of the data you enter. You give QualityFriend permission to host and process that data only to provide, secure, and support the service.",
          "How personal data is handled is described in the Privacy policy.",
        ],
      },
      {
        heading: "5. Availability and liability",
        paragraphs: [
          "We work to keep QualityFriend available, but maintenance, outages, and third-party failures can interrupt access. The service is a tool to support your operations, not a substitute for your own decisions.",
          "To the extent permitted by law, QualityFriend is not liable for indirect or consequential loss, or for decisions made from information shown in the service.",
        ],
      },
      {
        heading: "6. Fees, ending use, and changes",
        paragraphs: [
          "If you choose a paid plan, fees are charged as shown at signup. You may stop using QualityFriend at any time. We may suspend an account that breaks these terms or creates a security risk.",
          "We may update these terms. The date at the top of this page shows when they last changed. Continued use after an update means you accept the revised terms.",
        ],
      },
    ],
  },
  de: {
    title: "Nutzungsbedingungen",
    updated: "Zuletzt aktualisiert: 28. September 2026",
    back: "Zurück zur Registrierung",
    intro: "Diese Nutzungsbedingungen regeln den Zugang zu QualityFriend, der Plattform für den Hotelbetrieb. Mit der Erstellung eines Kontos akzeptieren Sie diese Bedingungen für das Unternehmen, das Sie registrieren.",
    sections: [
      {
        heading: "1. Der Dienst",
        paragraphs: [
          "QualityFriend hilft Hotels, die tägliche Arbeit zu organisieren, einschließlich Aufgaben, Dienstplänen, Housekeeping, Reparaturen und verwandter Abläufe.",
          "Wir können Funktionen aktualisieren, ergänzen oder entfernen, um den Dienst sicher und nützlich zu halten. Wir garantieren nicht, dass jede Funktion unverändert verfügbar bleibt.",
        ],
      },
      {
        heading: "2. Ihr Konto",
        paragraphs: [
          "Sie müssen zutreffende Angaben zu Unternehmen, Hotel und Kontaktperson machen und dürfen dieses Unternehmen registrieren.",
          "Sie sind für die Vertraulichkeit der Passwörter und für Aktivitäten unter Ihrem Konto verantwortlich. Informieren Sie uns umgehend, wenn Sie eine unbefugte Nutzung vermuten.",
        ],
      },
      {
        heading: "3. Zulässige Nutzung",
        paragraphs: [
          "Nutzen Sie den Dienst nur für rechtmäßige Hotelabläufe. Versuchen Sie nicht, auf Daten eines anderen Hotels zuzugreifen, die Plattform zu stören oder Inhalte zu speichern, die Sie nicht speichern dürfen.",
          "Sie sind für die Angaben Ihres Teams verantwortlich, einschließlich personenbezogener Daten von Mitarbeitenden und Gästen, und dafür, dass eine Rechtsgrundlage für die Verarbeitung besteht.",
        ],
      },
      {
        heading: "4. Kundendaten",
        paragraphs: [
          "Die Daten, die Sie eingeben, bleiben in Ihrem Eigentum. Sie erlauben QualityFriend, diese Daten nur zu hosten und zu verarbeiten, um den Dienst bereitzustellen, abzusichern und zu unterstützen.",
          "Der Umgang mit personenbezogenen Daten ist in der Datenschutzerklärung beschrieben.",
        ],
      },
      {
        heading: "5. Verfügbarkeit und Haftung",
        paragraphs: [
          "Wir arbeiten daran, QualityFriend verfügbar zu halten. Wartung, Ausfälle und Störungen Dritter können den Zugang unterbrechen. Der Dienst unterstützt Ihre Abläufe und ersetzt nicht Ihre eigenen Entscheidungen.",
          "Soweit gesetzlich zulässig, haftet QualityFriend nicht für mittelbare Schäden oder Folgeschäden und nicht für Entscheidungen, die auf Angaben im Dienst beruhen.",
        ],
      },
      {
        heading: "6. Entgelte, Beendigung und Änderungen",
        paragraphs: [
          "Wenn Sie einen kostenpflichtigen Tarif wählen, werden die Entgelte so berechnet, wie sie bei der Anmeldung angezeigt werden. Sie können QualityFriend jederzeit nicht mehr nutzen. Wir können ein Konto sperren, das diese Bedingungen verletzt oder ein Sicherheitsrisiko darstellt.",
          "Wir können diese Bedingungen aktualisieren. Das Datum oben auf dieser Seite zeigt die letzte Änderung. Die weitere Nutzung nach einer Aktualisierung bedeutet, dass Sie die geänderten Bedingungen akzeptieren.",
        ],
      },
    ],
  },
  it: {
    title: "Termini di utilizzo",
    updated: "Ultimo aggiornamento: 28 settembre 2026",
    back: "Torna alla registrazione",
    intro: "Questi termini di utilizzo regolano l’accesso a QualityFriend, la piattaforma per la gestione alberghiera. Creando un account accetti questi termini per l’azienda che registri.",
    sections: [
      {
        heading: "1. Il servizio",
        paragraphs: [
          "QualityFriend aiuta gli hotel a organizzare il lavoro quotidiano, inclusi compiti, turni, housekeeping, riparazioni e attività collegate.",
          "Possiamo aggiornare, aggiungere o rimuovere funzioni per mantenere il servizio sicuro e utile. Non garantiamo che ogni funzione resti disponibile senza modifiche.",
        ],
      },
      {
        heading: "2. Il tuo account",
        paragraphs: [
          "Devi indicare dati corretti su azienda, hotel e contatto e devi essere autorizzato a registrare quell’attività.",
          "Sei responsabile della riservatezza delle password e delle attività svolte con il tuo account. Avvisaci subito se ritieni che l’account sia stato usato senza permesso.",
        ],
      },
      {
        heading: "3. Uso consentito",
        paragraphs: [
          "Usa il servizio solo per attività alberghiere lecite. Non tentare di accedere ai dati di un altro hotel, di disturbare la piattaforma o di caricare contenuti che non puoi conservare.",
          "Sei responsabile delle informazioni inserite dal tuo team, compresi i dati personali di personale e ospiti, e di avere una base giuridica per trattarli.",
        ],
      },
      {
        heading: "4. Dati del cliente",
        paragraphs: [
          "Restano di tua proprietà i dati che inserisci. Autorizzi QualityFriend a ospitarli e trattarli solo per fornire, proteggere e assistere il servizio.",
          "Il trattamento dei dati personali è descritto nell’Informativa sulla privacy.",
        ],
      },
      {
        heading: "5. Disponibilità e responsabilità",
        paragraphs: [
          "Lavoriamo per mantenere QualityFriend disponibile, ma manutenzione, interruzioni e problemi di terzi possono limitare l’accesso. Il servizio supporta le tue attività e non sostituisce le tue decisioni.",
          "Nei limiti consentiti dalla legge, QualityFriend non risponde di danni indiretti o consequenziali, né delle decisioni prese in base alle informazioni mostrate nel servizio.",
        ],
      },
      {
        heading: "6. Corrispettivi, cessazione e modifiche",
        paragraphs: [
          "Se scegli un piano a pagamento, i corrispettivi sono quelli indicati al momento dell’iscrizione. Puoi smettere di usare QualityFriend in qualsiasi momento. Possiamo sospendere un account che viola questi termini o crea un rischio per la sicurezza.",
          "Possiamo aggiornare questi termini. La data in alto in questa pagina indica l’ultima modifica. L’uso continuato dopo un aggiornamento significa che accetti i termini revisionati.",
        ],
      },
    ],
  },
};

const privacyPolicy: Record<Locale, LegalDocument> = {
  en: {
    title: "Privacy policy",
    updated: "Last updated: 28 September 2026",
    back: "Back to registration",
    intro: "This policy explains which personal data QualityFriend collects when you register and use an account, and why.",
    sections: [
      {
        heading: "1. Who we are",
        paragraphs: [
          "QualityFriend provides a hotel operations platform. For account data collected through registration, QualityFriend is the controller of that personal data.",
        ],
      },
      {
        heading: "2. Data we collect",
        paragraphs: [
          "When you create an account we collect the company name, hotel name, first and last name, email address, password, country, city, street address, and postal code. Province or region is collected when it applies to the selected country.",
          "Phone number and tax code are optional. We also store the language you choose and technical data such as sign-in time and browser type, which we use to keep the service secure.",
        ],
      },
      {
        heading: "3. How we use data",
        paragraphs: [
          "We use this information to create and manage your account, sign you in, provide the product, contact you about the service, and meet legal duties.",
          "We do not sell personal data.",
        ],
      },
      {
        heading: "4. Legal bases",
        paragraphs: [
          "We process account data to perform the contract with you, for legitimate interests in securing and running the service, and where the law requires it.",
        ],
      },
      {
        heading: "5. Sharing and retention",
        paragraphs: [
          "We share data with providers that host the application, send email, or support billing, and only so they can perform those tasks. We may also disclose data when the law requires it.",
          "We keep account data while the account is active and for a limited time afterwards when we need it for security, billing, or legal claims. You can ask us to delete data we no longer need to keep.",
        ],
      },
      {
        heading: "6. Your rights and security",
        paragraphs: [
          "Depending on where you live, you may request access, correction, deletion, restriction, or a copy of your personal data, and you may object to certain processing. You may also complain to a data protection authority.",
          "We use access controls and technical measures to protect account data. Please use a strong password and limit who can sign in.",
        ],
      },
      {
        heading: "7. Changes",
        paragraphs: [
          "We may update this policy. The date at the top of this page shows when it last changed.",
        ],
      },
    ],
  },
  de: {
    title: "Datenschutzerklärung",
    updated: "Zuletzt aktualisiert: 28. September 2026",
    back: "Zurück zur Registrierung",
    intro: "Diese Erklärung beschreibt, welche personenbezogenen Daten QualityFriend bei der Registrierung und Nutzung eines Kontos erhebt und warum.",
    sections: [
      {
        heading: "1. Wer wir sind",
        paragraphs: [
          "QualityFriend stellt eine Plattform für den Hotelbetrieb bereit. Für Kontodaten, die über die Registrierung erhoben werden, ist QualityFriend der Verantwortliche.",
        ],
      },
      {
        heading: "2. Welche Daten wir erheben",
        paragraphs: [
          "Bei der Kontoerstellung erheben wir Unternehmensname, Hotelname, Vor- und Nachname, E-Mail-Adresse, Passwort, Land, Stadt, Straße und Postleitzahl. Provinz oder Region erheben wir, wenn sie für das gewählte Land gilt.",
          "Telefonnummer und Steuernummer sind freiwillig. Wir speichern außerdem die gewählte Sprache und technische Daten wie Anmeldezeitpunkt und Browsertyp, um den Dienst abzusichern.",
        ],
      },
      {
        heading: "3. Wie wir Daten verwenden",
        paragraphs: [
          "Wir verwenden diese Angaben, um Ihr Konto anzulegen und zu verwalten, Sie anzumelden, das Produkt bereitzustellen, Sie zum Dienst zu kontaktieren und gesetzliche Pflichten zu erfüllen.",
          "Wir verkaufen keine personenbezogenen Daten.",
        ],
      },
      {
        heading: "4. Rechtsgrundlagen",
        paragraphs: [
          "Wir verarbeiten Kontodaten zur Erfüllung des Vertrags mit Ihnen, aufgrund berechtigter Interessen an der Sicherheit und dem Betrieb des Dienstes und soweit das Gesetz es verlangt.",
        ],
      },
      {
        heading: "5. Weitergabe und Speicherdauer",
        paragraphs: [
          "Wir geben Daten an Dienstleister weiter, die die Anwendung hosten, E-Mails versenden oder die Abrechnung unterstützen, und nur damit sie diese Aufgaben ausführen. Wir können Daten auch offenlegen, wenn das Gesetz es verlangt.",
          "Wir speichern Kontodaten, solange das Konto aktiv ist, und danach für eine begrenzte Zeit, wenn wir sie für Sicherheit, Abrechnung oder Rechtsansprüche benötigen. Sie können uns bitten, Daten zu löschen, die wir nicht mehr aufbewahren müssen.",
        ],
      },
      {
        heading: "6. Ihre Rechte und Sicherheit",
        paragraphs: [
          "Je nach Ihrem Wohnort können Sie Auskunft, Berichtigung, Löschung, Einschränkung oder eine Kopie Ihrer personenbezogenen Daten verlangen und bestimmten Verarbeitungen widersprechen. Sie können sich auch bei einer Aufsichtsbehörde beschweren.",
          "Wir schützen Kontodaten durch Zugriffskontrollen und technische Maßnahmen. Bitte verwenden Sie ein starkes Passwort und beschränken Sie, wer sich anmelden kann.",
        ],
      },
      {
        heading: "7. Änderungen",
        paragraphs: [
          "Wir können diese Erklärung aktualisieren. Das Datum oben auf dieser Seite zeigt die letzte Änderung.",
        ],
      },
    ],
  },
  it: {
    title: "Informativa sulla privacy",
    updated: "Ultimo aggiornamento: 28 settembre 2026",
    back: "Torna alla registrazione",
    intro: "Questa informativa spiega quali dati personali QualityFriend raccoglie quando registri e usi un account, e perché.",
    sections: [
      {
        heading: "1. Chi siamo",
        paragraphs: [
          "QualityFriend fornisce una piattaforma per la gestione alberghiera. Per i dati dell’account raccolti in fase di registrazione, QualityFriend è il titolare del trattamento.",
        ],
      },
      {
        heading: "2. Dati che raccogliamo",
        paragraphs: [
          "Quando crei un account raccogliamo ragione sociale, nome dell’hotel, nome e cognome, indirizzo e-mail, password, paese, città, indirizzo e CAP. Provincia o regione vengono raccolte quando si applicano al paese selezionato.",
          "Numero di telefono e partita IVA sono facoltativi. Conserviamo anche la lingua scelta e dati tecnici come l’orario di accesso e il tipo di browser, per proteggere il servizio.",
        ],
      },
      {
        heading: "3. Come usiamo i dati",
        paragraphs: [
          "Usiamo queste informazioni per creare e gestire l’account, autenticarti, fornire il prodotto, contattarti sul servizio e adempiere agli obblighi di legge.",
          "Non vendiamo dati personali.",
        ],
      },
      {
        heading: "4. Basi giuridiche",
        paragraphs: [
          "Trattiamo i dati dell’account per eseguire il contratto con te, per interessi legittimi legati alla sicurezza e al funzionamento del servizio e quando la legge lo richiede.",
        ],
      },
      {
        heading: "5. Comunicazione e conservazione",
        paragraphs: [
          "Condividiamo i dati con fornitori che ospitano l’applicazione, inviano e-mail o supportano la fatturazione, e solo per svolgere questi compiti. Possiamo comunicare i dati anche quando la legge lo richiede.",
          "Conserviamo i dati dell’account finché l’account è attivo e, dopo, per un periodo limitato se servono per sicurezza, fatturazione o azioni legali. Puoi chiederci di cancellare i dati che non dobbiamo più conservare.",
        ],
      },
      {
        heading: "6. I tuoi diritti e la sicurezza",
        paragraphs: [
          "A seconda di dove vivi, puoi chiedere accesso, rettifica, cancellazione, limitazione o una copia dei tuoi dati personali e opporti a determinati trattamenti. Puoi anche proporre reclamo a un’autorità di protezione dei dati.",
          "Proteggiamo i dati dell’account con controlli di accesso e misure tecniche. Usa una password robusta e limita chi può accedere.",
        ],
      },
      {
        heading: "7. Modifiche",
        paragraphs: [
          "Possiamo aggiornare questa informativa. La data in alto in questa pagina indica l’ultima modifica.",
        ],
      },
    ],
  },
};

export function legalDocument(kind: "terms" | "privacy", locale: Locale): LegalDocument {
  return kind === "terms" ? termsOfUse[locale] : privacyPolicy[locale];
}
