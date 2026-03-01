from typing import Annotated

from email_validator import EmailNotValidError, validate_email
from pydantic import AfterValidator


def _validate_email_no_deliver(v: str) -> str:
    """Validate email syntax without checking deliverability (allows .local, etc.)."""
    try:
        info = validate_email(v, check_deliverability=False)
        return info.normalized
    except EmailNotValidError as exc:
        raise ValueError(str(exc)) from exc


# Use this instead of EmailStr wherever .local / non-public TLDs must be accepted.
LocalEmail = Annotated[str, AfterValidator(_validate_email_no_deliver)]
