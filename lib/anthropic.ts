import Anthropic from "@anthropic-ai/sdk";

let client: Anthropic | null = null;
export function aiEnabled(): boolean { return !!process.env.ANTHROPIC_API_KEY; }

const SYSTEM = "Tu es analyste au Centre du camion Gamache. On te donne toutes les données connues d'un véhicule en inventaire (JSON). Rédige en français, en 3 courts paragraphes de prose (pas de listes) : 1) où en est ce dossier et son histoire en une ligne de temps résumée; 2) ce qui cloche ou mérite attention (marge coût/prix, offres sans vente, estimés à faire, incohérences); 3) une recommandation concrète pour le vendeur ou l'atelier. Ne rien inventer : si une donnée manque, dis-le. Montants en dollars canadiens, dates AAAA-MM-JJ.";

/** Analyse narrative d'une fiche. Le JSON compact vient du navigateur mais ne contient que des données déjà affichées. */
export async function analyse(compact: unknown): Promise<string> {
  if (!client) client = new Anthropic();
  const payload = JSON.stringify(compact).slice(0, 60000);
  const stream = client.messages.stream({
    model: process.env.ANTHROPIC_MODEL || "claude-opus-5",
    max_tokens: 4000,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium" },
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: payload }],
  });
  const msg = await stream.finalMessage();
  if (msg.stop_reason === "refusal") return "Analyse refusée par le modèle.";
  return msg.content.filter(b => b.type === "text").map(b => b.text).join("\n") + (msg.stop_reason === "max_tokens" ? "\n[…réponse tronquée]" : "");
}
