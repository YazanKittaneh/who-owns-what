import re
from django import forms
from django.core.validators import RegexValidator
from django.core.exceptions import ValidationError


class CommaSeparatedField(forms.CharField):
    def to_python(self, value):
        if value in self.empty_values:
            return self.empty_value
        value = str(value).split(",")
        if self.strip:
            value = [s.strip() for s in value]
        return value

    def prepare_value(self, value):
        if value is None:
            return None
        return ", ".join([str(s) for s in value])


PIN_REGEX = r"^\d{14}$"
BBL_REGEX = r"^\d{10}$"


class PinForm(forms.Form):
    pin = forms.CharField(
        validators=[
            RegexValidator(PIN_REGEX, message="This should be a 14-digit PIN.")
        ]
    )


class PinOrBblForm(forms.Form):
    pin = forms.CharField(
        validators=[RegexValidator(PIN_REGEX, message="This should be a 14-digit PIN.")],
        required=False,
    )
    bbl = forms.CharField(
        validators=[RegexValidator(BBL_REGEX, message="This should be a 10-digit BBL.")],
        required=False,
    )

    def clean(self):
        data = super().clean()
        if not data.get("pin") and not data.get("bbl"):
            raise ValidationError("Either pin or bbl is required.")
        return data


class PinListForm(forms.Form):
    pins = CommaSeparatedField(label="14-digit PIN (comma-separated list)", required=True)

    def clean(self):
        data = self.cleaned_data
        if "pins" not in data:
            return data
        for pin in data["pins"]:
            if not re.match(PIN_REGEX, pin):
                raise ValidationError(
                    f"Invalid PIN: '{pin}'. All PINs must be 14-digit numeric values."
                )
        return data


class AddressSearchForm(forms.Form):
    q = forms.CharField(required=True)


class MapViewportForm(forms.Form):
    north = forms.FloatField(required=True)
    south = forms.FloatField(required=True)
    east = forms.FloatField(required=True)
    west = forms.FloatField(required=True)
    limit = forms.IntegerField(required=False, min_value=1, max_value=2000, initial=800)

    def clean(self):
        data = super().clean()
        north = data.get("north")
        south = data.get("south")
        east = data.get("east")
        west = data.get("west")

        if north is not None and south is not None and south >= north:
            raise ValidationError("south must be less than north.")
        if east is not None and west is not None and west >= east:
            raise ValidationError("west must be less than east.")

        return data


class NearbyPropertiesForm(PinForm):
    radius_m = forms.IntegerField(required=False, min_value=25, max_value=5000, initial=200)
    limit = forms.IntegerField(required=False, min_value=1, max_value=100, initial=25)


class CurrentOwnerForm(forms.Form):
    owner_id = forms.CharField(required=False)
    owner_name = forms.CharField(required=False)

    def clean(self):
        data = super().clean()
        owner_id = data.get("owner_id")
        owner_name = data.get("owner_name")
        if not owner_id and not owner_name:
            raise ValidationError("Either owner_id or owner_name is required.")
        return data


class EntitySearchForm(forms.Form):
    """Form for searching entities by name."""
    q = forms.CharField(required=True, min_length=2, max_length=500)
    entity_type = forms.ChoiceField(
        choices=[('all', 'All'), ('business', 'Business'), ('individual', 'Individual')],
        required=False,
        initial='all'
    )
    limit = forms.IntegerField(required=False, min_value=1, max_value=100, initial=20)


class ContactConfidenceFilterForm(forms.Form):
    """Form for filtering contacts by confidence score."""
    min_confidence = forms.IntegerField(required=False, min_value=0, max_value=100, initial=70)
    contact_type = forms.ChoiceField(
        choices=[('all', 'All'), ('phone', 'Phone'), ('email', 'Email'), ('mailing_address', 'Address')],
        required=False,
        initial='all'
    )
