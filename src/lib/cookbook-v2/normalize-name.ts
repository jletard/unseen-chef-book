export function normalizeCookbookName(value: string) {
  return value.trim().replace(/\s+/gu, " ").toLocaleLowerCase();
}
