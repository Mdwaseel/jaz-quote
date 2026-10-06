"""Deleting a user: everything they own moves to the next person up the tree.

* direct reports → now report to that person
* quotations they created → owned by that person (recorded in each quote's history)
* approvals waiting on them → escalated up the requester's chain

The account itself is soft-deleted: it can no longer sign in and disappears from
every list, but its name stays on audit history. Its email is freed for re-use.
"""
from django.db import transaction
from django.utils import timezone

from . import hierarchy as H
from .models import User


class DeleteError(Exception):
    def __init__(self, message, status=400):
        super().__init__(message)
        self.status = status


def check_can_delete(actor, target):
    if target is None or target.is_deleted:
        raise DeleteError("User not found.", 404)
    if target.id == actor.id:
        raise DeleteError("You cannot delete your own account.")
    role = H.effective_role(actor)
    if role == H.ADMIN:
        if H.effective_role(target) == H.ADMIN:
            others = [u for u in User.objects.filter(is_active=True, is_deleted=False).exclude(id=target.id) if H.is_admin(u)]
            if not others:
                raise DeleteError("You cannot delete the last Admin.")
        return
    if role == H.DIRECTOR:
        if target.id not in set(H.descendant_ids(actor)):
            raise DeleteError("Directors can only delete people in their own team.", 403)
        return
    raise DeleteError("Only Admins and Directors can delete users.", 403)


def successor(target, actor):
    """Nearest active, non-deleted manager above the target; else the person deleting."""
    for a in H.ancestors(target):
        if not a.is_deleted:
            return a
    return actor


def preview(actor, target):
    from quotes.models import ApprovalStep, Quotation

    check_can_delete(actor, target)
    heir = successor(target, actor)
    return {
        "UserId": target.id, "Name": target.name, "Role": H.effective_role(target),
        "Successor": {"Id": heir.id, "Name": heir.name, "Role": H.effective_role(heir)},
        "Quotations": Quotation.objects.filter(created_by=target).count(),
        "DirectReports": target.reports.filter(is_deleted=False).count(),
        "OpenApprovals": ApprovalStep.objects.filter(
            assigned_to=target, status__in=["PENDING", "WAITING"], request__status="PENDING").count(),
    }


@transaction.atomic
def delete_user(actor, target):
    from quotes import workflow as W
    from quotes.models import ApprovalStep, Quotation
    from quotes.notify import notify

    check_can_delete(actor, target)
    heir = successor(target, actor)
    summary = preview(actor, target)

    # 1. Their team now reports to the person above them.
    target.reports.filter(is_deleted=False).update(reporting_manager=heir)

    # 2. Their quotations move up.
    moved = list(Quotation.objects.filter(created_by=target))
    for q in moved:
        q.created_by = heir
        q.save(update_fields=["created_by", "updated_at"])
        W.log(q, actor, "Quotation Transferred", prev={"owner": target.name}, new={"owner": heir.name},
              note=f"{target.name} was deleted; the quotation now belongs to {heir.name}.")

    # 3. The account: hidden, cannot sign in, email freed; name kept for history.
    target.is_active = False
    target.is_deleted = True
    target.deleted_at = timezone.now()
    target.deleted_email = target.email
    target.email = f"deleted-{target.id}-{int(target.deleted_at.timestamp())}@deleted.invalid"
    target.reporting_manager = None
    target.save()

    # 4. Approvals waiting on them go up the chain (they are now inactive)…
    W.escalate_for_inactive(target, actor)
    # …and nobody may approve a quotation they now own: lift those steps one level.
    for step in ApprovalStep.objects.filter(
            request__quotation__in=moved, status__in=["PENDING", "WAITING"], request__status="PENDING",
            assigned_to=heir).select_related("request__quotation"):
        new = H.resolve_approver(heir, step.role)
        if new and new.id != heir.id:
            step.assigned_to = new
            step.save(update_fields=["assigned_to"])
            W.log(step.request.quotation, actor, "Approval Escalated", field=step.request.category,
                  prev={"user": heir.name}, new={"user": new.name, "stage": step.role},
                  note=f"{heir.name} now owns this quotation and cannot approve it.")

    if moved and heir.id != actor.id:
        notify([heir], moved[0], "transferred",
               f"{actor.name} deleted {target.name}. {len(moved)} quotation(s) and "
               f"{summary['DirectReports']} team member(s) now belong to you.")
    return summary
