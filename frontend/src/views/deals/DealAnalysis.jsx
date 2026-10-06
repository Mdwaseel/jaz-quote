import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Grid, Card, Typography, Tabs, Tab, Table, TableHead, TableBody, TableRow, TableCell, Chip, Alert,
  CircularProgress, Stack, LinearProgress
} from '@mui/material';
import Chart from 'react-apexcharts';
import PageHeader from '../../components/PageHeader';
import MainCard from '../../components/MainCard';
import { getDealAnalysis, errMsg } from '../../api/workflow';
import { fmtDate, inr } from '../../components/workflow/format';

const NAVY = '#1f1a14';
const BRONZE = '#a8813d';
const RED = '#c0392b';
const GREEN = '#1f9d57';
const RANGES = [[30, 'Last 30 days'], [90, 'Last 90 days'], [365, 'Last 12 months'], [0, 'All time']];

const compact = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + ' L';
  return inr(v);
};

const Kpi = ({ label, value, sub, color }) => (
  <Card sx={{ p: 2.25, height: '100%' }}>
    <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
    <Typography sx={{ fontSize: '1.9rem', fontWeight: 750, color, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums' }}>{value}</Typography>
    {sub && <Typography variant="caption" color="text.secondary">{sub}</Typography>}
  </Card>
);

const Empty = ({ children }) => (
  <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>{children}</Typography>
);

/** Why quotations are (not) closing — for Directors (and managers, scoped to their team). */
export default function DealAnalysis() {
  const navigate = useNavigate();
  const [days, setDays] = useState(90);
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    setData(null);
    getDealAnalysis(days).then(setData).catch((e) => setError(errMsg(e, 'Could not load the analysis.')));
  }, [days]);

  const t = data?.Totals;
  const reasons = data?.Reasons || [];
  const months = data?.Months || [];

  return (
    <Box>
      <PageHeader title="Deal Analysis" crumbs={['Deals']} />
      <Tabs value={days} onChange={(_, v) => setDays(v)} sx={{ mb: 2.5 }} variant="scrollable" allowScrollButtonsMobile>
        {RANGES.map(([v, l]) => <Tab key={v} value={v} label={l} />)}
      </Tabs>
      {error && <Alert severity="error">{error}</Alert>}
      {!data && !error && <Box sx={{ py: 10, textAlign: 'center' }}><CircularProgress /></Box>}
      {data && (
        <>
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={6} md={3}><Kpi label="Win rate" value={t.WinRate == null ? '—' : `${t.WinRate}%`} sub={`${t.Won + t.Lost} decided deals`} color={NAVY} /></Grid>
            <Grid item xs={6} md={3}><Kpi label="Deals done" value={t.Won} sub={compact(t.WonValue)} color={GREEN} /></Grid>
            <Grid item xs={6} md={3}><Kpi label="Deals not done" value={t.Lost} sub={`${compact(t.LostValue)} lost`} color={RED} /></Grid>
            <Grid item xs={6} md={3}><Kpi label="Still open" value={t.Open} sub={`${compact(t.OpenValue)} in pipeline`} color={BRONZE} /></Grid>
          </Grid>

          <Grid container spacing={2.5}>
            <Grid item xs={12} lg={7}>
              <MainCard title="Why deals are not closing" sx={{ height: '100%' }}>
                {reasons.length === 0 ? <Empty>No lost deals in this period.</Empty> : (
                  <Stack spacing={1.75}>
                    {reasons.map((r, i) => (
                      <Box key={r.Reason}>
                        <Stack direction="row" justifyContent="space-between" sx={{ mb: 0.5 }}>
                          <Typography variant="body2" sx={{ fontWeight: i === 0 ? 700 : 500 }}>{r.Reason}</Typography>
                          <Typography variant="body2" color="text.secondary" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                            {r.Count} deal{r.Count === 1 ? '' : 's'} · {r.Pct}% · {compact(r.Value)}
                          </Typography>
                        </Stack>
                        <LinearProgress variant="determinate" value={r.Pct}
                          sx={{ height: 10, borderRadius: 5, bgcolor: 'grey.200', '& .MuiLinearProgress-bar': { bgcolor: i === 0 ? RED : BRONZE, borderRadius: 5 } }} />
                      </Box>
                    ))}
                  </Stack>
                )}
              </MainCard>
            </Grid>
            <Grid item xs={12} lg={5}>
              <MainCard title="Done vs not done by month" sx={{ height: '100%' }}>
                <Chart type="bar" height={280}
                  series={[{ name: 'Done', data: months.map((m) => m.Won) }, { name: 'Not done', data: months.map((m) => m.Lost) }]}
                  options={{
                    chart: { toolbar: { show: false }, fontFamily: 'inherit' },
                    colors: [GREEN, RED],
                    plotOptions: { bar: { columnWidth: '55%', borderRadius: 4 } },
                    dataLabels: { enabled: false },
                    xaxis: { categories: months.map((m) => m.Label) },
                    // Whole-number ticks only (counts of deals).
                    yaxis: { min: 0, tickAmount: Math.min(5, Math.max(1, ...months.flatMap((m) => [m.Won, m.Lost]))), forceNiceScale: true, labels: { formatter: (v) => Math.round(v) } },
                    legend: { position: 'top', horizontalAlign: 'right' },
                    grid: { borderColor: '#e7ebef', strokeDashArray: 4 }
                  }} />
              </MainCard>
            </Grid>

            <Grid item xs={12}>
              <MainCard title="By salesperson" contentSx={{ p: 0, '&:last-child': { pb: 0 }, overflowX: 'auto' }}>
                {data.People.length === 0 ? <Empty>No quotations in this period.</Empty> : (
                  <Table size="small" sx={{ minWidth: 720 }}>
                    <TableHead>
                      <TableRow sx={{ '& th': { fontWeight: 700, bgcolor: '#f7f9fb' } }}>
                        <TableCell>Name</TableCell><TableCell align="right">Done</TableCell><TableCell align="right">Not done</TableCell>
                        <TableCell align="right">Open</TableCell><TableCell align="right">Win rate</TableCell>
                        <TableCell align="right">Won value</TableCell><TableCell>Top reason for losing</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {data.People.map((p) => (
                        <TableRow key={p.Name} hover>
                          <TableCell sx={{ fontWeight: 600 }}>{p.Name} <Typography component="span" variant="caption" color="text.secondary">{p.Role}</Typography></TableCell>
                          <TableCell align="right" sx={{ color: GREEN, fontWeight: 600 }}>{p.Won}</TableCell>
                          <TableCell align="right" sx={{ color: RED, fontWeight: 600 }}>{p.Lost}</TableCell>
                          <TableCell align="right">{p.Open}</TableCell>
                          <TableCell align="right">{p.WinRate == null ? '—' : `${p.WinRate}%`}</TableCell>
                          <TableCell align="right">{compact(p.WonValue)}</TableCell>
                          <TableCell>{p.TopReason || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </MainCard>
            </Grid>

            <Grid item xs={12} lg={5}>
              <MainCard title="By package" sx={{ height: '100%' }}>
                {data.Packages.length === 0 ? <Empty>No decided deals yet.</Empty> : (
                  <Stack spacing={1}>
                    {data.Packages.map((m) => (
                      <Stack key={m.Package} direction="row" justifyContent="space-between" alignItems="center">
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>{m.Package}</Typography>
                        <Stack direction="row" spacing={0.75}>
                          <Chip size="small" color="success" variant="outlined" label={`${m.Won} done`} />
                          <Chip size="small" color="error" variant="outlined" label={`${m.Lost} not done`} />
                        </Stack>
                      </Stack>
                    ))}
                  </Stack>
                )}
              </MainCard>
            </Grid>
            <Grid item xs={12} lg={7}>
              <MainCard title="Latest deals not done" sx={{ height: '100%' }} contentSx={{ p: 0, '&:last-child': { pb: 0 } }}>
                {data.RecentLost.length === 0 ? <Empty>Nothing here — no lost deals in this period.</Empty> : data.RecentLost.map((d, i) => (
                  <Box key={d.QuotationNumber} onClick={() => navigate(`/quotation/view/${d.QuotationNumber}`)} role="button" tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && navigate(`/quotation/view/${d.QuotationNumber}`)}
                    sx={{ px: { xs: 2, md: 3 }, py: 1.5, cursor: 'pointer', borderTop: i ? '1px solid' : 'none', borderColor: 'divider', '&:hover': { bgcolor: 'action.hover' } }}>
                    <Stack direction="row" justifyContent="space-between" spacing={1}>
                      <Typography variant="subtitle2">{d.CustomerName} <Typography component="span" variant="caption" color="text.secondary">· {d.QuotationNumber} · {d.Owner}</Typography></Typography>
                      <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{compact(d.Value)}</Typography>
                    </Stack>
                    <Typography variant="body2" sx={{ color: RED, fontWeight: 600 }}>{d.Reason}</Typography>
                    {d.Note && <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic', overflowWrap: 'anywhere' }}>“{d.Note}”</Typography>}
                    <Typography variant="caption" color="text.secondary">{fmtDate(d.ClosedAt)}</Typography>
                  </Box>
                ))}
              </MainCard>
            </Grid>
          </Grid>
        </>
      )}
    </Box>
  );
}
