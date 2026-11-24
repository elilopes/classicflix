import React, { useState } from "react";
import { ArrowLeft, Download, RefreshCw } from "lucide-react";
import { VideoConverter } from "./VideoConverter";
import { SocialMediaDownloader } from "./SocialMediaDownloader";
import type { AppLanguage } from "../types";

export function ConvertPage({ onClose, language }: { onClose: () => void; language: AppLanguage }) {
  const [tab, setTab] = useState<"convert" | "download">("convert");
  return <div className="min-vh-100 bg-black text-white">
    <header className="sticky-top bg-dark border-bottom border-secondary px-3 py-3">
      <div className="container d-flex align-items-center justify-content-between gap-3">
        <button className="btn btn-outline-light btn-sm d-flex align-items-center gap-2" onClick={onClose}><ArrowLeft size={17}/> Voltar ao ClassicFlix</button>
        <strong className="fs-5">ClassicFlix <span className="text-danger">Convert</span></strong>
        <span className="small text-white-50 d-none d-md-inline">Conversor e downloader de mídia</span>
      </div>
      <div className="container d-flex justify-content-center gap-2 mt-3">
        <button className={`btn btn-sm d-flex align-items-center gap-2 ${tab === "convert" ? "btn-danger" : "btn-outline-light"}`} onClick={() => setTab("convert")}><RefreshCw size={16}/> Converter arquivos</button>
        <button className={`btn btn-sm d-flex align-items-center gap-2 ${tab === "download" ? "btn-danger" : "btn-outline-light"}`} onClick={() => setTab("download")}><Download size={16}/> Baixar de redes sociais</button>
      </div>
    </header>
    <main className="container-fluid py-3">
      {tab === "download" ? <SocialMediaDownloader/> : <VideoConverter isOpen={true} onClose={onClose} language={language}/>}
    </main>
  </div>;
}
