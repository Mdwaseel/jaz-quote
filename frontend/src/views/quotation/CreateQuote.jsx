import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box, Stepper, Step, StepLabel, StepButton, Button, Grid, TextField, MenuItem, Typography, Divider, Chip, Alert,
  Snackbar, CircularProgress, Table, TableBody, TableRow, TableCell, InputAdornment, IconButton, Autocomplete, Stack,
  Tooltip, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import WarningAmberOutlinedIcon from '@mui/icons-material/WarningAmberOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined';
import { OutsideLimitChip } from '../../components/workflow/WorkflowStatusChip';
import PageHeader from '../../components/PageHeader';
import MainCard from '../../components/MainCard';
import SignatureField from '../../components/SignatureField';
import PdfPreviewDialog from '../../components/PdfPreviewDialog';
import FinancialSummary from '../../components/workflow/FinancialSummary';
import { inr, pct } from '../../components/workflow/format';
import { fetchCountries, fetchStates, fetchCities, fetchBuilderCatalog, resetKeys } from '../../store/slices/catalogSlice';
import { fetchBankList } from '../../store/slices/userSlice';
import axios from '../../api/axios';
import { Endpoints } from '../../api/endpoints';
import { getRules, evaluateQuote, getQuote, createQuote, updateQuote, errMsg } from '../../api/workflow';
import PackagePicker from './builder/PackagePicker';
import BoqEditor from './builder/BoqEditor';
import RowsEditor from './builder/RowsEditor';
import ScopeEditor from './builder/ScopeEditor';
import { computeTotals, itemsPayload, lineFromProduct, uid, additionalPercent } from './builder/calc';

const steps = ['Customer', 'Project', 'BOQ & pricing', 'Scope & finishes', 'Terms', 'Review'];

const emptyProject = {
  PackageId: '', Package: '', Configuration: '', Tier: '', Room: '', ProjectType: '', RoomLength: '', RoomWidth: '',
  RoomHeight: '', Seats: '', Rows: '', Screen: '', ConstructionStage: '', Notes: ''
};

const initialForm = {
  CustomerName: '', CustomerEmail: '', CustomerMobile: '', LandMark: '', CustomerAddress: '',
  CountryName: '', StateName: '', CityName: '', ZipCode: '',
  Project: emptyProject,
  Spec: [], Scope: [], Finishes: [], Items: [],
  Warranty: { Workmanship: '1' },
  AmcRates: { Comprehensive: '', Preventive: '' },
  SalesInfo: { SalesBy: '', CreatedBy: '', DeliveryAt: '', ValidityDays: 15, Remarks: '', BankId: '' },
  SignatorySign: '',
  PaymentTerms: [],
  DiscountMode: 'pct', DiscountPercent: '0', DiscountAmount: '',
  Reasons: {}
};

const CATEGORY_LABEL = { DISCOUNT: 'Discount', WARRANTY: 'Warranty', AMC: 'AMC', PAYMENT_TERMS: 'Payment terms' };
const REASON_HINT = {
  DISCOUNT: 'e.g. Competing proposal; customer ready to book this week.',
  WARRANTY: 'e.g. Reference project — extended workmanship warranty requested.',
  AMC: 'e.g. Customer comparing AMC with another integrator.',
  PAYMENT_TERMS: 'e.g. Builder pays against construction milestones.'
};

const cloneRows = (rows) => (rows || []).map((r) => ({ Label: r.Label || '', Value: r.Value || '' }));

export default function CreateQuote() {
  const { number: editNumber } = useParams();
  const isEdit = !!editNumber;
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const geo = useSelector((s) => s.catalog);
  const catalog = useSelector((s) => s.catalog.builder);
  const banks = useSelector((s) => s.user.bank);
  const user = useSelector((s) => s.auth.user);

  const [active, setActive] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [toast, setToast] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [policy, setPolicy] = useState(null);
  const [evaluation, setEvaluation] = useState(null);
  const [existing, setExisting] = useState(null);
  const [loadingEdit, setLoadingEdit] = useState(isEdit);
  const [preview, setPreview] = useState({ open: false, url: '', filename: 'quotation-preview.pdf', loading: false, error: '' });

  useEffect(() => {
    dispatch(fetchCountries());
    dispatch(fetchBuilderCatalog());
    dispatch(fetchBankList());
  }, [dispatch]);

  // New quotation: the standard JAZ scope, finishes and specification to start from.
  useEffect(() => {
    if (!catalog || isEdit) return;
    setForm((f) => ({
      ...f,
      Spec: f.Spec.length ? f.Spec : cloneRows(catalog.DefaultSpec),
      Scope: f.Scope.length ? f.Scope : [...catalog.DefaultScope],
      Finishes: f.Finishes.length ? f.Finishes : cloneRows(catalog.DefaultFinishes),
      SalesInfo: { ...f.SalesInfo, DeliveryAt: f.SalesInfo.DeliveryAt || catalog.Timelines?.[1] || '' }
    }));
  }, [catalog, isEdit]);

  // Role policy: limits, standard AMC rates and the standard payment schedule.
  useEffect(() => {
    getRules().then((p) => {
      setPolicy(p);
      if (isEdit) return;
      setForm((f) => ({
        ...f,
        PaymentTerms: f.PaymentTerms.length ? f.PaymentTerms : p.paymentTerms.map((t) => ({ ...t })),
        AmcRates: {
          Comprehensive: f.AmcRates.Comprehensive || String(p.amc.defaults.Comprehensive),
          Preventive: f.AmcRates.Preventive || String(p.amc.defaults.Preventive)
        }
      }));
    }).catch(() => setError('Could not load your quotation limits. Refresh to try again.'));
  }, [isEdit]);

  useEffect(() => {
    if (user && !isEdit) setForm((f) => ({ ...f, SalesInfo: { ...f.SalesInfo, SalesBy: user.profileName, CreatedBy: user.profileName } }));
  }, [user, isEdit]);

  // ---------------------------------------------------------------- edit mode: rehydrate
  useEffect(() => {
    if (!isEdit || !catalog || existing) return;
    (async () => {
      try {
        const q = await getQuote(editNumber);
        if (!q) throw new Error('not found');
        setExisting(q);
        if (!q.Workflow?.Permissions?.canEdit) {
          setError(q.Workflow?.Permissions?.editBlockedReason || 'This quotation cannot be edited.');
          return;
        }
        const p = q.ProductInfo || {};
        const s = q.SalesInfo || {};
        const w = Object.fromEntries((q.WarrentyDetails || []).map((x) => [x.TypeOfParts, String(x.Duration)]));
        const a = Object.fromEntries((q.Amc || []).map((x) => [x.AmcType, String(x.Duration)]));
        const prices = Object.fromEntries((catalog.Products || []).map((x) => [x.Id, x.Price]));
        setForm((f) => ({
          ...f,
          CustomerName: q.CustomerName || '', CustomerEmail: q.CustomerEmail || '', CustomerMobile: q.CustomerMobile || '',
          LandMark: q.LandMark || '', CustomerAddress: q.CustomerAddress || '',
          CountryName: q.CountryName || '', StateName: q.StateName || '', CityName: q.CityName || '', ZipCode: q.ZipCode || '',
          Project: Object.fromEntries(Object.keys(emptyProject).map((k) => [k, p[k] == null ? '' : String(p[k])])),
          Spec: cloneRows(p.Spec), Scope: [...(p.Scope || [])], Finishes: cloneRows(p.Finishes),
          Items: (p.Items || []).map((i) => ({
            ...i, key: uid(), Qty: String(i.Qty), UnitPrice: String(i.UnitPrice), GstPercent: String(i.GstPercent),
            ListPrice: i.ProductId && prices[i.ProductId] != null ? prices[i.ProductId] : Number(i.ListPrice || 0)
          })),
          Warranty: { Workmanship: w.Workmanship || '1' },
          AmcRates: { Comprehensive: a.Comprehensive || '', Preventive: a.Preventive || '' },
          SalesInfo: { ...f.SalesInfo, ...s, BankId: s.BankId || '' },
          SignatorySign: s.SignatorySign || '',
          PaymentTerms: (q.PaymentTerms || []).map((t) => ({ TermName: t.TermName, TermValue: t.TermValue })),
          DiscountMode: s.DiscountMode === 'amount' ? 'amount' : 'pct',
          DiscountPercent: String(Math.round(Number(p.AdditionalDiscountPercent || 0) * 10000) / 10000),
          DiscountAmount: s.DiscountAmount ? String(s.DiscountAmount) : ''
        }));
      } catch {
        setError('Quotation not found or you do not have access to it.');
      } finally {
        setLoadingEdit(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, editNumber, catalog]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const setP = (k, v) => setForm((f) => ({ ...f, Project: { ...f.Project, [k]: v } }));
  const setS = (k, v) => setForm((f) => ({ ...f, SalesInfo: { ...f.SalesInfo, [k]: v } }));
  const setA = (k, v) => setForm((f) => ({ ...f, AmcRates: { ...f.AmcRates, [k]: v } }));
  const setReason = (k, v) => setForm((f) => ({ ...f, Reasons: { ...f.Reasons, [k]: v } }));

  // ---------------------------------------------------------------- packages
  const pickPackage = (pkg) => {
    if (form.Items.length && String(form.Project.PackageId) !== String(pkg.Id)
      && !window.confirm(`Replace the current BOQ (${form.Items.length} lines) with the ${pkg.Name} items?`)) return;
    const products = Object.fromEntries((catalog?.Products || []).map((x) => [x.Id, x]));
    const items = pkg.Items.map((i) => products[i.ProductId]).map((prod, idx) => (prod ? lineFromProduct(prod, pkg.Items[idx].Qty) : null)).filter(Boolean);
    setForm((f) => ({
      ...f,
      Project: { ...f.Project, PackageId: String(pkg.Id), Package: pkg.Name, Configuration: pkg.Configuration, Tier: pkg.Tier || f.Project.Tier },
      Spec: pkg.Spec?.length ? cloneRows(pkg.Spec) : f.Spec,
      Items: items
    }));
  };
  const customPackage = () => setForm((f) => ({ ...f, Project: { ...f.Project, PackageId: '' } }));
  const selectedPackage = (catalog?.Packages || []).find((p) => String(p.Id) === String(form.Project.PackageId));

  // ---------------------------------------------------------------- money (instant local mirror; server is authoritative)
  const totals = useMemo(() => computeTotals(form.Items, form.DiscountMode, form.DiscountPercent, form.DiscountAmount),
    [form.Items, form.DiscountMode, form.DiscountPercent, form.DiscountAmount]);
  const discountPercentToSend = additionalPercent(
    form.Items.filter((i) => !i.Optional).reduce((s, i) => s + (Number(i.Qty) || 0) * (Number(i.UnitPrice) || 0), 0),
    form.DiscountMode, form.DiscountPercent, form.DiscountAmount
  );

  // ---------------------------------------------------------------- payload
  const buildPayload = (extra = {}) => {
    const amc = [];
    if (form.AmcRates.Comprehensive !== '') amc.push({ Duration: Number(form.AmcRates.Comprehensive), AmcType: 'Comprehensive' });
    if (form.AmcRates.Preventive !== '') amc.push({ Duration: Number(form.AmcRates.Preventive), AmcType: 'Preventive' });
    return {
      CustomerId: 0,
      CustomerName: form.CustomerName, CustomerMobile: form.CustomerMobile, CustomerEmail: form.CustomerEmail,
      CustomerAddress: form.CustomerAddress, CustomerAddress2: form.CustomerAddress,
      CityName: form.CityName, StateName: form.StateName, CountryName: form.CountryName, ZipCode: form.ZipCode, LandMark: form.LandMark,
      ProductInfo: {
        ...form.Project,
        PackageId: form.Project.PackageId || null,
        Spec: form.Spec.filter((r) => r.Label || r.Value),
        Scope: form.Scope,
        Finishes: form.Finishes.filter((r) => r.Label || r.Value),
        Items: itemsPayload(form.Items)
      },
      PaymentTerms: form.PaymentTerms.filter((t) => t.TermName?.trim()).map((t) => ({ TermName: t.TermName.trim(), TermValue: Number(t.TermValue) })),
      DiscountPercent: discountPercentToSend,
      SalesInfo: {
        ...form.SalesInfo,
        DiscountMode: form.DiscountMode,
        DiscountAmount: form.DiscountMode === 'amount' ? Number(form.DiscountAmount || 0) : 0,
        SignatorySign: form.SignatorySign
      },
      WarrentyDetails: [{ Duration: Number(form.Warranty.Workmanship || 0), TypeOfParts: 'Workmanship' }],
      Amc: amc,
      Reasons: form.Reasons,
      ...(isEdit ? { QuotationNumber: editNumber } : {}),
      ...extra
    };
  };

  // ---------------------------------------------------------------- live evaluation (debounced)
  const evalKey = JSON.stringify([itemsPayload(form.Items), discountPercentToSend, form.Warranty, form.AmcRates, form.PaymentTerms]);
  const evalTimer = useRef();
  useEffect(() => {
    if (!form.Items.length) { setEvaluation(null); return undefined; }
    clearTimeout(evalTimer.current);
    evalTimer.current = setTimeout(() => {
      evaluateQuote(buildPayload()).then(setEvaluation).catch(() => {});
    }, 350);
    return () => clearTimeout(evalTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evalKey]);

  const approvals = evaluation?.Approvals || [];
  const outsideLimit = approvals.some((a) => a.OutsideLimit);
  const missingReason = approvals.find((a) => !(form.Reasons[a.Category] || '').trim());
  const termsTotal = form.PaymentTerms.reduce((s, t) => s + (Number(t.TermValue) || 0), 0);
  const canSaveDraft = !isEdit || existing?.Workflow?.WorkflowStatus === 'DRAFT';
  const priced = totals.QuotedAmount > 0;

  // ---------------------------------------------------------------- navigation / validation
  const stepError = (i) => {
    if (i === 0 && !form.CustomerName.trim()) return 'Customer name is required.';
    if (i === 1 && !form.Project.Configuration.trim() && !form.Project.Package.trim()) return 'Choose a package or enter the configuration (e.g. 7.2.4).';
    if (i === 2) {
      const named = form.Items.filter((x) => (x.Name || '').trim());
      if (!named.length) return 'Add at least one item to the BOQ.';
      const bad = named.find((x) => !(Number(x.Qty) > 0) || x.UnitPrice === '' || Number(x.UnitPrice) < 0);
      if (bad) return `Check the quantity and price of “${bad.Name}”.`;
      if (!priced) return 'Set prices for the BOQ items.';
    }
    if (i === 4 && termsTotal !== 100) return `Payment terms must add up to 100% (currently ${termsTotal}%).`;
    if (i >= 2 && evaluation?.Error) return evaluation.Error;
    return '';
  };
  const next = () => {
    const e = stepError(active);
    if (e) { setError(e); return; }
    setError('');
    setActive((a) => Math.min(a + 1, steps.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => { setError(''); setActive((a) => Math.max(a - 1, 0)); };

  const submit = async (asDraft = false) => {
    for (let i = 0; i < 5; i += 1) {
      const e = asDraft && i > 2 ? '' : stepError(i);
      if (e) { setError(e); setActive(i); return; }
    }
    if (!asDraft && missingReason) {
      setError(`Add a reason for the ${CATEGORY_LABEL[missingReason.Category].toLowerCase()} approval request.`);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = buildPayload(asDraft ? { SaveAsDraft: true } : {});
      const res = isEdit ? await updateQuote(payload) : await createQuote(payload);
      setToast(asDraft ? 'Draft saved' : approvals.length ? `Submitted — ${res.WorkflowLabel || ''}` : 'Quotation ready for download');
      setTimeout(() => navigate(`/quotation/view/${res.QuotationNumber}`), 700);
    } catch (e) {
      setError(errMsg(e, 'Could not save the quotation.'));
    } finally {
      setSaving(false);
    }
  };

  const handlePreview = async () => {
    setPreview({ open: true, url: '', filename: 'quotation-preview.pdf', loading: true, error: '' });
    try {
      const res = await axios.post(Endpoints.Preview_Quote, buildPayload(), { responseType: 'blob' });
      setPreview({ open: true, url: URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' })), filename: 'quotation-preview.pdf', loading: false, error: '' });
    } catch (e) {
      let message = 'Could not generate the preview. Please check the details and try again.';
      if (e?.response?.data instanceof Blob) {
        try { message = JSON.parse(await e.response.data.text()).message || message; } catch { /* keep default */ }
      }
      setPreview({ open: true, url: '', filename: '', loading: false, error: message });
    }
  };
  const closePreview = () => setPreview((p) => { if (p.url) URL.revokeObjectURL(p.url); return { ...p, open: false }; });

  const resetTerms = () => policy && set('PaymentTerms', policy.paymentTerms.map((t) => ({ ...t })));
  const setTerm = (i, k, v) => setForm((f) => ({ ...f, PaymentTerms: f.PaymentTerms.map((t, j) => (j === i ? { ...t, [k]: v } : t)) }));

  if (loadingEdit || (isEdit && !existing && !error)) return <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress color="secondary" /></Box>;
  if (isEdit && existing && !existing.Workflow?.Permissions?.canEdit) {
    return (
      <Box>
        <PageHeader title={`Edit ${editNumber}`} crumbs={['Quotation', 'Edit']} />
        <Alert severity="warning" action={<Button onClick={() => navigate(`/quotation/view/${editNumber}`)}>View quotation</Button>}>{error}</Alert>
      </Box>
    );
  }

  const submitLabel = outsideLimit ? 'Request Admin Approval' : approvals.length ? 'Submit for approval'
    : isEdit && existing?.Workflow?.CurrentVersion ? 'Re-submit quotation' : 'Create quotation';
  const role = policy?.role;
  const P = form.Project;
  const wide = active === 2; // the BOQ editor gets the full width; totals move into a sticky bar

  return (
    <Box>
      <PageHeader
        title={isEdit ? `Edit quotation ${editNumber}` : 'Create Quotation'}
        crumbs={['Quotation', isEdit ? 'Edit' : 'Create']}
        action={role && <Chip label={`Creating as ${role}`} variant="outlined" />}
      />
      {isEdit && existing?.Workflow?.WorkflowStatus === 'EDITING' && (
        <Alert severity="info" icon={<EditOutlinedIcon />} sx={{ mb: 2 }}>Editing enabled — RM approved a modification. Re-submitting re-evaluates every approval against your limits.</Alert>
      )}
      <Grid container spacing={2.5} alignItems="flex-start">
        <Grid item xs={12} lg={wide ? 12 : 8.5}>
          <MainCard sx={{ overflow: 'visible' }}>
            <Stepper activeStep={active} alternativeLabel nonLinear sx={{ mb: 4 }}>
              {steps.map((label, i) => (
                <Step key={label} completed={i < active}>
                  <StepButton onClick={() => { if (i < active) { setError(''); setActive(i); } }}><StepLabel>{label}</StepLabel></StepButton>
                </Step>
              ))}
            </Stepper>

            {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
            {!catalog && <Box sx={{ py: 6, textAlign: 'center' }}><CircularProgress color="secondary" /></Box>}

            {/* STEP 1 — Customer */}
            {catalog && active === 0 && (
              <>
                <SectionTitle hint="Printed on the quotation cover: name, mobile, e-mail, city, state and address.">Customer</SectionTitle>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}><TextField fullWidth required label="Customer name" value={form.CustomerName} onChange={(e) => set('CustomerName', e.target.value)} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="Mobile number" value={form.CustomerMobile} onChange={(e) => set('CustomerMobile', e.target.value)} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="E-mail" type="email" value={form.CustomerEmail} onChange={(e) => set('CustomerEmail', e.target.value)} /></Grid>
                  <Grid item xs={12} sm={6}><TextField fullWidth label="Landmark" value={form.LandMark} onChange={(e) => set('LandMark', e.target.value)} /></Grid>
                  <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Project address" value={form.CustomerAddress} onChange={(e) => set('CustomerAddress', e.target.value)} /></Grid>
                  <Grid item xs={12} sm={3}>
                    <TextField select fullWidth label="Country" value={geo.countries.some((c) => c.CountryName === form.CountryName) ? form.CountryName : ''}
                      onChange={(e) => {
                        const c = geo.countries.find((x) => x.CountryName === e.target.value);
                        setForm((f) => ({ ...f, CountryName: e.target.value, StateName: '', CityName: '' }));
                        dispatch(resetKeys(['states', 'cities']));
                        if (c) dispatch(fetchStates(c.Id));
                      }}>
                      {geo.countries.map((c) => (<MenuItem key={c.Id} value={c.CountryName}>{c.CountryName}</MenuItem>))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    {geo.states.length ? (
                      <TextField select fullWidth label="State" value={geo.states.some((s) => s.StateName === form.StateName) ? form.StateName : ''}
                        onChange={(e) => {
                          const st = geo.states.find((x) => x.StateName === e.target.value);
                          setForm((f) => ({ ...f, StateName: e.target.value, CityName: '' }));
                          dispatch(resetKeys(['cities']));
                          if (st) dispatch(fetchCities(st.Id));
                        }}>
                        {geo.states.map((s) => (<MenuItem key={s.Id} value={s.StateName}>{s.StateName}</MenuItem>))}
                      </TextField>
                    ) : <TextField fullWidth label="State" value={form.StateName} onChange={(e) => set('StateName', e.target.value)} />}
                  </Grid>
                  <Grid item xs={12} sm={3}>
                    {geo.cities.length ? (
                      <TextField select fullWidth label="City / District" value={geo.cities.some((c) => c.CityName === form.CityName) ? form.CityName : ''} onChange={(e) => set('CityName', e.target.value)}>
                        {geo.cities.map((c) => (<MenuItem key={c.Id} value={c.CityName}>{c.CityName}</MenuItem>))}
                      </TextField>
                    ) : <TextField fullWidth label="City / District" value={form.CityName} onChange={(e) => set('CityName', e.target.value)} />}
                  </Grid>
                  <Grid item xs={12} sm={3}><TextField fullWidth label="Pincode" value={form.ZipCode} onChange={(e) => set('ZipCode', e.target.value)} /></Grid>
                </Grid>
              </>
            )}

            {/* STEP 2 — Project */}
            {catalog && active === 1 && (
              <>
                <SectionTitle hint="Pick a starting configuration — it fills the specification and the BOQ. Everything stays editable.">Package</SectionTitle>
                <PackagePicker packages={catalog.Packages} selectedId={P.PackageId} onPick={pickPackage} onCustom={customPackage} />

                <SectionTitle sx={{ mt: 4 }}>Room &amp; project</SectionTitle>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <TextField fullWidth label="Room / area" placeholder="e.g. Basement home theatre" value={P.Room} onChange={(e) => setP('Room', e.target.value)} />
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField select fullWidth label="Project type" value={P.ProjectType} onChange={(e) => setP('ProjectType', e.target.value)}>
                      {catalog.ProjectTypes.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <Autocomplete freeSolo options={catalog.Configurations} inputValue={P.Configuration}
                      onInputChange={(_, v, reason) => { if (reason !== 'reset') setP('Configuration', v); }}
                      renderInput={(params) => <TextField {...params} required label="Configuration" placeholder="7.2.4" helperText="Speakers . subwoofers . height" />} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Investment level" value={P.Tier} onChange={(e) => setP('Tier', e.target.value)}>
                      {catalog.Tiers.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField select fullWidth label="Site stage" value={P.ConstructionStage} onChange={(e) => setP('ConstructionStage', e.target.value)}>
                      {catalog.ConstructionStages.map((t) => <MenuItem key={t} value={t}>{t}</MenuItem>)}
                    </TextField>
                  </Grid>
                  {[['RoomLength', 'Length'], ['RoomWidth', 'Width'], ['RoomHeight', 'Height']].map(([k, label]) => (
                    <Grid item xs={4} sm={2} key={k}>
                      <TextField fullWidth type="number" label={label} value={P[k]} onChange={(e) => setP(k, e.target.value)}
                        InputProps={{ endAdornment: <InputAdornment position="end">ft</InputAdornment> }} inputProps={{ min: 0, step: 'any' }} />
                    </Grid>
                  ))}
                  <Grid item xs={6} sm={2}><TextField fullWidth type="number" label="Seats" value={P.Seats} onChange={(e) => setP('Seats', e.target.value)} inputProps={{ min: 0 }} /></Grid>
                  <Grid item xs={6} sm={2}><TextField fullWidth type="number" label="Rows" value={P.Rows} onChange={(e) => setP('Rows', e.target.value)} inputProps={{ min: 0 }} /></Grid>
                  <Grid item xs={12} sm={2}><TextField fullWidth label="Screen" placeholder='135" 2.40:1' value={P.Screen} onChange={(e) => setP('Screen', e.target.value)} /></Grid>
                  <Grid item xs={12}>
                    <TextField fullWidth label="Title on the cover (MODEL)" value={P.Package}
                      placeholder={P.Configuration ? `${P.Configuration} Home Theatre` : 'e.g. 7.2.4 Dolby Atmos Home Cinema'}
                      helperText="Leave blank to use the configuration" onChange={(e) => setP('Package', e.target.value)} />
                  </Grid>
                </Grid>

                <SectionTitle sx={{ mt: 4 }} hint="Printed as the Recommended Home Theatre Specification.">Recommended specification</SectionTitle>
                <RowsEditor rows={form.Spec} onChange={(v) => set('Spec', v)} labels={catalog.SpecLabels} labelTitle="Element"
                  onReset={() => set('Spec', cloneRows(selectedPackage?.Spec?.length ? selectedPackage.Spec : catalog.DefaultSpec))}
                  resetLabel={selectedPackage ? 'Reset to package spec' : 'Reset to standard spec'} addLabel="Add element" />

                <TextField fullWidth multiline minRows={2} label="Project notes (printed on the quotation)" value={P.Notes}
                  onChange={(e) => setP('Notes', e.target.value)} sx={{ mt: 3 }} />
              </>
            )}

            {/* STEP 3 — BOQ & pricing */}
            {catalog && active === 2 && (
              <>
                <SectionTitle hint="Set the quantity and your price on every line. Going below a catalog list price counts towards the discount that needs approval. ☆ marks a line as an optional upgrade.">
                  Bill of quantities
                </SectionTitle>
                <BoqEditor items={form.Items} onChange={(v) => set('Items', v)} catalog={catalog} />
                {priced && <TotalsBar t={totals} outsideLimit={outsideLimit} approvals={approvals.length} />}

                <SectionTitle sx={{ mt: 4 }}>Additional discount</SectionTitle>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} sm="auto">
                    <ToggleButtonGroup size="small" exclusive value={form.DiscountMode} onChange={(_, v) => v && set('DiscountMode', v)}>
                      <ToggleButton value="pct">%</ToggleButton>
                      <ToggleButton value="amount">₹</ToggleButton>
                    </ToggleButtonGroup>
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    {form.DiscountMode === 'pct' ? (
                      <TextField fullWidth type="number" label="Discount on the BOQ" value={form.DiscountPercent}
                        onChange={(e) => set('DiscountPercent', e.target.value)} inputProps={{ min: 0, max: 100, step: 0.5 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} error={outsideLimit} />
                    ) : (
                      <TextField fullWidth type="number" label="Discount amount (ex-GST)" value={form.DiscountAmount}
                        onChange={(e) => set('DiscountAmount', e.target.value)} inputProps={{ min: 0, step: 1000 }}
                        InputProps={{ startAdornment: <InputAdornment position="start">₹</InputAdornment> }} error={outsideLimit} />
                    )}
                  </Grid>
                  <Grid item xs={12} sm>
                    <Typography variant="body2">
                      Total discount vs list <b style={{ color: outsideLimit ? '#b8432f' : undefined }}>{pct(totals.DiscountPercent)}</b>
                      {' '}({inr(totals.DiscountAmount)}) · {policy?.discount?.selfLimit == null ? 'no limit for your role' : `up to ${policy.discount.selfLimit}% without approval`}
                    </Typography>
                    {outsideLimit && (
                      <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 700, mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <WarningAmberOutlinedIcon fontSize="small" /> OUTSIDE COMPANY LIMIT ({policy.discount.companyLimit}%) — needs Admin approval
                      </Typography>
                    )}
                  </Grid>
                </Grid>
              </>
            )}

            {/* STEP 4 — Scope & finishes */}
            {catalog && active === 3 && (
              <>
                <SectionTitle hint="Tick what this project includes; add anything specific to it.">System &amp; interior scope</SectionTitle>
                <ScopeEditor scope={form.Scope} onChange={(v) => set('Scope', v)} defaults={catalog.DefaultScope} />
                <SectionTitle sx={{ mt: 4 }}>Design &amp; finishes</SectionTitle>
                <RowsEditor rows={form.Finishes} onChange={(v) => set('Finishes', v)} labelTitle="Area"
                  labels={catalog.DefaultFinishes.map((r) => r.Label)}
                  onReset={() => set('Finishes', cloneRows(catalog.DefaultFinishes))} resetLabel="Reset to standard finishes" addLabel="Add finish" />
              </>
            )}

            {/* STEP 5 — Terms */}
            {catalog && active === 4 && policy && (
              <>
                <SectionTitle>Warranty &amp; AMC</SectionTitle>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField fullWidth type="number" label="Installation workmanship warranty" value={form.Warranty.Workmanship}
                      onChange={(e) => set('Warranty', { Workmanship: e.target.value })} inputProps={{ min: 0, max: 25, step: 1 }}
                      InputProps={{ endAdornment: <InputAdornment position="end">years</InputAdornment> }}
                      helperText={`Standard ${policy.warranty.standard} yr · up to ${policy.warranty.selfLimit ?? '∞'} yr without approval`} />
                  </Grid>
                  {[['Comprehensive', 'Comprehensive AMC'], ['Preventive', 'Preventive AMC']].map(([k, label]) => (
                    <Grid item xs={12} sm={4} key={k}>
                      <TextField fullWidth type="number" label={label} value={form.AmcRates[k]} onChange={(e) => setA(k, e.target.value)}
                        inputProps={{ min: 0, max: 100, step: 0.5 }}
                        InputProps={{ endAdornment: <InputAdornment position="end">% / yr</InputAdornment> }}
                        helperText={`Standard ${policy.amc.defaults[k]}% · below ${policy.amc.floors?.[k] ?? policy.amc.defaults[k]}% needs approval`} />
                    </Grid>
                  ))}
                </Grid>

                <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 4, mb: 1.5, gap: 1, flexWrap: 'wrap' }}>
                  <SectionTitle sx={{ mb: 0 }}>Payment terms</SectionTitle>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Chip size="small" label={`Total ${termsTotal}%`} color={termsTotal === 100 ? 'success' : 'error'} variant="outlined" />
                    <Button size="small" startIcon={<RestartAltIcon />} onClick={resetTerms}>Use the standard 30 / 60 / 10</Button>
                  </Stack>
                </Box>
                <Stack spacing={1.25}>
                  {form.PaymentTerms.map((t, i) => (
                    // eslint-disable-next-line react/no-array-index-key
                    <Box key={i} sx={{ display: 'flex', gap: 1.25, alignItems: 'center' }}>
                      <Autocomplete freeSolo options={policy.paymentTermNames} inputValue={t.TermName} sx={{ flex: 1 }}
                        onInputChange={(_, v, reason) => { if (reason !== 'reset') setTerm(i, 'TermName', v); }}
                        renderInput={(params) => <TextField {...params} size="small" label="Stage" />} />
                      <TextField size="small" type="number" label="Share" value={t.TermValue} sx={{ width: 110 }}
                        onChange={(e) => setTerm(i, 'TermValue', e.target.value)}
                        InputProps={{ endAdornment: <InputAdornment position="end">%</InputAdornment> }} />
                      <Typography variant="body2" sx={{ width: 120, textAlign: 'right', fontVariantNumeric: 'tabular-nums', color: 'text.secondary' }}>
                        {inr((totals.FinalAmount * (Number(t.TermValue) || 0)) / 100)}
                      </Typography>
                      <IconButton aria-label="Remove stage" onClick={() => set('PaymentTerms', form.PaymentTerms.filter((_, j) => j !== i))}>
                        <DeleteOutlineIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  ))}
                </Stack>
                <Button size="small" startIcon={<AddIcon />} sx={{ mt: 1 }} onClick={() => set('PaymentTerms', [...form.PaymentTerms, { TermName: '', TermValue: '' }])}>
                  Add stage
                </Button>

                <SectionTitle sx={{ mt: 4 }}>Timeline &amp; sales</SectionTitle>
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={6}>
                    <Autocomplete freeSolo options={catalog.Timelines} inputValue={form.SalesInfo.DeliveryAt || ''}
                      onInputChange={(_, v, reason) => { if (reason !== 'reset') setS('DeliveryAt', v); }}
                      renderInput={(params) => <TextField {...params} label="Project timeline" />} />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField select fullWidth label="Quotation valid for" value={form.SalesInfo.ValidityDays || 15} onChange={(e) => setS('ValidityDays', e.target.value)}>
                      {catalog.ValidityDays.map((d) => <MenuItem key={d} value={d}>{d} days</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid item xs={6} sm={3}><TextField fullWidth label="Sales person" value={form.SalesInfo.SalesBy} onChange={(e) => setS('SalesBy', e.target.value)} /></Grid>
                  <Grid item xs={12} sm={6}>
                    <TextField select fullWidth label="Bank account on the quotation" value={form.SalesInfo.BankId || ''} onChange={(e) => setS('BankId', e.target.value)}
                      helperText={banks.length ? ' ' : 'No bank account yet — add it in Admin → Company & Bank'}>
                      <MenuItem value="">Default account</MenuItem>
                      {banks.map((b) => (<MenuItem key={b.Id} value={b.Id}>{b.BankName} — {b.AccountNumber}</MenuItem>))}
                    </TextField>
                  </Grid>
                  <Grid item xs={12}><TextField fullWidth multiline rows={2} label="Note on the quotation" value={form.SalesInfo.Remarks} onChange={(e) => setS('Remarks', e.target.value)} /></Grid>
                </Grid>
              </>
            )}

            {/* STEP 6 — Review */}
            {catalog && active === 5 && (
              <>
                <SectionTitle>Review</SectionTitle>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <SummaryBlock title="Customer" rows={[
                      ['Name', form.CustomerName], ['Mobile', form.CustomerMobile], ['E-mail', form.CustomerEmail],
                      ['Address', form.CustomerAddress], ['City / State', [form.CityName, form.StateName].filter(Boolean).join(', ')]
                    ]} />
                    <SummaryBlock title="Terms" rows={[
                      ['Total discount', `${pct(totals.DiscountPercent)} (${inr(totals.DiscountAmount)})`],
                      ['Workmanship warranty', `${form.Warranty.Workmanship} yr`],
                      ['AMC', `Comprehensive ${form.AmcRates.Comprehensive}% · Preventive ${form.AmcRates.Preventive}%`],
                      ...form.PaymentTerms.map((t) => [t.TermName, `${t.TermValue}%`]),
                      ['Timeline', form.SalesInfo.DeliveryAt], ['Valid for', `${form.SalesInfo.ValidityDays} days`]
                    ]} />
                  </Grid>
                  <Grid item xs={12} md={6}>
                    <SummaryBlock title="Project" rows={[
                      ['Package', P.Package || selectedPackage?.Name || 'Custom'], ['Configuration', P.Configuration],
                      ['Room', P.Room], ['Investment', P.Tier],
                      ['Room size', [P.RoomLength, P.RoomWidth, P.RoomHeight].filter(Boolean).join(' × ') && `${[P.RoomLength, P.RoomWidth, P.RoomHeight].filter(Boolean).join(' × ')} ft`],
                      ['Seating', [P.Seats && `${P.Seats} seats`, P.Rows && `${P.Rows} rows`].filter(Boolean).join(' · ')]
                    ]} />
                    <SummaryBlock title={`BOQ — ${totals.ItemCount} lines${totals.OptionalCount ? ` + ${totals.OptionalCount} optional` : ''}`} rows={
                      Object.entries(form.Items.filter((i) => !i.Optional && (i.Name || '').trim()).reduce((acc, i) => {
                        acc[i.Category || 'Other'] = (acc[i.Category || 'Other'] || 0) + (Number(i.Qty) || 0) * (Number(i.UnitPrice) || 0);
                        return acc;
                      }, {})).map(([k, v]) => [k, inr(v)])
                    } />
                  </Grid>
                  <Grid item xs={12}>
                    <Divider sx={{ mb: 2 }} />
                    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>Signatures</Typography>
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                      Your signature prints as the JAZ authorised signatory. The customer signs after approval — by <b>e-signature</b> (we email a link) or <b>onsite</b> with a live photo.
                    </Typography>
                    <Grid container spacing={3}>
                      <Grid item xs={12} sm={6}><SignatureField label="Authorised signatory signature" value={form.SignatorySign} onChange={(v) => set('SignatorySign', v)} /></Grid>
                    </Grid>
                  </Grid>
                </Grid>
              </>
            )}

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4, gap: 1, flexWrap: 'wrap' }}>
              <Button disabled={active === 0} onClick={back}>Back</Button>
              <Stack direction="row" spacing={1.25}>
                {active >= 2 && (
                  <Button variant="outlined" startIcon={<PictureAsPdfOutlinedIcon />} onClick={handlePreview} disabled={preview.loading || !priced}>
                    Preview PDF
                  </Button>
                )}
                {active < steps.length - 1 && <Button variant="contained" onClick={next}>Next</Button>}
              </Stack>
            </Box>
          </MainCard>
        </Grid>

        {/* Persistent summary: value · requested · who approves */}
        <Grid item xs={12} lg={3.5} sx={{ position: { lg: 'sticky' }, top: { lg: 92 }, display: wide ? 'none' : undefined }}>
          <MainCard title="Quotation summary">
            {priced ? (
              <FinancialSummary f={totals} outsideLimit={outsideLimit} />
            ) : (
              <Typography variant="body2" color="text.secondary">Choose a package or add priced items to see the value.</Typography>
            )}
            {priced && (form.AmcRates.Comprehensive || form.AmcRates.Preventive) && (
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 1 }}>
                AMC after warranty (not in the total):{' '}
                {[['Comprehensive', form.AmcRates.Comprehensive], ['Preventive', form.AmcRates.Preventive]]
                  .filter(([, r]) => r !== '').map(([k, r]) => `${k} ${inr((totals.NetAmount * Number(r)) / 100)}/yr`).join(' · ')}
              </Typography>
            )}

            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Who needs to approve</Typography>
            {!form.Items.length ? (
              <Typography variant="body2" color="text.secondary">Evaluated as you build.</Typography>
            ) : evaluation?.Error ? (
              <Alert severity="warning" sx={{ py: 0.25 }}>{evaluation.Error}</Alert>
            ) : approvals.length === 0 ? (
              <Alert severity="success" sx={{ py: 0.25 }}>Within your authority — downloadable right after submitting.</Alert>
            ) : (
              <Stack spacing={1.75}>
                {approvals.map((a) => (
                  <Box key={a.Category}>
                    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ mb: 0.75, flexWrap: 'wrap', rowGap: 0.5 }}>
                      <Typography variant="body2" sx={{ fontWeight: 650 }}>{a.Label}</Typography>
                      {a.OutsideLimit && <OutsideLimitChip label="Outside limit" />}
                    </Stack>
                    <Stack direction="row" spacing={0.5} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 0.5, mb: 1 }}>
                      <Chip size="small" label="You" variant="outlined" />
                      {a.Path.map((s) => (
                        <Box key={s.Role} sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5 }}>
                          <Typography variant="caption" color="text.secondary">→</Typography>
                          <Tooltip title={s.Name || 'Not assigned — ask an Admin'}>
                            <Chip size="small" color={s.Name ? 'warning' : 'error'} variant="outlined" label={`${s.Role}${s.Name ? ` · ${s.Name}` : ''}`} />
                          </Tooltip>
                        </Box>
                      ))}
                    </Stack>
                    <TextField size="small" fullWidth multiline minRows={1} required
                      label={`Reason for ${a.Label.toLowerCase()}`} placeholder={REASON_HINT[a.Category]}
                      value={form.Reasons[a.Category] || ''} onChange={(e) => setReason(a.Category, e.target.value)} />
                  </Box>
                ))}
              </Stack>
            )}

            <Divider sx={{ my: 2 }} />
            <Stack spacing={1}>
              <Button variant="contained" size="large" color={outsideLimit ? 'error' : approvals.length ? 'primary' : 'secondary'}
                onClick={() => submit(false)} disabled={saving || !priced}>
                {saving ? <CircularProgress size={22} color="inherit" /> : submitLabel}
              </Button>
              {canSaveDraft && <Button onClick={() => submit(true)} disabled={saving}>Save as draft</Button>}
              {policy?.editRequiresApproval && (
                <Typography variant="caption" color="text.secondary" sx={{ textAlign: 'center' }}>
                  After submitting, the quotation is locked. Changes need your RM’s approval.
                </Typography>
              )}
            </Stack>
          </MainCard>
        </Grid>
      </Grid>

      <PdfPreviewDialog open={preview.open} onClose={closePreview} url={preview.url} filename={preview.filename}
        loading={preview.loading} error={preview.error} title="Quotation preview" />

      <Snackbar open={!!toast} autoHideDuration={2500} onClose={() => setToast('')} anchorOrigin={{ vertical: 'top', horizontal: 'center' }}>
        <Alert severity="success">{toast}</Alert>
      </Snackbar>
    </Box>
  );
}

const TotalsBar = ({ t, outsideLimit, approvals }) => {
  const cell = (label, value, tone) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography sx={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: '#a99f8d', whiteSpace: 'nowrap' }}>{label}</Typography>
      <Typography sx={{ fontWeight: 650, fontVariantNumeric: 'tabular-nums', color: tone || '#f3ead8', whiteSpace: 'nowrap' }}>{value}</Typography>
    </Box>
  );
  return (
    <Box sx={{
      position: 'sticky', bottom: 12, zIndex: 3, mt: 2, px: 2.5, py: 1.5, borderRadius: 2, bgcolor: '#14110d',
      border: '1px solid rgba(212,171,85,.3)', boxShadow: '0 16px 30px -18px rgba(0,0,0,.6)',
      display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: { xs: 2, md: 3.5 }
    }}>
      {cell('List value', inr(t.BaseAmount))}
      {t.PriceAdjustment > 0 && cell('Line price cuts', `−${inr(t.PriceAdjustment)}`, '#e6c477')}
      {t.AdditionalDiscountAmount > 0 && cell('Additional discount', `−${inr(t.AdditionalDiscountAmount)}`, '#e6c477')}
      {cell('Offer (ex-GST)', inr(t.NetAmount))}
      {cell('GST', inr(t.Tax))}
      {cell('Total discount', pct(t.DiscountPercent), outsideLimit ? '#f19a8a' : undefined)}
      <Box sx={{ flex: 1 }} />
      <Box sx={{ textAlign: 'right' }}>
        <Typography sx={{ fontSize: 10.5, letterSpacing: '.14em', textTransform: 'uppercase', color: '#a99f8d' }}>
          Final · {approvals ? `${approvals} approval${approvals === 1 ? '' : 's'} needed` : 'within your authority'}
        </Typography>
        <Typography sx={{ fontWeight: 750, fontSize: '1.35rem', color: '#d4ab55', fontVariantNumeric: 'tabular-nums' }}>{inr(t.FinalAmount)}</Typography>
      </Box>
    </Box>
  );
};

const SectionTitle = ({ children, hint, sx }) => (
  <Box sx={{ mb: 2, ...sx }}>
    <Typography variant="h4" sx={{ fontSize: '1.1rem' }}>{children}</Typography>
    {hint && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{hint}</Typography>}
  </Box>
);

const SummaryBlock = ({ title, rows }) => (
  <Box sx={{ mb: 2 }}>
    <Typography variant="subtitle1" sx={{ fontWeight: 700, mb: 0.5 }}>{title}</Typography>
    <Table size="small">
      <TableBody>
        {rows.map(([k, v], i) => (
          // eslint-disable-next-line react/no-array-index-key
          <TableRow key={i}>
            <TableCell sx={{ border: 0, py: 0.5, color: 'text.secondary', width: '42%' }}>{k}</TableCell>
            <TableCell sx={{ border: 0, py: 0.5, fontWeight: 500 }}>{v || '—'}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </Box>
);
