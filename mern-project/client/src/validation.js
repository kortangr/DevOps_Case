export const LEVELS = ["Intern", "Junior", "Senior"];
export const TEXT_MAX = 100;

// Returns an error text, or null if valid.
export function validateForm(form) {
  for (const field of ["name", "position"]) {
    const length = String(form[field]).trim().length;
    if (length < 1 || length > TEXT_MAX) {
      return `${field} must be 1-${TEXT_MAX} characters`;
    }
  }
  if (!LEVELS.includes(form.level)) {
    return `Pick a level: ${LEVELS.join(", ")}`;
  }
  return null;
}