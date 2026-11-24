import React, { useState } from "react";
import { Search, Download, Loader2, Link2, Youtube, AlertCircle, CheckCircle2 } from "lucide-react";

type SearchResult = { id: string; title: string; url: string; thumbnail: string; duration: string; author: string };

export function SocialMediaDownloader() {
  const [query, setQuery] = useState("");
  const [mode, setMode] = useState<"video" | "audio">("video");
  const [quality, setQuality] = useState("highest");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [busy, setBusy] = useState(false);
  const [activeUrl, setActiveUrl] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const isUrl = (value: string) => /^https?:\/\//i.test(value.trim());

  async function searchOrDownload() {
    const value = query.trim();
    if (!value) return;
    setError(""); setSuccess(""); setResults([]);
    if (isUrl(value)) {
      await download(value);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch(`/api/social-media/search?q=${encodeURIComponent(value)}`);
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Falha na pesquisa.");
      setResults(data);
      if (!data.length) setError("Nenhum vídeo encontrado. Experimente outro termo ou cole um link.");
    } catch (e: any) { setError(e.message || "Erro ao pesquisar."); }
    finally { setBusy(false); }
  }

  async function download(url: string) {
    setBusy(true); setActiveUrl(url); setError(""); setSuccess("");
    try {
      const response = await fetch(`/api/social-media/download?url=${encodeURIComponent(url)}&mode=${mode}&quality=${quality}`);
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Download falhou (HTTP ${response.status}).`);
      }
      const blob = await response.blob();
      const disposition = response.headers.get("content-disposition") || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? decodeURIComponent(match[1]) : `classicflix-media.${mode === "audio" ? "mp3" : "mp4"}`;
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl; anchor.download = filename;
      document.body.appendChild(anchor); anchor.click(); anchor.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
      setSuccess(`Download concluído: ${filename}`);
    } catch (e: any) { setError(e.message || "Não foi possível baixar esta mídia."); }
    finally { setBusy(false); setActiveUrl(""); }
  }

  return (
    <section className="container py-4" style={{ maxWidth: 980 }}>
      <div className="text-center mb-4">
        <div className="d-inline-flex align-items-center justify-content-center rounded-circle bg-danger bg-opacity-10 p-3 mb-3"><Youtube size={30} className="text-danger" /></div>
        <h2 className="text-white fw-bold">Download de vídeos e áudio</h2>
        <p className="text-white-50">Pesquise vídeos do YouTube ou cole um link de uma rede social compatível.</p>
      </div>
      <div className="card bg-dark border-secondary shadow-lg">
        <div className="card-body p-3 p-md-4">
          <div className="d-flex flex-wrap gap-2 mb-3">
            <button className={`btn btn-sm ${mode === "video" ? "btn-danger" : "btn-outline-light"}`} onClick={() => setMode("video")}>Vídeo</button>
            <button className={`btn btn-sm ${mode === "audio" ? "btn-danger" : "btn-outline-light"}`} onClick={() => setMode("audio")}>Áudio MP3</button>
            {mode === "video" && <select className="form-select form-select-sm bg-black text-white border-secondary" style={{ width: 170 }} value={quality} onChange={e => setQuality(e.target.value)}><option value="highest">Melhor qualidade</option><option value="360p">Até 360p</option><option value="lowest">Menor tamanho</option></select>}
          </div>
          <div className="input-group">
            <span className="input-group-text bg-black text-white-50 border-secondary"><Link2 size={18}/></span>
            <input className="form-control bg-black text-white border-secondary" value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === "Enter" && void searchOrDownload()} placeholder="Pesquise no YouTube ou cole a URL da mídia" />
            <button className="btn btn-danger d-flex align-items-center gap-2" onClick={() => void searchOrDownload()} disabled={busy || !query.trim()}>{busy ? <Loader2 size={17} className="spinner-border-sm"/> : isUrl(query) ? <Download size={17}/> : <Search size={17}/>} {busy ? "Processando…" : isUrl(query) ? "Baixar" : "Pesquisar"}</button>
          </div>
          <div className="small text-white-50 mt-2">Plataformas suportadas pelo mecanismo yt-dlp: YouTube, TikTok, Instagram, Facebook, Vimeo, X/Twitter, Reddit, Pinterest, SoundCloud e outras.</div>
        </div>
      </div>
      {error && <div className="alert alert-danger mt-3 d-flex gap-2"><AlertCircle size={18}/><span>{error}</span></div>}
      {success && <div className="alert alert-success mt-3 d-flex gap-2"><CheckCircle2 size={18}/><span>{success}</span></div>}
      {results.length > 0 && <div className="mt-4">
        <h5 className="text-white mb-3">Resultados da pesquisa</h5>
        <div className="d-grid gap-3">{results.map(item => <div key={item.id || item.url} className="card bg-dark border-secondary"><div className="card-body d-flex gap-3 align-items-center">
          {item.thumbnail && <img src={item.thumbnail} alt="" className="rounded" style={{ width: 132, aspectRatio: "16/9", objectFit: "cover" }}/>}
          <div className="flex-grow-1 min-width-0"><div className="text-white fw-semibold">{item.title}</div><div className="small text-white-50">{item.author} {item.duration ? `• ${item.duration}` : ""}</div></div>
          <button className="btn btn-outline-danger btn-sm d-flex align-items-center gap-2" disabled={busy} onClick={() => void download(item.url)}>{busy && activeUrl === item.url ? <Loader2 size={16}/> : <Download size={16}/>} Baixar</button>
        </div></div>)}</div>
      </div>}
    </section>
  );
}
