import json
import math
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from uuid import uuid4

LOG_DIR = Path(__file__).resolve().parent / "logs"
LOG_FILE = LOG_DIR / "chat_turns.jsonl"


@dataclass
class TokenUsage:
    input_tokens: int | None = None
    output_tokens: int | None = None
    total_tokens: int | None = None
    input_tokens_source: str = "estimated"
    output_tokens_source: str = "estimated"


def now_utc() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def estimate_tokens(text: str | None) -> int:
    if not text:
        return 0
    return max(1, math.ceil(len(text) / 4))


def _price_env(name: str) -> float:
    try:
        return float(os.getenv(name, "0") or 0)
    except ValueError:
        return 0.0


def _pricing(model_name: str) -> tuple[float, float]:
    if model_name.startswith("local") or model_name == "frontend-error":
        return 0.0, 0.0
    return _price_env("GEMINI_INPUT_PRICE_PER_1M"), _price_env("GEMINI_OUTPUT_PRICE_PER_1M")


def _cost(tokens: int, price_per_1m: float) -> float:
    return round(tokens / 1_000_000 * price_per_1m, 10)


def _append_jsonl(record: dict[str, Any]) -> None:
    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with LOG_FILE.open("a", encoding="utf-8") as file:
        file.write(json.dumps(record, ensure_ascii=False) + "\n")


def displayed_assistant_text(assistant_text: str, clarify_question: str | None = None) -> str:
    return f"{assistant_text}\n{clarify_question}" if clarify_question else assistant_text


def log_chat_turn(
    *,
    session_id: str | None,
    user_id: str | None,
    start_timestamp: str,
    end_timestamp: str,
    latency_ms: int,
    user_message: str,
    assistant_response: str,
    model_name: str,
    usage: TokenUsage | None = None,
    aggregate_input_text: str | None = None,
    user_message_timestamp: str | None = None,
    assistant_response_timestamp: str | None = None,
    tool_calls: list[str] | None = None,
    attempts: int = 1,
    status: str = "success",
    route: str = "",
    action: str | None = None,
    chosen_ids: list[str] | None = None,
    is_fallback: bool = False,
    metadata: dict[str, Any] | None = None,
) -> str:
    usage = usage or TokenUsage()
    input_tokens = usage.input_tokens
    output_tokens = usage.output_tokens

    if input_tokens is None:
        input_tokens = estimate_tokens(aggregate_input_text or user_message)
        usage.input_tokens_source = "estimated"
    if output_tokens is None:
        output_tokens = estimate_tokens(assistant_response)
        usage.output_tokens_source = "estimated"

    total_tokens = usage.total_tokens if usage.total_tokens is not None else input_tokens + output_tokens
    user_input_tokens = estimate_tokens(user_message)
    input_price, output_price = _pricing(model_name)
    input_cost = _cost(input_tokens, input_price)
    output_cost = _cost(output_tokens, output_price)
    total_cost = round(input_cost + output_cost, 10)
    turn_id = str(uuid4())
    calls = tool_calls or []
    token_usage = {
        "input_tokens": input_tokens,
        "output_tokens": output_tokens,
        "total_tokens": total_tokens,
    }

    record = {
        "schema_version": "1.0",
        "session_id": session_id or f"server-{uuid4()}",
        "user_id": user_id,
        "turn_id": turn_id,
        "timestamp": start_timestamp,
        "start_timestamp": start_timestamp,
        "end_timestamp": end_timestamp,
        "duration_ms": latency_ms,
        "user_message": {
            "timestamp": user_message_timestamp or start_timestamp,
            "content": user_message,
            "input_tokens": user_input_tokens,
            "input_tokens_source": "estimated",
        },
        "assistant_response": {
            "timestamp": assistant_response_timestamp or end_timestamp,
            "content": assistant_response,
            "output_tokens": output_tokens,
            "output_tokens_source": usage.output_tokens_source,
        },
        "token_usage": token_usage,
        "pricing": {
            "model": model_name,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "total_cost": total_cost,
        },
        "cost": {
            "model_name": model_name,
            "input_price_per_1m": input_price,
            "output_price_per_1m": output_price,
            **token_usage,
            "input_cost": input_cost,
            "output_cost": output_cost,
            "total_cost": total_cost,
        },
        "performance": {
            "latency_ms": latency_ms,
            "tool_calls": calls,
            "number_of_tools_used": len(calls),
            "attempts": attempts,
            "status": status,
        },
        "metadata": {
            "route": route,
            "action": action,
            "chosen_ids": chosen_ids or [],
            "is_fallback": is_fallback,
            **(metadata or {}),
        },
    }

    try:
        _append_jsonl(record)
    except Exception as error:
        print("chat log error", error)

    return turn_id
