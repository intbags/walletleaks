const supabase = window.supabase.createClient(
  "https://zzxqftnarcpjkqiztuof.supabase.co",
  "sb_publishable_T76EtSvgz5oMzg2zW2cGkA_I1fX3DIO"
);


const params = new URLSearchParams(window.location.search);
const username = params.get("u");

document.getElementById("username").innerText = username;

async function loadProfile() {
  const { data: user } = await supabase
    .from("users")
    .select("wallet")
    .eq("username", username)
    .single();

  if (!user) return;

  const { data: posts } = await supabase
    .from("statements")
    .select("content, created_at")
    .eq("user_wallet", user.wallet)
    .order("created_at", { ascending: false });

  const container = document.getElementById("posts");
  posts.forEach(p => {
    const el = document.createElement("div");
    el.className = "post";
    el.innerText = p.content;
    container.appendChild(el);
  });
}

loadProfile();

document.getElementById("followBtn").onclick = async () => {
  const wallet = window.solana.publicKey.toString();

  await supabase.from("follows").insert({
    follower_wallet: wallet,
    following_wallet: user.wallet
  });

  alert("followed");
};

