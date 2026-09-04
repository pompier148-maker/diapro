import { signIn } from "@/auth";

export default function LoginPage() {
  return (
    <main style={{ minHeight: "100vh", display: "grid", placeItems: "center", fontFamily: "system-ui, sans-serif", background: "#F4F6F8", color: "#172029" }}>
      <form action={async () => { "use server"; await signIn("microsoft-entra-id", { redirectTo: "/" }); }}
        style={{ background: "#fff", border: "1px solid #D9DFE6", borderRadius: 8, padding: "32px 36px", textAlign: "center", maxWidth: 380 }}>
        <div style={{ fontSize: 22, fontWeight: 700 }}>Fiche 360° Stock</div>
        <p style={{ color: "#5F6B78", margin: "8px 0 20px" }}>Réservé au personnel du Groupe Gamache. Connecte-toi avec ton compte Microsoft 365.</p>
        <button type="submit" style={{ padding: "10px 18px", border: 0, borderRadius: 6, background: "#245C8E", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
          Se connecter avec Microsoft
        </button>
      </form>
    </main>
  );
}
