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

function parseGroupsRoute(hash) {
  const normalizedHash = (hash || "").replace(/^#/, "");
  const [root, mode, rawGroupId] = normalizedHash.split("/");

  if (root !== "groups") {
    return { mode: "list", groupId: "" };
  }

  if (mode === "create") {
    return { mode: "create", groupId: "" };
  }

  if (mode === "edit" && rawGroupId) {
    return { mode: "edit", groupId: decodeURIComponent(rawGroupId) };
  }

  return { mode: "list", groupId: "" };
}

function buildGroupsHash(mode, groupId = "") {
  if (mode === "create") {
    return "#groups/create";
  }

  if (mode === "edit" && groupId) {
    return `#groups/edit/${encodeURIComponent(groupId)}`;
  }

  return "#groups";
}

function App() {
  const [activeTab, setActiveTab] = useState("auth"); 
  const [status, setStatus] = useState("Ready");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [currentUser, setCurrentUser] = useState(null);

  const [groupName, setGroupName] = useState("Roommates");
  const [groups, setGroups] = useState([]);
  const [selectedGroupId, setSelectedGroupId] = useState("");
  const [groupsRoute, setGroupsRoute] = useState(() => (
    parseGroupsRoute(typeof window !== "undefined" ? window.location.hash : "")
  ));
  const [expenseView, setExpenseView] = useState("list");
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

  const availableTabs = currentUser
    ? ["groups", "expense", "balances", "activity"]
    : ["auth"];

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

  const activeGroups = useMemo(
    () => groups.filter((group) => !group.deleted_at),
    [groups]
  );

  const editGroup = groups.find((group) => group.id === groupsRoute.groupId) || null;
  const visibleGroup = groups.find((group) => group.id === selectedGroupId) || null;

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
    if (typeof window === "undefined") {
      return undefined;
    }

    const syncRouteFromHash = () => {
      const nextRoute = parseGroupsRoute(window.location.hash);
      setGroupsRoute(nextRoute);
      if (nextRoute.mode !== "list") {
        setActiveTab("groups");
      }
    };

    window.addEventListener("hashchange", syncRouteFromHash);
    syncRouteFromHash();

    return () => {
      window.removeEventListener("hashchange", syncRouteFromHash);
    };
  }, []);

  useEffect(() => {
    if (currentUser) {
      setExpensePayer(currentUser.id);
    }
  }, [currentUser]);

  useEffect(() => {
    if (!currentUser) {
      setActiveTab("auth");
    }
  }, [currentUser]);

  useEffect(() => {
    if (groupsRoute.mode === "edit" && groupsRoute.groupId && groupsRoute.groupId !== selectedGroupId) {
      setSelectedGroupId(groupsRoute.groupId);
    }
  }, [groupsRoute, selectedGroupId]);

  useEffect(() => {
    if (expenseView === "manage" && !visibleGroup) {
      setExpenseView("list");
    }
  }, [expenseView, visibleGroup]);

  useEffect(() => {
    if (activeTab !== "balances" || !selectedGroupId || !token) {
      return;
    }

    run(async () => {
      await loadBalancesForGroup(selectedGroupId, false);
    });
  }, [activeTab, selectedGroupId, token]);

  useEffect(() => {
    if (activeTab !== "activity" || !selectedGroupId || !token) {
      return;
    }

    run(async () => {
      await loadActivityForGroup(selectedGroupId, false);
    });
  }, [activeTab, selectedGroupId, token]);

  useEffect(() => {
    if (!selectedGroupId || !token) {
      setMembers([]);
      return;
    }

    let cancelled = false;

    run(async () => {
      const data = await api(`/groups/${selectedGroupId}/members`);
      if (!cancelled) {
        setMembers(data.members || []);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [selectedGroupId, token]);

  async function api(path, options = {}) {
    const base = DEFAULT_API_BASE.replace(/\/$/, "");
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
      setActiveTab("groups");
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
      setActiveTab("groups");
      setStatus(`Logged in: ${data.user.email}`);
      await refreshGroups(data.token);
    });
  }

  function onLogout() {
    setToken("");
    setCurrentUser(null);
    setGroups([]);
    setSelectedGroupId("");
    setMembers([]);
    setBalances([]);
    setDebtGraph([]);
    setActivity([]);
    setSettleFrom("");
    setSettleTo("");
    setExpensePayer("");
    setGroupsRoute({ mode: "list", groupId: "" });
    setMemberEmail("");
    setMemberNickname("");
    setStatus("Logged out");

    if (typeof window !== "undefined") {
      window.location.hash = "";
    }
  }

  async function refreshGroups(overrideToken) {
    const authToken = overrideToken || token;
    const base = DEFAULT_API_BASE.replace(/\/$/, "");
    const response = await fetch(`${base}/groups`, {
      headers: { ...buildAuthHeaders(authToken) }
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "Failed to load groups");
    }

    setGroups(data);
    setSelectedGroupId((prev) => {
      if (prev && data.some((group) => group.id === prev)) {
        return prev;
      }
      return data.find((group) => !group.deleted_at)?.id || data[0]?.id || "";
    });
  }

  function navigateGroups(mode, groupId = "") {
    const nextHash = buildGroupsHash(mode, groupId);

    if (typeof window !== "undefined") {
      window.location.hash = nextHash;
    } else {
      setGroupsRoute(parseGroupsRoute(nextHash));
    }

    setActiveTab("groups");
  }

  function selectGroup(groupId) {
    setSelectedGroupId(groupId);
  }

  async function onCreateGroup() {
    await run(async () => {
      const data = await api("/groups", {
        ...toJsonBody({ name: groupName })
      });
      const createdGroupId = data.group?.id || "";
      if (createdGroupId) {
        setSelectedGroupId(createdGroupId);
      }
      await refreshGroups();
      setStatus("Group created");
      navigateGroups("list");
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

  async function loadMembersForGroup(groupId, showStatus = true) {
    if (!groupId) {
      setStatus("Select a group first");
      return;
    }

    const data = await api(`/groups/${groupId}/members`);
    setMembers(data.members || []);

    if (showStatus) {
      setStatus(`Members loaded: ${data.members?.length || 0}`);
    }
  }

  async function onLoadMembers() {
    await run(async () => {
      await loadMembersForGroup(selectedGroupId);
    });
  }

  async function onRemoveMember(userId) {
    if (!selectedGroupId) {
      setStatus("Select a group first");
      return;
    }

    await run(async () => {
      await api(`/groups/${selectedGroupId}/members/${userId}`, {
        method: "DELETE"
      });

      if (currentUser && userId === currentUser.id) {
        setMembers([]);
        setSelectedGroupId("");
        setGroupsRoute({ mode: "list", groupId: "" });
        await refreshGroups();
        navigateGroups("list");
        setStatus("You were removed from the group");
        return;
      }

      setStatus("Member removed");
      await loadMembersForGroup(selectedGroupId, false);
    });
  }

  async function onDeleteGroup(groupId) {
    if (!groupId) {
      setStatus("Select a group first");
      return;
    }

    await run(async () => {
      await api(`/groups/${groupId}`, {
        method: "DELETE"
      });

      setGroupsRoute({ mode: "list", groupId: "" });
      await refreshGroups();
      setSelectedGroupId(groupId);
      setActiveTab("balances");
      setStatus("Group removed from management. Balances and settlements are still available.");
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
      await loadBalancesForGroup(selectedGroupId, false);
      setActiveTab("balances");
      setStatus("Expense created successfully");
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
    await run(async () => {
      await loadBalancesForGroup(selectedGroupId);
    });
  }

  async function loadBalancesForGroup(groupId, showStatus = true) {
    if (!groupId) {
      setStatus("Select a group first");
      return;
    }

    const data = await api(`/groups/${groupId}/balances`);
    setBalances(data.balances || []);
    setDebtGraph(data.debt_graph || []);

    if (showStatus) {
      setStatus("Balances loaded");
    }
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
      await loadBalancesForGroup(selectedGroupId, false);
      setStatus("Settlement created successfully");
    });
  }

  async function onLoadActivity() {
    await run(async () => {
      await loadActivityForGroup(selectedGroupId);
    });
  }

  async function loadActivityForGroup(groupId, showStatus = true) {
    if (!groupId) {
      setStatus("Select a group first");
      return;
    }

    const data = await api(`/groups/${groupId}/activity?limit=20&offset=0`);
    setActivity(data.activity || []);

    if (showStatus) {
      setStatus("Activity loaded");
    }
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

  function handleTabChange(tab) {
    setActiveTab(tab);

    if (tab === "expense") {
      setExpenseView("list");
    }
  }

  function openExpenseGroup(groupId) {
    setSelectedGroupId(groupId);
    setExpenseView("manage");
    setActiveTab("expense");
    run(async () => {
      await loadMembersForGroup(groupId, false);
    });
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-top">
          <div>
            <h1>SettleUp</h1>
            <p>A fast and transparent expense splitting loop.</p>
          </div>
          {currentUser && (
            <div className="user-pill">
              <span className="small">Logged in as</span>
              <strong>{currentUser.email}</strong>
              <button type="button" className="btn-secondary" onClick={onLogout}>
                Log Out
              </button>
            </div>
          )}
        </div>
      </header>

      <nav className="nav-bar">
        {availableTabs.map(tab => (
          <button 
            key={tab}
            className={`nav-tab ${activeTab === tab ? 'active' : ''}`}
            onClick={() => handleTabChange(tab)}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </nav>

      {activeTab === 'auth' && (
        <section className="panel animate-fade-in">
          <h2>Authentication</h2>
          {!currentUser && (
            <p className="small" style={{ marginTop: 0, marginBottom: "16px" }}>
              Log in to access groups, expenses, balances, and activity.
            </p>
          )}
          <div className="grid2">
            <div className="input-field">
              <input id="authEmail" value={email} onChange={(e) => setEmail(e.target.value)} placeholder=" " />
              <label htmlFor="authEmail">Email</label>
            </div>
            <div className="input-field">
              <input id="authPass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder=" " />
              <label htmlFor="authPass">Password</label>
            </div>
          </div>
          <div className="row" style={{ gap: '16px' }}>
            <button onClick={onRegister}>Register</button>
            <button onClick={onLogin}>Login</button>
          </div>
          <p className="small" style={{marginTop: '12px'}}>Current user: {currentUser ? currentUser.email : "none"}</p>
        </section>
      )}

      {activeTab === 'groups' && (
        <section className="panel animate-fade-in">
          <div className="panel-header">
            <div>
              <h2>Groups</h2>
              <p className="small">Create groups first, then open a group to manage its members.</p>
            </div>
            {groupsRoute.mode !== "create" && (
              <button onClick={() => navigateGroups("create")}>Create Group</button>
            )}
          </div>

          {groupsRoute.mode === "create" && (
            <div className="groups-flow">
              <div className="row">
                <button type="button" className="btn-secondary" onClick={() => navigateGroups("list")}>
                  Back to Groups
                </button>
              </div>
              <div className="grid2">
                <div className="input-field">
                  <input id="groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder=" " />
                  <label htmlFor="groupName">Group name</label>
                </div>
                <button onClick={onCreateGroup}>Create Group</button>
              </div>
            </div>
          )}

          {groupsRoute.mode === "edit" && editGroup && (
            <div className="groups-flow">
              <div className="row">
                <button type="button" className="btn-secondary" onClick={() => navigateGroups("list")}>
                  Back to Groups
                </button>
                <button
                  type="button"
                  className="danger-btn"
                  onClick={() => onDeleteGroup(editGroup.id)}
                >
                  Delete Group
                </button>
              </div>

              <h3 className="groups-subtitle">Edit {editGroup.name}</h3>

              <div className="grid2">
                <div className="input-field">
                  <input id="memberEmail" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder=" " />
                  <label htmlFor="memberEmail">Member email</label>
                </div>
                <div className="input-field">
                  <input id="memberNickname" value={memberNickname} onChange={(e) => setMemberNickname(e.target.value)} placeholder=" " />
                  <label htmlFor="memberNickname">Member display name (optional, e.g. David)</label>
                </div>
              </div>

              <div className="row">
                <button
                  onClick={() => {
                    setSelectedGroupId(editGroup.id);
                    onAddMember();
                  }}
                >
                  Add Member
                </button>
              </div>

              <div className="small">Tip: add nickname now so splits can be selected by name.</div>

              <ul className="member-list">
                {members.map((m) => (
                  <li key={m.id}>
                    <div className="member-details">
                      <span>{getMemberLabel(m)}</span>
                      <span>({m.email})</span>
                    </div>
                    <button
                      type="button"
                      className="danger-btn"
                      onClick={() => onRemoveMember(m.id)}
                    >
                      Delete
                    </button>
                  </li>
                ))}
              </ul>

              {members.length === 0 && <p className="small">No members loaded for this group yet.</p>}
            </div>
          )}

          {groupsRoute.mode === "edit" && !editGroup && (
            <div className="groups-flow">
              <div className="row">
                <button type="button" className="btn-secondary" onClick={() => navigateGroups("list")}>
                  Back to Groups
                </button>
              </div>
              <p className="small">That group could not be found. Choose a group from the list and try again.</p>
            </div>
          )}

          {groupsRoute.mode === "list" && (
            <div className="groups-flow">
              <div className="group-list">
                {activeGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`group-row ${selectedGroupId === group.id ? "is-selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="group-select"
                      onClick={() => selectGroup(group.id)}
                    >
                      <span className="group-name">{group.name}</span>
                      <span className="small">{selectedGroupId === group.id ? "Selected group" : "Select group"}</span>
                    </button>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => {
                        setSelectedGroupId(group.id);
                        run(async () => {
                          await loadMembersForGroup(group.id, false);
                        });
                        navigateGroups("edit", group.id);
                      }}
                    >
                      Edit
                    </button>
                  </div>
                ))}
              </div>

              {activeGroups.length === 0 && (
                <p className="small">No groups yet. Use the create button above to add your first group.</p>
              )}

              {visibleGroup && <p className="small">Selected group: {visibleGroup.name}</p>}
            </div>
          )}
        </section>
      )}

      {activeTab === 'expense' && (
        <section className="panel animate-fade-in">
          {expenseView === "list" && (
            <div className="groups-flow">
              <div className="panel-header">
                <div>
                  <h2>Expense Groups</h2>
                  <p className="small">Choose a group you participate in, then manage expenses for that group.</p>
                </div>
              </div>

              <div className="group-list">
                {activeGroups.map((group) => (
                  <div
                    key={group.id}
                    className={`group-row ${selectedGroupId === group.id ? "is-selected" : ""}`}
                  >
                    <div className="group-select">
                      <span className="group-name">{group.name}</span>
                      <span className="small">{selectedGroupId === group.id ? "Current expense group" : "Available group"}</span>
                    </div>
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() => openExpenseGroup(group.id)}
                    >
                      Expense
                    </button>
                  </div>
                ))}
              </div>

              {activeGroups.length === 0 && (
                <p className="small">You are not part of any groups yet, so there are no group expenses to manage.</p>
              )}
            </div>
          )}

          {expenseView === "manage" && visibleGroup && (
            <div className="groups-flow">
              <div className="row">
                <button type="button" className="btn-secondary" onClick={() => setExpenseView("list")}>
                  Back to Expense Groups
                </button>
              </div>

              <h2>Expense</h2>
              <p className="small" style={{ marginTop: "-8px", marginBottom: "8px" }}>
                Managing expenses for {visibleGroup.name}.
              </p>

              <div className="grid2">
                <div className="input-field">
                  <input id="expenseDesc" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} placeholder=" " />
                  <label htmlFor="expenseDesc">Description</label>
                </div>
                <div className="input-field">
                  <input id="expenseAmt" type="number" min="1" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} placeholder=" " />
                  <label htmlFor="expenseAmt">Amount cents</label>
                </div>
              </div>
              
              <div className="grid2" style={{marginBottom: '16px'}}>
                <div className="input-field">
                  <select id="expensePayer" value={expensePayer} onChange={(e) => setExpensePayer(e.target.value)}>
                    <option value="" disabled hidden></option>
                    {members.map((member) => (
                      <option key={member.id} value={member.id}>
                        {getMemberLabel(member)} ({member.email})
                      </option>
                    ))}
                  </select>
                  <label htmlFor="expensePayer">Who paid?</label>
                </div>
                <div className="input-field">
                  <select id="splitType" value={splitType} onChange={(e) => setSplitType(e.target.value)}>
                    <option value="equal">equal</option>
                    <option value="percentage">percentage</option>
                    <option value="exact">exact</option>
                  </select>
                  <label htmlFor="splitType">Split type</label>
                </div>
              </div>

              <div className="small" style={{marginBottom: '16px', marginTop: '8px'}}>Select members below by name:</div>

              <div className="row" style={{marginBottom: '20px', alignItems: 'center'}}>
                <button type="button" className="btn-secondary" onClick={() => setAllParticipants(true)}>Select All</button>
                <button type="button" className="btn-secondary" onClick={() => setAllParticipants(false)}>Clear</button>
                <span className="small badge" style={{marginLeft: 'auto', fontWeight: '500', color: 'var(--text-main)'}}>Selected: {selectedParticipantIds.length}</span>
              </div>

              <div className="split-builder">
                {members.map((member) => (
                  <div key={member.id} className="split-row">
                    <label className="member-toggle" style={{margin: 0}}>
                      <input
                        type="checkbox"
                        checked={Boolean(participantEnabled[member.id])}
                        onChange={() => toggleParticipant(member.id)}
                      />
                      <span>{getMemberLabel(member)}</span>
                      <span className="small">({member.email})</span>
                    </label>

                    {(splitType === "percentage" || splitType === "exact") && (
                      <div className="input-field" style={{marginBottom: 0}}>
                        <input
                          id={`split-${member.id}`}
                          type="number"
                          min="0"
                          step={splitType === "percentage" ? "0.01" : "1"}
                          value={splitValues[member.id] ?? ""}
                          onChange={(e) => updateSplitValue(member.id, e.target.value)}
                          placeholder=" "
                          disabled={!participantEnabled[member.id]}
                        />
                        <label htmlFor={`split-${member.id}`}>{splitType === "percentage" ? "Percentage" : "Owed cents"}</label>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <p className="small" style={{marginTop: '16px', marginBottom: '24px'}}>
                {splitType === "equal" && "Equal: selected members share the total equally."}
                {splitType === "percentage" && "Percentage: selected percentages must sum to 100."}
                {splitType === "exact" && "Exact: selected owed_cents must sum to total amount_cents."}
              </p>

              <button onClick={onCreateExpense}>Create Expense</button>
            </div>
          )}
        </section>
      )}

      {activeTab === 'balances' && (
        <section className="panel animate-fade-in">
          <h2>Balances & Settlements</h2>

          <h3>Net Balances</h3>
          <ul>
            {balances.map((b) => (
              <li key={b.user_id}>
                {b.email}: <strong style={{color: b.net_cents < 0 ? '#ef4444' : '#10b981'}}>{formatCents(b.net_cents)}</strong>
              </li>
            ))}
          </ul>

          <h3>Who Owes Who</h3>
          <ul>
            {debtGraph.map((edge, index) => (
              <li key={index}>
                {memberById[edge.from_user]?.email || edge.from_user} owes {memberById[edge.to_user]?.email || edge.to_user} <strong>{formatCents(edge.amount_cents)}</strong>
              </li>
            ))}
          </ul>
          {debtGraph.length === 0 && <p className="small">No outstanding debts</p>}

          <h3 style={{marginTop: '32px'}}>Record Settlement</h3>
          <div className="grid2">
            <div className="input-field">
              <select id="settleFrom" value={settleFrom} onChange={(e) => setSettleFrom(e.target.value)}>
                {settlementTargets.length === 0 && <option value="" disabled hidden></option>}
                {settlementTargets.map((member) => (
                  <option key={member.id} value={member.id}>
                    {getMemberLabel(member)} ({member.email})
                  </option>
                ))}
              </select>
              <label htmlFor="settleFrom">Who is paying</label>
            </div>
            <div className="input-field">
              <select id="settleTo" value={settleTo} onChange={(e) => setSettleTo(e.target.value)}>
                {settlementTargets.length === 0 && <option value="" disabled hidden></option>}
                {settlementTargets.map((member) => (
                  <option key={member.id} value={member.id}>
                    {getMemberLabel(member)} ({member.email})
                  </option>
                ))}
              </select>
              <label htmlFor="settleTo">Who is receiving</label>
            </div>
          </div>
          <div className="input-field" style={{maxWidth: '220px', marginBottom: '24px'}}>
            <input id="settleAmount" type="number" min="1" value={settleAmount} onChange={(e) => setSettleAmount(e.target.value)} placeholder=" " />
            <label htmlFor="settleAmount">Amount (cents)</label>
          </div>

          <button onClick={onCreateSettlement}>Create Settlement</button>
        </section>
      )}

      {activeTab === 'activity' && (
        <section className="panel animate-fade-in">
          <h2>Activity</h2>
          <ul>
            {activity.map((a) => (
              <li key={a.id}>
                {formatActivityItem(a)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <footer className="status">{status}</footer>
    </div>
  );
}

export default App;
