from time import perf_counter

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .catalog import ATTRACTIONS_BY_ID, build_menu
from .gemini import MODEL, ask_gemini, system_prompt
from .logging_service import TokenUsage, displayed_assistant_text, estimate_tokens, log_chat_turn, now_utc
from .models import LogTurnRequest, PlanRequest, PlanResponse

app = FastAPI(title="VinWonders Scheduler API")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MENU = build_menu()


def fallback_response() -> PlanResponse:
    return PlanResponse(
        action="clarify",
        assistantText="Xin lỗi, mình gặp trục trặc khi xử lý. Bạn thử nói lại yêu cầu ngắn gọn hơn nhé?",
        clarifyQuestion="Bạn muốn chơi từ mấy giờ tới mấy giờ, đoàn có trẻ nhỏ không?",
    )


def _last_user_message(request: PlanRequest) -> str:
    for message in reversed(request.messages):
        if message.role == "user":
            return message.text
    return ""


def _aggregate_input_text(request: PlanRequest) -> str:
    message_text = "\n".join(f"{message.role}: {message.text}" for message in request.messages)
    return f"{system_prompt(MENU)}\n{message_text}\nLịch hiện tại:\n{request.itinerarySummary or '(chưa có)'}"


def _log_plan_turn(
    *,
    request: PlanRequest,
    output: PlanResponse,
    start_timestamp: str,
    end_timestamp: str,
    latency_ms: int,
    attempts: int,
    status: str,
    is_fallback: bool,
    usage: TokenUsage | None = None,
) -> None:
    log_chat_turn(
        session_id=request.sessionId,
        user_id=request.userId,
        start_timestamp=start_timestamp,
        end_timestamp=end_timestamp,
        latency_ms=latency_ms,
        user_message=_last_user_message(request),
        assistant_response=displayed_assistant_text(output.assistantText, output.clarifyQuestion),
        model_name=MODEL,
        usage=usage,
        aggregate_input_text=_aggregate_input_text(request),
        user_message_timestamp=request.clientTurnStartedAt or start_timestamp,
        tool_calls=[],
        attempts=attempts,
        status=status,
        route="/api/plan",
        action=output.action,
        chosen_ids=output.chosenIds,
        is_fallback=is_fallback,
    )


@app.post("/api/plan", response_model=PlanResponse, response_model_exclude_none=True)
def plan(request: PlanRequest) -> PlanResponse:
    start_timestamp = now_utc()
    started = perf_counter()
    attempts = 0
    try:
        output: PlanResponse | None = None
        usage: TokenUsage | None = None
        for attempt in range(2):
            attempts = attempt + 1
            try:
                result = ask_gemini(request.messages, request.itinerarySummary, MENU)
                output = result.plan
                usage = result.usage
                if output.chosenIds:
                    output.chosenIds = [
                        attraction_id
                        for attraction_id in output.chosenIds
                        if attraction_id in ATTRACTIONS_BY_ID
                    ]
                break
            except Exception:
                if attempt == 1:
                    raise
        output = output or fallback_response()
        end_timestamp = now_utc()
        _log_plan_turn(
            request=request,
            output=output,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            latency_ms=round((perf_counter() - started) * 1000),
            attempts=attempts,
            status="success",
            is_fallback=False,
            usage=usage,
        )
        return output
    except Exception as error:
        print("plan error", error)
        output = fallback_response()
        end_timestamp = now_utc()
        _log_plan_turn(
            request=request,
            output=output,
            start_timestamp=start_timestamp,
            end_timestamp=end_timestamp,
            latency_ms=round((perf_counter() - started) * 1000),
            attempts=attempts or 1,
            status="error",
            is_fallback=True,
        )
        return output


@app.post("/api/log-turn")
def log_turn(request: LogTurnRequest) -> dict[str, str]:
    start_timestamp = request.startTimestamp or request.userMessage.timestamp or now_utc()
    end_timestamp = request.endTimestamp or request.assistantResponse.timestamp or now_utc()
    latency_ms = request.latencyMs if request.latencyMs is not None else 0
    turn_id = log_chat_turn(
        session_id=request.sessionId,
        user_id=request.userId,
        start_timestamp=start_timestamp,
        end_timestamp=end_timestamp,
        latency_ms=latency_ms,
        user_message=request.userMessage.content,
        assistant_response=request.assistantResponse.content,
        model_name=request.modelName,
        usage=TokenUsage(
            input_tokens=estimate_tokens(request.userMessage.content),
            output_tokens=estimate_tokens(request.assistantResponse.content),
            input_tokens_source="estimated",
            output_tokens_source="estimated",
        ),
        user_message_timestamp=request.userMessage.timestamp,
        assistant_response_timestamp=request.assistantResponse.timestamp,
        tool_calls=request.toolCalls,
        attempts=0,
        status="success",
        route="/api/log-turn",
        metadata={"source": "frontend-local"},
    )
    return {"status": "ok", "turn_id": turn_id}
