import HomeOutlinedIcon from '@mui/icons-material/HomeOutlined';
import RequestQuoteOutlinedIcon from '@mui/icons-material/RequestQuoteOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import PersonOutlineOutlinedIcon from '@mui/icons-material/PersonOutlineOutlined';
import HelpOutlineOutlinedIcon from '@mui/icons-material/HelpOutlineOutlined';
import SupportAgentOutlinedIcon from '@mui/icons-material/SupportAgentOutlined';
import LogoutOutlinedIcon from '@mui/icons-material/LogoutOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import HistoryOutlinedIcon from '@mui/icons-material/HistoryOutlined';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import OutboxOutlinedIcon from '@mui/icons-material/OutboxOutlined';
import AdminPanelSettingsOutlinedIcon from '@mui/icons-material/AdminPanelSettingsOutlined';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import { ROLES } from '../../utils/roles';
import { SUPPORT_EMAIL } from '../../config';

// Sectioned navigation. `path` -> route, `href` -> external, `action` -> handler.
// `badge` names a count from the approval store. The API enforces access; this is UX only.
const dashboard = (label = 'Dashboard') => ({ label, path: '/sales-dashboard', icon: HomeOutlinedIcon });
const create = { label: 'Create Quote', path: '/quotation/create', icon: RequestQuoteOutlinedIcon };
const quotes = (label) => ({ label, path: '/quotation/list', icon: DescriptionOutlinedIcon });
const pending = (label = 'Pending Approvals') => ({ label, path: '/approvals', icon: FactCheckOutlinedIcon, badge: 'PendingTotal' });
const history = { label: 'Approval History', path: '/approvals?tab=history', icon: HistoryOutlinedIcon };
const team = (label) => ({ label, path: '/team', icon: AccountTreeOutlinedIcon });
const myRequests = { label: 'My Requests', path: '/approvals?tab=mine', icon: OutboxOutlinedIcon, badge: 'MyOpenRequests' };
const notifications = { label: 'Notifications', path: '/notifications', icon: NotificationsNoneOutlinedIcon, badge: 'UnreadNotifications' };
const deals = { label: 'Deal Analysis', path: '/deals', icon: InsightsOutlinedIcon };
const profile = { label: 'Profile', path: '/user-profile/profile-view', icon: PersonOutlineOutlinedIcon };

const byRole = {
  [ROLES.BDM]: [dashboard(), create, quotes('My Quotations'), myRequests, notifications, profile],
  [ROLES.SR_BDM]: [dashboard(), create, quotes('My Quotations'), myRequests, notifications, profile],
  [ROLES.RM]: [dashboard(), create, quotes('Quotations'), pending(), team('My Team'), deals, history, notifications, profile],
  [ROLES.RSD]: [dashboard(), create, quotes('Regional Quotations'), pending(), team('Team Overview'), deals, history, notifications, profile],
  [ROLES.DIRECTOR]: [
    dashboard('Overview'), create, quotes('Overall Quotations'), pending(),
    { label: 'Approval Status', path: '/approvals?tab=team', icon: FactCheckOutlinedIcon },
    deals, team('Organisation'), history, notifications, profile
  ],
  [ROLES.ADMIN]: [
    dashboard(), create, quotes('All Quotations'), pending(), deals, notifications,
    { label: 'Admin Panel', path: '/admin', icon: AdminPanelSettingsOutlinedIcon }, profile
  ]
};

export const getSections = (role) => [
  { title: 'General', items: byRole[role] || byRole[ROLES.BDM] },
  {
    title: 'Support',
    items: [
      { label: 'Help Center', href: `mailto:${SUPPORT_EMAIL}`, icon: HelpOutlineOutlinedIcon },
      { label: 'Contact us', href: `mailto:${SUPPORT_EMAIL}`, icon: SupportAgentOutlinedIcon }
    ]
  },
  {
    title: 'Log',
    items: [{ label: 'Logout', action: 'logout', icon: LogoutOutlinedIcon }]
  }
];

export default getSections;
