// All admin console pages to monitor
// Auto-generated from team-portal-frontend/app structure

const ADMIN_CONSOLE_URL = process.env.ADMIN_CONSOLE_URL || 'https://admin.ib365.ai';

const PAGES_TO_MONITOR = [
  // Dashboard pages
  { url: `${ADMIN_CONSOLE_URL}/`, name: 'Home', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/dashboard`, name: 'Dashboard', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/dashboard/super-admin`, name: 'Super Admin Dashboard', critical: true },

  // Agents
  { url: `${ADMIN_CONSOLE_URL}/agents`, name: 'Agents List', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/agents/new`, name: 'Create Agent', critical: true },

  // Tenants
  { url: `${ADMIN_CONSOLE_URL}/tenants`, name: 'Tenants List', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/tenants/new`, name: 'Create Tenant', critical: true },

  // Admin section
  { url: `${ADMIN_CONSOLE_URL}/admin/leads`, name: 'Admin Leads', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/admin/leads/create`, name: 'Create Lead', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/admin/onboarding`, name: 'Admin Onboarding', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/admin/base-prompt`, name: 'Base Prompt Config', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/admin/elevenlabs-prompt`, name: 'ElevenLabs Prompt', critical: false },

  // Billing
  { url: `${ADMIN_CONSOLE_URL}/billing`, name: 'Billing', critical: true },

  // Monitoring
  { url: `${ADMIN_CONSOLE_URL}/monitoring`, name: 'Monitoring Dashboard', critical: true },

  // Settings
  { url: `${ADMIN_CONSOLE_URL}/settings`, name: 'Settings', critical: true },

  // Revenue
  { url: `${ADMIN_CONSOLE_URL}/revenue`, name: 'Revenue Dashboard', critical: true },

  // Telephony
  { url: `${ADMIN_CONSOLE_URL}/telephony`, name: 'Telephony Dashboard', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/telephony/numbers`, name: 'Phone Numbers', critical: false },

  // Support
  { url: `${ADMIN_CONSOLE_URL}/support-docs`, name: 'Support Documentation', critical: false },

  // Team Portal sections
  { url: `${ADMIN_CONSOLE_URL}/csr-dashboard`, name: 'CSR Dashboard', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/sales-dashboard`, name: 'Sales Dashboard', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/manager-dashboard`, name: 'Manager Dashboard', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/investor-dashboard`, name: 'Investor Dashboard', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/leads`, name: 'Leads Management', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/customers`, name: 'Customers', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/team`, name: 'Team Management', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/messages`, name: 'Messages', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/training`, name: 'Training', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/training/progress`, name: 'Training Progress', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/recruitment/offers`, name: 'Recruitment Offers', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/recruitment/send-offer`, name: 'Send Offer', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/commissions`, name: 'Commissions', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/commissions/calculator`, name: 'Commission Calculator', critical: false },
  { url: `${ADMIN_CONSOLE_URL}/commissions/history`, name: 'Commission History', critical: false },

  // Onboarding
  { url: `${ADMIN_CONSOLE_URL}/onboarding/agent-setup`, name: 'Agent Setup', critical: true },
  { url: `${ADMIN_CONSOLE_URL}/onboarding/success`, name: 'Onboarding Success', critical: false },
];

module.exports = { PAGES_TO_MONITOR, ADMIN_CONSOLE_URL };
