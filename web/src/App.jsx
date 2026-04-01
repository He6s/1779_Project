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

function buildEventStreamUrl(groupId, token) {
  const base = DEFAULT_API_BASE.replace(/\/$/, "");
  const params = new URLSearchParams({ token });
  return `${base}/groups/${groupId}/events?${params.toString()}`;
}

function buildUserEventStreamUrl(token) {
  const base = DEFAULT_API_BASE.replace(/\/$/, "");
  const params = new URLSearchParams({ token });
  return `${base}/events?${params.toString()}`;
}

function App() {
  const [activeTab, setActiveTab] = useState("auth"); 
  const [status, setStatus] = useState("Ready");
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);

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

  const isAuthenticated = useMemo(
    () => Boolean(token && currentUser),
    [token, currentUser]
  );

  const userName = useMemo(() => {
    if (!currentUser?.email) {
      return "User name";
    }
    const local = currentUser.email.split("@")[0] || "User";
    return local;
  }, [currentUser]);

  const userInitial = useMemo(() => {
    if (!userName) {
      return "U";
    }
    return userName.charAt(0).toUpperCase();
  }, [userName]);

  const userEmail = useMemo(() => currentUser?.email || "", [currentUser]);

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

  useEffect(() => {
    if (!isAuthenticated) {
      setAccountMenuOpen(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!accountMenuOpen) {
      return undefined;
    }

    function handleOutsideClick(event) {
      if (!event.target.closest(".account-entry")) {
        setAccountMenuOpen(false);
      }
    }

    function handleEscape(event) {
      if (event.key === "Escape") {
        setAccountMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (activeTab !== "groups" || !selectedGroupId || !token) {
      return undefined;
    }

    run(async () => {
      await loadMembersForGroup(selectedGroupId, false);
    });
  }, [activeTab, selectedGroupId, token]);

  useEffect(() => {
    if (activeTab !== "balances" || !selectedGroupId || !token) {
      return undefined;
    }

    run(async () => {
      await loadBalancesForGroup(selectedGroupId, false);
    });
  }, [activeTab, selectedGroupId, token]);

  useEffect(() => {
    if (activeTab !== "activity" || !selectedGroupId || !token) {
      return undefined;
    }

    run(async () => {
      await loadActivityForGroup(selectedGroupId, false);
    });
  }, [activeTab, selectedGroupId, token]);

  useEffect(() => {
    if (!selectedGroupId || !token) {
      return undefined;
    }

    const eventSource = new EventSource(buildEventStreamUrl(selectedGroupId, token));

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload || payload.type === "connected") {
          return;
        }

        if (
          activeTab === "groups" &&
          (payload.type === "member_added" || payload.type === "member_removed" || payload.type === "member_updated")
        ) {
          run(async () => {
            await loadMembersForGroup(selectedGroupId, false);
          });
        }

        if (
          activeTab === "balances" &&
          (
            payload.type === "expense_created" ||
            payload.type === "settlement_recorded" ||
            payload.type === "member_added" ||
            payload.type === "member_removed"
          )
        ) {
          run(async () => {
            await loadBalancesForGroup(selectedGroupId, false);
          });
        }

        if (
          activeTab === "activity" &&
          (
            payload.type === "expense_created" ||
            payload.type === "settlement_recorded" ||
            payload.type === "member_added" ||
            payload.type === "member_removed" ||
            payload.type === "member_updated"
          )
        ) {
          run(async () => {
            await loadActivityForGroup(selectedGroupId, false);
          });
        }
      } catch (err) {
        console.error("Failed to handle group event:", err);
      }
    };

    eventSource.onerror = () => {
      setStatus("Live updates disconnected. Reload if changes stop appearing.");
    };

    return () => {
      eventSource.close();
    };
  }, [activeTab, selectedGroupId, token]);

  useEffect(() => {
    if (!token) {
      return undefined;
    }

    const eventSource = new EventSource(buildUserEventStreamUrl(token));

    eventSource.onmessage = (event) => {
      try {
        const payload = JSON.parse(event.data);
        if (!payload || payload.type === "connected") {
          return;
        }

        if (payload.type === "groups_updated") {
          run(async () => {
            await refreshGroups();
          });
        }
      } catch (err) {
        console.error("Failed to handle user event:", err);
      }
    };

    eventSource.onerror = () => {
      setStatus("Group updates disconnected. Reload if new groups stop appearing.");
    };

    return () => {
      eventSource.close();
    };
  }, [token]);

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
    setAccountMenuOpen(false);
    setActiveTab("auth");
    setStatus("Logged out successfully");
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
    // Auto-select removed to allow empty default state
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

  async function onDeleteGroup() {
    if (!selectedGroup) return;
    const confirmName = window.prompt(`Are you sure you want to delete this group?\nAll expenses, settlements, and activity will be permanently lost.\n\nType the group name "${selectedGroup.name}" to confirm:`);
    
    if (confirmName !== selectedGroup.name) {
      if (confirmName !== null) setStatus("Group deletion cancelled: name did not match.");
      return;
    }

    await run(async () => {
      await api(`/groups/${selectedGroupId}`, {
        method: "DELETE"
      });
      setStatus(`Group "${selectedGroup.name}" deleted successfully.`);
      setSelectedGroupId("");
      setMembers([]);
      await refreshGroups();
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
      await loadMembersForGroup(selectedGroupId);
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
    if (!selectedGroupId) {
      setStatus("Select a group first");
      return;
    }

    await run(async () => {
      await loadBalancesForGroup(selectedGroupId);
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
      setStatus("Settlement created successfully");
    });
  }

  async function onLoadActivity() {
    if (!selectedGroupId) {
      setStatus("Select a group first");
      return;
    }

    await run(async () => {
      await loadActivityForGroup(selectedGroupId);
    });
  }

  function formatActivityItem(item) {
    const payload = item.payload || {};

    if (item.action_type === "expense_created") {
      const amount = formatCents(payload.amount_cents);
      const description = payload.description || "(no description)";
      const splitType = payload.split_type || "equal";
      const splitBreakdown = Array.isArray(payload.split_breakdown)
        ? payload.split_breakdown
        : [];

      const fallbackSplitDetails =
        !splitBreakdown.length && typeof payload.split_details_text === "string"
          ? payload.split_details_text.replace(/^\s*Total:[^;]*;\s*/i, "")
          : "";

      return (
        <>
          <span>{item.user_email} </span>
          <strong>created expense "{description}"</strong>
          <span> </span>
          <strong>({amount})</strong>
          {splitBreakdown.length ? (
            <>
              <span> Split type: </span>
              <strong>{splitType}</strong>
              <span>; Splits: </span>
              {splitBreakdown.map((entry, index) => {
                const label = entry?.label || entry?.user_id || "unknown";
                const owedCents = Number(entry?.owed_cents);
                const hasPercentage =
                  splitType === "percentage" &&
                  Number.isFinite(Number(entry?.percentage));

                return (
                  <span key={`${label}-${index}`}>
                    {index > 0 ? ", " : ""}
                    {label}: <strong>{Number.isFinite(owedCents) ? `${owedCents} cents` : String(entry?.owed_cents)}</strong>
                    {hasPercentage ? ` (${Number(entry.percentage)}%)` : ""}
                  </span>
                );
              })}
            </>
          ) : fallbackSplitDetails ? (
            <>
              <span> </span>
              <span>{fallbackSplitDetails}</span>
            </>
          ) : null}
        </>
      );
    }

    if (item.action_type === "settlement_recorded") {
      const amount = formatCents(payload.amount_cents);
      const target = memberById[payload.to_user];
      const targetName = target ? getMemberLabel(target) : payload.to_user || "unknown";
      
      let payerName = "Someone";
      if (payload.from_user) {
        const payer = memberById[payload.from_user];
        payerName = payer ? getMemberLabel(payer) : payload.from_user;
      } else {
        // Fallback for older records where from_user wasn't explicitly saved
        payerName = item.user_email;
      }

      return (
        <>
          <span>{item.user_email} recorded that </span>
          <strong>{payerName}</strong>
          <span> paid </span>
          <strong>{amount}</strong>
          <span> to </span>
          <strong>{targetName}</strong>
        </>
      );
    }

    return `${item.action_type} by ${item.user_email}`;
  }

  return (
    <div className="page">
      <header className="hero">
        <div className="hero-top">
          <div>
            <h1>SettleUp</h1>
            <p>A fast and transparent expense splitting loop.</p>
          </div>

          {isAuthenticated && (
            <div className="account-entry">
              <button
                type="button"
                className={`account-pill ${accountMenuOpen ? "open" : ""}`}
                onClick={() => setAccountMenuOpen((prev) => !prev)}
                aria-expanded={accountMenuOpen}
                aria-label="Account menu"
              >
                <span className="account-avatar">{userInitial}</span>
              </button>

              {accountMenuOpen && (
                <div className="account-menu animate-dropdown-in">
                  <div className="account-menu-user">{userEmail}</div>
                  <button type="button" className="logout-btn" onClick={onLogout}>
                    Log out
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {!isAuthenticated && (
        <section className="panel animate-fade-in">
          <h2>Authentication</h2>
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

      {isAuthenticated && (
        <>
          <nav className="nav-bar">
            {["groups", "expense", "balances", "activity"].map((tab) => (
              <button
                key={tab}
                className={`nav-tab ${activeTab === tab ? "active" : ""}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>

      {activeTab === "groups" && (
        <>
          <section className="panel animate-fade-in">
            <h2>Groups</h2>
            <div className="grid2">
              <div className="input-field">
                <input id="groupName" value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder=" " />
                <label htmlFor="groupName">Group name</label>
              </div>
              <button onClick={onCreateGroup}>Create Group</button>
            </div>

            <div className="row" style={{marginTop: '16px', alignItems: 'center', marginBottom: 0}}>
              <div className="input-field" style={{ flex: 1, margin: 0 }}>
                <select id="groupSelect" value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
                  <option value="">Select a group from the list...</option>
                  {groups.map((g) => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
                </select>
              </div>
              {selectedGroupId && (
                <button 
                  onClick={onDeleteGroup}
                  style={{ backgroundColor: 'rgba(239, 68, 68, 0.9)', color: 'white', margin: 0, height: '48px' }}>
                  Delete Group
                </button>
              )}
            </div>
          </section>

          {selectedGroupId && (
            <section className="panel animate-fade-in">
              <h2>Members of {selectedGroup?.name || 'Selected Group'}</h2>
              <div className="grid2">
                <div className="input-field">
                  <input id="memberEmail" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} placeholder=" " />
                  <label htmlFor="memberEmail">Member email</label>
                </div>
                <div className="input-field">
                  <input id="memberNickname" value={memberNickname} onChange={(e) => setMemberNickname(e.target.value)} placeholder=" " />
                  <label htmlFor="memberNickname">Member display name (optional)</label>
                </div>
              </div>
              <div className="small" style={{marginBottom: '16px'}}>Tip: add nickname now so splits can be selected by name.</div>

              <div className="row">
                <button onClick={onAddMember}>Add Member</button>
                <button onClick={onLoadMembers}>Load Members</button>
              </div>

              {members.length > 0 ? (
                <ul className="member-list">
                  {members.map((m) => (
                    <li key={m.id}>
                      {getMemberLabel(m)} ({m.email})
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="small" style={{marginTop: '16px'}}>No members in this group yet. Add yourself and others below.</p>
              )}
            </section>
          )}
        </>
      )}

      {activeTab === "expense" && (
        <section className="panel animate-fade-in">
          <h2>Expense</h2>
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
        </section>
      )}

      {activeTab === "balances" && (
        <section className="panel animate-fade-in">
          <h2>Balances & Settlements</h2>
          <div className="row">
            <button onClick={onLoadBalances}>Load Balances</button>
          </div>

          <h3>Group Balance</h3>
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

      {activeTab === "activity" && (
        <section className="panel animate-fade-in">
          <h2>Activity</h2>
          <button onClick={onLoadActivity} style={{marginBottom: '24px'}}>Load Activity</button>
          <ul>
            {activity.map((a) => (
              <li key={a.id}>
                {formatActivityItem(a)}
              </li>
            ))}
          </ul>
        </section>
      )}

        </>
      )}

      <footer className="status">{status}</footer>
    </div>
  );
}

export default App;
