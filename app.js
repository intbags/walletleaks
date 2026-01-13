let wallet = null;

const connectBtn = document.getElementById("connectBtn");
const publishBtn = document.getElementById("publishBtn");
const statusEl = document.getElementById("status");
const statementInput = document.getElementById("statementInput");
const usernameBox = document.getElementById("usernameBox");
const usernameInput = document.getElementById("usernameInput");

connectBtn.onclick = async () => {
  if (!window.solana || !window.solana.isPhantom) {
    alert("phantom wallet required");
    return;
  }

  const res = await window.solana.connect();
  wallet = res.publicKey.toString();

  connectBtn.innerText = "wallet connected";
  connectBtn.classList.add("disabled");

  usernameBox.classList.remove("hidden");
  publishBtn.classList.remove("disabled");
};

publishBtn.onclick = async () => {
  const text = statementInput.value.trim();
  const username = usernameInput.value.trim();

  if (!text || !username.startsWith("@")) {
    statusEl.innerText = "add a @username and a statement";
    return;
  }

  statusEl.innerText = "signing statement...";

  const message = `statement:\n${text}\nby ${username}\nwallet:${wallet}`;
  const encoded = new TextEncoder().encode(message);

  await window.solana.signMessage(encoded, "utf8");

  statusEl.innerText = "statement published";

  const tweet = `i just posted a public statement as my wallet:\n"${text}"`;
  setTimeout(() => {
    window.open(
      `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweet)}`,
      "_blank"
    );
  }, 600);
};
