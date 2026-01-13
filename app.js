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

    // check username
    const { data } = await supabase
      .from("users")
      .select("username")
      .eq("wallet", wallet)
      .maybeSingle();

    if (!data) {
      usernameModal.classList.remove("hidden");
    }
  };

  // ---------- USERNAME INPUT ----------
  modalUsernameInput.oninput = async () => {
    let u = modalUsernameInput.value.trim();
    if (!u.startsWith("@")) u = "@" + u;
    modalUsernameInput.value = u;

    if (u.length < 4) {
      usernameStatus.innerText = "min 3 characters";
      confirmUsernameBtn.classList.add("disabled");
      return;
    }

    const { data } = await supabase
      .from("users")
      .select("id")
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

  // ---------- CONFIRM USERNAME ----------
  confirmUsernameBtn.onclick = async () => {
    if (confirmUsernameBtn.classList.contains("disabled")) return;

    const u = modalUsernameInput.value.trim();

    await supabase.from("users").insert({
      wallet,
      username: u
    });

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
    const { data } = await supabase
      .from("statements")
      .select("content, created_at, users(username)")
      .order("created_at", { ascending: false })
      .limit(12);

    feedEl.innerHTML = "";

    data.forEach(p => {
      const el = document.createElement("div");
      el.className = "post";
      el.innerHTML = `
        <a href="#">${p.users.username}</a>
        <div>${p.content}</div>
      `;
      feedEl.appendChild(el);
    });
  }

  loadFeed();
});
