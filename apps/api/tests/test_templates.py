"""Tests for email template CRUD and rendering."""
import uuid
import datetime
import pytest
from unittest.mock import AsyncMock, MagicMock

from app.services.template_service import render_template
from app.schemas.email_template import EmailTemplateRead


# --- Unit tests for EmailTemplateRead schema ---

def test_email_template_read_with_reminder_type():
    """EmailTemplateRead populates reminder_type_name from the relationship."""
    mock_rt = MagicMock()
    mock_rt.name = "Seasonal Order"

    mock_obj = MagicMock()
    mock_obj.id = uuid.uuid4()
    mock_obj.name = "Test Template"
    mock_obj.description = None
    mock_obj.subject_template = "Hello"
    mock_obj.body_template = "Body"
    mock_obj.is_active = True
    mock_obj.reminder_type_id = 5
    mock_obj.reminder_type = mock_rt
    mock_obj.created_at = datetime.datetime.now()
    mock_obj.updated_at = datetime.datetime.now()

    result = EmailTemplateRead.model_validate(mock_obj)
    assert result.reminder_type_id == 5
    assert result.reminder_type_name == "Seasonal Order"


def test_email_template_read_without_reminder_type():
    """EmailTemplateRead has None reminder_type_name when no type associated."""
    mock_obj = MagicMock()
    mock_obj.id = uuid.uuid4()
    mock_obj.name = "Generic Template"
    mock_obj.description = "A generic template"
    mock_obj.subject_template = "Subject"
    mock_obj.body_template = "Body text"
    mock_obj.is_active = True
    mock_obj.reminder_type_id = None
    mock_obj.reminder_type = None
    mock_obj.reminder_type_name = None  # explicit None to avoid MagicMock auto-attr
    mock_obj.created_at = datetime.datetime.now()
    mock_obj.updated_at = datetime.datetime.now()

    result = EmailTemplateRead.model_validate(mock_obj)
    assert result.reminder_type_id is None
    assert result.reminder_type_name is None


# --- Unit tests for render_template (no DB needed) ---

class MockTemplate:
    subject_template = "Hello {{account_name}} - {{reminder_title}}"
    body_template = "Dear {{contact_name}},\n\nYour reminder {{reminder_title}} is due on {{due_date}}.\n\nNotes: {{reminder_notes}}"


def test_render_template_basic():
    tmpl = MockTemplate()
    variables = {
        "account_name": "Acme Corp",
        "contact_name": "John Doe",
        "reminder_title": "Q1 Review",
        "due_date": "2026-03-15",
        "reminder_notes": "Bring the proposal",
        "contact_email": "",
        "program_name": "LATAM",
        "bdm_name": "Jane Smith",
    }
    subject, body = render_template(tmpl, variables)
    assert "Acme Corp" in subject
    assert "Q1 Review" in subject
    assert "John Doe" in body
    assert "2026-03-15" in body
    assert "Bring the proposal" in body


def test_render_template_empty_values():
    tmpl = MockTemplate()
    variables = {
        "account_name": "",
        "contact_name": "",
        "reminder_title": "Follow up",
        "due_date": "2026-04-01",
        "reminder_notes": None,
        "contact_email": "",
        "program_name": "",
        "bdm_name": "",
    }
    subject, body = render_template(tmpl, variables)
    # Placeholders should be replaced with empty string
    assert "{{account_name}}" not in subject
    assert "{{contact_name}}" not in body


def test_render_template_missing_key():
    """Variables not provided should remain as-is if key not in dict."""
    tmpl = MockTemplate()
    # Only partial variables
    variables = {
        "account_name": "TestCo",
        "reminder_title": "Test",
        "due_date": "2026-01-01",
    }
    subject, body = render_template(tmpl, variables)
    assert "TestCo" in subject
    # contact_name, reminder_notes not replaced since not in variables
    assert "{{contact_name}}" in body  # unreplaced
