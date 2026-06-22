"""Default template definitions mirrored from the frontend settings store."""

BUILTIN_TEMPLATES: dict[str, dict[str, int]] = {
    "Classic": {
        "focus": 25,
        "short_break": 5,
        "long_break": 15,
        "cycle": 4,
    },
    "Deep Work": {
        "focus": 52,
        "short_break": 17,
        "long_break": 30,
        "cycle": 2,
    },
    "Ultradian": {
        "focus": 90,
        "short_break": 20,
        "long_break": 30,
        "cycle": 2,
    },
    "Quick Sprints": {
        "focus": 15,
        "short_break": 3,
        "long_break": 10,
        "cycle": 4,
    },
    "Animedoro": {
        "focus": 40,
        "short_break": 20,
        "long_break": 30,
        "cycle": 3,
    },
}

DEFAULT_ACTIVE_TEMPLATE_LABEL = "Classic"
DEFAULT_PROFILE = BUILTIN_TEMPLATES[DEFAULT_ACTIVE_TEMPLATE_LABEL]
