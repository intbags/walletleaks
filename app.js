document.addEventListener("DOMContentLoaded", () => {

  // ---------- SUPABASE ----------
  let supabase = null;
  try {
    supabase = window.supabase.createClient(
      "https://zzxqftnarcpjkqiztuof.supabase.co",
      "sb_publishable_T76EtSvgz5oMzg2zW2cGkA_I1fX3DIO"
    );
  } catch (e) {
    console.error("supabase error", e);
  }

  // ---------- DOM ----------
  const connectBtn = document.getElementById("connectBtn");
  const publishBtn = document.getElementById("publishBtn");
  const statementInput = document.getElementById("statementInput");
  const statusEl = document.getElementById("status");
  const feedEl = document.getElementById("feed");

  const usernameModal = document.getElementById("usernameModal");
  const modalUsernameInput = document.getElementById("modalUsernameInput");
  const confirmUsernameBtn = document.getElementById("confirmUsernameBtn");
  const usernameStatus = document.getElementById("usernameStatus");

  let wallet = null;
  let currentUsername = null;

  // ---------- CONNECT ----------
  connectBtn.onclick = async () => {
    if (!window.solana || !window.solana.isPhantom) {
      alert("phantom required");
      return;
    }

    const res = await window.solana.connect();
    wallet = res.publicKey.toString();

    connectBtn.innerText = "wallet connected";
    connectBtn.classList.add("disabled");
    publishBtn.classList.remove("disabled");

    const { data } = await supabase
      .from("users")
      .select("username")
      .eq("wallet", wallet)
      .maybeSingle();

    if (!data) {
      modalUsernameInput.value = "@";
      usernameModal.classList.remove("hidden");
    } else {
      currentUsername = data.username;
    }
  };

  // ---------- USERNAME INPUT ----------
  modalUsernameInput.oninput = async () => {
    let val = modalUsernameInput.value;

    if (!val.startsWith("@")) {
      val = "@" + val.replace(/@/g, "");
    }

    modalUsernameInput.value = val;

    const u = val.trim();

    if (u.length < 4) {
      usernameStatus.innerText = "min 3 characters (without @)";
      confirmUsernameBtn.classList.add("disabled");
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("wallet")
      .eq("username", u)
      .maybeSingle();

    if (data) {
      usernameStatus.innerText = "username taken";
      confirmUsernameBtn.classList.add("disabled");
    } else {
      usernameStatus.innerText = "username available";
      confirmUsernameBtn.classList.remove("disabled");
    }
  };

  modalUsernameInput.onkeydown = (e) => {
    const pos = e.target.selectionStart;
    if (pos === 0 && (e.key === "Backspace" || e.key === "Delete")) {
      e.preventDefault();
    }
  };

  modalUsernameInput.onclick = (e) => {
    if (e.target.selectionStart === 0) {
      e.target.setSelectionRange(1, 1);
    }
  };

  // ---------- CONFIRM USERNAME ----------
  confirmUsernameBtn.onclick = async () => {
    if (confirmUsernameBtn.classList.contains("disabled")) return;

    const u = modalUsernameInput.value.trim();

    await supabase.from("users").insert({
      wallet,
      username: u
    });

    currentUsername = u;
    usernameModal.classList.add("hidden");
  };

  // ---------- PUBLISH ----------
  publishBtn.onclick = async () => {
    if (!wallet) return;

    const text = statementInput.value.trim();
    if (!text) return;

    statusEl.innerText = "signing…";

    const msg = `statement:${text}\nwallet:${wallet}`;
    const encoded = new TextEncoder().encode(msg);
    const signed = await window.solana.signMessage(encoded, "utf8");

    const sig = btoa(
      String.fromCharCode(...signed.signature)
    );

    statusEl.innerText = "publishing…";

    await supabase.from("statements").insert({
      user_wallet: wallet,
      content: text,
      signature: sig
    });

    statusEl.innerText = "statement published";
    statementInput.value = "";

    loadFeed();
  };

  // ---------- FEED ----------
  async function loadFeed() {
    const { data: statements } = await supabase
      .from("statements")
      .select("id, content, created_at, user_wallet")
      .order("created_at", { ascending: false })
      .limit(20);

    if (!statements || statements.length === 0) {
      feedEl.innerHTML = '<div class="empty-state">no statements yet. be the first to publish.</div>';
      return;
    }

    const wallets = [...new Set(statements.map(s => s.user_wallet))];
    const { data: users } = await supabase
      .from("users")
      .select("wallet, username")
      .in("wallet", wallets);

    const userMap = {};
    users.forEach(u => {
      userMap[u.wallet] = u.username;
    });

    feedEl.innerHTML = "";

    statements.forEach(p => {
      const username = userMap[p.user_wallet] || "@unknown";
      const el = document.createElement("div");
      el.className = "post";
      el.innerHTML = `
        <a href="profile.html?u=${encodeURIComponent(username)}">${username}</a>
        <div>${p.content}</div>
      `;
      feedEl.appendChild(el);
    });
  }

  loadFeed();
});
