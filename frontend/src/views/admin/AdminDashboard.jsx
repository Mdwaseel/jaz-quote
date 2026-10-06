import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Grid, Card, CardContent, Typography, Box, Avatar, Skeleton } from '@mui/material';
import Chart from 'react-apexcharts';
import ReceiptLongOutlinedIcon from '@mui/icons-material/ReceiptLongOutlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PeopleAltOutlinedIcon from '@mui/icons-material/PeopleAltOutlined';
import CurrencyRupeeOutlinedIcon from '@mui/icons-material/CurrencyRupeeOutlined';
import ViewInArOutlinedIcon from '@mui/icons-material/ViewInArOutlined';
import { chartColors } from '../../theme';
import MainCard from '../../components/MainCard';
import { fetchStats } from '../../store/slices/adminSlice';

const money = (n) => '₹ ' + Number(n || 0).toLocaleString('en-IN');
// Compact Indian format so large pipeline values always fit the card.
const moneyCompact = (n) => {
  const v = Number(n || 0);
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(2) + ' Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(2) + ' L';
  return '₹' + v.toLocaleString('en-IN');
};
const colors = chartColors;

const StatCard = ({ icon: Icon, label, value, title, color, loading, money: isMoney }) => (
  <Card sx={{ border: '1px solid', borderColor: 'divider', height: '100%' }}>
    <CardContent sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 1.5, p: 2, '&:last-child': { pb: 2 } }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography
          title={title}
          sx={{
            fontWeight: 700, lineHeight: 1.15, color: 'text.primary',
            fontSize: isMoney ? { xs: '1.2rem', lg: '1.15rem', xl: '1.3rem' } : '1.6rem',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
          }}
        >
          {loading ? <Skeleton width={54} /> : value}
        </Typography>
        <Typography variant="body2" color="text.secondary" noWrap>{label}</Typography>
      </Box>
      <Avatar sx={{ bgcolor: color, width: 44, height: 44, flexShrink: 0 }}><Icon fontSize="small" /></Avatar>
    </CardContent>
  </Card>
);

const CARD_COLORS = {
  quotations: '#1f1a14', pending: '#c4861b', confirmed: '#2e8b57',
  customers: '#6b5a43', models: '#a8813d', pipeline: '#7d5f28'
};

export default function AdminDashboard() {
  const dispatch = useDispatch();
  const stats = useSelector((s) => s.admin.stats);

  useEffect(() => { dispatch(fetchStats()); }, [dispatch]);

  const loading = !stats;
  const mc = stats?.packageCounts || [];
  const chartOptions = {
    chart: { type: 'bar', toolbar: { show: false }, fontFamily: 'inherit' },
    plotOptions: { bar: { borderRadius: 6, columnWidth: '45%', distributed: true } },
    colors, dataLabels: { enabled: false }, legend: { show: false },
    xaxis: { categories: mc.map((m) => m.product), labels: { rotate: -35, style: { fontSize: '11px' } } },
    grid: { borderColor: '#eee8dc' }
  };

  return (
    <Box>
      <Typography variant="h2" sx={{ mb: 3 }} className="brio-fade-up">Dashboard</Typography>
      <Grid container spacing={2} className="brio-stagger" alignItems="stretch">
        <Grid item xs={6} sm={4} md={4} lg={2}><StatCard icon={ReceiptLongOutlinedIcon} label="Quotations" value={stats?.totalQuotations} color={CARD_COLORS.quotations} loading={loading} /></Grid>
        <Grid item xs={6} sm={4} md={4} lg={2}><StatCard icon={PendingActionsOutlinedIcon} label="Pending" value={stats?.pending} color={CARD_COLORS.pending} loading={loading} /></Grid>
        <Grid item xs={6} sm={4} md={4} lg={2}><StatCard icon={CheckCircleOutlineIcon} label="Confirmed" value={stats?.confirmed} color={CARD_COLORS.confirmed} loading={loading} /></Grid>
        <Grid item xs={6} sm={4} md={4} lg={2}><StatCard icon={PeopleAltOutlinedIcon} label="Customers" value={stats?.totalCustomers} color={CARD_COLORS.customers} loading={loading} /></Grid>
        <Grid item xs={6} sm={4} md={4} lg={2}><StatCard icon={ViewInArOutlinedIcon} label="Products" value={stats?.totalProducts} color={CARD_COLORS.models} loading={loading} /></Grid>
        <Grid item xs={6} sm={4} md={4} lg={2}><StatCard icon={CurrencyRupeeOutlinedIcon} label="Pipeline Value" value={loading ? '' : moneyCompact(stats?.totalValue)} title={money(stats?.totalValue)} color={CARD_COLORS.pipeline} loading={loading} money /></Grid>
      </Grid>

      <Grid container spacing={2.5} sx={{ mt: 0 }}>
        <Grid item xs={12} md={8}>
          <MainCard title="Quotations by package">
            {loading ? <Skeleton variant="rounded" height={340} /> : <Chart options={chartOptions} series={[{ name: 'Quotations', data: mc.map((m) => m.count) }]} type="bar" height={340} />}
          </MainCard>
        </Grid>
        <Grid item xs={12} md={4}>
          <MainCard title="Breakdown">
            {mc.map((m, i) => (
              <Box key={m.product} sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', py: 1, borderBottom: '1px dashed', borderColor: 'divider' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <Box sx={{ width: 10, height: 10, borderRadius: '50%', bgcolor: colors[i % colors.length] }} />
                  <Typography variant="body2">{m.product}</Typography>
                </Box>
                <Typography variant="subtitle2">{m.count}</Typography>
              </Box>
            ))}
            {!loading && mc.length === 0 && <Typography variant="body2" color="text.secondary">No data</Typography>}
          </MainCard>
        </Grid>
      </Grid>
    </Box>
  );
}
