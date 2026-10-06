import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Grid, Card, Box, Typography, Skeleton, Button, Chip } from '@mui/material';
import ArrowOutwardIcon from '@mui/icons-material/ArrowOutward';
import Chart from 'react-apexcharts';
import WelcomeHero from '../../components/WelcomeHero';
import { userRole } from '../../utils/roles';
import { fetchOverview } from '../../store/slices/dashboardSlice';

/* ---------- JAZ palette: charcoal + gold ---------- */
const NAVY = '#1f1a14';
const NAVY_DARK = '#14110d';
const BRONZE = '#a8813d';
const MUTED = '#8f877a';

const DONUT_COLORS = [NAVY_DARK, BRONZE, '#6b5a43', '#d4ab55', '#d8d0c2'];

/* ---------- money helpers ---------- */
const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
const compact = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(v >= 1e8 ? 1 : 2) + 'Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(1) + 'L';
  if (v >= 1e3) return '₹' + Math.round(v / 1e3) + 'K';
  return '₹' + v;
};

/* ---------- reusable card shell ---------- */
function Panel({ title, subtitle, action, children, sx }) {
  return (
    <Card sx={{ p: { xs: 2.25, md: 2.75 }, height: '100%', display: 'flex', flexDirection: 'column', border: '1px solid', borderColor: 'divider', borderRadius: 3, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1, mb: 2 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography sx={{ fontWeight: 700, fontSize: '1.05rem', color: 'text.primary', lineHeight: 1.2 }}>{title}</Typography>
          {subtitle && <Typography variant="body2" color="text.secondary" sx={{ mt: 0.25 }}>{subtitle}</Typography>}
        </Box>
        {action}
      </Box>
      <Box sx={{ flex: 1, minHeight: 0 }}>{children}</Box>
    </Card>
  );
}

function ChangeBadge({ value }) {
  const up = Number(value) >= 0;
  return (
    <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.25, color: up ? '#1f9d57' : '#c0492f', fontWeight: 700, fontSize: '.9rem' }}>
      {up ? '↑' : '↓'} {Math.abs(Number(value) || 0)}%
    </Box>
  );
}

/* ---------- Revenue overview : quoted vs won area chart ---------- */
function RevenueOverview({ revenue, months }) {
  const opts = {
    chart: { type: 'area', toolbar: { show: false }, fontFamily: 'inherit', stacked: false },
    colors: [NAVY, BRONZE],
    stroke: { curve: 'smooth', width: [3, 3] },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: [0.18, 0.32], opacityTo: 0.02, stops: [0, 100] } },
    dataLabels: { enabled: false },
    legend: { show: true, position: 'top', horizontalAlign: 'left', fontSize: '13px', markers: { width: 9, height: 9, radius: 12 }, itemMargin: { horizontal: 12 } },
    grid: { borderColor: '#eee8dc', strokeDashArray: 4, padding: { left: 6, right: 6 } },
    markers: { size: 0, hover: { size: 5 } },
    xaxis: { categories: months, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: MUTED, fontSize: '12px' } } },
    yaxis: { labels: { style: { colors: MUTED, fontSize: '12px' }, formatter: (v) => compact(v) } },
    tooltip: { y: { formatter: (v) => inr(v) } }
  };
  const series = [
    { name: 'Quoted', data: revenue.quoted },
    { name: 'Won', data: revenue.won }
  ];
  return <Chart options={opts} series={series} type="area" height={260} />;
}

/* ---------- Source / product mix : donut ---------- */
function SourceMix({ items, total }) {
  const opts = {
    chart: { type: 'donut', fontFamily: 'inherit' },
    labels: items.map((i) => i.label),
    colors: DONUT_COLORS,
    stroke: { width: 0 },
    legend: { show: false },
    dataLabels: { enabled: false },
    tooltip: { y: { formatter: (v) => inr(v) } },
    plotOptions: { pie: { donut: { size: '74%', labels: { show: true,
      value: { show: true, fontSize: '20px', fontWeight: 700, color: NAVY_DARK, offsetY: 4, formatter: () => compact(total) },
      total: { show: true, showAlways: true, label: 'WON QTD', fontSize: '10px', color: MUTED, formatter: () => compact(total) } } } } }
  };
  return (
    <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, alignItems: 'center', gap: 2 }}>
      <Box sx={{ width: 190, flexShrink: 0 }}>
        {items.length ? <Chart options={opts} series={items.map((i) => i.value)} type="donut" height={190} />
          : <Skeleton variant="circular" width={170} height={170} sx={{ mx: 'auto' }} />}
      </Box>
      <Box sx={{ flex: 1, width: '100%' }}>
        {items.map((it, i) => (
          <Box key={it.label} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 0.85, borderBottom: i < items.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, minWidth: 0 }}>
              <Box sx={{ width: 9, height: 9, borderRadius: '50%', bgcolor: DONUT_COLORS[i % DONUT_COLORS.length], flexShrink: 0 }} />
              <Typography variant="body2" noWrap sx={{ color: 'text.primary' }}>{it.label}</Typography>
            </Box>
            <Typography variant="body2" sx={{ fontWeight: 700 }}>{it.pct}%</Typography>
          </Box>
        ))}
        {!items.length && <Typography variant="body2" color="text.secondary">No data</Typography>}
      </Box>
    </Box>
  );
}

/* ---------- Pipeline health : horizontal funnel ---------- */
function Pipeline({ stages }) {
  const max = Math.max(1, ...stages.map((s) => s.count));
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.75 }}>
      {stages.map((s) => (
        <Box key={s.stage}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
            <Typography variant="body2" sx={{ color: 'text.primary' }}>{s.stage}</Typography>
            <Typography variant="body2" sx={{ fontWeight: 700, color: 'text.secondary' }}>{s.count.toLocaleString('en-IN')}</Typography>
          </Box>
          <Box sx={{ height: 22, borderRadius: 1.5, bgcolor: '#f1ece2', overflow: 'hidden' }}>
            <Box sx={{ height: '100%', width: `${Math.max(4, (s.count / max) * 100)}%`, borderRadius: 1.5, background: `linear-gradient(90deg, ${NAVY} 0%, ${NAVY_DARK} 100%)`, transformOrigin: 'left', animation: 'brioGrowX .6s cubic-bezier(.4,0,.2,1) both' }} />
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/* ---------- small spark line/area chart ---------- */
function Spark({ series, categories, color, formatter }) {
  const opts = {
    chart: { type: 'area', toolbar: { show: false }, sparkline: { enabled: false }, fontFamily: 'inherit' },
    colors: [color],
    stroke: { curve: 'smooth', width: 3 },
    fill: { type: 'gradient', gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.02, stops: [0, 100] } },
    dataLabels: { enabled: false },
    grid: { borderColor: '#eee8dc', strokeDashArray: 4, padding: { left: 4, right: 4 } },
    markers: { size: 4, colors: ['#fff'], strokeColors: color, strokeWidth: 2, hover: { size: 6 } },
    xaxis: { categories, axisBorder: { show: false }, axisTicks: { show: false }, labels: { style: { colors: MUTED, fontSize: '11px' } } },
    yaxis: { labels: { style: { colors: MUTED, fontSize: '11px' }, formatter: formatter || ((v) => v) } },
    tooltip: { y: { formatter: formatter || ((v) => v) } }
  };
  return <Chart options={opts} series={[{ name: 'value', data: series }]} type="area" height={180} />;
}

function MiniStat({ label, value }) {
  return (
    <Box>
      <Typography sx={{ fontSize: '.68rem', letterSpacing: '.06em', color: MUTED, fontWeight: 700 }}>{label}</Typography>
      <Typography sx={{ fontWeight: 700, fontSize: '1.15rem', color: 'text.primary', mt: 0.25 }}>{value}</Typography>
    </Box>
  );
}

export default function SalesDashboard() {
  const dispatch = useDispatch();
  const user = useSelector((s) => s.auth.user);
  const ov = useSelector((s) => s.dashboard.overview);

  useEffect(() => { dispatch(fetchOverview()); }, [dispatch]);

  const loading = !ov;
  const months = ov?.months || [];
  const total = ov?.trend?.total ?? 0;

  return (
    <Box>
      <WelcomeHero name={user?.profileName} role={userRole(user)} count={total} />

      {/* period header row */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, mt: 1, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="body2" color="text.secondary">Quarter to date · compared with the previous quarter</Typography>
        <Button size="small" variant="outlined" startIcon={<ArrowOutwardIcon sx={{ fontSize: 16 }} />} sx={{ borderRadius: 999, textTransform: 'none', borderColor: 'divider', color: 'text.secondary' }}>
          Export dataset
        </Button>
      </Box>

      <Grid container spacing={2.5} className="brio-stagger">
        {/* Revenue overview */}
        <Grid item xs={12} md={7}>
          <Panel
            title="Revenue overview"
            subtitle="Quoted vs closed-won, last 6 months"
            action={<Chip label={`Won ${compact(ov?.teamTotal || 0)}`} size="small" sx={{ bgcolor: 'rgba(31,157,87,.12)', color: '#1f9d57', fontWeight: 700 }} />}
          >
            {loading ? <Skeleton variant="rounded" height={260} /> : <RevenueOverview revenue={ov.revenue} months={months} />}
          </Panel>
        </Grid>

        {/* Source mix */}
        <Grid item xs={12} md={5}>
          <Panel
            title="Revenue by investment level"
            subtitle="Won revenue by tier"
            action={<Button size="small" variant="outlined" sx={{ borderRadius: 999, textTransform: 'none', borderColor: 'divider', color: 'text.secondary', display: { xs: 'none', sm: 'inline-flex' } }}>View full report</Button>}
          >
            {loading ? <Skeleton variant="rounded" height={190} /> : <SourceMix items={ov.sourceMix} total={ov.sourceTotal} />}
          </Panel>
        </Grid>

        {/* Pipeline health */}
        <Grid item xs={12} md={4}>
          <Panel title="Pipeline health" subtitle="Quotations by stage, this quarter">
            {loading ? <Skeleton variant="rounded" height={200} /> : <Pipeline stages={ov.pipeline} />}
          </Panel>
        </Grid>

        {/* Quotations trend */}
        <Grid item xs={12} md={4}>
          <Panel
            title="Quotations trend"
            subtitle="Last 6 months"
            action={<Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1, color: 'text.primary' }}>{loading ? <Skeleton width={40} /> : total}</Typography>
              {!loading && <ChangeBadge value={ov.trend.change} />}
            </Box>}
          >
            {loading ? <Skeleton variant="rounded" height={180} /> : <Spark series={ov.trend.series} categories={months} color={BRONZE} />}
            {!loading && (
              <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 1.5, pt: 1.5, borderTop: '1px solid', borderColor: 'divider' }}>
                <MiniStat label="THIS MONTH" value={ov.trend.thisMonth} />
                <MiniStat label="CONFIRMED" value={ov.trend.confirmed} />
                <MiniStat label="PENDING" value={ov.trend.pending} />
              </Box>
            )}
          </Panel>
        </Grid>

        {/* Average contract value */}
        <Grid item xs={12} md={4}>
          <Panel
            title="Average contract value"
            subtitle="Confirmed quotations"
            action={<Box sx={{ textAlign: 'right' }}>
              <Typography sx={{ fontWeight: 800, fontSize: '1.5rem', lineHeight: 1, color: 'text.primary' }}>{loading ? <Skeleton width={60} /> : compact(ov.acv.value)}</Typography>
              {!loading && <ChangeBadge value={ov.acv.change} />}
            </Box>}
          >
            {loading ? <Skeleton variant="rounded" height={180} /> : <Spark series={ov.acv.series} categories={months} color={NAVY} formatter={(v) => compact(v)} />}
          </Panel>
        </Grid>
      </Grid>
    </Box>
  );
}
