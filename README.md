# Production Management React UI

Modern ERP starter matching the approved UI reference.

## Included
- Dashboard with PPO KPIs
- Sales navigation shell
- Production menu with first 8 processes
- Fully functional Primary Production Order: List, Create, Detail, Modify, Submit, Approve
- FastAPI backend
- SQLite database with sample approved Sales Orders

## Run on Windows / VS Code

### 1. Backend terminal
```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python -m uvicorn main:app --reload --port 8000
```
Backend: http://localhost:8000
API docs: http://localhost:8000/docs

### 2. Frontend terminal
Install Node.js first if `node --version` does not work.
```powershell
cd frontend
npm install
npm run dev
```
Open the Vite URL, normally http://localhost:5173

## Important
This is a separate React/FastAPI project. Do not overwrite the current Streamlit project until you have tested it.
The other seven Production menu pages are prepared as UI shells and can be implemented process-by-process using the same design.
