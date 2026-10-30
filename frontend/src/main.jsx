import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  LayoutDashboard,
  ShoppingCart,
  Factory,
  Package,
  FileText,
  Settings,
  Bell,
  Plus,
  Search,
  Eye,
  ArrowLeft,
  Save,
  Send,
  CheckCircle2,
  Pencil,
  Trash2
} from 'lucide-react';

import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';

import './styles.css';

const API = 'https://production-management-api-sz9d.onrender.com/api';

const menu = [
  'Primary Production Order',
  'Manufacturing Production Order',
  'Production Order',
  'BOM',
  'PrepForMRP',
  'MRP',
  'Planned Order',
  'Approve Stock Reservations'
];

const emptyLine = () => ({
  fg_name: '',
  description: '',
  quantity: 1,
  unit_price: 0
});

const STATUS_COLORS = {
  Open: '#2563eb',
  Submitted: '#f59e0b',
  Approved: '#16a34a'
};

function Badge({ s }) {
  if (!s) return null;

  return (
    <span className={'badge ' + s.toLowerCase()}>
      {s}
    </span>
  );
}

function App() {
  const [page, setPage] = useState('Dashboard');
  const [ppos, setPpos] = useState([]);
  const [sos, setSos] = useState([]);
  const [selected, setSelected] = useState(null);
  const [edit, setEdit] = useState(false);
  const [search, setSearch] = useState('');
  const [dashboardFilter, setDashboardFilter] = useState('All');

  const [form, setForm] = useState({
    location: 'DAL',
    project: '',
    ppo_date: new Date().toISOString().slice(0, 10),
    sales_order: '',
    division: 'CEMENT',
    remarks: '',
    lines: [emptyLine()]
  });

  const load = async () => {
    try {
      const ppoResponse = await fetch(API + '/ppo');
      const soResponse = await fetch(API + '/sales-orders');

      if (!ppoResponse.ok) {
        throw new Error('Unable to load PPO records');
      }

      if (!soResponse.ok) {
        throw new Error('Unable to load Sales Orders');
      }

      const ppoData = await ppoResponse.json();
      const soData = await soResponse.json();

      setPpos(ppoData);
      setSos(soData);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const nav = (p) => {
    setPage(p);
    setSelected(null);
    setEdit(false);
  };

  const chooseSO = (value) => {
    const so = sos.find((x) => x.tran_no === value);

    setForm((f) => ({
      ...f,
      sales_order: value,
      project: so?.project || f.project,
      location: so?.location || f.location
    }));
  };

  const create = () => {
    setForm({
      location: 'DAL',
      project: '',
      ppo_date: new Date().toISOString().slice(0, 10),
      sales_order: '',
      division: 'CEMENT',
      remarks: '',
      lines: [emptyLine()]
    });

    setSelected(null);
    setEdit(false);
    setPage('Create PPO');
  };

  const save = async () => {
    let url = API + '/ppo';
    let method = 'POST';

    if (selected) {
      url = API + '/ppo/' + selected.id;
      method = 'PUT';
    }

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(form)
      });

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.detail || 'Unable to save PPO');
        return;
      }

      await load();
      nav('Primary Production Order');
    } catch (error) {
      console.error(error);
      alert('Unable to connect to the API.');
    }
  };

  const detail = async (id) => {
    try {
      const response = await fetch(API + '/ppo/' + id);

      if (!response.ok) {
        alert('Unable to load PPO details.');
        return;
      }

      const data = await response.json();

      setSelected(data);
      setPage('PPO Detail');
    } catch (error) {
      console.error(error);
      alert('Unable to connect to the API.');
    }
  };

  const action = async (actionName) => {
    if (!selected) return;

    try {
      const response = await fetch(
        API + '/ppo/' + selected.id + '/' + actionName,
        {
          method: 'POST'
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        alert(errorData.detail || 'Unable to perform action');
        return;
      }

      const data = await response.json();

      setSelected(data);
      await load();
    } catch (error) {
      console.error(error);
      alert('Unable to connect to the API.');
    }
  };

  const modify = () => {
    if (!selected) return;

    setForm({
      location: selected.location,
      project: selected.project,
      ppo_date: selected.ppo_date,
      sales_order: selected.sales_order,
      division: selected.division || '',
      remarks: selected.remarks || '',
      lines: (selected.lines || []).map((x) => ({
        fg_name: x.fg_name,
        description: x.description,
        quantity: x.quantity,
        unit_price: x.unit_price
      }))
    });

    setEdit(true);
    setPage('Create PPO');
  };

  const stats = useMemo(() => {
    return {
      total: ppos.length,

      open: ppos.filter(
        (x) => x.production_status === 'Open'
      ).length,

      submitted: ppos.filter(
        (x) => x.production_status === 'Submitted'
      ).length,

      approved: ppos.filter(
        (x) => x.production_status === 'Approved'
      ).length
    };
  }, [ppos]);

  const chartData = useMemo(() => {
    return [
      {
        name: 'Open',
        value: stats.open
      },
      {
        name: 'Submitted',
        value: stats.submitted
      },
      {
        name: 'Approved',
        value: stats.approved
      }
    ];
  }, [stats]);

  const dashboardRows = useMemo(() => {
    if (dashboardFilter === 'All') {
      return ppos;
    }

    return ppos.filter(
      (x) => x.production_status === dashboardFilter
    );
  }, [ppos, dashboardFilter]);

  const handlePieClick = (data) => {
    if (data && data.name) {
      setDashboardFilter(data.name);
    }
  };

  return (
    <div className="app">
      <aside>
        <div className="brand">
          ◉ ABC Company
        </div>

        <button
          className={page === 'Dashboard' ? 'active' : ''}
          onClick={() => nav('Dashboard')}
        >
          <LayoutDashboard />
          Dashboard
        </button>

        <button>
          <ShoppingCart />
          Sales
        </button>

        <div className="group">
          <b>
            <Factory /> Production
          </b>

          {menu.map((m) => (
            <button
              className={page === m ? 'active' : ''}
              onClick={() => nav(m)}
              key={m}
            >
              {m}
            </button>
          ))}
        </div>

        <button>
          <Package />
          Inventory
        </button>

        <button>
          <FileText />
          Reports
        </button>

        <button>
          <Settings />
          Settings
        </button>
      </aside>

      <main>
        <header>
          <div className="global">
            Search for transactions, orders, or reports...
          </div>

          <Bell />

          <div className="avatar">
            A
          </div>

          <b>Admin</b>
        </header>

        <section className="content">

          {page === 'Dashboard' && (
            <>
              <h1>Production Management</h1>

              <p className="muted">
                Overview of your production activities
              </p>

              <div className="cards">
                <Card
                  n={stats.total}
                  t="Total PPOs"
                  active={dashboardFilter === 'All'}
                  onClick={() => setDashboardFilter('All')}
                />

                <Card
                  n={stats.open}
                  t="Open"
                  active={dashboardFilter === 'Open'}
                  onClick={() => setDashboardFilter('Open')}
                />

                <Card
                  n={stats.submitted}
                  t="Submitted"
                  active={dashboardFilter === 'Submitted'}
                  onClick={() => setDashboardFilter('Submitted')}
                />

                <Card
                  n={stats.approved}
                  t="Approved"
                  active={dashboardFilter === 'Approved'}
                  onClick={() => setDashboardFilter('Approved')}
                />
              </div>

              <div
                className="panel"
                style={{ marginTop: '20px' }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '20px'
                  }}
                >
                  <div>
                    <h2>PPO Status Distribution</h2>

                    <p className="muted">
                      Click Open, Submitted or Approved in the chart
                      to view those PPO records.
                    </p>
                  </div>

                  {dashboardFilter !== 'All' && (
                    <button
                      onClick={() => setDashboardFilter('All')}
                    >
                      Show All PPOs
                    </button>
                  )}
                </div>

                <div
                  style={{
                    width: '100%',
                    height: '340px'
                  }}
                >
                  <ResponsiveContainer
                    width="100%"
                    height="100%"
                  >
                    <PieChart>
                      <Pie
                        data={chartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={120}
                        paddingAngle={3}
                        onClick={handlePieClick}
                        label={({ name, value }) =>
                          name + ': ' + value
                        }
                      >
                        {chartData.map((entry) => (
                          <Cell
                            key={entry.name}
                            fill={STATUS_COLORS[entry.name]}
                            opacity={
                              dashboardFilter === 'All' ||
                              dashboardFilter === entry.name
                                ? 1
                                : 0.3
                            }
                            style={{
                              cursor: 'pointer'
                            }}
                          />
                        ))}
                      </Pie>

                      <Tooltip />

                      <Legend
                        onClick={(entry) => {
                          if (entry && entry.value) {
                            setDashboardFilter(entry.value);
                          }
                        }}
                        wrapperStyle={{
                          cursor: 'pointer'
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="panel">
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '15px'
                  }}
                >
                  <h2>
                    {dashboardFilter === 'All'
                      ? 'All Primary Production Orders'
                      : dashboardFilter +
                        ' Primary Production Orders'}
                  </h2>

                  <strong>
                    Records: {dashboardRows.length}
                  </strong>
                </div>

                <PTable
                  rows={dashboardRows}
                  detail={detail}
                />
              </div>
            </>
          )}

          {page === 'Primary Production Order' && (
            <>
              <div className="titlebar">
                <div>
                  <h1>Primary Production Orders</h1>

                  <p className="muted">
                    Manage and track primary production orders
                  </p>
                </div>

                <button
                  className="primary"
                  onClick={create}
                >
                  <Plus />
                  Create
                </button>
              </div>

              <div className="filters">
                <Search />

                <input
                  placeholder="Search PPO, Project, Sales Order..."
                  value={search}
                  onChange={(e) =>
                    setSearch(e.target.value)
                  }
                />
              </div>

              <div className="panel">
                <PTable
                  rows={ppos.filter((x) =>
                    JSON.stringify(x)
                      .toLowerCase()
                      .includes(search.toLowerCase())
                  )}
                  detail={detail}
                />
              </div>
            </>
          )}

          {page === 'Create PPO' && (
            <Create
              form={form}
              setForm={setForm}
              sos={sos}
              chooseSO={chooseSO}
              save={save}
              back={() =>
                selected
                  ? setPage('PPO Detail')
                  : nav('Primary Production Order')
              }
              edit={edit}
            />
          )}

          {page === 'PPO Detail' && selected && (
            <Detail
              p={selected}
              back={() => nav('Primary Production Order')}
              modify={modify}
              submit={() => action('submit')}
              approve={() => action('approve')}
            />
          )}

          {menu.includes(page) &&
            page !== 'Primary Production Order' && (
              <div className="panel">
                <h1>{page}</h1>

                <p className="muted">
                  Module shell is ready. This process will be
                  implemented using the same ERP design system.
                </p>
              </div>
            )}

        </section>
      </main>
    </div>
  );
}

function Card({
  n,
  t,
  active = false,
  onClick
}) {
  return (
    <div
      className="card"
      onClick={onClick}
      style={{
        cursor: 'pointer',
        border: active
          ? '2px solid #2563eb'
          : undefined,
        transform: active
          ? 'translateY(-2px)'
          : undefined,
        transition: '0.2s'
      }}
    >
      <strong>{n}</strong>
      <span>{t}</span>
    </div>
  );
}

function PTable({ rows, detail }) {
  return (
    <div className="tablewrap">
      <table>
        <thead>
          <tr>
            <th>PPO No</th>
            <th>Location</th>
            <th>Project</th>
            <th>Sales Order</th>
            <th>PPO Date</th>
            <th>Status</th>
            <th>BOM Status</th>
            <th>Actions</th>
          </tr>
        </thead>

        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td
                colSpan="8"
                style={{
                  textAlign: 'center',
                  padding: '30px'
                }}
              >
                No PPO records found.
              </td>
            </tr>
          ) : (
            rows.map((x) => (
              <tr key={x.id}>
                <td className="link">
                  {x.sequence_no}
                </td>

                <td>{x.location}</td>
                <td>{x.project}</td>
                <td>{x.sales_order}</td>
                <td>{x.ppo_date}</td>

                <td>
                  <Badge s={x.production_status} />
                </td>

                <td>{x.bom_status}</td>

                <td>
                  <button
                    className="icon"
                    onClick={() => detail(x.id)}
                  >
                    <Eye />
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Create({
  form,
  setForm,
  sos,
  chooseSO,
  save,
  back,
  edit
}) {
  const so = sos.find(
    (x) => x.tran_no === form.sales_order
  );

  const set = (key, value) => {
    setForm((f) => ({
      ...f,
      [key]: value
    }));
  };

  const line = (index, key, value) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.map((x, i) =>
        i === index
          ? {
              ...x,
              [key]: value
            }
          : x
      )
    }));
  };

  const removeLine = (index) => {
    setForm((f) => ({
      ...f,
      lines: f.lines.filter(
        (_, i) => i !== index
      )
    }));
  };

  const addLine = () => {
    setForm((f) => ({
      ...f,
      lines: [
        ...f.lines,
        emptyLine()
      ]
    }));
  };

  return (
    <>
      <button
        className="back"
        onClick={back}
      >
        <ArrowLeft />
        Back
      </button>

      <h1>
        {edit ? 'Modify' : 'Create'} Primary Production Order
      </h1>

      <div className="panel">
        <h2>General Information</h2>

        <div className="grid3">
          <Field label="Location *">
            <select
              value={form.location}
              onChange={(e) =>
                set('location', e.target.value)
              }
            >
              <option>DAL</option>
              <option>PSM</option>
              <option>HeadOffice</option>
            </select>
          </Field>

          <Field label="Project *">
            <input
              value={form.project}
              onChange={(e) =>
                set('project', e.target.value)
              }
            />
          </Field>

          <Field label="PPO Date">
            <input
              type="date"
              value={form.ppo_date}
              onChange={(e) =>
                set('ppo_date', e.target.value)
              }
            />
          </Field>
        </div>

        <h2>Sales Information</h2>

        <div className="grid3">
          <Field label="Sales Order No *">
            <select
              value={form.sales_order}
              onChange={(e) =>
                chooseSO(e.target.value)
              }
            >
              <option value="">
                Select Sales Order
              </option>

              {sos.map((x) => (
                <option
                  key={x.id}
                  value={x.tran_no}
                >
                  {x.tran_no}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Customer">
            <input
              disabled
              value={so?.customer || ''}
            />
          </Field>

          <Field label="SO Date">
            <input
              disabled
              value={so?.order_date || ''}
            />
          </Field>

          <Field label="SO Delivery Date">
            <input
              disabled
              value={so?.delivery_date || ''}
            />
          </Field>

          <Field label="Division">
            <select
              value={form.division}
              onChange={(e) =>
                set('division', e.target.value)
              }
            >
              <option>CEMENT</option>
              <option>ENGINEERING</option>
              <option>PROJECTS</option>
            </select>
          </Field>

          <Field label="BOM Status">
            <div className="statusline">
              ● Open
            </div>
          </Field>
        </div>

        <div className="sectiontitle">
          <h2>Primary FG Lines</h2>

          <button
            type="button"
            className="primary small"
            onClick={addLine}
          >
            <Plus />
            Add Line
          </button>
        </div>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>FG Name *</th>
                <th>Description</th>
                <th>Quantity *</th>
                <th>Unit Price</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {form.lines.map((x, i) => (
                <tr key={i}>
                  <td>
                    <input
                      value={x.fg_name}
                      onChange={(e) =>
                        line(
                          i,
                          'fg_name',
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      value={x.description}
                      onChange={(e) =>
                        line(
                          i,
                          'description',
                          e.target.value
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={x.quantity}
                      onChange={(e) =>
                        line(
                          i,
                          'quantity',
                          Number(e.target.value)
                        )
                      }
                    />
                  </td>

                  <td>
                    <input
                      type="number"
                      value={x.unit_price}
                      onChange={(e) =>
                        line(
                          i,
                          'unit_price',
                          Number(e.target.value)
                        )
                      }
                    />
                  </td>

                  <td>
                    <button
                      type="button"
                      className="danger"
                      onClick={() =>
                        removeLine(i)
                      }
                    >
                      <Trash2 />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <Field label="Remarks">
          <textarea
            value={form.remarks}
            onChange={(e) =>
              set(
                'remarks',
                e.target.value
              )
            }
          />
        </Field>

        <div className="actions">
          <button onClick={back}>
            Cancel
          </button>

          <button
            className="primary"
            onClick={save}
          >
            <Save />

            {edit
              ? 'Save Changes'
              : 'Save'}
          </button>
        </div>
      </div>
    </>
  );
}

function Field({
  label,
  children
}) {
  return (
    <label>
      <span>{label}</span>
      {children}
    </label>
  );
}

function Detail({
  p,
  back,
  modify,
  submit,
  approve
}) {
  return (
    <>
      <div className="titlebar">
        <button
          className="back"
          onClick={back}
        >
          <ArrowLeft />
          Back
        </button>

        <h1>
          Primary Production Order - {p.sequence_no}
        </h1>

        <Badge s={p.production_status} />
      </div>

      <div className="panel">
        <h2>General Information</h2>

        <div className="detailgrid">
          <Info
            l="PPO No"
            v={p.sequence_no}
          />

          <Info
            l="Location"
            v={p.location}
          />

          <Info
            l="Project"
            v={p.project}
          />

          <Info
            l="PPO Date"
            v={p.ppo_date}
          />

          <Info
            l="Division"
            v={p.division}
          />

          <Info
            l="Production Status"
            v={p.production_status}
          />

          <Info
            l="Remarks"
            v={p.remarks || '---'}
          />
        </div>

        <hr />

        <h2>Sales Information</h2>

        <div className="detailgrid">
          <Info
            l="Sales Order No"
            v={p.sales_order}
          />

          <Info
            l="Customer"
            v={p.customer}
          />

          <Info
            l="SO Date"
            v={p.so_date}
          />

          <Info
            l="SO Delivery Date"
            v={p.so_delivery_date}
          />

          <Info
            l="BOM Status"
            v={p.bom_status}
          />
        </div>

        <h2>Primary FG Lines</h2>

        <div className="tablewrap">
          <table>
            <thead>
              <tr>
                <th>#</th>
                <th>FG Name</th>
                <th>Description</th>
                <th>Quantity</th>
                <th>Unit Price</th>
                <th>Total</th>
              </tr>
            </thead>

            <tbody>
              {(p.lines || []).map(
                (x, i) => (
                  <tr key={x.id || i}>
                    <td>{i + 1}</td>
                    <td>{x.fg_name}</td>
                    <td>{x.description}</td>
                    <td>{x.quantity}</td>

                    <td>
                      {Number(
                        x.unit_price || 0
                      ).toLocaleString()}
                    </td>

                    <td>
                      {Number(
                        x.production_value || 0
                      ).toLocaleString()}
                    </td>
                  </tr>
                )
              )}
            </tbody>
          </table>
        </div>

        <div className="actions">
          {p.production_status === 'Open' && (
            <>
              <button
                className="primary"
                onClick={modify}
              >
                <Pencil />
                Modify
              </button>

              <button
                className="primary"
                onClick={submit}
              >
                <Send />
                Submit
              </button>
            </>
          )}

          {p.production_status === 'Submitted' && (
            <button
              className="success"
              onClick={approve}
            >
              <CheckCircle2 />
              Approve
            </button>
          )}

          {p.production_status === 'Approved' && (
            <div className="approvedmsg">
              ✓ This Primary Production Order is Approved.
              This record is read-only.
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function Info({
  l,
  v
}) {
  return (
    <div>
      <small>{l}</small>
      <div>{v}</div>
    </div>
  );
}

createRoot(
  document.getElementById('root')
).render(<App />);