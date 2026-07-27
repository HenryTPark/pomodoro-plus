"""OpenAI Responses API client for productivity insights."""

from __future__ import annotations

import json
from dataclasses import dataclass

from django.conf import settings
from openai import OpenAI
from pydantic import ValidationError

from insights.prompts import INSIGHT_SCHEMA, SYSTEM_INSTRUCTIONS
from insights.schemas import InsightResult

DEFAULT_TIMEOUT_SECONDS = 60
MAX_OUTPUT_TOKENS = 1200


class InsightResponseError(Exception):
    """OpenAI returned a response that could not be parsed into an insight."""


@dataclass(frozen=True)
class InsightGenerationResult:
    insight: InsightResult
    model_name: str
    input_tokens: int
    output_tokens: int


def _client() -> OpenAI:
    return OpenAI(api_key=settings.OPENAI_API_KEY)


def generate_insight(stats: dict) -> InsightGenerationResult:
    """Call OpenAI and return a validated insight plus token usage."""
    model = settings.OPENAI_MODEL
    response = _client().responses.create(
        model=model,
        instructions=SYSTEM_INSTRUCTIONS,
        input=json.dumps(stats),
        text={
            "format": {
                "type": "json_schema",
                "name": "pomodoro_insight",
                "strict": True,
                "schema": INSIGHT_SCHEMA,
            }
        },
        store=False,
        max_output_tokens=MAX_OUTPUT_TOKENS,
        timeout=DEFAULT_TIMEOUT_SECONDS,
    )

    if response.error is not None:
        raise InsightResponseError(
            f"OpenAI response error: {response.error.code or response.error.message}"
        )

    if not response.output_text:
        detail = response.incomplete_details.reason if response.incomplete_details else "empty output"
        raise InsightResponseError(f"Incomplete or empty model output: {detail}")

    try:
        insight = InsightResult.model_validate_json(response.output_text)
    except ValidationError as exc:
        raise InsightResponseError(f"Model output failed validation: {exc}") from exc

    usage = response.usage
    return InsightGenerationResult(
        insight=insight,
        model_name=response.model or model,
        input_tokens=usage.input_tokens if usage else 0,
        output_tokens=usage.output_tokens if usage else 0,
    )
