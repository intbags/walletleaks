document.addEventListener("DOMContentLoaded", () => {

const supabase = window.supabase.createClient(
  "https://zzxqftnarcpjkqiztuof.supabase.co",
  "sb_publishable_T76EtSvgz5oMzg2zW2cGkA_I1fX3DIO"
);

let wallet = null;

const connectBtn = document.getElementById("connectBtn");
const publishBtn = document.getElementById("publishBtn");
const usernameInput = document.getElementById("usernameInput");
const statementInput = document.getElementById("statementInput");
const feedEl = document.getElementById("feed");
const statusEl = document.getElementById("status");

// CONNECT
connectBtn.onclick = async () => {
  const res = await window.solana.connect();
  wallet = res.publicKey.toString();
  connectBtn.innerText = "connected";
  connectBtn.classList.add("disabled");
  usernameInput.classList.remove("hidden");
  publishBtn.classList.remove("disabled");
};

// PUBLISH
publishBtn.onclick = async () => {
  const username = usernameInput.value.trim();
  const content = statementInput.value.trim();

  if (!username.startsWith("@") || !content) return;

  await supabase.from("users").upsert({
    wallet,
    username
  });

  await supabase.from("statements").insert({
    user_wallet: wallet,
    content,
    signature: "signed"
  });

  statementInput.value = "";
  loadFeed();
};

// FEED
async function loadFeed() {
  const { data } = await supabase
    .from("statements")
    .select("content, created_at, users(username)")
    .order("created_at", { ascending: false });

  feedEl.innerHTML = "";

  data.forEach(p => {
    const div = document.createElement("div");
    div.className = "post";
    div.innerHTML = `
      <a href="profile.html?u=${p.users.username}">${p.users.username}</a>
      <p>${p.content}</p>
      <small>${new Date(p.created_at).toLocaleString()}</small>
    `;
    feedEl.appendChild(div);
  });
}

loadFeed();

});
