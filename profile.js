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

  const { data: posts } = await supabase
    .from("statements")
    .select("content, created_at")
    .eq("user_wallet", user.wallet);

  const container = document.getElementById("posts");

  posts.forEach(p => {
    const div = document.createElement("div");
    div.className = "post";
    div.innerHTML = `<p>${p.content}</p>`;
    container.appendChild(div);
  });
}

loadProfile();
