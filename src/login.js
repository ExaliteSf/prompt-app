import { supabase } from "./supabase.js";

document.getElementById("loginGoogle").addEventListener("click", async () => {
    await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
            redirectTo: "https://celebrated-sunflower-bd6871.netlify.app",
        },
    });
});

// Si déjà connecté → redirection
const { data } = await supabase.auth.getSession();
if (data.session) {
    window.location.href = "/";
}
