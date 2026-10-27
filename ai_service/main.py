# ai_service/main.py
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field
import asyncio
import time

app = FastAPI(title="Flyo AI Agent Service")

# Pydantic is Python's version of Zod (validation)
class TravelQuery(BaseModel):
    prompt: str = Field(..., min_length=5, max_length=2000)
    maxBudgetINR: float | None = Field(None, gt=0, le=1_000_000)

class TravelResult(BaseModel):
    itinerary: str
    status: str

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "python-ai-agent"}

@app.post("/generate", response_model=TravelResult)
async def generate_itinerary(query: TravelQuery):
    # Simulate LLM processing time
    await asyncio.sleep(0.5) 
    
    # Simulate a GenAI response
    itinerary = f"Python GenAI Agent: 3-Day Plan for '{query.prompt}' with budget {query.maxBudgetINR or 'unlimited'} INR."
    
    return TravelResult(itinerary=itinerary, status="SUCCESS")
