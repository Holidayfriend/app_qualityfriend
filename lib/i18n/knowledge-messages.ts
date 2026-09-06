import type { Locale } from "./dictionaries";

const messages = {
  en: {
    settings: "Settings", knowledgeTitle: "Knowledge base", trainingTitle: "Training files",
    knowledgeIntro: "Each department can have its own knowledge base or use the hotel-wide one. The AI assistant automatically uses the appropriate source for its answers.",
    trainingIntro: "Additional training files for the AI—for refinement beyond the regular knowledge base, such as tone-of-voice examples and job-posting templates.",
    hotelWide: "Hotel-wide", department: "Department", documents: "documents", document: "document",
    sharedWithManuals: "also available in Manuals", uploadDocument: "Upload document", uploadTraining: "Upload training file",
    formats: "PDF, DOCX or TXT", dropHint: "Drag and drop or click to browse", updated: "Updated", emptyDocuments: "No documents uploaded yet",
    emptyTraining: "No training files uploaded yet", current: "Current", review: "Review", outdated: "Outdated",
    remove: "Remove", removeConfirm: "Remove this file from this preview?", uploadReady: "File added to the preview. Backend storage will be connected later.",
    invalidType: "Please choose a PDF, DOCX or TXT file.", fileTooLarge: "The file must be smaller than 20 MB.", previewNote: "UI preview · files are kept only until you leave this page",
    bases: { hotel: "Hotel-wide", reception: "Reception", housekeeping: "Housekeeping", restaurant: "Restaurant/Service", kitchen: "Kitchen", administration: "Administration", marketing: "Marketing" },
  },
  de: {
    settings: "Einstellungen", knowledgeTitle: "Wissensbasis", trainingTitle: "Trainingsdateien",
    knowledgeIntro: "Jede Abteilung kann eine eigene Wissensbasis haben – oder greift auf die hotelweite zurück. Die KI im Chat zieht ihre Antworten automatisch aus der passenden Basis.",
    trainingIntro: "Zusätzliche Trainingsdateien für die KI – für Feinschliff über die normale Wissensbasis hinaus, z. B. Tonfall-Beispiele und Stellenausschreibungs-Vorlagen.",
    hotelWide: "Hotelweit", department: "Abteilung", documents: "Dokumente", document: "Dokument",
    sharedWithManuals: "wird auch in Handbücher angezeigt", uploadDocument: "Dokument hochladen", uploadTraining: "Trainingsdatei hochladen",
    formats: "PDF, DOCX oder TXT", dropHint: "Drag & Drop oder klicken", updated: "Aktualisiert", emptyDocuments: "Noch keine Dokumente hochgeladen",
    emptyTraining: "Noch keine Trainingsdateien hochgeladen", current: "Aktuell", review: "Prüfen", outdated: "Veraltet",
    remove: "Entfernen", removeConfirm: "Diese Datei aus der Vorschau entfernen?", uploadReady: "Datei zur Vorschau hinzugefügt. Die Backend-Speicherung folgt später.",
    invalidType: "Bitte eine PDF-, DOCX- oder TXT-Datei auswählen.", fileTooLarge: "Die Datei darf maximal 20 MB groß sein.", previewNote: "UI-Vorschau · Dateien bleiben nur bis zum Verlassen dieser Seite erhalten",
    bases: { hotel: "Hotelweit", reception: "Rezeption", housekeeping: "Housekeeping", restaurant: "Restaurant/Service", kitchen: "Küche", administration: "Administration", marketing: "Marketing" },
  },
  it: {
    settings: "Impostazioni", knowledgeTitle: "Base di conoscenza", trainingTitle: "File di addestramento",
    knowledgeIntro: "Ogni reparto può avere una propria base di conoscenza oppure usare quella dell’intero hotel. L’assistente IA utilizza automaticamente la fonte appropriata per le risposte.",
    trainingIntro: "File di addestramento aggiuntivi per l’IA, utili per perfezionare il modello oltre la normale base di conoscenza, ad esempio con esempi di tono e modelli di annunci di lavoro.",
    hotelWide: "Tutto l’hotel", department: "Reparto", documents: "documenti", document: "documento",
    sharedWithManuals: "disponibile anche nei Manuali", uploadDocument: "Carica documento", uploadTraining: "Carica file di addestramento",
    formats: "PDF, DOCX o TXT", dropHint: "Trascina qui o fai clic per scegliere", updated: "Aggiornato", emptyDocuments: "Nessun documento caricato",
    emptyTraining: "Nessun file di addestramento caricato", current: "Aggiornato", review: "Da verificare", outdated: "Obsoleto",
    remove: "Rimuovi", removeConfirm: "Rimuovere questo file dall’anteprima?", uploadReady: "File aggiunto all’anteprima. L’archiviazione backend verrà collegata in seguito.",
    invalidType: "Scegli un file PDF, DOCX o TXT.", fileTooLarge: "Il file deve essere inferiore a 20 MB.", previewNote: "Anteprima UI · i file restano solo finché non lasci questa pagina",
    bases: { hotel: "Tutto l’hotel", reception: "Reception", housekeeping: "Housekeeping", restaurant: "Ristorante/Servizio", kitchen: "Cucina", administration: "Amministrazione", marketing: "Marketing" },
  },
} as const;

export type KnowledgeMessages = (typeof messages)["en"];
export function getKnowledgeMessages(locale: Locale): KnowledgeMessages { return messages[locale] as KnowledgeMessages; }
