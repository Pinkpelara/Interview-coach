const state = {
  applications: [],
  currentSessionId: null,
};

async function api(path, method = "GET", body = null) {
  const res = await fetch(path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : null,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed: ${res.status}`);
  return data;
}

function $(id) {
  return document.getElementById(id);
}

function setMessage(el, obj) {
  el.textContent = typeof obj === "string" ? obj : JSON.stringify(obj, null, 2);
}

function switchTab(name) {
  document.querySelectorAll(".tabs button").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === name);
  });
  document.querySelectorAll(".tab").forEach((tab) => {
    tab.classList.toggle("active", tab.id === `tab-${name}`);
  });
}

function hydrateApplicationSelectors() {
  const selects = [$("prepareApplicationSelect"), $("performApplicationSelect")];
  for (const select of selects) {
    select.innerHTML = state.applications
      .map((a) => `<option value="${a.id}">${a.company_name} — ${a.job_title}</option>`)
      .join("");
  }
  const list = $("applicationList");
  list.innerHTML = state.applications
    .map(
      (a) => `<div class="card">
        <strong>#${a.id} ${a.company_name} — ${a.job_title}</strong><br/>
        Stage: ${a.interview_stage} | Alignment: ${a.alignment_score} | Readiness: ${a.readiness_score}%
      </div>`
    )
    .join("");
}

async function refreshApplications() {
  state.applications = await api("/api/applications");
  hydrateApplicationSelectors();
}

function addTranscriptLine(speaker, message) {
  const div = document.createElement("div");
  div.className = "line";
  div.innerHTML = `<strong>${speaker}:</strong> ${message}`;
  $("transcript").appendChild(div);
  $("transcript").scrollTop = $("transcript").scrollHeight;
}

async function boot() {
  document.querySelectorAll(".tabs button").forEach((btn) =>
    btn.addEventListener("click", () => switchTab(btn.dataset.tab))
  );

  $("signupForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      const data = await api("/api/auth/signup", "POST", Object.fromEntries(f.entries()));
      setMessage($("authMessage"), data);
    } catch (err) {
      setMessage($("authMessage"), err.message);
    }
  });

  $("loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    try {
      await api("/api/auth/login", "POST", Object.fromEntries(f.entries()));
      await updateAuthView();
    } catch (err) {
      setMessage($("authMessage"), err.message);
    }
  });

  $("logoutBtn").addEventListener("click", async () => {
    await api("/api/auth/logout", "POST");
    await updateAuthView();
  });

  $("onboardingForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.anxiety_level = Number(payload.anxiety_level || 5);
    await api("/api/onboarding", "POST", payload);
    alert("Onboarding profile saved.");
  });

  $("applicationForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    const data = await api("/api/applications", "POST", payload);
    alert(`Application created (id ${data.id}). Alignment ${data.alignment.alignment_score}.`);
    e.target.reset();
    await refreshApplications();
  });

  $("generateQuestionsBtn").addEventListener("click", async () => {
    const appId = $("prepareApplicationSelect").value;
    if (!appId) return;
    const data = await api(`/api/applications/${appId}/questions/generate`, "POST");
    alert(data.message);
  });

  $("loadQuestionsBtn").addEventListener("click", async () => {
    const appId = $("prepareApplicationSelect").value;
    const questions = await api(`/api/applications/${appId}/questions`);
    const node = $("questionList");
    node.innerHTML = "";
    questions.forEach((q) => {
      const card = document.createElement("div");
      card.className = "card";
      card.innerHTML = `
        <strong>[${q.category}] ${q.question_text}</strong>
        <p>Framework: ${q.framework} · Difficulty: ${q.difficulty} · Time: ${q.time_guidance_seconds}s</p>
        <p><em>Why asked:</em> ${q.why_asked}</p>
        <details><summary>Model answer</summary><p>${q.model_answer}</p></details>
        <textarea rows="4" id="ans-${q.id}" placeholder="Build your answer...">${q.answer_text || ""}</textarea>
        <div class="row">
          <label>Confidence
            <select id="conf-${q.id}">
              <option value="1">1</option><option value="2">2</option><option value="3" selected>3</option>
              <option value="4">4</option><option value="5">5</option>
            </select>
          </label>
          <button id="save-${q.id}">Save + Analyze</button>
          <pre id="ana-${q.id}" class="message">${q.analysis ? JSON.stringify(q.analysis, null, 2) : ""}</pre>
        </div>
      `;
      node.appendChild(card);
      card.querySelector(`#save-${q.id}`).addEventListener("click", async () => {
        const payload = {
          answer_text: card.querySelector(`#ans-${q.id}`).value,
          confidence_rating: Number(card.querySelector(`#conf-${q.id}`).value),
        };
        const result = await api(`/api/questions/${q.id}/answer`, "POST", payload);
        card.querySelector(`#ana-${q.id}`).textContent = JSON.stringify(result.analysis, null, 2);
      });
    });
  });

  $("startSessionForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(e.target).entries());
    payload.application_id = Number(payload.application_id);
    payload.duration_minutes = Number(payload.duration_minutes);
    const data = await api("/api/sessions/start", "POST", payload);
    state.currentSessionId = data.session_id;
    $("sessionPanel").classList.remove("hidden");
    $("activeSessionMeta").textContent = `#${data.session_id} with ${data.panel.map((p) => p.archetype).join(", ")}`;
    $("transcript").innerHTML = "";
    addTranscriptLine(data.opening.speaker, data.opening.message);
  });

  $("turnForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!state.currentSessionId) return;
    const msg = new FormData(e.target).get("message");
    if (!msg) return;
    addTranscriptLine("You", msg);
    const data = await api(`/api/sessions/${state.currentSessionId}/turn`, "POST", { message: msg });
    addTranscriptLine(`${data.response.speaker} (${data.response.character})`, data.response.message);
    e.target.reset();
  });

  $("endSessionBtn").addEventListener("click", async () => {
    if (!state.currentSessionId) return;
    const report = await api(`/api/sessions/${state.currentSessionId}/end`, "POST");
    $("debriefSessionId").value = state.currentSessionId;
    $("observeSessionId").value = state.currentSessionId;
    alert(`Session ended. Hiring probability: ${report.hiring_probability}`);
    switchTab("debrief");
  });

  $("loadDebriefBtn").addEventListener("click", async () => {
    const id = Number($("debriefSessionId").value);
    const d = await api(`/api/sessions/${id}/debrief`);
    $("debriefPanel").innerHTML = `
      <div class="card"><strong>Hiring Probability:</strong> ${d.hiring_probability ?? "N/A"}</div>
      <div class="card"><strong>Dimension Scores</strong><pre>${JSON.stringify(d.dimension_scores, null, 2)}</pre></div>
      <div class="card"><strong>Moment Map</strong><pre>${JSON.stringify(d.moment_map, null, 2)}</pre></div>
      <div class="card"><strong>Next Targets</strong><pre>${JSON.stringify(d.next_targets, null, 2)}</pre></div>
    `;
  });

  $("generateObserveBtn").addEventListener("click", async () => {
    const id = Number($("observeSessionId").value);
    const data = await api(`/api/sessions/${id}/observe/generate`, "POST");
    alert(data.message);
  });

  $("loadObserveBtn").addEventListener("click", async () => {
    const id = Number($("observeSessionId").value);
    const runs = await api(`/api/sessions/${id}/observe`);
    $("observePanel").innerHTML = runs
      .map(
        (r) => `<div class="card">
          <strong>${r.run_type.toUpperCase()} Run</strong>
          <pre>${JSON.stringify(r.script, null, 2)}</pre>
          <p><em>Annotations:</em> ${r.annotations.join(" | ")}</p>
        </div>`
      )
      .join("");
  });

  $("loadHistoryBtn").addEventListener("click", async () => {
    const h = await api("/api/history");
    $("historyPanel").innerHTML = h
      .map(
        (s) => `<div class="card">
          #${s.id} ${s.company_name} — ${s.job_title}<br/>
          ${s.stage} · ${s.intensity} · ${s.duration_minutes} mins · Hiring Probability: ${s.hiring_probability ?? "N/A"}
        </div>`
      )
      .join("");
  });

  await updateAuthView();
}

async function updateAuthView() {
  const me = await api("/api/me");
  const workspace = $("workspacePanel");
  const authPanel = $("authPanel");
  if (!me.authenticated) {
    workspace.classList.add("hidden");
    authPanel.classList.remove("hidden");
    return;
  }
  authPanel.classList.add("hidden");
  workspace.classList.remove("hidden");
  await refreshApplications();
}

boot().catch((err) => {
  setMessage($("authMessage"), err.message);
});
