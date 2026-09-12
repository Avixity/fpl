from __future__ import annotations

from typing import Literal

from fastapi import FastAPI
from pydantic import BaseModel, Field


app = FastAPI(title="FPL analytics", version="1.0.0")


class PlayerFeatures(BaseModel):
    player_id: int
    position_id: int = Field(ge=1, le=4)
    total_points: float = Field(ge=0)
    minutes: float = Field(ge=0)
    starts: float = Field(ge=0)
    completed_gameweeks: int = Field(ge=1)
    form: float = Field(ge=0)
    expected_goals: float = Field(ge=0)
    expected_assists: float = Field(ge=0)
    availability: float = Field(ge=0, le=1)
    fixture_difficulties: list[int] = Field(min_length=1, max_length=5)


class Projection(BaseModel):
    player_id: int
    expected_minutes: float
    expected_points: list[float]
    total: float
    confidence: Literal["high", "medium", "low"]
    model_version: str = "v1.0.0"


def clamp(value: float, minimum: float, maximum: float) -> float:
    return min(maximum, max(minimum, value))


@app.get("/model/health")
def health() -> dict[str, str]:
    return {"status": "ok", "model_version": "v1.0.0"}


@app.post("/model/v1/project-player", response_model=Projection)
def project_player(features: PlayerFeatures) -> Projection:
    average_minutes = clamp(features.minutes / features.completed_gameweeks, 0, 90)
    start_minutes = clamp(features.starts / features.completed_gameweeks, 0, 1) * 90
    expected_minutes = round(clamp((average_minutes * 0.65 + start_minutes * 0.35) * features.availability, 0, 90))
    season_per_90 = features.total_points / features.minutes * 90 if features.minutes else 0
    xg_per_90 = features.expected_goals / features.minutes * 90 if features.minutes else 0
    xa_per_90 = features.expected_assists / features.minutes * 90 if features.minutes else 0
    goal_points = 4 if features.position_id == 4 else 5 if features.position_id == 3 else 6
    base_rate = season_per_90 * 0.55 + features.form * 0.30 + (xg_per_90 * goal_points + xa_per_90 * 3) * 0.15
    points = [round(max(0, base_rate * expected_minutes / 90 * (1 + (3 - difficulty) * 0.1)), 1) for difficulty in features.fixture_difficulties]
    confidence: Literal["high", "medium", "low"] = "high" if expected_minutes >= 75 and features.availability >= 0.95 else "medium" if expected_minutes >= 50 and features.availability >= 0.6 else "low"
    return Projection(player_id=features.player_id, expected_minutes=expected_minutes, expected_points=points, total=round(sum(points), 1), confidence=confidence)
