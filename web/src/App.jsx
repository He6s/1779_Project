import { useEffect, useMemo, useState } from "react";

function resolveDefaultApiBase() {
  if (
    typeof window !== "undefined" &&
    window.__SETTLEUP_CONFIG__ &&
    typeof window.__SETTLEUP_CONFIG__.apiBaseUrl === "string" &&
    window.__SETTLEUP_CONFIG__.apiBaseUrl.trim()
  ) {
    return window.__SETTLEUP_CONFIG__.apiBaseUrl.trim();
  }

  if (typeof window === "undefined") {
    return "http://localhost:3001";
  }

  const protocol = window.location.protocol || "http:";
  const hostname = window.location.hostname || "localhost";
  return `${protocol}//${hostname}:3001`;
}

const DEFAULT_API_BASE = resolveDefaultApiBase();

function toJsonBody(data) {
  return {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data)
  };
}

function buildAuthHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function getMemberLabel(member) {
  if (member.display_name && member.display_name.trim()) {
    return member.display_name.trim();
  }
  if (member.nickname && member.nickname.trim()) {
    return member.nickname.trim();
  }
  const email = member.email || "";
  return email.includes("@") ? email.split("@")[0] : email;
}

function formatCents(value) {
  if (!Number.isFinite(Number(value))) {
    return "-";
  }
  return `${Number(value)} cents`;
}

function App() {
  const [apiBase, setApiBase] = useState(DEFAULT_API_BASE);
  const [status, setStatus] = useState("Ready");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [groupName, setGroupName] = useState("Roommates");
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [memberEmail, setMemberEmail] = useState("");
  const [memberNickname, setMemberNickname] = useState("");
  const [members, setMembers] = useState([]);

  const [expenseDescription, setExpenseDescription] = useState("Groceries");
  const [expenseAmount, setExpenseAmount] = useState(1000);
  const [expensePayer, setExpensePayer] = useState("");
  const [splitType, setSplitType] = useState("equal");
  const [participantEnabled, setParticipantEnabled] = useState({});
  const [splitValues, setSplitValues] = useState({});

  const [balances, setBalances] = useState([]);
  const [debtGraph, setDebtGraph] = useState([]);

  const [settleFrom, setSettleFrom] = useState("");
  const [settleTo, setSettleTo] = useState("");
  const [settleAmount, setSettleAmount] = useState(500);

  const [activity, setActivity] = useState([]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === selectedGroupId) || null,
    [groups, selectedGroupId]
  );

  const selectedParticipantIds = useMemo(
    () => members.filter((m) => participantEnabled[m.id]).map((m) => m.id),
    [members, participantEnabled]
  );

  const memberById = useMemo(() => {
    const map = {};
    members.forEach((member) => {
      map[member.id] = member;
    });
    return map;
  }, [members]);

  const settlementTargets = useMemo(
    () => members,
    [members]
  );

  useEffect(() => {
    setParticipantEnabled((prev) => {
      const next = {};
      members.forEach((member) => {
        next[member.id] = prev[member.id] ?? true;
      });
      return next;
    });

    setSplitValues((prev) => {
      const next = {};
      members.forEach((member) => {
        next[member.id] = prev[member.id] ?? "";
      });
      return next;
    });
  }, [members]);

  useEffect(() => {
    if (!settlementTargets.some((member) => member.id === settleFrom)) {
      setSettleFrom(settlementTargets[0]?.id || "");
    }
    if (!settlementTargets.some((member) => member.id === settleTo)) {
      setSettleTo(settlementTargets[0]?.id || "");
    }
  }, [settlementTargets, settleFrom, settleTo]);

  useEffect(() => {
    if (currentUser) {
      setExpensePayer(currentUser.id);
    }
  }, [currentUser]);

  async function api(path, options = {}) {
    const base = apiBase.replace(/\/$/, "");
    const headers = {
      ...(options.headers || {}),
      ...buildAuthHeaders(token)
    };

    const response = await fetch(`${base}${path}`, {
      ...options,
      headers
    });

    const raw = await response.text();
    const data = raw ? JSON.parse(raw) : {};

    if (!response.ok) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  async function run(action) {
    try {
      await action();
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  async function onRegister() {
    await run(async () => {
      const data = await api("/auth/register", {
        ...toJsonBody({ email, password })
      });
      setToken(data.token);
      setCurrentUser(data.user);
      setStatus(`Registered: ${data.user.email}`);
      await refreshGroups(data.token);
    });
  }

  async function onLogin() {
    await run(async () => {
      const data = await api("/auth/login", {
        ...toJsonBody({ email, password })
      });
      setToken(data.token);
      setCurrentUser(data.user);
      setStatus(`Logged in: ${data.user.email}`);
      await refreshGroups(data.token);
    });
  }

  async function refreshGroups(overrideToken) {
    const authToken = overrideToken || token;
    const base = apiBase.replace(/\/$/, "");
    const response = await fetch(`${base}/groups`, {
      headers: { ...buildAuthHeaders(authToken) }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load groups");
    }

    setGroups(data);
    if (data.length > 0) {
      setSelectedGroupId((prev) => prev || data[0].id);
    }
  }

  async function onCreateGroup() {
    await run(async () => {
      await api("/groups", {
        ...toJsonBody({ name: groupName })
      });
      await refreshGroups();
      setStatus("Group created");
    });
  }

  async function onAddMember() {
    if (!selectedGroupId) {
      setStatus("Select a group first");
      return;
    }

    // Check if the member is already in the group
    const existingMember = members.find(member => member.email === memberEmail);
    if (existingMember) {
      setStatus("User has already been added to the group");
      return;
    }

    await run(async () => {
      await api(`/groups/${selectedGroupId}/members`, {
        ...toJsonBody({
          email: memberEmail,
          nickname: memberNickname || undefined
        })
      });
      setStatus("Member added");
      setMemberEmail("");
      setMemberNickname("");
      await onLoadMembers();
    });
  }

  async function onLoadMembers() {
    if (!selectedGroupId) {
      setStatus("Select a group first");
      return;
    }

    await run(async () => {
      const data = await api(`/groups/${selectedGroupId}/members`);
      setMembers(data.members || []);
      setStatus(`Members loaded: ${data.members?.length || 0}`);
    });
  }

  async function onCreateExpense() {
    if (!selectedGroupId) {
      setStatus("Select a group first");
      return;
    }

    if (!expensePayer) {
      setStatus("Select who paid for the expense");
      return;
    }

    await run(async () => {
      const payload = {
        description: expenseDescription,
        amount_cents: Number(expenseAmount),
        currency: "CAD",
        split_type: splitType,
        payer_id: expensePayer
      };

      if (splitType === "equal") {
        if (selectedParticipantIds.length === 0) {
          throw new Error("Select at least one participant");
        }

        if (selectedParticipantIds.length !== members.length) {
          payload.participant_ids = selectedParticipantIds;
        }
      }

      if (splitType === "percentage" || splitType === "exact") {
        if (selectedParticipantIds.length === 0) {
          throw new Error("Select at least one participant");
        }

        const splits = selectedParticipantIds.map((userId) => {
          const rawValue = splitValues[userId];
          const numericValue = Number(rawValue);

          if (!Number.isFinite(numericValue) || numericValue < 0) {
            throw new Error(`Invalid split value for member ${userId.slice(0, 8)}`);
          }

          if (splitType === "percentage") {
            return {
              user_id: userId,
              percentage: numericValue
            };
          }

          if (!Number.isInteger(numericValue)) {
            throw new Error("Exact split values must be integers (cents)");
          }

          return {
            user_id: userId,
            owed_cents: numericValue
          };
        });

        if (splitType === "percentage") {
          const total = splits.reduce((sum, item) => sum + item.percentage, 0);
          if (Math.abs(total - 100) > 0.0001) {
            throw new Error("Percentage splits must sum to 100");
          }
        }

        if (splitType === "exact") {
          const total = splits.reduce((sum, item) => sum + item.owed_cents, 0);
          if (total !== Number(expenseAmount)) {
            throw new Error("Exact splits must sum to total amount_cents");
          }
        }

        payload.splits = splits;
      }

      const data = await api(`/groups/${selectedGroupId}/expenses`, {
        ...toJsonBody(payload)
      });
      setStatus(`Expense created: ${data.expense.id}`);
    });
  }

  function toggleParticipant(userId) {
    setParticipantEnabled((prev) => ({
      ...prev,
      [userId]: !prev[userId]
    }));
  }

  function setAllParticipants(enabled) {
    const next = {};
    members.forEach((member) => {
      next[member.id] = enabled;
    });
    setParticipantEnabled(next);
  }

  function updateSplitValue(userId, value) {
    setSplitValues((prev) => ({
      ...prev,
      [userId]: value
    }));
  }

  async function onLoadBalances() {
    if (!selectedGroupId) {
      setStatus("Select a group first");
      return;
    }

    await run(async () => {
      const data = await api(`/groups/${selectedGroupId}/balances`);
      setBalances(data.balances || []);
      setDebtGraph(data.debt_graph || []);
      setStatus("Balances loaded");
    });
  }

  async function onCreateSettlement() {
    if (!selectedGroupId) {
      setStatus("Select a group first");
      return;
    }

    if (!settleFrom) {
      setStatus("Select who is paying");
      return;
    }

    if (!settleTo) {
      setStatus("Select who is receiving payment");
      return;
    }

    if (settleFrom === settleTo) {
      setStatus("Payer and payee cannot be the same person");
      return;
    }

    await run(async () => {
      const data = await api(`/groups/${selectedGroupId}/settlements`, {
        ...toJsonBody({
          from_user: settleFrom,
          to_user: settleTo,
          amount_cents: Number(settleAmount)
        })
      });
      setStatus(`Settlement created: ${data.settlement.id}`);
    });
  }

  async function onLoadActivity() {
    if (!selectedGroupId) {
      setStatus("Select a group first");
      return;
    }

    await run(async () => {
      const data = await api(`/groups/${selectedGroupId}/activity?limit=20&offset=0`);
      setActivity(data.activity || []);
      setStatus("Activity loaded");
    });
  }

  function formatActivityItem(item) {
    const payload = item.payload || {};

    if (item.action_type === "expense_created") {
      const amount = formatCents(payload.amount_cents);
      const description = payload.description || "(no description)";
      return `${item.user_email} created expense \"${description}\" (${amount})`;
    }

    if (item.action_type === "settlement_recorded") {
      const amount = formatCents(payload.amount_cents);
      const target = memberById[payload.to_user];
      const targetName = target ? getMemberLabel(target) : payload.to_user || "unknown";
      return `${item.user_email} recorded settlement ${amount} to ${targetName}`;
    }

    return `${item.action_type} by ${item.user_email}`;
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>SettleUp React Console</h1>
        <p>Production-track React frontend for project delivery.</p>
      </header>

      <section className="panel">
        <h2>Connection</h2>
        <input value={apiBase} onChange={(e) => setApiBase(e.target.value)} placeholder="API base URL" />
      </section>

      <section className="panel">
        <h2>Auth</h2>
        <div className="grid2">
          <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        </div>
        <div className="row">
          <button onClick={onRegister}>Register</button>
          <button onClick={onLogin}>Login</button>
          <button onClick={() => run(async () => refreshGroups())}>Refresh Groups</button>
        </div>
        <p className="small">Current user: {currentUser ? currentUser.email : "none"}</p>
      </section>

      <section className="panel">
        <h2>Groups & Members</h2>
        <div className="grid2">
          <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" />
          <button onClick={onCreateGroup}>Create Group</button>
        </div>

        <div className="grid2">
          <select value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
            <option value="">Select group</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
          <input value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder="Member email" />
        </div>

        <div className="grid2">
          <input
            value={memberNickname}
            onChange={(e) => setMemberNickname(e.target.value)}
            placeholder="Member display name (optional, e.g. David)"
          />
          <div className="small">Tip: add nickname now so splits can be selected by name.</div>
        </div>

        <div className="row">
          <button onClick={onAddMember}>Add Member</button>
          <button onClick={onLoadMembers}>Load Members</button>
        </div>

        <ul>
          {members.map((m) => (
            <li key={m.id}>
              {getMemberLabel(m)} ({m.email})
            </li>
          ))}
        </ul>

        {selectedGroup && <p className="small">Selected group: {selectedGroup.name}</p>}
      </section>

      <section className="panel">
        <h2>Expense</h2>
        <div className="grid2">
          <input value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder="Description" />
          <input type="number" min="1" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder="Amount cents" />
        </div>
        <div>
          <label>
            Who paid? 
            <select value={expensePayer} onChange={(e) => setExpensePayer(e.target.value)}>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {getMemberLabel(member)} ({member.email})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="grid2">
          <select value={splitType} onChange={(e) => setSplitType(e.target.value)}>
            <option value="equal">equal</option>
            <option value="percentage">percentage</option>
            <option value="exact">exact</option>
          </select>
          <div className="small">Select members below by name. No UUID input required.</div>
        </div>

        <div className="row">
          <button type="button" onClick={() => setAllParticipants(true)}>Select All</button>
          <button type="button" onClick={() => setAllParticipants(false)}>Clear</button>
          <span className="small">Selected: {selectedParticipantIds.length}</span>
        </div>

        <div className="split-builder">
          {members.map((member) => (
            <div key={member.id} className="split-row">
              <label className="member-toggle">
                <input
                  type="checkbox"
                  checked={Boolean(participantEnabled[member.id])}
                  onChange={() => toggleParticipant(member.id)}
                />
                <span>{getMemberLabel(member)}</span>
                <span className="small">({member.email})</span>
              </label>

              {(splitType === "percentage" || splitType === "exact") && (
                <input
                  type="number"
                  min="0"
                  step={splitType === "percentage" ? "0.01" : "1"}
                  value={splitValues[member.id] ?? ""}
                  onChange={(e) => updateSplitValue(member.id, e.target.value)}
                  placeholder={splitType === "percentage" ? "percentage" : "owed cents"}
                  disabled={!participantEnabled[member.id]}
                />
              )}
            </div>
          ))}
        </div>

        <p className="small">
          {splitType === "equal" && "Equal: selected members share the total equally."}
          {splitType === "percentage" && "Percentage: selected percentages must sum to 100."}
          {splitType === "exact" && "Exact: selected owed_cents must sum to total amount_cents."}
        </p>

        <button onClick={onCreateExpense}>Create Expense</button>
      </section>

      <section className="panel">
        <h2>Balances & Settlements</h2>
        <div className="row">
          <button onClick={onLoadBalances}>Load Balances</button>
        </div>

        <h3>Net Balances</h3>
        <ul>
          {balances.map((b) => (
            <li key={b.user_id}>
              {b.email}: {formatCents(b.net_cents)}
            </li>
          ))}
        </ul>

        <h3>Who Owes Who</h3>
        <ul>
          {debtGraph.map((edge, index) => (
            <li key={index}>
              {memberById[edge.from_user]?.email || edge.from_user} owes {memberById[edge.to_user]?.email || edge.to_user} {formatCents(edge.amount_cents)}
            </li>
          ))}
        </ul>
        {debtGraph.length === 0 && <p className="small">No outstanding debts</p>}

        <h3>Record Settlement</h3>
        <div>
          <label>
            Who is paying:
            <select value={settleFrom} onChange={(e) => setSettleFrom(e.target.value)}>
              {settlementTargets.length === 0 && <option value="">Load members first</option>}
              {settlementTargets.map((member) => (
                <option key={member.id} value={member.id}>
                  {getMemberLabel(member)} ({member.email})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            Who is receiving:
            <select value={settleTo} onChange={(e) => setSettleTo(e.target.value)}>
              {settlementTargets.length === 0 && <option value="">Load members first</option>}
              {settlementTargets.map((member) => (
                <option key={member.id} value={member.id}>
                  {getMemberLabel(member)} ({member.email})
                </option>
              ))}
            </select>
          </label>
        </div>
        <div>
          <label>
            Amount (cents):
            <input type="number" min="1" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} placeholder="amount cents" />
          </label>
        </div>

        <button onClick={onCreateSettlement}>Create Settlement</button>
      </section>

      <section className="panel">
        <h2>Activity</h2>
        <button onClick={onLoadActivity}>Load Activity</button>
        <ul>
          {activity.map((a) => (
            <li key={a.id}>
              {formatActivityItem(a)}
            </li>
          ))}
        </ul>
      </section>

      <footer className="status">{status}</footer>
    </div>
  );
}

export default App;
