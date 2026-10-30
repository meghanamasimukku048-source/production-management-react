from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import sqlite3
from pathlib import Path


# ============================================================
# DATABASE
# ============================================================

DB = Path(__file__).with_name("production.db")


# ============================================================
# FASTAPI APP
# ============================================================

app = FastAPI(
    title="Production Management API",
    version="1.0.0"
)


# ============================================================
# CORS
# Allows React localhost + Render frontend
# ============================================================

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://production-management-ui.onrender.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============================================================
# DATABASE CONNECTION
# ============================================================

def conn():
    connection = sqlite3.connect(DB)
    connection.row_factory = sqlite3.Row
    return connection


# ============================================================
# INITIALIZE DATABASE
# ============================================================

def init_db():

    with conn() as c:

        c.executescript(
            """
            CREATE TABLE IF NOT EXISTS sales_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tran_no TEXT UNIQUE,
                project TEXT,
                order_date TEXT,
                customer TEXT,
                location TEXT,
                delivery_date TEXT,
                status TEXT DEFAULT 'Approved'
            );


            CREATE TABLE IF NOT EXISTS primary_production_orders (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sequence_no TEXT UNIQUE,
                location TEXT,
                project TEXT,
                customer TEXT,
                ppo_date TEXT,
                sales_order TEXT,
                so_delivery_date TEXT,
                so_date TEXT,
                division TEXT,
                production_status TEXT DEFAULT 'Open',
                bom_status TEXT DEFAULT 'Open',
                remarks TEXT,
                reason_for_reject TEXT DEFAULT ''
            );


            CREATE TABLE IF NOT EXISTS primary_production_fg_lines (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                ppo_id INTEGER,
                fg_name TEXT,
                description TEXT,
                quantity REAL,
                unit_price REAL,
                production_value REAL,
                FOREIGN KEY (ppo_id)
                    REFERENCES primary_production_orders(id)
            );
            """
        )

        # ----------------------------------------------------
        # SAMPLE APPROVED SALES ORDERS
        # ----------------------------------------------------

        count = c.execute(
            "SELECT COUNT(*) FROM sales_orders"
        ).fetchone()[0]

        if count == 0:

            c.executemany(
                """
                INSERT INTO sales_orders
                (
                    tran_no,
                    project,
                    order_date,
                    customer,
                    location,
                    delivery_date,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                [
                    (
                        "SO-0015",
                        "Project Alpha",
                        "2026-10-25",
                        "ABC Pharma Ltd",
                        "DAL",
                        "2026-11-28",
                        "Approved",
                    ),
                    (
                        "SO-0014",
                        "Project Beta",
                        "2026-10-22",
                        "Volta Green Structures Pvt. Ltd.",
                        "PSM",
                        "2026-11-28",
                        "Approved",
                    ),
                    (
                        "SO-0013",
                        "Project Gamma",
                        "2026-10-20",
                        "XYZ Construction",
                        "DAL",
                        "2026-11-20",
                        "Approved",
                    ),
                ],
            )


init_db()


# ============================================================
# PYDANTIC MODELS
# ============================================================

class FGLine(BaseModel):
    fg_name: str
    description: str = ""
    quantity: float
    unit_price: float = 0


class PPOCreate(BaseModel):
    location: str
    project: str
    ppo_date: str
    sales_order: str
    division: str = ""
    remarks: str = ""
    lines: List[FGLine]


class PPOUpdate(PPOCreate):
    pass


# ============================================================
# HELPER FUNCTIONS
# ============================================================

def generate_ppo_no(c):

    next_id = c.execute(
        """
        SELECT COALESCE(MAX(id), 0) + 1
        FROM primary_production_orders
        """
    ).fetchone()[0]

    return f"PPO-{next_id:04d}"


def get_full_ppo(pid):

    with conn() as c:

        header = c.execute(
            """
            SELECT *
            FROM primary_production_orders
            WHERE id = ?
            """,
            (pid,),
        ).fetchone()

        if not header:
            raise HTTPException(
                status_code=404,
                detail="PPO not found"
            )

        lines = c.execute(
            """
            SELECT *
            FROM primary_production_fg_lines
            WHERE ppo_id = ?
            ORDER BY id
            """,
            (pid,),
        ).fetchall()

        result = dict(header)

        result["lines"] = [
            dict(line)
            for line in lines
        ]

        return result


# ============================================================
# ROOT / HEALTH CHECK
# ============================================================

@app.get("/")
def root():

    return {
        "status": "success",
        "message": "Production Management API is running"
    }


@app.get("/api/health")
def health():

    return {
        "status": "ok"
    }


# ============================================================
# SALES ORDERS
# ============================================================

@app.get("/api/sales-orders")
def get_sales_orders():

    with conn() as c:

        rows = c.execute(
            """
            SELECT *
            FROM sales_orders
            WHERE status = 'Approved'
            ORDER BY id DESC
            """
        ).fetchall()

        return [
            dict(row)
            for row in rows
        ]


# ============================================================
# PPO LIST
# ============================================================

@app.get("/api/ppo")
def list_ppo():

    with conn() as c:

        rows = c.execute(
            """
            SELECT *
            FROM primary_production_orders
            ORDER BY id DESC
            """
        ).fetchall()

        return [
            dict(row)
            for row in rows
        ]


# ============================================================
# PPO DETAIL
# ============================================================

@app.get("/api/ppo/{pid}")
def get_ppo(pid: int):

    return get_full_ppo(pid)


# ============================================================
# CREATE PPO
#
# SAVE
#   ↓
# Production Status = Open
# BOM Status = Open
# ============================================================

@app.post("/api/ppo")
def create_ppo(body: PPOCreate):

    # --------------------------------------------------------
    # Header validation
    # --------------------------------------------------------

    if not body.location.strip():
        raise HTTPException(
            status_code=400,
            detail="Location is required"
        )

    if not body.project.strip():
        raise HTTPException(
            status_code=400,
            detail="Project is required"
        )

    if not body.ppo_date.strip():
        raise HTTPException(
            status_code=400,
            detail="PPO Date is required"
        )

    if not body.sales_order.strip():
        raise HTTPException(
            status_code=400,
            detail="Sales Order is required"
        )

    if not body.lines:
        raise HTTPException(
            status_code=400,
            detail="At least one FG Line is required"
        )

    # --------------------------------------------------------
    # FG line validation
    # --------------------------------------------------------

    for index, line in enumerate(body.lines, start=1):

        if not line.fg_name.strip():

            raise HTTPException(
                status_code=400,
                detail=f"FG Name is required in line {index}"
            )

        if line.quantity <= 0:

            raise HTTPException(
                status_code=400,
                detail=f"Quantity must be greater than zero in line {index}"
            )

        if line.unit_price < 0:

            raise HTTPException(
                status_code=400,
                detail=f"Unit Price cannot be negative in line {index}"
            )

    # --------------------------------------------------------
    # Save PPO
    # --------------------------------------------------------

    with conn() as c:

        sales_order = c.execute(
            """
            SELECT *
            FROM sales_orders
            WHERE tran_no = ?
            AND status = 'Approved'
            """,
            (body.sales_order,),
        ).fetchone()

        if not sales_order:

            raise HTTPException(
                status_code=400,
                detail="Approved Sales Order not found"
            )

        sequence_no = generate_ppo_no(c)

        cursor = c.execute(
            """
            INSERT INTO primary_production_orders
            (
                sequence_no,
                location,
                project,
                customer,
                ppo_date,
                sales_order,
                so_delivery_date,
                so_date,
                division,
                production_status,
                bom_status,
                remarks
            )
            VALUES
            (
                ?, ?, ?, ?, ?, ?, ?, ?, ?,
                'Open',
                'Open',
                ?
            )
            """,
            (
                sequence_no,
                body.location,
                body.project,
                sales_order["customer"],
                body.ppo_date,
                body.sales_order,
                sales_order["delivery_date"],
                sales_order["order_date"],
                body.division,
                body.remarks,
            ),
        )

        pid = cursor.lastrowid

        for line in body.lines:

            production_value = (
                line.quantity *
                line.unit_price
            )

            c.execute(
                """
                INSERT INTO primary_production_fg_lines
                (
                    ppo_id,
                    fg_name,
                    description,
                    quantity,
                    unit_price,
                    production_value
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    pid,
                    line.fg_name,
                    line.description,
                    line.quantity,
                    line.unit_price,
                    production_value,
                ),
            )

        c.commit()

    return get_full_ppo(pid)


# ============================================================
# MODIFY PPO
#
# Only OPEN PPO can be modified
# ============================================================

@app.put("/api/ppo/{pid}")
def update_ppo(pid: int, body: PPOUpdate):

    if not body.location.strip():
        raise HTTPException(
            status_code=400,
            detail="Location is required"
        )

    if not body.project.strip():
        raise HTTPException(
            status_code=400,
            detail="Project is required"
        )

    if not body.sales_order.strip():
        raise HTTPException(
            status_code=400,
            detail="Sales Order is required"
        )

    if not body.lines:
        raise HTTPException(
            status_code=400,
            detail="At least one FG Line is required"
        )

    for index, line in enumerate(body.lines, start=1):

        if not line.fg_name.strip():

            raise HTTPException(
                status_code=400,
                detail=f"FG Name is required in line {index}"
            )

        if line.quantity <= 0:

            raise HTTPException(
                status_code=400,
                detail=f"Quantity must be greater than zero in line {index}"
            )

    with conn() as c:

        old = c.execute(
            """
            SELECT *
            FROM primary_production_orders
            WHERE id = ?
            """,
            (pid,),
        ).fetchone()

        if not old:

            raise HTTPException(
                status_code=404,
                detail="PPO not found"
            )

        if old["production_status"] != "Open":

            raise HTTPException(
                status_code=400,
                detail="Only Open PPOs can be modified"
            )

        sales_order = c.execute(
            """
            SELECT *
            FROM sales_orders
            WHERE tran_no = ?
            AND status = 'Approved'
            """,
            (body.sales_order,),
        ).fetchone()

        if not sales_order:

            raise HTTPException(
                status_code=400,
                detail="Approved Sales Order not found"
            )

        c.execute(
            """
            UPDATE primary_production_orders

            SET
                location = ?,
                project = ?,
                customer = ?,
                ppo_date = ?,
                sales_order = ?,
                so_delivery_date = ?,
                so_date = ?,
                division = ?,
                remarks = ?

            WHERE id = ?
            """,
            (
                body.location,
                body.project,
                sales_order["customer"],
                body.ppo_date,
                body.sales_order,
                sales_order["delivery_date"],
                sales_order["order_date"],
                body.division,
                body.remarks,
                pid,
            ),
        )

        # Delete existing FG lines

        c.execute(
            """
            DELETE FROM primary_production_fg_lines
            WHERE ppo_id = ?
            """,
            (pid,),
        )

        # Insert modified FG lines

        for line in body.lines:

            production_value = (
                line.quantity *
                line.unit_price
            )

            c.execute(
                """
                INSERT INTO primary_production_fg_lines
                (
                    ppo_id,
                    fg_name,
                    description,
                    quantity,
                    unit_price,
                    production_value
                )
                VALUES (?, ?, ?, ?, ?, ?)
                """,
                (
                    pid,
                    line.fg_name,
                    line.description,
                    line.quantity,
                    line.unit_price,
                    production_value,
                ),
            )

        c.commit()

    return get_full_ppo(pid)


# ============================================================
# SUBMIT PPO
#
# Open → Submitted
# ============================================================

@app.post("/api/ppo/{pid}/submit")
def submit_ppo(pid: int):

    with conn() as c:

        existing = c.execute(
            """
            SELECT *
            FROM primary_production_orders
            WHERE id = ?
            """,
            (pid,),
        ).fetchone()

        if not existing:

            raise HTTPException(
                status_code=404,
                detail="PPO not found"
            )

        if existing["production_status"] != "Open":

            raise HTTPException(
                status_code=400,
                detail="Only Open PPOs can be submitted"
            )

        c.execute(
            """
            UPDATE primary_production_orders

            SET production_status = 'Submitted'

            WHERE id = ?
            """,
            (pid,),
        )

        c.commit()

    return get_full_ppo(pid)


# ============================================================
# APPROVE PPO
#
# Submitted → Approved
# ============================================================

@app.post("/api/ppo/{pid}/approve")
def approve_ppo(pid: int):

    with conn() as c:

        existing = c.execute(
            """
            SELECT *
            FROM primary_production_orders
            WHERE id = ?
            """,
            (pid,),
        ).fetchone()

        if not existing:

            raise HTTPException(
                status_code=404,
                detail="PPO not found"
            )

        if existing["production_status"] != "Submitted":

            raise HTTPException(
                status_code=400,
                detail="Only Submitted PPOs can be approved"
            )

        c.execute(
            """
            UPDATE primary_production_orders

            SET production_status = 'Approved'

            WHERE id = ?
            """,
            (pid,),
        )

        c.commit()

    return get_full_ppo(pid)