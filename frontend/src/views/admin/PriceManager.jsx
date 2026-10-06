import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  Box, Tabs, Tab, Typography, Table, TableHead, TableBody, TableRow, TableCell, TextField, InputAdornment, Button,
  Snackbar, Alert, Skeleton, TableContainer, Paper, Chip, IconButton, Tooltip, Dialog, DialogTitle, DialogContent,
  DialogActions, MenuItem, Divider, Switch, Autocomplete, Stack, Grid
} from '@mui/material';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import MainCard from '../../components/MainCard';
import RowsEditor from '../quotation/builder/RowsEditor';
import { inr } from '../../components/workflow/format';
import { fetchCatalog, updateCatalog, createCatalog, deleteCatalog, fetchCatalogRefs } from '../../store/slices/adminSlice';

const TABS = [
  { kind: 'product', label: 'Products & prices', singular: 'product' },
  { kind: 'package', label: 'Packages', singular: 'package' },
  { kind: 'category', label: 'Categories', singular: 'category' },
  { kind: 'paymentterm', label: 'Payment terms', singular: 'payment stage' }
];
const UNITS = ['Nos', 'Lot', 'Set', 'Pair', 'Sq.ft', 'Rft', 'Mtr'];
const GST = ['0', '5', '12', '18', '28'];
const headSx = { '& th': { fontWeight: 700, bgcolor: '#f8f5ee', color: 'text.primary', whiteSpace: 'nowrap' } };
const changedSx = (on) => ({ '& .MuiOutlinedInput-root': { bgcolor: on ? '#fbf3e2' : undefined } });

export default function PriceManager() {
  const dispatch = useDispatch();
  const { catalog, loading, refs } = useSelector((s) => s.admin);
  const [tab, setTab] = useState(0);
  const [edits, setEdits] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('');
  const [toast, setToast] = useState({ open: false, msg: '', sev: 'success' });
  const [dialog, setDialog] = useState(null); // {mode: 'create'|'edit', kind, data}

  const type = TABS[tab];
  const rows = catalog[type.kind] || [];

  useEffect(() => { dispatch(fetchCatalogRefs()); }, [dispatch]);
  useEffect(() => {
    dispatch(fetchCatalog(type.kind));
    setEdits({});
    setSearch('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  const notify = (msg, sev = 'success') => setToast({ open: true, msg, sev });
  const setField = (id, field, val) => setEdits((e) => ({ ...e, [id]: { ...e[id], [field]: val } }));
  const reload = () => { dispatch(fetchCatalog(type.kind)); dispatch(fetchCatalogRefs()); };

  const save = async (row, extra = {}) => {
    const payload = { kind: type.kind, id: row.Id, ...(edits[row.Id] || {}), ...extra };
    if (payload.value !== undefined) payload.value = Number(payload.value);
    setBusyId(row.Id);
    const res = await dispatch(updateCatalog(payload));
    setBusyId(null);
    if (updateCatalog.fulfilled.match(res)) {
      notify(`Saved “${payload.name ?? row.Name}”`);
      setEdits((e) => { const c = { ...e }; delete c[row.Id]; return c; });
      reload();
    } else notify(res.payload || res.error?.message || 'Save failed', 'error');
  };

  const remove = async (row) => {
    const warn = type.kind === 'product' ? ' It will also be removed from any package. Tip: switch it off instead to hide it from new quotations.' : '';
    if (!window.confirm(`Delete “${row.Name}”?${warn}`)) return;
    setBusyId(row.Id);
    const res = await dispatch(deleteCatalog({ kind: type.kind, id: row.Id }));
    setBusyId(null);
    if (deleteCatalog.fulfilled.match(res)) { notify(`Deleted “${row.Name}”`); reload(); } else notify(res.payload || 'Delete failed', 'error');
  };

  const submitDialog = async () => {
    const { mode, kind, data } = dialog;
    const payload = { kind, ...data };
    if (payload.value !== undefined && payload.value !== '') payload.value = Number(payload.value);
    const action = mode === 'create' ? createCatalog : updateCatalog;
    const res = await dispatch(action(payload));
    if (action.fulfilled.match(res)) {
      setDialog(null);
      notify(mode === 'create' ? 'Created' : 'Saved');
      reload();
    } else notify(res.payload || 'Could not save', 'error');
  };

  const q = search.toLowerCase();
  const filtered = rows.filter((r) => (!catFilter || r.CategoryId === catFilter)
    && [r.Name, r.Category, r.Brands, r.Specification, r.Configuration, r.Tier].filter(Boolean).join(' ').toLowerCase().includes(q));

  const openCreate = () => {
    const defaults = {
      product: { name: '', categoryId: catFilter || refs.categories?.[0]?.Id || '', unit: 'Nos', value: '', gstPercent: '', specification: '', brands: '' },
      package: { name: '', configuration: '', tier: '', description: '', spec: [], items: [], active: true },
      category: { name: '', gstPercent: 18, order: (rows.length + 1) * 10 },
      paymentterm: { name: '', value: '', order: rows.length + 1 }
    }[type.kind];
    setDialog({ mode: 'create', kind: type.kind, data: defaults });
  };
  const openPackage = (row) => setDialog({
    mode: 'edit', kind: 'package',
    data: { id: row.Id, name: row.Name, configuration: row.Configuration, tier: row.Tier, description: row.Description,
      spec: row.Spec || [], active: row.Active, items: row.Items.map((i) => ({ productId: i.ProductId, qty: i.Qty })) }
  });

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 3, gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ maxWidth: 760 }}>
          <Typography variant="h2" sx={{ mb: 0.5 }}>Prices &amp; Catalog</Typography>
          <Typography variant="body2" color="text.secondary">
            List prices are the starting point on every quotation. Sales can set any price per line; pricing below list counts towards the discount that needs approval. Changes apply to new quotations immediately.
          </Typography>
        </Box>
        <Button variant="contained" startIcon={<AddIcon />} onClick={openCreate}>Add {type.singular}</Button>
      </Box>

      <MainCard contentSx={{ p: 0 }}>
        <Tabs value={tab} onChange={(e, v) => setTab(v)} variant="scrollable" scrollButtons="auto" sx={{ px: 2, borderBottom: '1px solid', borderColor: 'divider' }}>
          {TABS.map((t) => <Tab key={t.kind} label={t.label} />)}
        </Tabs>

        <Box sx={{ p: 2.5 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mb: 2 }}>
            <TextField size="small" placeholder="Search…" value={search} onChange={(e) => setSearch(e.target.value)} sx={{ width: { xs: '100%', sm: 320 } }}
              InputProps={{ startAdornment: (<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>) }} />
            {type.kind === 'product' && (
              <TextField size="small" select label="Category" value={catFilter} onChange={(e) => setCatFilter(e.target.value)} sx={{ minWidth: 220 }}>
                <MenuItem value="">All categories</MenuItem>
                {(refs.categories || []).map((c) => <MenuItem key={c.Id} value={c.Id}>{c.Name}</MenuItem>)}
              </TextField>
            )}
          </Stack>

          {loading && rows.length === 0 ? <Skeleton variant="rounded" height={320} /> : (
            <TableContainer component={Paper} variant="outlined" sx={{ borderRadius: 2 }}>
              {type.kind === 'product' && (
                <Table size="small" sx={{ minWidth: 1000, '& td, & th': { px: 1 }, '& td:first-of-type, & th:first-of-type': { pl: 2 } }}>
                  <TableHead><TableRow sx={headSx}>
                    <TableCell sx={{ minWidth: 240 }}>Product</TableCell><TableCell>Category</TableCell><TableCell sx={{ minWidth: 170 }}>Brand / model class</TableCell>
                    <TableCell>Unit</TableCell><TableCell>List price (ex-GST)</TableCell><TableCell>GST</TableCell><TableCell>Active</TableCell><TableCell align="right">Actions</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {filtered.map((row) => {
                      const e = edits[row.Id] || {};
                      const changed = Object.keys(e).length > 0;
                      return (
                        <TableRow key={row.Id} hover sx={{ opacity: row.Active ? 1 : 0.55, '& td': { verticalAlign: 'top' } }}>
                          <TableCell>
                            <TextField variant="standard" fullWidth multiline value={e.name ?? row.Name} onChange={(ev) => setField(row.Id, 'name', ev.target.value)}
                              InputProps={{ disableUnderline: true, sx: { fontWeight: 650, fontSize: 14 } }} />
                            <TextField variant="standard" fullWidth multiline value={e.specification ?? row.Specification} placeholder="Specification"
                              onChange={(ev) => setField(row.Id, 'specification', ev.target.value)} InputProps={{ disableUnderline: true, sx: { fontSize: 12.5, color: 'text.secondary' } }} />
                          </TableCell>
                          <TableCell>
                            <TextField select size="small" value={e.categoryId ?? row.CategoryId} onChange={(ev) => setField(row.Id, 'categoryId', ev.target.value)} sx={{ width: 150 }}>
                              {(refs.categories || []).map((c) => <MenuItem key={c.Id} value={c.Id}>{c.Name}</MenuItem>)}
                            </TextField>
                          </TableCell>
                          <TableCell><TextField size="small" fullWidth multiline maxRows={3} value={e.brands ?? row.Brands} onChange={(ev) => setField(row.Id, 'brands', ev.target.value)} /></TableCell>
                          <TableCell>
                            <TextField select size="small" value={e.unit ?? (UNITS.includes(row.Unit) ? row.Unit : 'Nos')} onChange={(ev) => setField(row.Id, 'unit', ev.target.value)} sx={{ width: 90 }}>
                              {UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <TextField size="small" type="number" value={e.value ?? row.Price} onChange={(ev) => setField(row.Id, 'value', ev.target.value)}
                              InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} sx={{ width: 140, ...changedSx(e.value !== undefined) }} />
                          </TableCell>
                          <TableCell>
                            <TextField select size="small" value={e.gstPercent ?? (row.OwnGst == null ? '' : String(row.OwnGst))}
                              onChange={(ev) => setField(row.Id, 'gstPercent', ev.target.value)} sx={{ width: 112 }}
                              SelectProps={{ displayEmpty: true, renderValue: (v) => (v === '' ? `${row.GstPercent}% (cat.)` : `${v}%`) }}>
                              <MenuItem value="">Category default</MenuItem>
                              {GST.map((g) => <MenuItem key={g} value={g}>{g}%</MenuItem>)}
                            </TextField>
                          </TableCell>
                          <TableCell>
                            <Switch checked={!!row.Active} onChange={(ev) => save(row, { active: ev.target.checked })} inputProps={{ 'aria-label': 'Active' }} color="secondary" />
                          </TableCell>
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title="Save"><span><IconButton color="primary" size="small" disabled={!changed || busyId === row.Id} onClick={() => save(row)}><SaveOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                            <Tooltip title="Delete"><span><IconButton color="error" size="small" disabled={busyId === row.Id} onClick={() => remove(row)}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}

              {type.kind === 'package' && (
                <Table size="small">
                  <TableHead><TableRow sx={headSx}>
                    <TableCell>Package</TableCell><TableCell>Configuration</TableCell><TableCell>Investment level</TableCell>
                    <TableCell align="right">Items</TableCell><TableCell align="right">List value (ex-GST)</TableCell><TableCell>Active</TableCell><TableCell align="right">Actions</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {filtered.map((row) => (
                      <TableRow key={row.Id} hover sx={{ opacity: row.Active ? 1 : 0.55 }}>
                        <TableCell><Typography variant="body2" sx={{ fontWeight: 650 }}>{row.Name}</Typography>
                          <Typography variant="caption" color="text.secondary">{row.Description}</Typography></TableCell>
                        <TableCell><Chip size="small" label={row.Configuration || '—'} /></TableCell>
                        <TableCell>{row.Tier || '—'}</TableCell>
                        <TableCell align="right">{row.Items.length}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums' }}>{inr(row.ListValue)}</TableCell>
                        <TableCell><Switch checked={!!row.Active} onChange={(ev) => save(row, { active: ev.target.checked })} inputProps={{ 'aria-label': 'Active' }} color="secondary" /></TableCell>
                        <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                          <Tooltip title="Edit package"><IconButton size="small" onClick={() => openPackage(row)}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip>
                          <Tooltip title="Delete"><span><IconButton color="error" size="small" disabled={busyId === row.Id} onClick={() => remove(row)}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}

              {(type.kind === 'category' || type.kind === 'paymentterm') && (
                <Table size="small">
                  <TableHead><TableRow sx={headSx}>
                    <TableCell sx={{ minWidth: 260 }}>{type.kind === 'category' ? 'Category' : 'Stage'}</TableCell>
                    <TableCell>{type.kind === 'category' ? 'Default GST' : 'Share'}</TableCell>
                    <TableCell>Order</TableCell>
                    {type.kind === 'category' && <TableCell align="right">Products</TableCell>}
                    <TableCell align="right">Actions</TableCell>
                  </TableRow></TableHead>
                  <TableBody>
                    {filtered.map((row) => {
                      const e = edits[row.Id] || {};
                      const changed = Object.keys(e).length > 0;
                      return (
                        <TableRow key={row.Id} hover>
                          <TableCell><TextField variant="standard" fullWidth value={e.name ?? row.Name} onChange={(ev) => setField(row.Id, 'name', ev.target.value)} InputProps={{ disableUnderline: true, sx: { fontWeight: 600 } }} /></TableCell>
                          <TableCell>
                            {type.kind === 'category' ? (
                              <TextField select size="small" value={e.gstPercent ?? String(row.GstPercent)} onChange={(ev) => setField(row.Id, 'gstPercent', ev.target.value)} sx={{ width: 100 }}>
                                {GST.map((g) => <MenuItem key={g} value={g}>{g}%</MenuItem>)}
                              </TextField>
                            ) : (
                              <TextField size="small" type="number" value={e.value ?? row.Value} onChange={(ev) => setField(row.Id, 'value', ev.target.value)}
                                InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} sx={{ width: 120 }} />
                            )}
                          </TableCell>
                          <TableCell><TextField size="small" type="number" value={e.order ?? row.Order} onChange={(ev) => setField(row.Id, 'order', ev.target.value)} sx={{ width: 90 }} /></TableCell>
                          {type.kind === 'category' && <TableCell align="right">{row.Products}</TableCell>}
                          <TableCell align="right" sx={{ whiteSpace: 'nowrap' }}>
                            <Tooltip title="Save"><span><IconButton color="primary" size="small" disabled={!changed || busyId === row.Id} onClick={() => save(row)}><SaveOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
                            <Tooltip title="Delete"><span><IconButton color="error" size="small" disabled={busyId === row.Id} onClick={() => remove(row)}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
              {filtered.length === 0 && <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>Nothing here yet.</Typography>}
            </TableContainer>
          )}
          {type.kind === 'paymentterm' && (
            <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1.5 }}>
              These stages print when a quotation has no schedule of its own. The schedule sales use by default (30 / 60 / 10) is set in the approval rules.
            </Typography>
          )}
        </Box>
      </MainCard>

      <CatalogDialog dialog={dialog} setDialog={setDialog} refs={refs} onSubmit={submitDialog} />

      <Snackbar open={toast.open} autoHideDuration={2600} onClose={() => setToast((t) => ({ ...t, open: false }))} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity={toast.sev} onClose={() => setToast((t) => ({ ...t, open: false }))}>{toast.msg}</Alert>
      </Snackbar>
    </Box>
  );
}

function CatalogDialog({ dialog, setDialog, refs, onSubmit }) {
  const products = refs.products || [];
  const byId = useMemo(() => Object.fromEntries(products.map((p) => [p.Id, p])), [products]);
  if (!dialog) return null;
  const { kind, mode, data } = dialog;
  const set = (k, v) => setDialog((d) => ({ ...d, data: { ...d.data, [k]: v } }));
  const title = `${mode === 'create' ? 'Add' : 'Edit'} ${{ product: 'product', package: 'package', category: 'category', paymentterm: 'payment stage' }[kind]}`;
  const listValue = kind === 'package' ? (data.items || []).reduce((s, i) => s + (Number(i.qty) || 0) * (byId[i.productId]?.Price || 0), 0) : 0;

  return (
    <Dialog open onClose={() => setDialog(null)} maxWidth={kind === 'package' ? 'md' : 'sm'} fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{title}</DialogTitle>
      <Divider />
      <DialogContent>
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 1 }}>
          <TextField label="Name" value={data.name || ''} onChange={(e) => set('name', e.target.value)} fullWidth autoFocus />
          {kind === 'product' && (
            <>
              <TextField select label="Category" value={data.categoryId || ''} onChange={(e) => set('categoryId', e.target.value)} fullWidth>
                {(refs.categories || []).map((c) => <MenuItem key={c.Id} value={c.Id}>{c.Name}</MenuItem>)}
              </TextField>
              <TextField label="Specification" multiline minRows={2} value={data.specification || ''} onChange={(e) => set('specification', e.target.value)} fullWidth />
              <Autocomplete freeSolo options={Object.values(refs.brands || {}).flat()} inputValue={data.brands || ''}
                onInputChange={(_, v) => set('brands', v)} renderInput={(params) => <TextField {...params} label="Suggested brand / model class" />} />
              <Grid container spacing={2}>
                <Grid item xs={4}><TextField select label="Unit" value={data.unit || 'Nos'} onChange={(e) => set('unit', e.target.value)} fullWidth>{UNITS.map((u) => <MenuItem key={u} value={u}>{u}</MenuItem>)}</TextField></Grid>
                <Grid item xs={4}><TextField label="List price" type="number" value={data.value} onChange={(e) => set('value', e.target.value)} fullWidth InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} /></Grid>
                <Grid item xs={4}>
                  <TextField select label="GST" value={data.gstPercent ?? ''} onChange={(e) => set('gstPercent', e.target.value)} fullWidth SelectProps={{ displayEmpty: true }} InputLabelProps={{ shrink: true }}>
                    <MenuItem value="">Category default</MenuItem>
                    {GST.map((g) => <MenuItem key={g} value={g}>{g}%</MenuItem>)}
                  </TextField>
                </Grid>
              </Grid>
            </>
          )}
          {kind === 'category' && (
            <Grid container spacing={2}>
              <Grid item xs={6}><TextField select label="Default GST" value={String(data.gstPercent ?? 18)} onChange={(e) => set('gstPercent', e.target.value)} fullWidth>{GST.map((g) => <MenuItem key={g} value={g}>{g}%</MenuItem>)}</TextField></Grid>
              <Grid item xs={6}><TextField label="Order" type="number" value={data.order ?? 0} onChange={(e) => set('order', e.target.value)} fullWidth /></Grid>
            </Grid>
          )}
          {kind === 'paymentterm' && (
            <Grid container spacing={2}>
              <Grid item xs={6}><TextField label="Share" type="number" value={data.value} onChange={(e) => set('value', e.target.value)} fullWidth InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} /></Grid>
              <Grid item xs={6}><TextField label="Order" type="number" value={data.order ?? 0} onChange={(e) => set('order', e.target.value)} fullWidth /></Grid>
            </Grid>
          )}
          {kind === 'package' && (
            <>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={4}>
                  <Autocomplete freeSolo options={refs.configurations || []} inputValue={data.configuration || ''}
                    onInputChange={(_, v) => set('configuration', v)} renderInput={(params) => <TextField {...params} label="Configuration" />} />
                </Grid>
                <Grid item xs={12} sm={8}>
                  <TextField select label="Investment level" value={data.tier || ''} onChange={(e) => set('tier', e.target.value)} fullWidth>
                    {(refs.tiers || []).map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                  </TextField>
                </Grid>
              </Grid>
              <TextField label="Description" multiline minRows={2} value={data.description || ''} onChange={(e) => set('description', e.target.value)} fullWidth />
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Items · list value {inr(listValue)} + GST</Typography>
                <Stack spacing={1}>
                  {(data.items || []).map((it, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Autocomplete sx={{ flex: 1 }} options={products} groupBy={(o) => o.Category} getOptionLabel={(o) => o.Name || ''}
                        value={byId[it.productId] || null} isOptionEqualToValue={(o, v) => o.Id === v.Id}
                        onChange={(_, v) => set('items', data.items.map((x, j) => (j === i ? { ...x, productId: v?.Id } : x)))}
                        renderInput={(params) => <TextField {...params} size="small" label="Product" />} />
                      <TextField size="small" type="number" label="Qty" value={it.qty} sx={{ width: 90 }}
                        onChange={(e) => set('items', data.items.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))} />
                      <Typography variant="body2" sx={{ width: 110, textAlign: 'right', color: 'text.secondary' }}>{inr((Number(it.qty) || 0) * (byId[it.productId]?.Price || 0))}</Typography>
                      <IconButton aria-label="Remove item" onClick={() => set('items', data.items.filter((_, j) => j !== i))}><DeleteOutlineIcon fontSize="small" /></IconButton>
                    </Box>
                  ))}
                </Stack>
                <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => set('items', [...(data.items || []), { productId: null, qty: 1 }])}>Add item</Button>
              </Box>
              <Box>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>Recommended specification</Typography>
                <RowsEditor rows={data.spec || []} onChange={(v) => set('spec', v)} labels={refs.specLabels || []} labelTitle="Element" addLabel="Add element" />
              </Box>
            </>
          )}
        </Box>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button onClick={() => setDialog(null)}>Cancel</Button>
        <Button variant="contained" onClick={onSubmit}
          disabled={!data.name?.trim() || (kind === 'package' && (data.items || []).some((i) => !i.productId))}>
          {mode === 'create' ? 'Create' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
