// ─── Validation Utilities ─────────────────────────────────────────────────────

export interface ValidationError {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Valide un prix
 */
export function validatePrice(price: number, context?: { min?: number; max?: number }): ValidationResult {
  const errors: ValidationError[] = [];

  if (isNaN(price)) {
    errors.push({ field: "price", message: "Le prix doit être un nombre valide", severity: "error" });
  } else if (price < 0) {
    errors.push({ field: "price", message: "Le prix ne peut pas être négatif", severity: "error" });
  } else if (context?.min !== undefined && price < context.min) {
    errors.push({ field: "price", message: `Le prix minimum est de ${context.min}€`, severity: "warning" });
  } else if (context?.max !== undefined && price > context.max) {
    errors.push({ field: "price", message: `Le prix maximum est de ${context.max}€`, severity: "warning" });
  }

  return { valid: errors.filter(e => e.severity === "error").length === 0, errors };
}

/**
 * Valide un inventaire
 */
export function validateInventory(inventory: number, capacity: number): ValidationResult {
  const errors: ValidationError[] = [];

  if (isNaN(inventory)) {
    errors.push({ field: "inventory", message: "L'inventaire doit être un nombre valide", severity: "error" });
  } else if (inventory < 0) {
    errors.push({ field: "inventory", message: "L'inventaire ne peut pas être négatif", severity: "error" });
  } else if (inventory > capacity * 1.1) {
    errors.push({ field: "inventory", message: `L'inventaire dépasse 110% de la capacité (${capacity}). Surbooking limité à 10%.`, severity: "error" });
  }

  return { valid: errors.filter(e => e.severity === "error").length === 0, errors };
}

/**
 * Valide une durée de séjour
 */
export function validateStayDuration(value: number | null, type: "min" | "max"): ValidationResult {
  const errors: ValidationError[] = [];

  if (value !== null) {
    if (isNaN(value)) {
      errors.push({ field: type === "min" ? "minStay" : "maxStay", message: "Valeur invalide", severity: "error" });
    } else if (value < 1) {
      errors.push({ field: type === "min" ? "minStay" : "maxStay", message: "La durée doit être au moins de 1 nuit", severity: "error" });
    } else if (value > 30) {
      errors.push({ field: type === "min" ? "minStay" : "maxStay", message: "La durée maximum est de 30 nuits", severity: "warning" });
    }
  }

  return { valid: errors.filter(e => e.severity === "error").length === 0, errors };
}

/**
 * Valide la cohérence Min/Max Stay
 */
export function validateStayConsistency(minStay: number | null, maxStay: number | null): ValidationResult {
  const errors: ValidationError[] = [];

  if (minStay !== null && maxStay !== null && minStay > maxStay) {
    errors.push({
      field: "stayDuration",
      message: `Le Min Stay (${minStay}) ne peut pas être supérieur au Max Stay (${maxStay})`,
      severity: "error",
    });
  }

  return { valid: errors.filter(e => e.severity === "error").length === 0, errors };
}

/**
 * Valide un code tarifaire (unique, format)
 */
export function validateRateCode(code: string, existingCodes?: string[]): ValidationResult {
  const errors: ValidationError[] = [];

  if (!code.trim()) {
    errors.push({ field: "code", message: "Le code est obligatoire", severity: "error" });
  } else if (!/^[A-Z0-9_-]+$/.test(code)) {
    errors.push({ field: "code", message: "Le code ne peut contenir que des lettres majuscules, chiffres, tirets et underscores", severity: "error" });
  } else if (existingCodes?.includes(code)) {
    errors.push({ field: "code", message: "Ce code existe déjà", severity: "error" });
  }

  return { valid: errors.filter(e => e.severity === "error").length === 0, errors };
}

/**
 * Valide une commission
 */
export function validateCommission(commission: number): ValidationResult {
  const errors: ValidationError[] = [];

  if (isNaN(commission)) {
    errors.push({ field: "commission", message: "La commission doit être un nombre valide", severity: "error" });
  } else if (commission < 0) {
    errors.push({ field: "commission", message: "La commission ne peut pas être négative", severity: "error" });
  } else if (commission > 100) {
    errors.push({ field: "commission", message: "La commission ne peut pas dépasser 100%", severity: "error" });
  }

  return { valid: errors.filter(e => e.severity === "error").length === 0, errors };
}
