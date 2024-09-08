from fastapi import FastAPI
from pydantic import BaseModel
from basescript import returnResponse
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

# Allow all origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows all origins
    allow_credentials=True,
    allow_methods=["*"],  # Allows all HTTP methods
    allow_headers=["*"],  # Allows all headers
)
# Define a Pydantic model for the incoming JSON data
class Item(BaseModel):
    ID: str
    query: str


@app.post("/items/")
async def fetchResponse(item: Item):
    rseponse = returnResponse(item.query, item.ID)
    return {"response": rseponse}
