import { Table, TableHead, TableBody, TableRow, TableCell, TableContainer, Typography, Box, Chip } from '@mui/material';
import { inr } from '../../components/workflow/format';

const num = (v) => Number(v) || 0;

/** Read-only BOQ, grouped by category (quotation view). */
export default function BoqTable({ items = [] }) {
  if (!items.length) return <Typography variant="body2" color="text.secondary">No BOQ lines.</Typography>;
  const order = [];
  const groups = {};
  items.forEach((i) => {
    const c = i.Category || 'Other';
    if (!groups[c]) { groups[c] = []; order.push(c); }
    groups[c].push(i);
  });
  return (
    <TableContainer>
      <Table size="small" sx={{ minWidth: 720 }}>
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', fontSize: 12 } }}>
            <TableCell>Item</TableCell>
            <TableCell>Brand / model class</TableCell>
            <TableCell align="right">Qty</TableCell>
            <TableCell align="right">Unit price</TableCell>
            <TableCell align="right">GST</TableCell>
            <TableCell align="right">Amount</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {order.flatMap((c) => [
            <TableRow key={`h-${c}`}>
              <TableCell colSpan={6} sx={{ bgcolor: 'secondary.light', py: 0.5, fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'secondary.dark' }}>{c}</TableCell>
            </TableRow>,
            ...groups[c].map((i, idx) => {
              const below = i.ProductId && num(i.ListPrice) > 0 && num(i.UnitPrice) < num(i.ListPrice);
              return (
                // eslint-disable-next-line react/no-array-index-key
                <TableRow key={`${c}-${idx}`} sx={{ opacity: i.Optional ? 0.7 : 1, '& td': { verticalAlign: 'top' } }}>
                  <TableCell>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{i.Name}</Typography>
                    {i.Specification && <Typography variant="caption" color="text.secondary" component="div">{i.Specification}</Typography>}
                    {i.Remarks && <Typography variant="caption" color="text.secondary" component="div" sx={{ fontStyle: 'italic' }}>{i.Remarks}</Typography>}
                    {i.Optional && <Chip size="small" variant="outlined" color="secondary" label="Optional — not in total" sx={{ mt: 0.5 }} />}
                  </TableCell>
                  <TableCell><Typography variant="body2">{i.Brand || '—'}</Typography></TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>{i.Qty} {i.Unit}</TableCell>
                  <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                    {inr(i.UnitPrice)}
                    {below && <Box sx={{ fontSize: 11.5, color: 'warning.dark', fontWeight: 600 }}>list {inr(i.ListPrice)}</Box>}
                  </TableCell>
                  <TableCell align="right">{i.GstPercent}%</TableCell>
                  <TableCell align="right" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{inr(num(i.Qty) * num(i.UnitPrice))}</TableCell>
                </TableRow>
              );
            })
          ])}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
