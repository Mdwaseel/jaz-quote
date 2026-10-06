"""Organisational hierarchy: role levels and dynamic reporting-chain resolution.

The tree itself is data — every user points at their ``reporting_manager``.
Nothing here hard-codes *who* approves; approvers are always resolved by
walking up the requesting user's own chain, so a BDM under RM A can never be
routed to RM B.
"""
from collections import deque

# Canonical role names (as stored in accounts.Role.name) and their level.
# Lower level = more authority.
ADMIN = "Admin"
DIRECTOR = "Director"
RSD = "RSD"
RM = "RM"
SR_BDM = "Sr. BDM"
BDM = "BDM"

ROLE_LEVELS = {ADMIN: 1, DIRECTOR: 2, RSD: 3, RM: 4, SR_BDM: 5, BDM: 6}
ALL_ROLES = [ADMIN, DIRECTOR, RSD, RM, SR_BDM, BDM]

# Roles that can act as approvers (Sr. BDM / BDM never approve anything).
APPROVER_ROLES = {ADMIN, DIRECTOR, RSD, RM}
# Roles whose submitted quotations become immutable to them (edit needs RM approval).
LOCKED_CREATOR_ROLES = {SR_BDM, BDM}


def effective_role(user):
    """The highest-authority role a user holds (a user may hold several)."""
    if user is None:
        return None
    names = [r for r in user.role_names if r in ROLE_LEVELS]
    if user.is_superuser and ADMIN not in names:
        names.append(ADMIN)
    if not names:
        return BDM  # least privilege for unassigned users
    return min(names, key=lambda n: ROLE_LEVELS[n])


def role_level(role):
    return ROLE_LEVELS.get(role, ROLE_LEVELS[BDM])


def is_admin(user):
    return effective_role(user) == ADMIN


def ancestors(user):
    """Active reporting-chain ancestors, nearest first (cycle-safe).

    Inactive managers are skipped over — their own manager takes their place —
    so a deactivated RM never silently swallows an approval.
    """
    out, seen = [], {user.id}
    node = user.reporting_manager
    while node is not None and node.id not in seen:
        seen.add(node.id)
        if node.is_active:
            out.append(node)
        node = node.reporting_manager
    return out


def resolve_approver(user, role):
    """The person who fills ``role`` for ``user``.

    Resolution order:
      1. the nearest active ancestor holding exactly that role;
      2. otherwise the nearest active ancestor with *more* authority than the
         role (e.g. no RSD assigned → the Director / Admin above);
      3. for Admin (the system-level authority) — any active Admin.
    Returns ``None`` only when no one in the organisation can act.
    """
    from .models import User

    target = role_level(role)
    chain = ancestors(user)
    for a in chain:
        if effective_role(a) == role:
            return a
    for a in chain:
        if role_level(effective_role(a)) < target:
            return a
    if role == ADMIN or not chain:
        for u in User.objects.filter(is_active=True).prefetch_related("roles").order_by("id"):
            if u.id != user.id and effective_role(u) == ADMIN:
                return u
    return None


def descendant_ids(user):
    """IDs of everyone below ``user`` in the tree (BFS, cycle-safe)."""
    from .models import User

    edges = {}
    for uid, mid in User.objects.values_list("id", "reporting_manager_id"):
        edges.setdefault(mid, []).append(uid)
    out, seen, queue = [], {user.id}, deque([user.id])
    while queue:
        for child in edges.get(queue.popleft(), []):
            if child not in seen:
                seen.add(child)
                out.append(child)
                queue.append(child)
    return out


def validate_assignment(user, role, manager):
    """Return an error string when (role, manager) would break the tree, else None."""
    if manager is None:
        return None
    if manager.id == user.id:
        return "A user cannot report to themselves."
    # Cycle check: the new manager must not sit below this user.
    if manager.id in set(descendant_ids(user)):
        return "That assignment would create a reporting loop."
    if role_level(effective_role(manager)) > role_level(role):
        return f"A {role} cannot report to a {effective_role(manager)} (lower authority)."
    return None


def chain_summary(user):
    """[{role, id, name}] of the user's resolved approvers, for display."""
    out = []
    for role in (RM, RSD, DIRECTOR, ADMIN):
        if role_level(role) >= role_level(effective_role(user)):
            continue
        a = resolve_approver(user, role)
        # Director is optional in the tree — don't show a fallback person in that slot.
        if role == DIRECTOR and (a is None or effective_role(a) != DIRECTOR):
            continue
        out.append({"role": role, "id": a.id if a else None, "name": a.name if a else None})
    return out
