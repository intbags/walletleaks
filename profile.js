document.addEventListener("DOMContentLoaded", () => {
const supabase = window.supabase.createClient(
  "https://zzxqftnarcpjkqiztuof.supabase.co",
  "sb_publishable_T76EtSvgz5oMzg2zW2cGkA_I1fX3DIO"
);

const params = new URLSearchParams(window.location.search);
const username = params.get("u");

let currentWallet = null;
let profileWallet = null;

async function init() {
  if (!username) {
    window.location.href = "index.html";
    return;
  }

  document.getElementById("username").innerText = username;

  if (window.solana && window.solana.isConnected) {
    try {
      const accounts = await window.solana.request({ method: "getAccounts" });
      if (accounts && accounts.length > 0) {
        currentWallet = accounts[0].address;
      }
    } catch (e) {
      console.log("wallet not connected yet");
    }
  }

  loadProfile();
}

async function loadProfile() {
  const { data: user } = await supabase
    .from("users")
    .select("wallet")
    .eq("username", username)
    .maybeSingle();

  if (!user) {
    document.getElementById("posts").innerHTML = '<div class="empty-state">user not found</div>';
    return;
  }

  profileWallet = user.wallet;

  const { data: statements } = await supabase
    .from("statements")
    .select("content, created_at")
    .eq("user_wallet", user.wallet)
    .order("created_at", { ascending: false });

  const { count: followersCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("following_wallet", user.wallet);

  const { count: followingCount } = await supabase
    .from("follows")
    .select("*", { count: "exact", head: true })
    .eq("follower_wallet", user.wallet);

  document.getElementById("followersCount").innerText = followersCount || 0;
  document.getElementById("followingCount").innerText = followingCount || 0;

  const followBtn = document.getElementById("followBtn");

  if (currentWallet && currentWallet === profileWallet) {
    followBtn.style.display = "none";
  } else if (currentWallet) {
    const { data: existingFollow } = await supabase
      .from("follows")
      .select("id")
      .eq("follower_wallet", currentWallet)
      .eq("following_wallet", profileWallet)
      .maybeSingle();

    if (existingFollow) {
      followBtn.innerText = "unfollow";
      followBtn.classList.add("following");
    } else {
      followBtn.innerText = "follow";
      followBtn.classList.remove("following");
    }

    followBtn.classList.remove("disabled");
  } else {
    followBtn.innerText = "connect wallet to follow";
    followBtn.classList.add("disabled");
  }

  const container = document.getElementById("posts");
  container.innerHTML = "";

  if (!statements || statements.length === 0) {
    container.innerHTML = '<div class="empty-state">no statements yet</div>';
    return;
  }

  statements.forEach(p => {
    const div = document.createElement("div");
    div.className = "post";
    div.innerHTML = `
      <div>${p.content}</div>
      <div class="post-date">${new Date(p.created_at).toLocaleDateString()}</div>
    `;
    container.appendChild(div);
  });
}

  document.getElementById("followBtn").onclick = async () => {
    if (!currentWallet) {
      if (window.solana && window.solana.isPhantom) {
        try {
          const res = await window.solana.connect();
          currentWallet = res.publicKey.toString();
          loadProfile();
        } catch (e) {
          alert("failed to connect wallet");
        }
      } else {
        alert("phantom wallet required");
      }
      return;
    }

    const followBtn = document.getElementById("followBtn");
    const isFollowing = followBtn.classList.contains("following");

    if (isFollowing) {
      await supabase
        .from("follows")
        .delete()
        .eq("follower_wallet", currentWallet)
        .eq("following_wallet", profileWallet);
    } else {
      await supabase
        .from("follows")
        .insert({
          follower_wallet: currentWallet,
          following_wallet: profileWallet
        });
    }

    loadProfile();
  };

  document.getElementById("backBtn").onclick = () => {
    window.location.href = "index.html";
  };

  init();
});
