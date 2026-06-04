import json
import os
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from dotenv import load_dotenv
from google import genai
from google.genai import types

from .logging_service import TokenUsage
from .models import ChatMessage, PlanResponse

load_dotenv()

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.0-flash")


@dataclass
class GeminiResult:
    plan: PlanResponse
    usage: TokenUsage
    model_name: str


def system_prompt(menu: str) -> str:
    return f'''Bạn là trợ lý lập lịch vui chơi tại VinWonders Phú Quốc. NHIỆM VỤ:
- Đọc yêu cầu của khách (ngôn ngữ tự nhiên, tiếng Việt).
- Trích "constraints" (giờ đến, giờ về, số người, có trẻ nhỏ, sở thích).
- CHỌN trò chơi BẰNG ĐÚNG "id" trong DANH SÁCH dưới đây. TUYỆT ĐỐI KHÔNG bịa id hay tên mới, KHÔNG tự tính giờ (hệ thống khác lo việc tính giờ).
- Nếu yêu cầu quá mơ hồ (vd "có trò nào vui không") -> action="clarify" và đặt 1-2 câu hỏi ngắn trong clarifyQuestion.
- Nếu đã đủ thông tin -> action="plan" (lịch mới) hoặc "edit" (sửa lịch hiện có), điền chosenIds theo THỨ TỰ chơi hợp lý.
- assistantText: lời nhắn thân thiện, ngắn gọn cho khách (giải thích vì sao chọn các trò này).

DANH SÁCH TRÒ CHƠI (id — tên — khu — loại — phút — cường độ — hợp trẻ em):
{menu}'''


@lru_cache(maxsize=1)
def _client() -> genai.Client:
    api_key = os.getenv("GEMINI_API_KEY")
    if not api_key:
        raise RuntimeError("GEMINI_API_KEY is required")
    return genai.Client(api_key=api_key)


def _content_from_message(message: ChatMessage) -> types.Content:
    role = "model" if message.role == "assistant" else "user"
    return types.Content(role=role, parts=[types.Part.from_text(text=message.text)])


def _parse_response(text: str) -> dict[str, Any]:
    return json.loads(text or "{}")


def _metadata_value(metadata: Any, *names: str) -> int | None:
    for name in names:
        value = None
        if isinstance(metadata, dict):
            value = metadata.get(name)
        else:
            value = getattr(metadata, name, None)
        if value is not None:
            try:
                return int(value)
            except (TypeError, ValueError):
                return None
    return None


def _usage_from_response(response: Any) -> TokenUsage:
    metadata = getattr(response, "usage_metadata", None) or getattr(response, "usageMetadata", None)
    if metadata is None:
        return TokenUsage()

    input_tokens = _metadata_value(metadata, "prompt_token_count", "promptTokenCount", "input_token_count", "inputTokenCount")
    output_tokens = _metadata_value(metadata, "candidates_token_count", "candidatesTokenCount", "output_token_count", "outputTokenCount")
    total_tokens = _metadata_value(metadata, "total_token_count", "totalTokenCount")
    return TokenUsage(
        input_tokens=input_tokens,
        output_tokens=output_tokens,
        total_tokens=total_tokens,
        input_tokens_source="gemini_usage_metadata" if input_tokens is not None else "estimated",
        output_tokens_source="gemini_usage_metadata" if output_tokens is not None else "estimated",
    )


def ask_gemini(messages: list[ChatMessage], itinerary_summary: str, menu: str) -> GeminiResult:
    contents = [_content_from_message(message) for message in messages]
    contents.append(
        types.Content(
            role="user",
            parts=[types.Part.from_text(text=f"Lịch hiện tại:\n{itinerary_summary or '(chưa có)'}")],
        )
    )

    client = _client()
    response = client.models.generate_content(
        model=MODEL,
        contents=contents,
        config=types.GenerateContentConfig(
            system_instruction=system_prompt(menu),
            response_mime_type="application/json",
            response_schema=PlanResponse,
        ),
    )
    return GeminiResult(
        plan=PlanResponse.model_validate(_parse_response(response.text or "{}")),
        usage=_usage_from_response(response),
        model_name=MODEL,
    )
