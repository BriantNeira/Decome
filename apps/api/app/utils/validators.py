import re
from typing import Annotated

from pydantic import AfterValidator

# RFC-5321 local part + any domain including .local / reserved TLDs
_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$", re.IGNORECASE)


def _validate_local_email(v: str) -> str:
    """Validate email syntax with a permissive regex (allows .local, internal TLDs, etc.)."""
    v = v.strip().lower()
    if not _EMAIL_RE.match(v):
        raise ValueError("Enter a valid email address.")
    return v


# Use this instead of EmailStr wherever .local / non-public TLDs must be accepted.
LocalEmail = Annotated[str, AfterValidator(_validate_local_email)]
