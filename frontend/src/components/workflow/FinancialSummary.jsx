import { Box, Typography, Divider } from '@mui/material';
import { inr, pct } from './format';

const Row = ({ label, value, tone, strong }) => (
  <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, py: 0.4 }}>
    <Typography variant="body2" color="text.secondary">{label}</Typography>
    <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 550, color: tone, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
      {value}
    </Typography>
  </Box>
);

const gstLabel = (rates) => (!rates || rates.length !== 1 ? 'GST (as applicable)' : `GST (${rates[0]}%)`);

// List value → line price cuts → additional discount → offer → GST → final.
// `f` is the API's Financials block (builder evaluation, saved quotation or version snapshot).
export default function FinancialSummary({ f, outsideLimit, compact }) {
  if (!f) return null;
  const totalDiscount = Number(f.DiscountAmount) > 0;
  const adjustment = Number(f.PriceAdjustment) > 0;
  const additional = Number(f.AdditionalDiscountAmount) > 0;
  const discountTone = outsideLimit ? 'error.main' : 'secondary.dark';
  return (
    <Box>
      <Row label="List value (ex-GST)" value={inr(f.BaseAmount)} />
      {compact ? (
        <Row label={`Discount${totalDiscount ? ` (${pct(f.DiscountPercent)})` : ''}`} value={totalDiscount ? `−${inr(f.DiscountAmount)}` : '—'} tone={totalDiscount ? discountTone : undefined} />
      ) : (
        <>
          {adjustment && <Row label="Line price reductions" value={`−${inr(f.PriceAdjustment)}`} tone={discountTone} />}
          {additional && <Row label={`Additional discount (${pct(f.AdditionalDiscountPercent)})`} value={`−${inr(f.AdditionalDiscountAmount)}`} tone={discountTone} />}
          {!adjustment && !additional && !totalDiscount && <Row label="Discount" value="—" />}
          {!adjustment && !additional && totalDiscount && <Row label={`Discount (${pct(f.DiscountPercent)})`} value={`−${inr(f.DiscountAmount)}`} tone={discountTone} />}
          <Row label={totalDiscount ? 'Discounted price (ex-GST)' : 'Offer value (ex-GST)'} value={inr(f.NetAmount)} />
          <Row label={gstLabel(f.GstRates)} value={inr(f.Tax)} />
        </>
      )}
      <Divider sx={{ my: 1 }} />
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 2 }}>
        <Typography variant="overline" sx={{ fontWeight: 700, color: 'text.secondary' }}>Final amount</Typography>
        <Typography sx={{ fontWeight: 750, fontSize: compact ? '1.15rem' : '1.5rem', letterSpacing: '-0.02em', fontVariantNumeric: 'tabular-nums', color: 'text.primary' }}>
          {inr(f.FinalAmount)}
        </Typography>
      </Box>
      {!compact && (
        <Typography variant="caption" color="text.secondary" component="div">
          Inclusive of GST{totalDiscount ? ` · total discount ${pct(f.DiscountPercent)} vs list` : ''}
        </Typography>
      )}
      {!compact && Number(f.OptionalCount) > 0 && (
        <Typography variant="caption" color="secondary.dark" component="div" sx={{ mt: 0.5, fontWeight: 600 }}>
          + {f.OptionalCount} optional upgrade{f.OptionalCount === 1 ? '' : 's'} offered separately ({inr(f.OptionalAmount)} ex-GST)
        </Typography>
      )}
    </Box>
  );
}
