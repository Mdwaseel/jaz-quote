import { useMemo, useState } from 'react';
import {
  Box, Table, TableHead, TableBody, TableRow, TableCell, TableContainer, TextField, Autocomplete, IconButton,
  Tooltip, Typography, Button, Chip, MenuItem, InputAdornment, Stack
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ContentCopyOutlinedIcon from '@mui/icons-material/ContentCopyOutlined';
import StarBorderRoundedIcon from '@mui/icons-material/StarBorderRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import { inr } from '../../../components/workflow/format';
import { blankLine, lineFromProduct, uid } from './calc';

const GST_RATES = ['0', '5', '12', '18', '28'];
const UNITS = ['Nos', 'Lot', 'Set', 'Pair', 'Sq.ft', 'Rft', 'Mtr'];
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

const cellInput = { '& .MuiInputBase-input': { fontSize: 13, py: 0.75 } };

/** Category of a custom line — committed on pick / blur so the row only regroups once. */
function CategoryField({ value, options, onCommit }) {
  const [text, setText] = useState(value || '');
  const commit = (v) => { const t = (v || '').trim(); if (t !== (value || '')) onCommit(t); };
  return (
    <Autocomplete freeSolo size="small" options={options} inputValue={text}
      onInputChange={(_, v, reason) => { if (reason !== 'reset') setText(v); }}
      onChange={(_, v) => { setText(v || ''); commit(v); }}
      renderInput={(params) => (
        <TextField {...params} variant="standard" placeholder="Category" onBlur={() => commit(text)}
          sx={{ mt: 0.5, maxWidth: 240, ...cellInput }} />
      )} />
  );
}

/** The bill of quantities: catalog items or custom lines, every price set by hand. */
export default function BoqEditor({ items, onChange, catalog, versionPrices = {} }) {
  const [picker, setPicker] = useState(null);
  const products = catalog?.Products || [];
  const categories = useMemo(() => {
    const names = (catalog?.Categories || []).map((c) => c.Name);
    items.forEach((i) => { if (i.Category && !names.includes(i.Category)) names.push(i.Category); });
    return names;
  }, [catalog, items]);
  const brands = useMemo(() => [...new Set(Object.values(catalog?.Brands || {}).flat())].sort(), [catalog]);
  const catGst = useMemo(() => Object.fromEntries((catalog?.Categories || []).map((c) => [c.Name, String(c.GstPercent)])), [catalog]);

  const groups = useMemo(() => {
    const order = [];
    const map = {};
    items.forEach((i) => {
      const c = i.Category || 'Other';
      if (!map[c]) { map[c] = []; order.push(c); }
      map[c].push(i);
    });
    return order.map((c) => ({ category: c, lines: map[c] }));
  }, [items]);

  const update = (key, patch) => onChange(items.map((i) => (i.key === key ? { ...i, ...patch } : i)));
  const remove = (key) => onChange(items.filter((i) => i.key !== key));
  const duplicate = (line) => {
    const at = items.findIndex((i) => i.key === line.key);
    onChange([...items.slice(0, at + 1), { ...line, key: uid() }, ...items.slice(at + 1)]);
  };
  const insertInCategory = (line) => {
    // keep a category's lines together: insert after its last line
    let at = -1;
    items.forEach((i, idx) => { if ((i.Category || 'Other') === (line.Category || 'Other')) at = idx; });
    onChange(at < 0 ? [...items, line] : [...items.slice(0, at + 1), line, ...items.slice(at + 1)]);
  };
  const addProduct = (p) => {
    if (!p) return;
    insertInCategory(lineFromProduct(p, 1, versionPrices[p.Id]));
    setPicker(null);
  };

  return (
    <Box>
      <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
        <Autocomplete
          sx={{ flex: 1 }}
          options={products}
          value={picker}
          groupBy={(o) => o.Category}
          getOptionLabel={(o) => o.Name || ''}
          filterOptions={(opts, { inputValue }) => {
            const q = inputValue.trim().toLowerCase();
            if (!q) return opts;
            return opts.filter((o) => `${o.Name} ${o.Category} ${o.Brands} ${o.Specification}`.toLowerCase().includes(q));
          }}
          onChange={(_, v) => addProduct(v)}
          renderOption={(props, o) => (
            <li {...props} key={o.Id}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 2 }}>
                <Box sx={{ minWidth: 0 }}>
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>{o.Name}</Typography>
                  <Typography variant="caption" color="text.secondary" noWrap component="div">{o.Brands || o.Specification}</Typography>
                </Box>
                <Typography variant="body2" sx={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                  {o.Price ? `${inr(o.Price)} / ${o.Unit}` : 'Price on request'}
                </Typography>
              </Box>
            </li>
          )}
          renderInput={(params) => <TextField {...params} label="Add an item from the catalog" placeholder="Search speakers, AV receiver, projector, screen, cables…" />}
        />
        <Button variant="outlined" startIcon={<AddIcon />} onClick={() => onChange([...items, blankLine('Other')])} sx={{ whiteSpace: 'nowrap', minHeight: 54 }}>
          Custom line
        </Button>
      </Stack>

      {items.length === 0 ? (
        <Box sx={{ border: '1px dashed', borderColor: 'divider', borderRadius: 2, py: 5, px: 3, textAlign: 'center' }}>
          <Typography variant="subtitle1" sx={{ mb: 0.5 }}>The BOQ is empty</Typography>
          <Typography variant="body2" color="text.secondary">
            Choose a version on the Room &amp; system step, add items from the catalog above, or add a custom line for anything not in the catalog.
          </Typography>
        </Box>
      ) : (
        <TableContainer sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table size="small" sx={{ minWidth: 1100 }}>
            <TableHead>
              <TableRow sx={{ '& th': { bgcolor: 'primary.main', color: 'primary.contrastText', fontSize: 11.5, fontWeight: 650, letterSpacing: '.04em', py: 1 } }}>
                <TableCell sx={{ minWidth: 300 }}>Item &amp; specification</TableCell>
                <TableCell width={190}>Brand</TableCell>
                <TableCell width={150}>Qty</TableCell>
                <TableCell width={170}>Unit price (₹, ex-GST)</TableCell>
                <TableCell width={88}>GST</TableCell>
                <TableCell width={120} align="right">Amount</TableCell>
                <TableCell width={104} />
              </TableRow>
            </TableHead>
            <TableBody>
              {groups.flatMap((g) => {
                const subtotal = g.lines.filter((l) => !l.Optional).reduce((s, l) => s + num(l.Qty) * num(l.UnitPrice), 0);
                return [
                  <TableRow key={`h-${g.category}`}>
                    <TableCell colSpan={7} sx={{ bgcolor: 'secondary.light', py: 0.6 }}>
                      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 2 }}>
                        <Typography sx={{ fontSize: 11.5, fontWeight: 700, letterSpacing: '.12em', textTransform: 'uppercase', color: 'secondary.dark' }}>
                          {g.category}
                        </Typography>
                        <Stack direction="row" spacing={2} alignItems="center">
                          <Button size="small" startIcon={<AddIcon />} sx={{ py: 0, minHeight: 0, color: 'secondary.dark' }}
                            onClick={() => insertInCategory({ ...blankLine(g.category), GstPercent: catGst[g.category] || '18' })}>
                            Line
                          </Button>
                          <Typography variant="body2" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{inr(subtotal)}</Typography>
                        </Stack>
                      </Box>
                    </TableCell>
                  </TableRow>,
                  ...g.lines.map((l) => {
                    const amount = num(l.Qty) * num(l.UnitPrice);
                    const list = num(l.ListPrice);
                    const unit = num(l.UnitPrice);
                    const below = l.ProductId && list > 0 && unit < list;
                    const above = l.ProductId && list > 0 && unit > list;
                    return (
                      <TableRow key={l.key} sx={{ opacity: l.Optional ? 0.72 : 1, '& td': { verticalAlign: 'top', py: 1 } }}>
                        <TableCell>
                          <TextField variant="standard" fullWidth multiline placeholder="Item name" value={l.Name}
                            onChange={(e) => update(l.key, { Name: e.target.value })}
                            InputProps={{ disableUnderline: !!l.Name, sx: { fontWeight: 650, fontSize: 14 } }} />
                          <TextField variant="standard" fullWidth multiline placeholder="Specification" value={l.Specification}
                            onChange={(e) => update(l.key, { Specification: e.target.value })}
                            InputProps={{ disableUnderline: true, sx: { fontSize: 12.5, color: 'text.secondary' } }} />
                          {!l.ProductId && (
                            <CategoryField value={l.Category} options={categories} onCommit={(v) => update(l.key, { Category: v || 'Other' })} />
                          )}
                          <TextField variant="standard" fullWidth placeholder="Remarks (optional)" value={l.Remarks}
                            onChange={(e) => update(l.key, { Remarks: e.target.value })}
                            InputProps={{ disableUnderline: true, sx: { fontSize: 12, fontStyle: 'italic', color: 'text.secondary' } }} />
                          {l.Optional && <Chip size="small" label="Optional — not in total" color="secondary" variant="outlined" sx={{ mt: 0.5 }} />}
                        </TableCell>
                        <TableCell>
                          <Autocomplete freeSolo size="small" options={brands} value={l.Brand || ''}
                            onInputChange={(_, v) => update(l.key, { Brand: v })}
                            renderInput={(params) => <TextField {...params} placeholder="Brand" sx={cellInput} />} />
                        </TableCell>
                        <TableCell>
                          <Stack direction="row" spacing={0.5}>
                            <TextField size="small" type="number" value={l.Qty} error={num(l.Qty) <= 0}
                              onChange={(e) => update(l.key, { Qty: e.target.value })} inputProps={{ min: 0, step: 'any', 'aria-label': 'Quantity' }} sx={{ width: 68, ...cellInput }} />
                            <TextField size="small" select value={UNITS.includes(l.Unit) ? l.Unit : 'Nos'}
                              onChange={(e) => update(l.key, { Unit: e.target.value })} sx={{ width: 76, ...cellInput }}
                              SelectProps={{ 'aria-label': 'Unit' }}>
                              {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                            </TextField>
                          </Stack>
                        </TableCell>
                        <TableCell>
                          <TextField size="small" type="number" value={l.UnitPrice} placeholder="Set price"
                            error={l.UnitPrice === '' || num(l.UnitPrice) < 0}
                            onChange={(e) => update(l.key, { UnitPrice: e.target.value })}
                            inputProps={{ min: 0, step: 'any', 'aria-label': 'Unit price' }}
                            InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }}
                            sx={{ ...cellInput, '& .MuiOutlinedInput-root': { bgcolor: below ? 'warning.light' : undefined } }} />
                          {l.ProductId && list > 0 && (
                            <Tooltip title={below ? 'Below the catalog list price — counts towards the discount that needs approval.' : 'Catalog list price'}>
                              <Typography variant="caption" component="div" sx={{ mt: 0.4, color: below ? 'warning.dark' : above ? 'success.dark' : 'text.secondary', fontWeight: below ? 650 : 500, cursor: 'help' }}>
                                List {inr(list)}{below ? ` · −${Math.round(((list - unit) / list) * 1000) / 10}%` : above ? ' · above list' : ''}
                              </Typography>
                            </Tooltip>
                          )}
                        </TableCell>
                        <TableCell>
                          <TextField size="small" select value={GST_RATES.includes(String(l.GstPercent)) ? String(l.GstPercent) : '18'}
                            onChange={(e) => update(l.key, { GstPercent: e.target.value })} sx={{ width: 78, ...cellInput }}
                            SelectProps={{ 'aria-label': 'GST rate' }}>
                            {GST_RATES.map((r) => <MenuItem key={r} value={r}>{r}%</MenuItem>)}
                          </TextField>
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums', pt: '14px !important' }}>
                          {inr(amount)}
                        </TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title={l.Optional ? 'Include in the total' : 'Mark as optional upgrade (shown separately, not in the total)'}>
                            <IconButton size="small" aria-label="Toggle optional" onClick={() => update(l.key, { Optional: !l.Optional })} sx={{ color: l.Optional ? 'secondary.main' : 'text.secondary' }}>
                              {l.Optional ? <StarRoundedIcon fontSize="small" /> : <StarBorderRoundedIcon fontSize="small" />}
                            </IconButton>
                          </Tooltip>
                          <Tooltip title="Duplicate line">
                            <IconButton size="small" aria-label="Duplicate line" onClick={() => duplicate(l)}><ContentCopyOutlinedIcon fontSize="small" /></IconButton>
                          </Tooltip>
                          <Tooltip title="Remove line">
                            <IconButton size="small" color="error" aria-label="Remove line" onClick={() => remove(l.key)}><DeleteOutlineIcon fontSize="small" /></IconButton>
                          </Tooltip>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ];
              })}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Box>
  );
}
