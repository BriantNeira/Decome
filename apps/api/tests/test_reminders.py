import datetime
import uuid as uuid_lib

import pytest
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Account, User
from app.models.reminder import Reminder


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

async def create_test_account(db: AsyncSession) -> Account:
    uid = str(uuid_lib.uuid4()).replace("-", "")[:10].upper()
    account = Account(name=f"Reminder Test Account {uid}", code=uid)
    db.add(account)
    await db.commit()
    await db.refresh(account)
    return account


async def create_reminder_direct(
    db: AsyncSession,
    *,
    user_id,
    account_id,
    title: str = "Test Reminder",
    start_date: datetime.date | None = None,
    status: str = "open",
    recurrence_rule: str | None = None,
) -> Reminder:
    if start_date is None:
        start_date = datetime.date.today()
    reminder = Reminder(
        user_id=user_id,
        account_id=account_id,
        title=title,
        start_date=start_date,
        status=status,
        recurrence_rule=recurrence_rule,
        edit_count=0,
    )
    db.add(reminder)
    await db.commit()
    await db.refresh(reminder)
    return reminder


def auth(token: str) -> dict:
    return {"Authorization": f"Bearer {token}"}


# ---------------------------------------------------------------------------
# CREATE
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_create_reminder_admin(
    client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession
):
    """Admin can create a reminder; returned object has correct fields."""
    account = await create_test_account(db)
    payload = {
        "user_id": str(bdm_user.id),
        "account_id": str(account.id),
        "title": "Admin-Created Reminder",
        "start_date": str(datetime.date.today()),
    }
    res = await client.post("/api/reminders", json=payload, headers=auth(admin_token))
    assert res.status_code == 201
    data = res.json()
    assert data["title"] == "Admin-Created Reminder"
    assert data["user_id"] == str(bdm_user.id)
    assert data["status"] == "open"
    assert data["edit_count"] == 0
    assert "id" in data


@pytest.mark.asyncio
async def test_create_reminder_bdm(
    client: AsyncClient, bdm_token: str, bdm_user: User, admin_user: User, db: AsyncSession
):
    """BDM user_id is forced to their own id regardless of payload."""
    account = await create_test_account(db)
    payload = {
        "user_id": str(admin_user.id),   # attempt to set a different user
        "account_id": str(account.id),
        "title": "BDM Self Reminder",
        "start_date": str(datetime.date.today()),
    }
    res = await client.post("/api/reminders", json=payload, headers=auth(bdm_token))
    assert res.status_code == 201
    data = res.json()
    # user_id must be forced to the BDM's own id
    assert data["user_id"] == str(bdm_user.id)


# ---------------------------------------------------------------------------
# LIST
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_list_reminders_admin_sees_all(
    client: AsyncClient, admin_token: str, bdm_user: User, admin_user: User, db: AsyncSession
):
    """Admin can see reminders belonging to multiple users."""
    account = await create_test_account(db)
    await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id, title="BDM Reminder Unique1")
    await create_reminder_direct(db, user_id=admin_user.id, account_id=account.id, title="Admin Reminder Unique1")

    res = await client.get("/api/reminders", headers=auth(admin_token))
    assert res.status_code == 200
    data = res.json()
    assert "items" in data
    assert "total" in data
    user_ids = {item["user_id"] for item in data["items"]}
    assert str(bdm_user.id) in user_ids
    assert str(admin_user.id) in user_ids


@pytest.mark.asyncio
async def test_list_reminders_bdm_sees_own(
    client: AsyncClient, bdm_token: str, bdm_user: User, admin_user: User, db: AsyncSession
):
    """BDM only sees their own reminders in the list."""
    account = await create_test_account(db)
    await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id, title="BDM Exclusive")
    await create_reminder_direct(db, user_id=admin_user.id, account_id=account.id, title="Admin Exclusive")

    res = await client.get("/api/reminders", headers=auth(bdm_token))
    assert res.status_code == 200
    data = res.json()
    for item in data["items"]:
        assert item["user_id"] == str(bdm_user.id)


# ---------------------------------------------------------------------------
# GET
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_get_reminder_admin(
    client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession
):
    """Admin can get any reminder by id."""
    account = await create_test_account(db)
    reminder = await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id)
    res = await client.get(f"/api/reminders/{reminder.id}", headers=auth(admin_token))
    assert res.status_code == 200
    assert res.json()["id"] == str(reminder.id)


@pytest.mark.asyncio
async def test_get_reminder_bdm_own(
    client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession
):
    """BDM can get their own reminder."""
    account = await create_test_account(db)
    reminder = await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id)
    res = await client.get(f"/api/reminders/{reminder.id}", headers=auth(bdm_token))
    assert res.status_code == 200
    assert res.json()["id"] == str(reminder.id)


@pytest.mark.asyncio
async def test_get_reminder_bdm_other_403(
    client: AsyncClient, bdm_token: str, admin_user: User, db: AsyncSession
):
    """BDM gets 403 when trying to access another user's reminder."""
    account = await create_test_account(db)
    reminder = await create_reminder_direct(db, user_id=admin_user.id, account_id=account.id)
    res = await client.get(f"/api/reminders/{reminder.id}", headers=auth(bdm_token))
    assert res.status_code == 403


# ---------------------------------------------------------------------------
# UPDATE
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_update_reminder_increments_edit_count(
    client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession
):
    """Each PATCH request increments edit_count by 1."""
    account = await create_test_account(db)
    reminder = await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id)
    assert reminder.edit_count == 0

    res1 = await client.patch(
        f"/api/reminders/{reminder.id}", json={"title": "Updated once"},
        headers=auth(admin_token),
    )
    assert res1.status_code == 200
    assert res1.json()["edit_count"] == 1

    res2 = await client.patch(
        f"/api/reminders/{reminder.id}", json={"title": "Updated twice"},
        headers=auth(admin_token),
    )
    assert res2.status_code == 200
    assert res2.json()["edit_count"] == 2


@pytest.mark.asyncio
async def test_update_reminder_status(
    client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession
):
    """Admin can transition status from open to completed."""
    account = await create_test_account(db)
    reminder = await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id)
    res = await client.patch(
        f"/api/reminders/{reminder.id}", json={"status": "completed"},
        headers=auth(admin_token),
    )
    assert res.status_code == 200
    assert res.json()["status"] == "completed"


# ---------------------------------------------------------------------------
# DELETE
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_delete_reminder_admin(
    client: AsyncClient, admin_token: str, bdm_user: User, db: AsyncSession
):
    """Admin can delete a reminder; subsequent GET returns 404."""
    account = await create_test_account(db)
    reminder = await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id)

    res = await client.delete(f"/api/reminders/{reminder.id}", headers=auth(admin_token))
    assert res.status_code == 200

    res2 = await client.get(f"/api/reminders/{reminder.id}", headers=auth(admin_token))
    assert res2.status_code == 404


@pytest.mark.asyncio
async def test_delete_reminder_bdm_own(
    client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession
):
    """BDM can delete their own reminder."""
    account = await create_test_account(db)
    reminder = await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id)
    res = await client.delete(f"/api/reminders/{reminder.id}", headers=auth(bdm_token))
    assert res.status_code == 200


# ---------------------------------------------------------------------------
# STATS
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_stats_open_count(
    client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession
):
    """Stats.open is at least 1 after creating an open reminder for BDM."""
    account = await create_test_account(db)
    await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id, status="open")

    res = await client.get("/api/reminders/stats", headers=auth(bdm_token))
    assert res.status_code == 200
    data = res.json()
    assert data["open"] >= 1


@pytest.mark.asyncio
async def test_stats_overdue_count(
    client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession
):
    """Stats.overdue counts open reminders whose start_date is in the past."""
    account = await create_test_account(db)
    past = datetime.date.today() - datetime.timedelta(days=30)
    await create_reminder_direct(
        db, user_id=bdm_user.id, account_id=account.id,
        start_date=past, status="open",
    )

    res = await client.get("/api/reminders/stats", headers=auth(bdm_token))
    assert res.status_code == 200
    data = res.json()
    assert data["overdue"] >= 1


@pytest.mark.asyncio
async def test_stats_completed_this_month(
    client: AsyncClient, bdm_token: str, bdm_user: User, db: AsyncSession
):
    """A reminder completed today is counted in completed_this_month."""
    account = await create_test_account(db)
    reminder = await create_reminder_direct(db, user_id=bdm_user.id, account_id=account.id)

    # Mark completed via API so updated_at = now()
    patch_res = await client.patch(
        f"/api/reminders/{reminder.id}", json={"status": "completed"},
        headers=auth(bdm_token),
    )
    assert patch_res.status_code == 200

    res = await client.get("/api/reminders/stats", headers=auth(bdm_token))
    assert res.status_code == 200
    data = res.json()
    assert data["completed_this_month"] >= 1


# ---------------------------------------------------------------------------
# CALENDAR
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_calendar_returns_list(
    client: AsyncClient, admin_token: str, admin_user: User, db: AsyncSession
):
    """GET /api/reminders/calendar returns a JSON array with occurrence_date."""
    today = datetime.date.today()
    account = await create_test_account(db)
    await create_reminder_direct(
        db, user_id=admin_user.id, account_id=account.id,
        start_date=today,
    )

    res = await client.get(
        f"/api/reminders/calendar?year={today.year}&month={today.month}",
        headers=auth(admin_token),
    )
    assert res.status_code == 200
    data = res.json()
    assert isinstance(data, list)
    # At least the reminder we just created should appear
    assert any(item.get("start_date") == str(today) for item in data)


@pytest.mark.asyncio
async def test_calendar_recurring_expanded(
    client: AsyncClient, admin_token: str, admin_user: User, db: AsyncSession
):
    """A WEEKLY recurring reminder starting on the 1st expands into ≥3 occurrences."""
    today = datetime.date.today()
    start = datetime.date(today.year, today.month, 1)
    account = await create_test_account(db)
    unique_title = f"Weekly Test {uuid_lib.uuid4().hex[:8]}"
    await create_reminder_direct(
        db, user_id=admin_user.id, account_id=account.id,
        title=unique_title,
        start_date=start,
        recurrence_rule="WEEKLY",
    )

    res = await client.get(
        f"/api/reminders/calendar?year={today.year}&month={today.month}",
        headers=auth(admin_token),
    )
    assert res.status_code == 200
    data = res.json()
    weekly_occurrences = [item for item in data if item.get("title") == unique_title]
    # Starting on day 1 of any month, WEEKLY gives at least 4 occurrences (days 1,8,15,22)
    assert len(weekly_occurrences) >= 3
