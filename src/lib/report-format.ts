/** Display-only report precision; calculations and stored values stay unchanged. */
export const reportNumber = new Intl.NumberFormat('es-MX', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
