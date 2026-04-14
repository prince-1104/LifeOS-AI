# TrackerAgent System Architecture

This document describes the implemented functionalities and system architecture up to date, focusing primarily on the AI agent workflows and the orchestration layer.

## System Overview

TrackerAgent is a multi-agent personal life assistant designed to process natural language inputs, classify their intent, and route them to relevant specific agents for data creation or extraction. 

**Tech Stack:**
- **Frontend:** Next.js (React), Clerk (Authentication)
- **Backend:** FastAPI (Python), SQLAlchemy (Async), Uvicorn
- **Databases:** PostgreSQL (Relational data, logging, financial data), Qdrant (Vector database for semantic memory search)
- **AI Models:** Large Language Models (e.g., OpenAI via `AsyncOpenAI`) handling intent classification and data extraction.

---

## Capabilities & Functionalities

At this moment, the system is capable of understanding four main types of user inputs, each handled by its own agent:

1. **Finance Tracking (`Finance Agent`)**
   - **Functionality**: Tracks income and expenses. It can infer the transaction type (income/expense) and extract details like amount, categories (e.g., "food"), and sources/payees (e.g., "from sumit", "to gym").
   - **Storage**: Data is saved to PostgreSQL.

2. **Memory Management (`Memory Agent`)**
   - **Functionality**: Stores generic facts, notes, and context. It extracts the raw content and generates relevant thematic "tags" for the memory.
   - **Storage**: Data is stored both in PostgreSQL (for raw tracking) and Qdrant (for vector-based semantic search).

3. **Query/Retrieval (`Query Agent`)**
   - **Functionality**: Re-surfaces saved memories and queries financial data. 
   - **Features**: 
     - Evaluates queries for financial intent (e.g., "how much did I spend today?", "what are my top spending categories?").
     - Performs semantic searches through Qdrant vector memory for non-finance-related context queries (e.g., "where are my keys?"). It filters, matches against stopwords, and deduplicates identical contents.

4. **Task Reminders (`Reminder Agent`)**
   - **Functionality**: Schedules reminders by extracting the task and the associated time based on the user's specific timezone.
   - **Storage/Execution**: Saved to PostgreSQL and processed by an internal scheduler (`reminder_scheduler.py`) that monitors and executes alarms.

---

## Orchestrator & Agent Workflow

The core magic of TrackerAgent lies in how it seamlessly classifies natural language and routes it to specific components, minimizing excessive LLM calls (managing optimal latency and cost) through a robust pipeline.

### 1. User Input -> Process Service (`services/process_service.py`)
- User inputs trigger the `/process` endpoint.
- Validates the input length, handles rate-limiting checks, and ensures empty messages are rejected. 
- Dispatches the input to the Orchestrator.

### 2. Orchestrator (`orchestrator_llm.py`)
- **Single Prompt LLM Classification**: The orchestrator is completely powered by a single LLM call. Instead of generating text or chaining multiple models, it's strictly instructed via a `SYSTEM PROMPT` to return **structured JSON**.
- **Intent & Payload Extraction**: It classifies the "intent/type" (`memory`, `query`, `finance`, `reminder`, or `unknown`). Crucially, in the same pass, it extracts agent-specific payloads:
  - If Finance: Extracts `amount`, `transaction_type`, `category`, and `source`.
  - If Memory: Extracts `content` and `tags`.
  - If Reminder: Extracts `time` and `task`.
- **Latency Optimization**: By extracting schemas concurrently with classification, the system dramatically reduces processing time because downstream agents largely do not need to call the LLM themselves to parse entities.
- Converts the JSON into a strongly typed Pydantic `OrchestratorOutput` schema.

### 3. Router (`orchestrator/router.py`)
- The output from the Orchestrator hits the Router. 
- Depending on the `OrchestratorOutput.type`, the router triggers `.process()` on the appropriate Agent, passing along the DB connection, user ID, user timezone, and the extracted orchestrator context.

### 4. Agents Processing (`agents/`)
Agents receive the structured request, meaning they execute mostly deterministic, rigid logic rather than invoking further probabilistic AI behavior.

* **Finance Agent (`finance_agent.py`)**: Checks the `OrchestratorOutput` for finance-related parameters. Uses a few regex fallbacks for `infer_transaction_type` and `extract_source` if the orchestrator missed them. Inserts into the DB.
* **Memory Agent (`memory_agent.py`)**: Uses the `content` and `tags` provided by the Orchestrator to bypass secondary parsing LLMs, directly passing the payload to Qdrant memory storage.
* **Query Agent (`query_agent.py`)**: Employs heuristic logic (`_is_week_spend_intent`, `_is_top_categories_intent`) to identify if it can resolve the query explicitly via precise PostgreSQL SQL queries, avoiding embeddings altogether for concrete financial questions. If not financial, queries the vector database payload for textual chunks. 
* **Reminder Agent (`reminder_agent.py`)**: Takes the orchestrator's explicit `task` and uses a localized time parser with timezone awareness to save the task.

### 5. Bubbling Up & Response Handling
Once the agent finishes its logic (often taking <50ms since it's just DB IO), the execution trickles backward.
- The outcome message (`response_text`) and the type are returned to `process_service.py`.
- Everything is encapsulated inside a `ProcessResponseEnvelope` alongside performance metadata (`latency_ms_total`), and sent back to the client.

## System Logging

All interaction steps are rigorously logged to PostgreSQL:
- **`log_orchestrator_step`**: Tracks what the LLM orchestrator saw and decided, and how many milliseconds it took.
- **`log_agent_step`**: Tracks the action and latency of the agent component.
- **`log_error` / `log_query`**: Saves anomalies and the final response metadata for historical reference and system improvements.
