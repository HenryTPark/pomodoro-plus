import json
from unittest import mock

from django.test import SimpleTestCase, override_settings
from pydantic import ValidationError

from insights.openai_client import InsightGenerationResult, InsightResponseError, generate_insight
from insights.prompts import INSIGHT_SCHEMA, SYSTEM_INSTRUCTIONS
from insights.schemas import Confidence, InsightResult


VALID_PAYLOAD = {
    "summary": "You finish most focus sessions and pause rarely.",
    "patterns": [
        {
            "title": "Strong completion on Classic",
            "evidence": "Classic completion_rate is 0.85 over 20 sessions.",
            "confidence": "high",
        }
    ],
    "template_recommendations": [
        {
            "template_label": "Classic",
            "reason": "Highest completion rate in the range.",
            "suggested_experiment": "Use Classic for deep work blocks this week.",
        }
    ],
    "warnings": ["Tag sample sizes vary widely."],
    "next_steps": ["Track one tag per day to reduce noise."],
}


class InsightResultSchemaTests(SimpleTestCase):
    def test_valid_payload_round_trips(self):
        insight = InsightResult.model_validate(VALID_PAYLOAD)
        self.assertEqual(insight.patterns[0].confidence, Confidence.HIGH)
        self.assertEqual(insight.model_dump(), VALID_PAYLOAD)

    def test_rejects_extra_fields(self):
        bad = {**VALID_PAYLOAD, "extra": "nope"}
        with self.assertRaises(ValidationError):
            InsightResult.model_validate(bad)

    def test_schema_has_strict_object_shape(self):
        self.assertFalse(INSIGHT_SCHEMA["additionalProperties"])
        self.assertEqual(
            set(INSIGHT_SCHEMA["required"]),
            {"summary", "patterns", "template_recommendations", "warnings", "next_steps"},
        )
        pattern_item = INSIGHT_SCHEMA["properties"]["patterns"]["items"]
        self.assertFalse(pattern_item["additionalProperties"])
        self.assertEqual(
            set(pattern_item["required"]),
            {"title", "evidence", "confidence"},
        )

    def test_system_instructions_warn_about_untrusted_stats(self):
        lowered = SYSTEM_INSTRUCTIONS.lower()
        self.assertIn("untrusted", lowered)
        self.assertIn("tag", lowered)


@override_settings(OPENAI_API_KEY="test-key", OPENAI_MODEL="gpt-4o-mini")
class GenerateInsightTests(SimpleTestCase):
    @mock.patch("insights.openai_client._client")
    def test_generate_insight_parses_response(self, mock_client_factory):
        mock_response = mock.Mock()
        mock_response.error = None
        mock_response.output_text = json.dumps(VALID_PAYLOAD)
        mock_response.model = "gpt-4o-mini"
        mock_response.incomplete_details = None
        mock_response.usage = mock.Mock(input_tokens=120, output_tokens=80)
        mock_client_factory.return_value.responses.create.return_value = mock_response

        result = generate_insight({"range_key": "30d", "completion_rate": 0.8})

        self.assertIsInstance(result, InsightGenerationResult)
        self.assertEqual(result.insight.summary, VALID_PAYLOAD["summary"])
        self.assertEqual(result.input_tokens, 120)
        self.assertEqual(result.output_tokens, 80)
        self.assertEqual(result.model_name, "gpt-4o-mini")

        call_kwargs = mock_client_factory.return_value.responses.create.call_args.kwargs
        self.assertEqual(call_kwargs["instructions"], SYSTEM_INSTRUCTIONS)
        self.assertEqual(call_kwargs["store"], False)
        self.assertEqual(call_kwargs["max_output_tokens"], 1200)
        self.assertEqual(call_kwargs["timeout"], 60)
        text_format = call_kwargs["text"]["format"]
        self.assertEqual(text_format["type"], "json_schema")
        self.assertEqual(text_format["name"], "pomodoro_insight")
        self.assertTrue(text_format["strict"])
        self.assertEqual(text_format["schema"], INSIGHT_SCHEMA)

    @mock.patch("insights.openai_client._client")
    def test_generate_insight_raises_on_empty_output(self, mock_client_factory):
        mock_response = mock.Mock()
        mock_response.error = None
        mock_response.output_text = ""
        mock_response.incomplete_details = mock.Mock(reason="max_output_tokens")
        mock_client_factory.return_value.responses.create.return_value = mock_response

        with self.assertRaises(InsightResponseError):
            generate_insight({})

    @mock.patch("insights.openai_client._client")
    def test_generate_insight_raises_on_api_error(self, mock_client_factory):
        mock_response = mock.Mock()
        mock_response.error = mock.Mock(code="rate_limit_exceeded", message="slow down")
        mock_client_factory.return_value.responses.create.return_value = mock_response

        with self.assertRaises(InsightResponseError):
            generate_insight({})
