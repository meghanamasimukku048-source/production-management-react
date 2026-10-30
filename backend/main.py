from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
from datetime import date
import sqlite3
from pathlib import Path

DB = Path(__file__).with_name('production.db')
app = FastAPI(title='Production Management API')
app.add_middleware(CORSMiddleware, allow_origins=['http://localhost:5173'], allow_credentials=True, allow_methods=['*'], allow_headers=['*'])

def conn():
    c=sqlite3.connect(DB); c.row_factory=sqlite3.Row; return c

def init_db():
    with conn() as c:
        c.executescript('''
        CREATE TABLE IF NOT EXISTS sales_orders(id INTEGER PRIMARY KEY AUTOINCREMENT, tran_no TEXT UNIQUE, project TEXT, order_date TEXT, customer TEXT, location TEXT, delivery_date TEXT, status TEXT DEFAULT 'Approved');
        CREATE TABLE IF NOT EXISTS primary_production_orders(id INTEGER PRIMARY KEY AUTOINCREMENT, sequence_no TEXT UNIQUE, location TEXT, project TEXT, customer TEXT, ppo_date TEXT, sales_order TEXT, so_delivery_date TEXT, so_date TEXT, division TEXT, production_status TEXT DEFAULT 'Open', bom_status TEXT DEFAULT 'Open', remarks TEXT, reason_for_reject TEXT DEFAULT '');
        CREATE TABLE IF NOT EXISTS primary_production_fg_lines(id INTEGER PRIMARY KEY AUTOINCREMENT, ppo_id INTEGER, fg_name TEXT, description TEXT, quantity REAL, unit_price REAL, production_value REAL);
        ''')
        if c.execute('SELECT COUNT(*) FROM sales_orders').fetchone()[0] == 0:
            c.executemany('INSERT INTO sales_orders(tran_no,project,order_date,customer,location,delivery_date,status) VALUES(?,?,?,?,?,?,?)',[
                ('SO-0015','Project Alpha','2026-10-25','ABC Pharma Ltd','DAL','2026-11-28','Approved'),
                ('SO-0014','Project Beta','2026-10-22','Volta Green Structures Pvt. Ltd.','PSM','2026-11-28','Approved'),
                ('SO-0013','Project Gamma','2026-10-20','XYZ Construction','DAL','2026-11-20','Approved')])
init_db()

class FGLine(BaseModel):
    fg_name:str; description:str=''; quantity:float; unit_price:float=0
class PPOCreate(BaseModel):
    location:str; project:str; ppo_date:str; sales_order:str; division:str=''; remarks:str=''; lines:List[FGLine]
class PPOUpdate(PPOCreate): pass

def ppo_no(c):
    n=c.execute('SELECT COALESCE(MAX(id),0)+1 FROM primary_production_orders').fetchone()[0]
    return f'PPO-{n:04d}'

def full_ppo(pid):
    with conn() as c:
        h=c.execute('SELECT * FROM primary_production_orders WHERE id=?',(pid,)).fetchone()
        if not h: raise HTTPException(404,'PPO not found')
        lines=c.execute('SELECT * FROM primary_production_fg_lines WHERE ppo_id=? ORDER BY id',(pid,)).fetchall()
        d=dict(h); d['lines']=[dict(x) for x in lines]; return d

@app.get('/api/sales-orders')
def sales_orders():
    with conn() as c: return [dict(x) for x in c.execute("SELECT * FROM sales_orders WHERE status='Approved' ORDER BY id DESC")]
@app.get('/api/ppo')
def list_ppo():
    with conn() as c: return [dict(x) for x in c.execute('SELECT * FROM primary_production_orders ORDER BY id DESC')]
@app.get('/api/ppo/{pid}')
def get_ppo(pid:int): return full_ppo(pid)
@app.post('/api/ppo')
def create_ppo(body:PPOCreate):
    if not body.location or not body.project or not body.sales_order or not body.lines: raise HTTPException(400,'Location, Project, Sales Order and FG Lines are required')
    with conn() as c:
        so=c.execute('SELECT * FROM sales_orders WHERE tran_no=?',(body.sales_order,)).fetchone()
        if not so: raise HTTPException(400,'Sales Order not found')
        seq=ppo_no(c)
        cur=c.execute('''INSERT INTO primary_production_orders(sequence_no,location,project,customer,ppo_date,sales_order,so_delivery_date,so_date,division,production_status,bom_status,remarks) VALUES(?,?,?,?,?,?,?,?,?,'Open','Open',?)''',(seq,body.location,body.project,so['customer'],body.ppo_date,body.sales_order,so['delivery_date'],so['order_date'],body.division,body.remarks))
        pid=cur.lastrowid
        for x in body.lines:
            c.execute('INSERT INTO primary_production_fg_lines(ppo_id,fg_name,description,quantity,unit_price,production_value) VALUES(?,?,?,?,?,?)',(pid,x.fg_name,x.description,x.quantity,x.unit_price,x.quantity*x.unit_price))
    return full_ppo(pid)
@app.put('/api/ppo/{pid}')
def update_ppo(pid:int, body:PPOUpdate):
    with conn() as c:
        old=c.execute('SELECT * FROM primary_production_orders WHERE id=?',(pid,)).fetchone()
        if not old: raise HTTPException(404,'PPO not found')
        if old['production_status']!='Open': raise HTTPException(400,'Only Open PPOs can be modified')
        so=c.execute('SELECT * FROM sales_orders WHERE tran_no=?',(body.sales_order,)).fetchone()
        c.execute('''UPDATE primary_production_orders SET location=?,project=?,customer=?,ppo_date=?,sales_order=?,so_delivery_date=?,so_date=?,division=?,remarks=? WHERE id=?''',(body.location,body.project,so['customer'],body.ppo_date,body.sales_order,so['delivery_date'],so['order_date'],body.division,body.remarks,pid))
        c.execute('DELETE FROM primary_production_fg_lines WHERE ppo_id=?',(pid,))
        for x in body.lines: c.execute('INSERT INTO primary_production_fg_lines(ppo_id,fg_name,description,quantity,unit_price,production_value) VALUES(?,?,?,?,?,?)',(pid,x.fg_name,x.description,x.quantity,x.unit_price,x.quantity*x.unit_price))
    return full_ppo(pid)
@app.post('/api/ppo/{pid}/submit')
def submit(pid:int):
    with conn() as c:
        r=c.execute("UPDATE primary_production_orders SET production_status='Submitted' WHERE id=? AND production_status='Open'",(pid,))
        if r.rowcount==0: raise HTTPException(400,'Only Open PPOs can be submitted')
    return full_ppo(pid)
@app.post('/api/ppo/{pid}/approve')
def approve(pid:int):
    with conn() as c:
        r=c.execute("UPDATE primary_production_orders SET production_status='Approved' WHERE id=? AND production_status='Submitted'",(pid,))
        if r.rowcount==0: raise HTTPException(400,'Only Submitted PPOs can be approved')
    return full_ppo(pid)
