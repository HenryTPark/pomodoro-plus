"""Pydantic models for validated AI insight responses."""

from __future__ import annotations

from enum import Enum

from pydantic import BaseModel, ConfigDict


class Confidence(str, Enum):
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Pattern(BaseModel):
    model_config = ConfigDict(extra="forbid")

    title: str
    evidence: str
    confidence: Confidence


class TemplateRecommendation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    template_label: str
    reason: str
    suggested_experiment: str


class InsightResult(BaseModel):
    """Structured insight returned by the OpenAI Responses API."""

    model_config = ConfigDict(extra="forbid")

    summary: str
    patterns: list[Pattern]
    template_recommendations: list[TemplateRecommendation]
    warnings: list[str]
    next_steps: list[str]
