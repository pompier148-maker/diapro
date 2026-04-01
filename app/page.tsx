"use client";

import { useState } from "react";

const MARQUES = [
  "Freightliner", "Kenworth", "Peterbilt", "Volvo", "Mack",
  "International", "Hino", "Mitsubishi Fuso", "Sterling", "Detroit Diesel",
];

const MOTEURS = [
  "Cummins ISX / X15",
  "Cummins ISL",
  "Cummins ISB",
  "Cummins ISC 8.3",
  "Detroit DD13",
  "Detroit DD15",
  "Detroit DD16",
  "Paccar MX-13",
  "Paccar MX-11",
  "Paccar PX-9",
  "Paccar PX-7",
  "Volvo D13",
  "Volvo D11",
  "Mack MP8",
  "Mack MP7",
  "Navistar A26",
  "Mercedes MBE 900",
  "Mercedes MBE 906",
  "Mercedes MBE 4000",
  "Caterpillar C15",
  "Caterpillar C13",
];

const CATEGORIES = [
  "Moteur",
  "Transmission / Boîte de vitesses",
  "Système de freinage (ABS / EBS)",
  "Système électrique / ECM",
  "Système de refroidissement",
  "Carburant / Injection",
  "Système d'échappement / DPF / SCR",
  "Suspension / Essieux",
  "Direction",
  "Système d'air",
  "Embrayage",
  "Châssis / Carrosserie",
  "Autre",
];

interface FormData {
  marque: string;
  modele: string;
  annee: string;
  kilometrage: string;
  moteur: string;
  categorie: string;
  codes_dtc: string;
  symptomes: string;
  travaux_recents: string;
}

const INITIAL_FORM: FormData = {
  marque: "",
  modele: "",
  annee: "",
  kilometrage: "",
  moteur: "",
  categorie: "",
  codes_dtc: "",
  symptomes: "",
  travaux_recents: "",
};

export default function DiaproPage() {
  const [form, setForm] = useState<FormData>(INITIAL_FORM);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [source, setSource] = useState<string>("");
  const [error, setError] = useState<string>("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult("");
    setError("");
    setSource("");

    // 1. Essayer n8n directement (CORS * configuré, pas de timeout Vercel)
    try {
      const n8nRes = await fetch("https://n8n.gamache.cloud/webhook/diapro-qs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
        signal: AbortSignal.timeout(60000), // 60s pour laisser le temps à QuickServe + Claude
      });

      if (n8nRes.ok) {
        const data = await n8nRes.json();
        const text = data.diagnostic || data.output || data.message || data.response || JSON.stringify(data, null, 2);
        if (text) {
          setResult(text);
          setSource("n8n");
          setLoading(false);
          return;
        }
      }
    } catch {
      // n8n indisponible — bascule sur le fallback Vercel
    }

    // 2. Fallback via API Vercel (Anthropic)
    try {
      const res = await fetch("/api/diagnostic", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await res.json();

      if (!res.ok || data.error) {
        setError(data.error || "Erreur inconnue.");
      } else {
        const text = data.output || data.diagnostic || data.message || data.response || JSON.stringify(data, null, 2);
        setResult(text);
        setSource(data.source || "anthropic");
      }
    } catch {
      setError("Impossible de contacter le serveur de diagnostic.");
    } finally {
      setLoading(false);
    }
  }

  function handleReset() {
    setForm(INITIAL_FORM);
    setResult("");
    setError("");
    setSource("");
  }

  function handleExport() {
    if (!result) return;
    const content = `DIAPRO — Diagnostic Camion Lourd
Généré le : ${new Date().toLocaleString("fr-CA")}
Source : ${source || "N/A"}

--- VÉHICULE ---
Marque : ${form.marque}
Modèle : ${form.modele}
Année : ${form.annee}
Kilométrage : ${form.kilometrage} km
Moteur : ${form.moteur}
Catégorie : ${form.categorie}
Codes DTC/SPN-FMI : ${form.codes_dtc || "Aucun"}
Symptômes : ${form.symptomes}
Travaux récents : ${form.travaux_recents || "Aucun"}

--- DIAGNOSTIC DE MÉCANO ---
${result}

---
⚠️ Ce diagnostic est fourni à titre indicatif. Toujours valider avec les sources officielles du fabricant.
`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `diapro-${form.marque}-${form.annee}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const isFormValid = form.marque && form.moteur && form.symptomes;

  return (
    <div className="min-h-screen bg-[#0d0d0d] text-gray-100 font-mono">
      {/* Header */}
      <header className="border-b border-[#2a2a2a] bg-[#111111] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-3xl">🔧</span>
            <div>
              <h1 className="text-2xl font-bold text-amber-400 tracking-wider">DIAPRO</h1>
              <p className="text-xs text-gray-500 uppercase tracking-widest">Assistant Diagnostic Camions Lourds</p>
            </div>
          </div>
          <div className="text-right hidden sm:block">
            <p className="text-xs text-gray-500">Propulsé par</p>
            <p className="text-sm text-amber-400 font-bold">Mécano — Expert Diesel</p>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {/* Formulaire */}
        <section className="bg-[#1a1a1a] border border-[#2a2a2a] rounded-xl p-6">
          <h2 className="text-lg font-bold text-amber-400 mb-6 flex items-center gap-2">
            <span>📋</span> Informations du véhicule
          </h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Ligne 1 : Marque / Modèle / Année */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase mb-1">Marque *</label>
                <select
                  name="marque"
                  value={form.marque}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {MARQUES.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase mb-1">Modèle</label>
                <input
                  type="text"
                  name="modele"
                  value={form.modele}
                  onChange={handleChange}
                  placeholder="ex: Cascadia, T680..."
                  className="w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase mb-1">Année</label>
                <input
                  type="number"
                  name="annee"
                  value={form.annee}
                  onChange={handleChange}
                  placeholder="2019"
                  min="1990"
                  max="2026"
                  className="w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Ligne 2 : Kilométrage / Moteur */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase mb-1">Kilométrage (km)</label>
                <input
                  type="number"
                  name="kilometrage"
                  value={form.kilometrage}
                  onChange={handleChange}
                  placeholder="ex: 850000"
                  className="w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase mb-1">Type de moteur *</label>
                <select
                  name="moteur"
                  value={form.moteur}
                  onChange={handleChange}
                  required
                  className="w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {MOTEURS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </div>
            </div>

            {/* Ligne 3 : Catégorie + Codes DTC */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 uppercase mb-1">Catégorie du problème</label>
                <select
                  name="categorie"
                  value={form.categorie}
                  onChange={handleChange}
                  className="w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-100 focus:outline-none focus:border-amber-500"
                >
                  <option value="">-- Sélectionner --</option>
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-400 uppercase mb-1">Codes DTC / SPN-FMI</label>
                <input
                  type="text"
                  name="codes_dtc"
                  value={form.codes_dtc}
                  onChange={handleChange}
                  placeholder="ex: SPN 3031 FMI 5, P0401"
                  className="w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500"
                />
              </div>
            </div>

            {/* Symptômes */}
            <div>
              <label className="block text-xs text-gray-400 uppercase mb-1">Symptômes *</label>
              <textarea
                name="symptomes"
                value={form.symptomes}
                onChange={handleChange}
                required
                rows={3}
                placeholder="Décrivez les symptômes observés : fumée, bruit, perte de puissance, voyants allumés..."
                className="w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Travaux récents */}
            <div>
              <label className="block text-xs text-gray-400 uppercase mb-1">Travaux récents</label>
              <textarea
                name="travaux_recents"
                value={form.travaux_recents}
                onChange={handleChange}
                rows={2}
                placeholder="Changement d'huile, filtre DPF, capteurs remplacés..."
                className="w-full bg-[#0d0d0d] border border-[#333] rounded-lg px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:border-amber-500 resize-none"
              />
            </div>

            {/* Boutons */}
            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={loading || !isFormValid}
                className="flex-1 sm:flex-none bg-amber-500 hover:bg-amber-400 disabled:bg-gray-700 disabled:text-gray-500 text-black font-bold py-3 px-8 rounded-lg transition-colors text-sm uppercase tracking-wider"
              >
                {loading ? "⏳ Analyse en cours..." : "🔍 Lancer le diagnostic"}
              </button>
              <button
                type="button"
                onClick={handleReset}
                className="px-6 py-3 border border-[#333] hover:border-gray-500 text-gray-400 hover:text-gray-200 rounded-lg text-sm transition-colors"
              >
                Réinitialiser
              </button>
            </div>
          </form>
        </section>

        {/* Loading */}
        {loading && (
          <section className="bg-[#1a1a1a] border border-amber-500/30 rounded-xl p-6 text-center">
            <div className="text-4xl mb-3 animate-pulse">⚙️</div>
            <p className="text-amber-400 font-bold">Mécano analyse le problème...</p>
            <p className="text-sm text-gray-500 mt-1">Connexion au système de diagnostic</p>
          </section>
        )}

        {/* Erreur */}
        {error && (
          <section className="bg-red-950/30 border border-red-700 rounded-xl p-6">
            <h3 className="text-red-400 font-bold flex items-center gap-2 mb-2">
              <span>❌</span> Erreur
            </h3>
            <p className="text-red-300 text-sm">{error}</p>
          </section>
        )}

        {/* Résultat */}
        {result && (
          <section className="bg-[#1a1a1a] border border-green-700/50 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-green-400 flex items-center gap-2">
                <span>🔧</span> Diagnostic de Mécano
                {source && (
                  <span className="text-xs bg-[#2a2a2a] text-gray-400 px-2 py-0.5 rounded-full ml-2">
                    via {source}
                  </span>
                )}
              </h2>
              <button
                onClick={handleExport}
                className="text-xs bg-[#2a2a2a] hover:bg-[#333] border border-[#444] text-gray-300 px-4 py-2 rounded-lg transition-colors"
              >
                📄 Exporter .txt
              </button>
            </div>

            {/* Contenu du diagnostic — rendu markdown simple */}
            <div className="prose prose-invert prose-sm max-w-none">
              <DiagnosticRenderer text={result} />
            </div>

            {/* Avertissement */}
            <div className="mt-6 p-4 bg-amber-950/30 border border-amber-700/50 rounded-lg">
              <p className="text-amber-400 text-xs font-bold uppercase mb-1">⚠️ Avertissement</p>
              <p className="text-amber-200/80 text-xs leading-relaxed">
                Ce diagnostic est fourni à titre indicatif seulement. Toujours valider avec les manuels de service
                officiels du fabricant, les bulletins techniques (TSB) et les outils de diagnostic appropriés
                avant d&apos;effectuer toute réparation. Les résultats peuvent varier selon l&apos;état réel du véhicule.
              </p>
            </div>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[#1a1a1a] mt-12 py-6 text-center">
        <p className="text-xs text-gray-600">
          DIAPRO v1.0 — Gamache Transport © {new Date().getFullYear()} — Usage interne
        </p>
      </footer>
    </div>
  );
}

/** Rendu simple du markdown retourné par Claude */
function DiagnosticRenderer({ text }: { text: string }) {
  const lines = text.split("\n");

  return (
    <div className="space-y-1 text-sm text-gray-200 leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="text-amber-400 font-bold text-base mt-4 mb-1">
              {line.replace(/^## /, "")}
            </h3>
          );
        }
        if (line.startsWith("### ")) {
          return (
            <h4 key={i} className="text-amber-300 font-semibold mt-3 mb-1">
              {line.replace(/^### /, "")}
            </h4>
          );
        }
        if (line.startsWith("- ") || line.startsWith("• ")) {
          return (
            <p key={i} className="pl-4 text-gray-300">
              <span className="text-amber-500 mr-2">▸</span>
              {line.replace(/^[-•] /, "")}
            </p>
          );
        }
        if (line.match(/^\d+\. /)) {
          return (
            <p key={i} className="pl-4 text-gray-300">
              <span className="text-amber-500 mr-1">{line.match(/^\d+/)?.[0]}.</span>
              {line.replace(/^\d+\. /, "")}
            </p>
          );
        }
        if (line.startsWith("**") && line.endsWith("**")) {
          return (
            <p key={i} className="font-bold text-gray-100">
              {line.replace(/\*\*/g, "")}
            </p>
          );
        }
        if (line.trim() === "") {
          return <div key={i} className="h-2" />;
        }
        return <p key={i} className="text-gray-300">{line}</p>;
      })}
    </div>
  );
}
