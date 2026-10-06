// Instant client-side mirror of quotes/pricing.py so totals update while typing.
// The server recomputes everything on evaluate/save — these numbers are never sent as truth.

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

let seq = 0;
export const uid = () => `l${Date.now().toString(36)}${(seq += 1)}`;

export const isPriced = (i) => (i.Name || '').trim() && num(i.Qty) > 0;

/** Additional-discount % implied by the builder's discount input (% or ₹ off the quoted BOQ). */
export const additionalPercent = (quoted, mode, pctValue, amountValue) => {
  if (mode === 'amount') return quoted > 0 ? Math.min(100, Math.max(0, (num(amountValue) / quoted) * 100)) : 0;
  return Math.min(100, Math.max(0, num(pctValue)));
};

export function computeTotals(items, mode, pctValue, amountValue) {
  const included = (items || []).filter((i) => isPriced(i) && !i.Optional);
  let listRaw = 0;
  let quotedRaw = 0;
  included.forEach((i) => {
    const q = num(i.Qty);
    const u = num(i.UnitPrice);
    listRaw += q * Math.max(num(i.ListPrice), u);
    quotedRaw += q * u;
  });
  const pct = additionalPercent(quotedRaw, mode, pctValue, amountValue);
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

/** A BOQ line from a catalog product. */
export const lineFromProduct = (p, qty = 1) => ({
  key: uid(),
  ProductId: p.Id,
  Category: p.Category,
  Name: p.Name,
  Specification: p.Specification || '',
  Brand: p.Brands || '',
  Unit: p.Unit || 'Nos',
  Qty: String(qty),
  UnitPrice: String(p.Price ?? 0),
  ListPrice: Number(p.Price ?? 0),
  GstPercent: String(p.GstPercent ?? 18),
  Optional: false,
  Remarks: ''
});

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
