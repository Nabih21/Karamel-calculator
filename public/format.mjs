export const currency=n=>Number.isFinite(n)?new Intl.NumberFormat('en-CA',{style:'currency',currency:'CAD',minimumFractionDigits:2,maximumFractionDigits:2}).format(n):'—';
// Tiny rates retain two significant digits instead of rounding nonzero values to zero.
export const unitCurrency=n=>!Number.isFinite(n)?'—':n!==0&&Math.abs(n)<0.01?'$'+n.toFixed(Math.max(2,1-Math.floor(Math.log10(Math.abs(n))))):currency(n);
