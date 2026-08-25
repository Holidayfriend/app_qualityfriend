export const dictionaries = {
  en: {
    common: { language: "Language", brandSubtitle: "Hotel Operations", optional: "optional" },
    login: {
      eyebrow: "Welcome back", heroTitle: "Your hotel. Your team. One system.", heroDescription: "Keep tasks, workflows, and your entire team in view from one central place.", title: "Sign in", subtitle: "Sign in with your QualityFriend account.", email: "Email address", password: "Password", passwordPlaceholder: "Your password", forgotPassword: "Forgot password?", remember: "Keep me signed in", submit: "Sign in", noAccount: "No account yet?", register: "Create account", showPassword: "Show password", hidePassword: "Hide password",
    },
    register: {
      eyebrow: "Work better together", heroTitle: "A good workday starts with clarity.", heroDescription: "Set up your workspace and bring structure to your hotel's daily operations.", title: "Create account", subtitle: "Create your company and primary contact profile.", companySection: "Company details", contactSection: "Contact details", addressSection: "Business address", firstName: "First name", lastName: "Last name", company: "Company", hotelName: "Hotel name", email: "Email address", password: "Password", passwordPlaceholder: "At least 8 characters", showPassword: "Show password", hidePassword: "Hide password", contactPerson: "Contact person", phone: "Phone number", country: "Country", city: "City", street: "Street address", zip: "ZIP / Postal code", vatId: "VAT ID", terms: "I accept the Terms of Service and Privacy Policy.", submit: "Create account", submitting: "Creating account...", success: "Account created successfully. You can now sign in.", emailExists: "An account with this email already exists.", error: "Registration failed. Please check your details and try again.", hasAccount: "Already registered?", login: "Sign in",
    },
  },
  de: {
    common: { language: "Sprache", brandSubtitle: "Hotelbetrieb", optional: "optional" },
    login: {
      eyebrow: "Willkommen zurück", heroTitle: "Ihr Hotel. Ihr Team. Ein System.", heroDescription: "Behalten Sie Aufgaben, Abläufe und Ihr gesamtes Team an einem zentralen Ort im Blick.", title: "Anmelden", subtitle: "Melden Sie sich mit Ihrem QualityFriend-Konto an.", email: "E-Mail-Adresse", password: "Passwort", passwordPlaceholder: "Ihr Passwort", forgotPassword: "Passwort vergessen?", remember: "Angemeldet bleiben", submit: "Anmelden", noAccount: "Noch kein Konto?", register: "Konto erstellen", showPassword: "Passwort anzeigen", hidePassword: "Passwort ausblenden",
    },
    register: {
      eyebrow: "Gemeinsam besser arbeiten", heroTitle: "Ein guter Arbeitstag beginnt mit Klarheit.", heroDescription: "Richten Sie Ihren Arbeitsbereich ein und bringen Sie Struktur in die täglichen Abläufe Ihres Hotels.", title: "Konto erstellen", subtitle: "Legen Sie Ihr Unternehmen und den Hauptkontakt an.", companySection: "Unternehmensdaten", contactSection: "Kontaktdaten", addressSection: "Geschäftsadresse", firstName: "Vorname", lastName: "Nachname", company: "Unternehmen", hotelName: "Hotelname", email: "E-Mail-Adresse", password: "Passwort", passwordPlaceholder: "Mindestens 8 Zeichen", showPassword: "Passwort anzeigen", hidePassword: "Passwort ausblenden", contactPerson: "Ansprechperson", phone: "Telefonnummer", country: "Land", city: "Stadt", street: "Straße und Hausnummer", zip: "PLZ", vatId: "USt-IdNr.", terms: "Ich akzeptiere die Nutzungsbedingungen und die Datenschutzerklärung.", submit: "Konto erstellen", submitting: "Konto wird erstellt...", success: "Konto erfolgreich erstellt. Sie können sich jetzt anmelden.", emailExists: "Für diese E-Mail-Adresse besteht bereits ein Konto.", error: "Registrierung fehlgeschlagen. Bitte prüfen Sie Ihre Angaben.", hasAccount: "Bereits registriert?", login: "Jetzt anmelden",
    },
  },
  it: {
    common: { language: "Lingua", brandSubtitle: "Gestione alberghiera", optional: "facoltativo" },
    login: {
      eyebrow: "Bentornato", heroTitle: "Il tuo hotel. Il tuo team. Un unico sistema.", heroDescription: "Tieni sotto controllo attività, processi e tutto il team da un unico spazio centrale.", title: "Accedi", subtitle: "Accedi con il tuo account QualityFriend.", email: "Indirizzo e-mail", password: "Password", passwordPlaceholder: "La tua password", forgotPassword: "Password dimenticata?", remember: "Resta connesso", submit: "Accedi", noAccount: "Non hai ancora un account?", register: "Crea account", showPassword: "Mostra password", hidePassword: "Nascondi password",
    },
    register: {
      eyebrow: "Lavorare meglio insieme", heroTitle: "Una buona giornata di lavoro inizia dalla chiarezza.", heroDescription: "Configura il tuo spazio di lavoro e organizza le attività quotidiane del tuo hotel.", title: "Crea account", subtitle: "Inserisci i dati dell'azienda e del contatto principale.", companySection: "Dati aziendali", contactSection: "Dati di contatto", addressSection: "Indirizzo aziendale", firstName: "Nome", lastName: "Cognome", company: "Azienda", hotelName: "Nome dell'hotel", email: "Indirizzo e-mail", password: "Password", passwordPlaceholder: "Almeno 8 caratteri", showPassword: "Mostra password", hidePassword: "Nascondi password", contactPerson: "Persona di contatto", phone: "Numero di telefono", country: "Paese", city: "Città", street: "Indirizzo", zip: "CAP", vatId: "Partita IVA", terms: "Accetto i Termini di servizio e l'Informativa sulla privacy.", submit: "Crea account", submitting: "Creazione account...", success: "Account creato correttamente. Ora puoi accedere.", emailExists: "Esiste già un account con questo indirizzo e-mail.", error: "Registrazione non riuscita. Controlla i dati e riprova.", hasAccount: "Hai già un account?", login: "Accedi",
    },
  },
} as const;

export type Locale = keyof typeof dictionaries;
export const supportedLocales = ["en", "de", "it"] as const;
