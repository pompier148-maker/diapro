import { NextRequest, NextResponse } from "next/server";

const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || "https://n8n.gamache.cloud/webhook/diapro-qs";
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || "";

export async function POST(req: NextRequest) {
  const body = await req.json();

  // 1. Essayer n8n en premier
  try {
    const n8nRes = await fetch(N8N_WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(15000),
    });

    if (n8nRes.ok) {
      const data = await n8nRes.json();
      return NextResponse.json({ source: "n8n", ...data });
    }
  } catch {
    // n8n indisponible — bascule sur Anthropic
  }

  // 2. Fallback Anthropic Claude
  if (!ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "Service indisponible. Configurez ANTHROPIC_API_KEY." },
      { status: 503 }
    );
  }

  const prompt = buildPrompt(body);

  try {
    const claudeRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-opus-4-6",
        max_tokens: 2048,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!claudeRes.ok) {
      const err = await claudeRes.text();
      return NextResponse.json({ error: `Anthropic error: ${err}` }, { status: 502 });
    }

    const claudeData = await claudeRes.json();
    const diagnostic = claudeData.content?.[0]?.text || "";
    return NextResponse.json({ source: "anthropic", output: diagnostic });
  } catch (e) {
    return NextResponse.json({ error: `Erreur serveur: ${e}` }, { status: 500 });
  }
}

function buildPrompt(data: Record<string, string>) {
  return `
Voici les informations sur le véhicule à diagnostiquer :

- Marque : ${data.marque || "N/A"}
- Modèle : ${data.modele || "N/A"}
- Année : ${data.annee || "N/A"}
- Kilométrage : ${data.kilometrage || "N/A"} km
- Type de moteur : ${data.moteur || "N/A"}
- Catégorie du problème : ${data.categorie || "N/A"}
- Codes DTC/SPN-FMI : ${data.codes_dtc || "Aucun"}
- Symptômes : ${data.symptomes || "N/A"}
- Travaux récents : ${data.travaux_recents || "Aucun"}

Fournis un diagnostic complet en français.
  `.trim();
}

const SYSTEM_PROMPT = `Tu es Mécano, mécanicien expert en camions lourds avec 30 ans d'expérience. Tu travailles dans un atelier diesel professionnel au Québec. Tu parles en français québécois professionnel, direct et précis.

Quand tu reçois les données d'un véhicule, tu fournis un diagnostic structuré ainsi :

## 🔍 ANALYSE DES SYMPTÔMES
- Interprétation des codes DTC/SPN-FMI
- Corrélation avec les symptômes décrits

## ⚙️ CAUSES PROBABLES
Liste des causes les plus probables, par ordre de probabilité

## 🛠️ PROCÉDURE DE DIAGNOSTIC
Étapes concrètes pour confirmer le diagnostic

## 🔧 RÉPARATIONS RECOMMANDÉES
- Pièces à vérifier/remplacer
- Procédures de réparation

## ⚠️ POINTS D'ATTENTION
- Risques de sécurité
- Vérifications additionnelles importantes

## 📋 AVERTISSEMENT
Toujours terminer par : "Ce diagnostic est fourni à titre indicatif. Valider avec les données techniques officielles du fabricant (manuels de service, bulletins techniques) et les outils de diagnostic appropriés avant toute réparation."`;
