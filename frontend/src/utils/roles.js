// Role helpers. The UI adapts to the role for UX only — the API re-checks everything.
export const ROLES = { ADMIN: 'Admin', DIRECTOR: 'Director', RSD: 'RSD', RM: 'RM', SR_BDM: 'Sr. BDM', BDM: 'BDM' };
const LEVELS = { Admin: 1, Director: 2, RSD: 3, RM: 4, 'Sr. BDM': 5, BDM: 6 };

// Highest-authority role (backend sends `role`; fall back to the roles list).
export const userRole = (user) => {
  if (user?.role) return user.role;
  const roles = (user?.roles || []).filter((r) => LEVELS[r]);
  return roles.sort((a, b) => LEVELS[a] - LEVELS[b])[0] || ROLES.BDM;
};

export const isAdmin = (user) => userRole(user) === ROLES.ADMIN;
export const isApprover = (user) => [ROLES.ADMIN, ROLES.DIRECTOR, ROLES.RSD, ROLES.RM].includes(userRole(user));
export const isFieldRole = (user) => [ROLES.BDM, ROLES.SR_BDM].includes(userRole(user));
