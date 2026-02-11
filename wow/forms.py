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


class PinForm(forms.Form):
    pin = forms.CharField(
        validators=[
            RegexValidator(PIN_REGEX, message="This should be a 14-digit PIN.")
        ]
    )


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
