// Instant client-side mirror of quotes/pricing.py so totals update while typing.
// The server recomputes everything on evaluate/save — these numbers are never sent as truth.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

let seq = 0;
export const uid = () => `l${Date.now().toString(36)}${(seq += 1)}`;

export const isPriced = (i) => (i.Name || '').trim() && num(i.Qty) > 0;

/**
 * Additional-discount % implied by the builder's discount input:
 *   pct    — a percentage off the quoted BOQ
 *   amount — rupees off the quoted BOQ (ex-GST)
 *   price  — the discounted price itself, ex-GST or GST-inclusive (`basis` 'ex' | 'incl')
 * `fullTax` is the GST on the quoted BOQ before any additional discount.
 */
export const additionalPercent = (quoted, d = {}, fullTax = 0) => {
  const clamp = (v) => Math.min(100, Math.max(0, v));
  if (!(quoted > 0)) return 0;
  if (d.DiscountMode === 'amount') return clamp((num(d.DiscountAmount) / quoted) * 100);
  if (d.DiscountMode === 'price') {
    if (d.DiscountPrice === '' || d.DiscountPrice == null) return 0;
    const target = num(d.DiscountPrice);
    const base = d.DiscountPriceBasis === 'incl' ? quoted + fullTax : quoted;
    return clamp((1 - target / base) * 100);
  }
  return clamp(num(d.DiscountPercent));
};

/** Quoted BOQ value and its GST before the additional discount (included lines only). */
export const quotedBase = (items) => (items || []).filter((i) => isPriced(i) && !i.Optional).reduce((acc, i) => {
  const v = num(i.Qty) * num(i.UnitPrice);
  return { quoted: acc.quoted + v, tax: acc.tax + (v * num(i.GstPercent)) / 100 };
}, { quoted: 0, tax: 0 });

/** Totals for the builder. `discountInput` carries DiscountMode / DiscountPercent / DiscountAmount / DiscountPrice / DiscountPriceBasis. */
export function computeTotals(items, discountInput = {}) {
  const included = (items || []).filter((i) => isPriced(i) && !i.Optional);
  let listRaw = 0;
  let quotedRaw = 0;
  let fullTax = 0;
  included.forEach((i) => {
    const q = num(i.Qty);
    const u = num(i.UnitPrice);
    listRaw += q * Math.max(num(i.ListPrice), u);
    quotedRaw += q * u;
    fullTax += (q * u * num(i.GstPercent)) / 100;
  });
  const pct = additionalPercent(quotedRaw, discountInput, fullTax);
  const keep = (100 - pct) / 100;
  let taxRaw = 0;
  const rates = new Set();
  included.forEach((i) => {
    taxRaw += (num(i.Qty) * num(i.UnitPrice) * keep * num(i.GstPercent)) / 100;
    rates.add(num(i.GstPercent));
  });
  const list = Math.round(listRaw);
  const quoted = Math.round(quotedRaw);
  const additional = Math.round((quotedRaw * pct) / 100);
  const net = Math.max(quoted - additional, 0);
  const tax = Math.round(taxRaw);
  const discount = Math.max(list - net, 0);
  const optional = (items || []).filter((i) => isPriced(i) && i.Optional);
  return {
    BaseAmount: list,
    QuotedAmount: quoted,
    PriceAdjustment: Math.max(list - quoted, 0),
    AdditionalDiscountPercent: pct,
    AdditionalDiscountAmount: additional,
    DiscountPercent: list ? Math.round((discount / list) * 10000) / 100 : 0,
    DiscountAmount: discount,
    NetAmount: net,
    Tax: tax,
    FinalAmount: net + tax,
    GstRates: [...rates].sort((a, b) => a - b),
    OptionalAmount: Math.round(optional.reduce((s, i) => s + num(i.Qty) * num(i.UnitPrice), 0)),
    OptionalCount: optional.length,
    ItemCount: included.length
  };
}

/** A BOQ line from a catalog product, at `price` (a version's own price) or its list price.
 * Unpriced products ("price on request") start with an empty price for the salesperson to fill. */
export const lineFromProduct = (p, qty = 1, price = null) => {
  const unit = price ?? p.Price ?? 0;
  return {
    key: uid(),
    ProductId: p.Id,
    Category: p.Category,
    Name: p.Name,
    Specification: p.Specification || '',
    Brand: p.Brands || '',
    Unit: p.Unit || 'Nos',
    Qty: String(qty),
    UnitPrice: unit ? String(unit) : '',
    ListPrice: Number(unit),
    GstPercent: String(p.GstPercent ?? 18),
    Optional: false,
    Remarks: ''
  };
};

export const blankLine = (category = '') => ({
  key: uid(), ProductId: null, Category: category, Name: '', Specification: '', Brand: '', Unit: 'Nos',
  Qty: '1', UnitPrice: '', ListPrice: 0, GstPercent: '18', Optional: false, Remarks: ''
});

/** Lines as the API expects them (ListPrice is resolved server-side; never sent). */
export const itemsPayload = (items) => (items || [])
  .filter((i) => (i.Name || '').trim())
  .map((i) => ({
    ProductId: i.ProductId || null,
    Category: (i.Category || '').trim() || 'Other',
    Name: i.Name.trim(),
    Specification: i.Specification || '',
    Brand: i.Brand || '',
    Unit: i.Unit || 'Nos',
    Qty: num(i.Qty),
    UnitPrice: num(i.UnitPrice),
    GstPercent: i.GstPercent === '' ? 18 : num(i.GstPercent),
    Optional: !!i.Optional,
    Remarks: i.Remarks || ''
  }));
