/**
 * FLOWTYM — Import Service · Types partagés
 *
 * Contrats communs entre l'UI d'import et les providers (Lighthouse / Expedia /
 * Événements). Strictement aucune dépendance UI ou React ici.
 */

export type ImportSourceId =
  | 'lighthouse-file'
  | 'lighthouse-api'
  | 'expedia'
  | 'events';

export type ImportSourceStatus =
  | 'file'             // import fichier disponible aujourd'hui
  | 'api-ready'        // API branchée et prête
  | 'api-coming-soon'; // API prévue, pas encore active

export type ImportSourceIcon = 'lighthouse' | 'expedia' | 'events';

/**
 * Méta-description d'une source d'import, exposée à l'UI.
 */
export interface ImportSourceMeta {
  id: ImportSourceId;
  label: string;
  shortLabel: string;
  description: string;
  acceptedFormats: string[];     // affichage humain ('.xlsx', '.csv')
  acceptedMime: string;          // input.accept
  status: ImportSourceStatus;
  icon: ImportSourceIcon;
  rmsTargets: string[];          // ce qui sera mis à jour côté RMS
}

/**
 * Aperçu avant validation : ce que l'utilisateur doit voir AVANT le commit.
 */
export interface ImportPreview {
  source: ImportSourceId;
  fileName: string;
  fileSize: number;
  totalRows: number;
  validRows: number;
  ignoredRows: number;
  duplicates: number;
  inconsistencies: number;
  outliers: number;
  warnings: string[];
  errors: string[];
  columns: string[];             // colonnes mappées détectées
  samples: SamplePreviewRow[];   // 5 premières lignes pour preview UI
  rmsImpact: string[];           // description humaine de l'impact
}

export interface SamplePreviewRow {
  /** Représentation simple clé/valeur normalisée pour preview tableau */
  cells: Record<string, string | number | null>;
}

/**
 * Résultat d'un parse réussi (parse only, pas encore engagé).
 * Le `payload` est conservé par l'UI et renvoyé tel quel au commit
 * pour éviter de re-parser le fichier deux fois.
 */
export interface ParseOutcome<T = unknown> {
  preview: ImportPreview;
  payload: T;
}

export type ImportRunStatus = 'success' | 'partial' | 'failed';

/**
 * Résultat d'un commit, persisté dans le journal d'audit.
 */
export interface ImportResult {
  id: string;                    // identifiant unique de l'import
  source: ImportSourceId;
  fileName: string;
  fileSize: number;
  status: ImportRunStatus;
  totalRows: number;
  importedRows: number;
  ignoredRows: number;
  duplicates: number;
  errors: string[];
  warnings: string[];
  importedAt: string;            // ISO
  importedBy?: string;
  rollbackToken?: string;        // identifiant pour annuler ce commit
  rmsImpact: string[];
}

/**
 * Contrat unique pour toutes les sources de données marché.
 * Parsing & validation sont du ressort du provider, jamais de l'UI.
 */
export interface MarketDataProvider<T = unknown> {
  readonly meta: ImportSourceMeta;

  /** Parse fichier + validation + détection anomalies. Ne commit rien. */
  parse(file: File, onProgress?: (pct: number) => void): Promise<ParseOutcome<T>>;

  /** Engage les données dans les stores RMS, retourne un résultat audit-able. */
  commit(payload: T, meta: { fileName: string; fileSize: number }): Promise<ImportResult>;

  /** (Optionnel) annule un commit précédent identifié par son token. */
  rollback?(token: string): Promise<void>;
}

/**
 * Une source peut être indisponible (API pas encore implémentée).
 * On utilise un type d'erreur dédié plutôt qu'un boolean magique.
 */
export class ImportSourceUnavailableError extends Error {
  constructor(public readonly source: ImportSourceId, message: string) {
    super(message);
    this.name = 'ImportSourceUnavailableError';
  }
}

export class ImportValidationError extends Error {
  constructor(
    public readonly source: ImportSourceId,
    message: string,
    public readonly details: string[] = []
  ) {
    super(message);
    this.name = 'ImportValidationError';
  }
}
