from pydantic import BaseModel


class BrandingConfigRead(BaseModel):
    logo_light_url: str | None = None
    logo_dark_url: str | None = None
    favicon_url: str | None = None

    model_config = {"from_attributes": True}
