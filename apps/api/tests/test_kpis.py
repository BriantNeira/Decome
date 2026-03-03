"""Tests for KPI service — summaries, Excel export, AI diagnosis."""
import datetime
import io
import uuid

import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.services.kpi_service import get_kpi_summary, export_calendar_excel, _month_range
from app.schemas.kpi import KPISummary


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _uid():
    return uuid.uuid4()


def _make_reminder(
    *,
    status="open",
    start_date=None,
    completed_at=None,
    account_name="Acme",
    program_name="Q1 Promo",
    type_name="Seasonal",
    type_color="#FF0000",
    user_name="John Doe",
    user_email="john@example.com",
    account_id=None,
    program_id=None,
    user_id=None,
    type_id=None,
):
    """Build a mock Reminder with nested relationships."""
    r = MagicMock()
    r.status = status
    r.start_date = start_date or datetime.date(2026, 3, 15)
    r.completed_at = completed_at

    r.account_id = account_id or _uid()
    r.program_id = program_id or _uid()
    r.user_id = user_id or _uid()
    r.type_id = type_id or 1

    # Account relationship
    r.account = MagicMock()
    r.account.name = account_name
    r.account.id = r.account_id

    # Program relationship
    r.program = MagicMock()
    r.program.name = program_name
    r.program.account = r.account

    # User relationship
    r.user = MagicMock()
    r.user.full_name = user_name
    r.user.email = user_email
    r.user.id = r.user_id

    # ReminderType relationship
    r.reminder_type = MagicMock()
    r.reminder_type.name = type_name
    r.reminder_type.color = type_color

    r.title = "Test Reminder"
    return r


def _mock_db(reminders=None, token_rows=None, msg_rows=None, users=None):
    """Create a mock AsyncSession that returns controlled data."""
    db = AsyncMock()
    call_count = [0]
    reminders = reminders or []
    token_rows = token_rows or []
    msg_rows = msg_rows or []
    users = users or []

    async def mock_execute(stmt, *args, **kwargs):
        n = call_count[0]
        call_count[0] += 1
        result = MagicMock()

        if n == 0:
            # First call: reminders query
            result.scalars.return_value.all.return_value = reminders
        elif n == 1:
            # Second call: token usage query
            result.__iter__ = MagicMock(return_value=iter(token_rows))
        elif n == 2:
            # Third call: generated messages query
            result.__iter__ = MagicMock(return_value=iter(msg_rows))
        elif n == 3:
            # Fourth call: users for token summary
            result.scalars.return_value.all.return_value = users
        else:
            result.scalars.return_value.all.return_value = []
            result.__iter__ = MagicMock(return_value=iter([]))
        return result

    db.execute = mock_execute
    return db


# ---------------------------------------------------------------------------
# _month_range unit tests
# ---------------------------------------------------------------------------

def test_month_range_single_month():
    result = _month_range(datetime.date(2026, 3, 1), datetime.date(2026, 3, 31))
    assert len(result) == 1
    assert result[0] == datetime.date(2026, 3, 1)


def test_month_range_multiple_months():
    result = _month_range(datetime.date(2026, 1, 15), datetime.date(2026, 4, 10))
    assert len(result) == 4  # Jan, Feb, Mar, Apr
    assert result[0] == datetime.date(2026, 1, 1)
    assert result[-1] == datetime.date(2026, 4, 1)


def test_month_range_cross_year():
    result = _month_range(datetime.date(2025, 11, 1), datetime.date(2026, 2, 28))
    assert len(result) == 4  # Nov, Dec, Jan, Feb
    assert result[0] == datetime.date(2025, 11, 1)
    assert result[-1] == datetime.date(2026, 2, 1)


# ---------------------------------------------------------------------------
# get_kpi_summary tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_kpi_summary_empty_db():
    """With no reminders, all counts should be zero."""
    db = _mock_db(reminders=[])
    summary = await get_kpi_summary(db, date_from="2026-01-01", date_to="2026-12-31")

    assert isinstance(summary, KPISummary)
    assert summary.completed_on_time == 0
    assert summary.completed_late == 0
    assert summary.completion_rate == 0.0
    assert summary.overdue_pending == 0
    assert summary.total_open == 0
    assert summary.total_completed == 0
    assert summary.by_type == []
    assert summary.by_account == []
    assert summary.by_program == []
    assert summary.by_bdm == []
    assert summary.token_summary.total_tokens == 0


@pytest.mark.asyncio
async def test_kpi_summary_with_data():
    """Summary should count reminders by status correctly."""
    acct_id = _uid()
    prog_id = _uid()
    user_id = _uid()

    reminders = [
        _make_reminder(
            status="completed",
            start_date=datetime.date(2026, 3, 15),
            completed_at=datetime.datetime(2026, 3, 14, 10, 0),  # before due = on-time
            account_id=acct_id, program_id=prog_id, user_id=user_id,
        ),
        _make_reminder(
            status="completed",
            start_date=datetime.date(2026, 3, 10),
            completed_at=datetime.datetime(2026, 3, 12, 10, 0),  # after due = late
            account_id=acct_id, program_id=prog_id, user_id=user_id,
        ),
        _make_reminder(
            status="open",
            start_date=datetime.date(2026, 1, 1),  # overdue (before today)
            account_id=acct_id, program_id=prog_id, user_id=user_id,
        ),
        _make_reminder(
            status="open",
            start_date=datetime.date(2026, 12, 1),  # future, not overdue
            account_id=acct_id, program_id=prog_id, user_id=user_id,
        ),
    ]

    db = _mock_db(reminders=reminders)
    summary = await get_kpi_summary(db, date_from="2026-01-01", date_to="2026-12-31")

    assert summary.total_completed == 2
    assert summary.completed_on_time == 1
    assert summary.completed_late == 1
    assert summary.total_open == 2
    assert summary.overdue_pending == 1


@pytest.mark.asyncio
async def test_kpi_completion_rate_calculation():
    """Completion rate should be on_time / (on_time + late) * 100."""
    reminders = [
        # 3 completed on time
        _make_reminder(status="completed", start_date=datetime.date(2026, 6, 10),
                       completed_at=datetime.datetime(2026, 6, 9)),
        _make_reminder(status="completed", start_date=datetime.date(2026, 6, 15),
                       completed_at=datetime.datetime(2026, 6, 14)),
        _make_reminder(status="completed", start_date=datetime.date(2026, 6, 20),
                       completed_at=datetime.datetime(2026, 6, 20)),
        # 1 completed late
        _make_reminder(status="completed", start_date=datetime.date(2026, 6, 5),
                       completed_at=datetime.datetime(2026, 6, 8)),
    ]

    db = _mock_db(reminders=reminders)
    summary = await get_kpi_summary(db, date_from="2026-01-01", date_to="2026-12-31")

    # 3 on time out of 4 total = 75%
    assert summary.completed_on_time == 3
    assert summary.completed_late == 1
    assert summary.completion_rate == 75.0


@pytest.mark.asyncio
async def test_kpi_by_type_breakdown():
    """by_type should group by reminder type."""
    type1_id = 1
    type2_id = 2

    reminders = [
        _make_reminder(status="completed", type_id=type1_id, type_name="Seasonal", type_color="#00FF00",
                       start_date=datetime.date(2026, 6, 1),
                       completed_at=datetime.datetime(2026, 5, 30)),
        _make_reminder(status="open", type_id=type1_id, type_name="Seasonal", type_color="#00FF00",
                       start_date=datetime.date(2026, 6, 1)),
        _make_reminder(status="completed", type_id=type2_id, type_name="Follow-up", type_color="#0000FF",
                       start_date=datetime.date(2026, 6, 1),
                       completed_at=datetime.datetime(2026, 6, 1)),
    ]

    db = _mock_db(reminders=reminders)
    summary = await get_kpi_summary(db, date_from="2026-01-01", date_to="2026-12-31")

    assert len(summary.by_type) == 2
    type_names = {t.type_name for t in summary.by_type}
    assert "Seasonal" in type_names
    assert "Follow-up" in type_names

    seasonal = next(t for t in summary.by_type if t.type_name == "Seasonal")
    assert seasonal.total == 2
    assert seasonal.completed == 1

    followup = next(t for t in summary.by_type if t.type_name == "Follow-up")
    assert followup.total == 1
    assert followup.completed == 1


@pytest.mark.asyncio
async def test_kpi_by_account_breakdown():
    """by_account should group by account and calculate on_time_pct."""
    acct1_id = _uid()
    acct2_id = _uid()

    reminders = [
        _make_reminder(status="completed", account_id=acct1_id, account_name="Acme",
                       start_date=datetime.date(2026, 6, 10),
                       completed_at=datetime.datetime(2026, 6, 9)),  # on time
        _make_reminder(status="completed", account_id=acct1_id, account_name="Acme",
                       start_date=datetime.date(2026, 6, 15),
                       completed_at=datetime.datetime(2026, 6, 20)),  # late
        _make_reminder(status="completed", account_id=acct2_id, account_name="BetaCo",
                       start_date=datetime.date(2026, 6, 20),
                       completed_at=datetime.datetime(2026, 6, 19)),  # on time
    ]

    db = _mock_db(reminders=reminders)
    summary = await get_kpi_summary(db, date_from="2026-01-01", date_to="2026-12-31")

    assert len(summary.by_account) == 2

    acme = next(a for a in summary.by_account if a.account_name == "Acme")
    assert acme.total == 2
    assert acme.completed == 2
    assert acme.on_time_pct == 50.0  # 1 on-time out of 2

    beta = next(a for a in summary.by_account if a.account_name == "BetaCo")
    assert beta.total == 1
    assert beta.on_time_pct == 100.0


# ---------------------------------------------------------------------------
# Excel export tests
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_export_excel_returns_xlsx():
    """export_calendar_excel should return valid xlsx bytes."""
    acct_id = _uid()
    prog_id = _uid()
    user_id = _uid()

    reminders = [
        _make_reminder(
            status="completed",
            start_date=datetime.date(2026, 3, 15),
            completed_at=datetime.datetime(2026, 3, 14),
            account_id=acct_id, program_id=prog_id, user_id=user_id,
        ),
    ]

    db = AsyncMock()
    call_count = [0]

    async def mock_execute(stmt, *args, **kwargs):
        n = call_count[0]
        call_count[0] += 1
        result = MagicMock()

        if n == 0:
            # get_kpi_summary: reminders
            result.scalars.return_value.all.return_value = reminders
        elif n == 1:
            # token usage
            result.__iter__ = MagicMock(return_value=iter([]))
        elif n == 2:
            # messages
            result.__iter__ = MagicMock(return_value=iter([]))
        elif n == 3:
            # users for token summary
            result.scalars.return_value.all.return_value = []
        elif n == 4:
            # export: load reminders again for detail sheet
            result.scalars.return_value.all.return_value = reminders
        else:
            result.scalars.return_value.all.return_value = []
            result.__iter__ = MagicMock(return_value=iter([]))
        return result

    db.execute = mock_execute

    xlsx_bytes = await export_calendar_excel(
        db, date_from="2026-01-01", date_to="2026-12-31"
    )

    assert isinstance(xlsx_bytes, bytes)
    assert len(xlsx_bytes) > 500
    # Valid xlsx starts with PK magic bytes (zip archive)
    assert xlsx_bytes[:2] == b"PK"

    # Verify it has the expected sheets
    import openpyxl
    wb = openpyxl.load_workbook(io.BytesIO(xlsx_bytes))
    sheet_names = wb.sheetnames
    assert "Summary" in sheet_names
    assert "By Account" in sheet_names
    assert "By BDM" in sheet_names
    assert "All Reminders" in sheet_names


# ---------------------------------------------------------------------------
# AI diagnosis test
# ---------------------------------------------------------------------------

@pytest.mark.asyncio
async def test_diagnosis_mock_llm():
    """generate_ai_diagnosis should call LLM and return diagnosis text."""
    from app.services.kpi_service import generate_ai_diagnosis

    user_id = _uid()
    db = _mock_db(reminders=[])  # empty KPIs = simple scenario

    mock_config = MagicMock()
    mock_config.is_active = True
    mock_config.api_key = "encrypted-key"
    mock_config.provider = "openai"
    mock_config.model = "gpt-4"

    with patch("app.services.budget_service.check_budget", new=AsyncMock()) as mock_check, \
         patch("app.services.budget_service.log_usage", new=AsyncMock()) as mock_log, \
         patch("app.services.llm_service.get_llm_config", new=AsyncMock(return_value=mock_config)), \
         patch("app.services.llm_service.generate_diagnosis", new=AsyncMock(return_value=("Great performance overall.", 150))):

        text, tokens = await generate_ai_diagnosis(
            db, user_id=user_id, date_from="2026-01-01", date_to="2026-12-31",
        )

    assert text == "Great performance overall."
    assert tokens == 150


@pytest.mark.asyncio
async def test_diagnosis_no_llm_config_raises():
    """generate_ai_diagnosis should raise if LLM is not configured."""
    from fastapi import HTTPException
    from app.services.kpi_service import generate_ai_diagnosis

    user_id = _uid()
    db = _mock_db(reminders=[])

    with patch("app.services.budget_service.check_budget", new=AsyncMock()), \
         patch("app.services.llm_service.get_llm_config", new=AsyncMock(return_value=None)):

        with pytest.raises(HTTPException) as exc_info:
            await generate_ai_diagnosis(
                db, user_id=user_id, date_from="2026-01-01", date_to="2026-12-31",
            )
        assert exc_info.value.status_code == 422
