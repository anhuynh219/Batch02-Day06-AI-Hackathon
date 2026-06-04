from typing import Literal

from pydantic import BaseModel, Field


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    text: str


class PlanRequest(BaseModel):
    messages: list[ChatMessage] = Field(default_factory=list)
    itinerarySummary: str = ""
    sessionId: str | None = None
    userId: str | None = None
    clientTurnStartedAt: str | None = None


class LogMessage(BaseModel):
    timestamp: str | None = None
    content: str


class LogTurnRequest(BaseModel):
    sessionId: str | None = None
    userId: str | None = None
    startTimestamp: str | None = None
    endTimestamp: str | None = None
    latencyMs: int | None = None
    userMessage: LogMessage
    assistantResponse: LogMessage
    modelName: str = "local-catalog-info"
    toolCalls: list[str] = Field(default_factory=list)


class Meal(BaseModel):
    type: Literal["lunch", "dinner", "snack"]
    around: str


class UserConstraints(BaseModel):
    arrivalTime: str | None = None
    departureTime: str | None = None
    groupSize: float | None = None
    hasKids: bool | None = None
    prefs: list[str] | None = None
    meals: list[Meal] | None = None
    mustDo: list[str] | None = None
    avoid: list[str] | None = None


class PlanResponse(BaseModel):
    action: Literal["plan", "edit", "clarify"]
    constraints: UserConstraints | None = None
    chosenIds: list[str] | None = None
    clarifyQuestion: str | None = None
    assistantText: str
