import React, { useMemo, useRef, useState } from "react";
import { AlertTriangle, Download, Loader2, Pause, Play, ShieldCheck } from "lucide-react";
import { auth } from "../firebase";
import { Movie } from "../types";

type AuditResult = {
  wikidataid: string;
  catalogTitle: string;
  entityExists: boolean;
  wikidataLabelEn: string;
  wikidataLabelPt: string;
  titleP1476: string[];
  p31Qids: string[];
  p6216Qids: string[];
  visualProduction: boolean;
  publicDomain: boolean;
  titleMatchesP1476: boolean | null;
  titleMatchesLabel: boolean | null;
  classification: string;
  error?: string;
};

const VISUAL_INSTANCE_QIDS = new Set([
  "Q11424", "Q24862", "Q506240", "Q15416", "Q21191270", "Q226730",
  "Q20667187", "Q17517379", "Q202866", "Q5398426", "Q24856",
  "Q917641", "Q1259759",
]);
const DOCUMENTARY_GENRE_QID = "Q93204";
const PUBLIC_DOMAIN_QID = "Q19652";

const normalize = (value: string) =>
  value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase().replace(/\s+/g, " ");

const claimEntityIds = (claims: any, property: string): string[] =>
  (claims?.[property] || [])
    .map((claim: any) => claim?.mainsnak?.datavalue?.value?.id)
    .filter((value: unknown): value is string => typeof value === "string");

const titleClaims = (claims: any): string[] =>
  (claims?.P1476 || [])
    .map((claim: any) => claim?.mainsnak?.datavalue?.value)
    .filter((value: any) => value && typeof value.text === "string")
    .map((value: any) => value.text);

function classifyEntity(qid: string, entity: any, catalogTitle: string): AuditResult {
  const exists = Boolean(entity && !entity.missing && entity.id === qid);
  if (!exists) {
    return {
      wikidataid: qid, catalogTitle, entityExists: false, wikidataLabelEn: "", wikidataLabelPt: "",
      titleP1476: [], p31Qids: [], p6216Qids: [], visualProduction: false, publicDomain: false,
      titleMatchesP1476: null, titleMatchesLabel: null, classification: "qid_not_found",
    };
  }

  const claims = entity.claims || {};
  const p31Qids = claimEntityIds(claims, "P31");
  const p6216Qids = claimEntityIds(claims, "P6216");
  const genres = claimEntityIds(claims, "P136");
  const titleP1476 = titleClaims(claims);
  const labelEn = entity.labels?.en?.value || "";
  const labelPt = entity.labels?.pt?.value || "";
  const documentaryFilm = p31Qids.includes("Q11424") && genres.includes(DOCUMENTARY_GENRE_QID);
  const visualProduction = p31Qids.some((id) => VISUAL_INSTANCE_QIDS.has(id)) || documentaryFilm;
  const publicDomain = p6216Qids.includes(PUBLIC_DOMAIN_QID);
  const normalizedCatalog = normalize(catalogTitle || "");
  const titleMatchesP1476 = titleP1476.length
    ? titleP1476.some((title) => normalize(title) === normalizedCatalog)
    : null;
  const titleMatchesLabel = [labelEn, labelPt].filter(Boolean)
    .some((label) => normalize(label) === normalizedCatalog);

  let classification = "valid_visual_public_domain";
  if (!visualProduction) classification = p31Qids.length ? "not_visual_production" : "missing_instance";
  else if (!p6216Qids.length) classification = "missing_copyright_status";
  else if (!publicDomain) classification = "not_public_domain";
  else if (titleMatchesP1476 === false) classification = "title_mismatch";
  else if (titleMatchesP1476 === null) classification = "missing_title_property";

  return {
    wikidataid: qid, catalogTitle, entityExists: true, wikidataLabelEn: labelEn, wikidataLabelPt: labelPt,
    titleP1476, p31Qids, p6216Qids, visualProduction, publicDomain,
    titleMatchesP1476, titleMatchesLabel, classification,
  };
}

const classificationLabel: Record<string, string> = {
  valid_visual_public_domain: "Produção visual em domínio público",
  not_visual_production: "Não é produção visual aceita",
  missing_instance: "Sem instância P31",
  missing_copyright_status: "Sem situação P6216",
  not_public_domain: "Não está classificada como domínio público",
  title_mismatch: "Título divergente de P1476",
  missing_title_property: "Sem propriedade P1476",
  qid_not_found: "QID não encontrado",
  api_error: "Erro na consulta",
};

interface Props { movies: Movie[]; }

export const WikidataCatalogAudit: React.FC<Props> = ({ movies }) => {
  const [results, setResults] = useState<AuditResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [progress, setProgress] = useState({ checked: 0, total: 0 });
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const pauseRef = useRef(false);

  const candidates = useMemo(() => {
    const seen = new Set<string>();
    return movies.flatMap((movie: any) => {
      const qid = String(movie.wikidataId || movie.wikidataid || "").trim().toUpperCase();
      if (!/^Q[1-9]\d*$/.test(qid) || seen.has(qid)) return [];
      seen.add(qid);
      return [{ qid, title: String(movie.title || "") }];
    });
  }, [movies]);

  const summary = useMemo(() => ({
    valid: results.filter((item) => item.classification === "valid_visual_public_domain").length,
    invalidType: results.filter((item) => ["not_visual_production", "missing_instance"].includes(item.classification)).length,
    nonPublic: results.filter((item) => ["not_public_domain", "missing_copyright_status"].includes(item.classification)).length,
    titleIssues: results.filter((item) => item.titleMatchesP1476 !== true || item.titleMatchesLabel === false).length,
    missing: results.filter((item) => item.classification === "qid_not_found").length,
    errors: results.filter((item) => item.classification === "api_error").length,
  }), [results]);

  const runAudit = async () => {
    const user = auth.currentUser;
    if (!user) { setError("Entre com a conta Google autorizada para executar a auditoria."); return; }
    if (!candidates.length) { setError("Não foram encontrados QIDs válidos no catálogo carregado."); return; }

    setIsRunning(true);
    setIsPaused(false);
    setError("");
    setResults([]);
    setProgress({ checked: 0, total: candidates.length });
    pauseRef.current = false;
    const collected: AuditResult[] = [];
    try {
      const token = await user.getIdToken();
      for (let offset = 0; offset < candidates.length; offset += 50) {
        while (pauseRef.current) {
          await new Promise((resolve) => window.setTimeout(resolve, 300));
        }
        const batch = candidates.slice(offset, offset + 50);
        let transientRetries = 0;
        const response = await fetch("/api/admin/wikidata-catalog-audit/batch", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ qids: batch.map((item) => item.qid) }),
        });
        const payload = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (response.status === 429 || payload.transient) {
            transientRetries += 1;
            if (transientRetries > 8) throw new Error("O Wikidata continuou limitando este lote após várias tentativas. Execute novamente para continuar a auditoria.");
            const exponential = Math.min(60, 2 ** transientRetries * 2);
            const retrySeconds = Math.max(exponential, Number(payload.retryAfter) || 0, 5);
            await new Promise((resolve) => window.setTimeout(resolve, retrySeconds * 1000));
            offset -= 50;
            continue;
          }
          throw new Error(payload.error || "Falha ao consultar o Wikidata.");
        }

        const entities = payload.entities || {};
        for (const item of batch) {
          const entity = entities[item.qid];
          try {
            collected.push(classifyEntity(item.qid, entity, item.title));
          } catch {
            collected.push({
              wikidataid: item.qid, catalogTitle: item.title, entityExists: Boolean(entity),
              wikidataLabelEn: "", wikidataLabelPt: "", titleP1476: [], p31Qids: [], p6216Qids: [],
              visualProduction: false, publicDomain: false, titleMatchesP1476: null,
              titleMatchesLabel: null, classification: "api_error", error: "Não foi possível interpretar a entidade.",
            });
          }
        }
        setResults([...collected]);
        setProgress({ checked: collected.length, total: candidates.length });
        await new Promise((resolve) => window.setTimeout(resolve, 1100));
      }
    } catch (caught: any) {
      setError(caught?.message || String(caught));
    } finally {
      setIsRunning(false);
      setIsPaused(false);
      pauseRef.current = false;
    }
  };

  const exportCsv = () => {
    const columns = ["wikidataid", "catalogTitle", "classification", "wikidataLabelEn", "wikidataLabelPt",
      "titleP1476", "p31Qids", "p6216Qids", "visualProduction", "publicDomain", "titleMatchesP1476", "titleMatchesLabel"];
    const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
    const csv = [columns.join(","), ...results.map((item) => columns.map((key) => {
      const value = (item as any)[key];
      return quote(Array.isArray(value) ? value.join("|") : value);
    }).join(","))].join("\r\n");
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "classicflix-wikidata-catalog-audit.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const visibleResults = filter === "all" ? results : results.filter((item) => item.classification === filter);

  return (
    <div className="d-flex flex-column gap-3">
      <div className="card bg-black border-secondary p-3">
        <h6 className="text-info fw-bold d-flex align-items-center gap-2 mb-2">
          <ShieldCheck size={18} /> Auditoria e revalidação do catálogo
        </h6>
        <p className="small text-secondary mb-2">
          Reconsulta os QIDs do Supabase no Wikidata e confere P31 (instância), P6216 (situação dos direitos autorais),
          P1476 (título) e labels. A auditoria não modifica nem exclui registros.
        </p>
        <div className="small text-secondary mb-3">
          {candidates.length.toLocaleString("pt-BR")} QIDs válidos disponíveis no catálogo carregado. Consulta em lotes de 50 entidades.
        </div>
        <div className="d-flex flex-wrap gap-2">
          <button className="btn btn-info fw-bold d-flex align-items-center gap-2" onClick={runAudit} disabled={isRunning}>
            {isRunning ? <Loader2 size={16} className="animate-spin" /> : <Play size={16} />}
            {results.length ? "Executar auditoria novamente" : "Iniciar auditoria completa"}
          </button>
          {isRunning && (
            <button className="btn btn-outline-warning d-flex align-items-center gap-2" onClick={() => {
              pauseRef.current = !pauseRef.current; setIsPaused(pauseRef.current);
            }}>
              <Pause size={16} /> {isPaused ? "Continuar" : "Pausar"}
            </button>
          )}
          {results.length > 0 && (
            <button className="btn btn-outline-light d-flex align-items-center gap-2" onClick={exportCsv}>
              <Download size={16} /> Exportar CSV
            </button>
          )}
        </div>
        {error && <div className="alert alert-danger py-2 small mt-3 mb-0">{error}</div>}
      </div>

      {(isRunning || results.length > 0) && (
        <>
          <div className="card bg-black border-secondary p-3">
            <div className="d-flex justify-content-between small mb-2">
              <span className="text-secondary">Progresso: {progress.checked.toLocaleString("pt-BR")} / {progress.total.toLocaleString("pt-BR")}</span>
              <strong className="text-white">{progress.total ? Math.round(progress.checked / progress.total * 100) : 0}%</strong>
            </div>
            <div className="progress bg-secondary mb-3" style={{ height: 10 }}>
              <div className="progress-bar bg-info" style={{ width: `${progress.total ? progress.checked / progress.total * 100 : 0}%` }} />
            </div>
            <div className="row g-2 text-center">
              <div className="col-6 col-md"><div className="border border-secondary rounded p-2"><strong className="text-success">{summary.valid}</strong><div className="small text-secondary">PD e audiovisual</div></div></div>
              <div className="col-6 col-md"><div className="border border-secondary rounded p-2"><strong className="text-danger">{summary.invalidType}</strong><div className="small text-secondary">Instância inválida</div></div></div>
              <div className="col-6 col-md"><div className="border border-secondary rounded p-2"><strong className="text-warning">{summary.nonPublic}</strong><div className="small text-secondary">Direitos não PD</div></div></div>
              <div className="col-6 col-md"><div className="border border-secondary rounded p-2"><strong className="text-info">{summary.titleIssues}</strong><div className="small text-secondary">Problemas de título</div></div></div>
              <div className="col-6 col-md"><div className="border border-secondary rounded p-2"><strong className="text-danger">{summary.missing}</strong><div className="small text-secondary">QID inexistente</div></div></div>
              <div className="col-6 col-md"><div className="border border-secondary rounded p-2"><strong className="text-secondary">{summary.errors}</strong><div className="small text-secondary">Erros</div></div></div>
            </div>
          </div>

          {results.length > 0 && (
            <div className="card bg-black border-secondary p-3">
              <div className="d-flex flex-wrap justify-content-between gap-2 mb-2">
                <strong className="text-white">Resultados individuais ({visibleResults.length})</strong>
                <select className="form-select form-select-sm bg-dark border-secondary text-white" style={{ maxWidth: 290 }}
                  value={filter} onChange={(event) => setFilter(event.target.value)}>
                  <option value="all">Todas as situações</option>
                  {Object.entries(classificationLabel).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="table-responsive" style={{ maxHeight: 520 }}>
                <table className="table table-dark table-sm table-hover align-middle">
                  <thead style={{ position: "sticky", top: 0 }}>
                    <tr><th>QID / título do catálogo</th><th>Label Wikidata</th><th>P1476</th><th>P31</th><th>P6216</th><th>Resultado</th></tr>
                  </thead>
                  <tbody>
                    {visibleResults.map((item) => (
                      <tr key={item.wikidataid}>
                        <td className="small"><a className="text-info" href={`https://www.wikidata.org/wiki/${item.wikidataid}`} target="_blank" rel="noreferrer">{item.wikidataid}</a><div>{item.catalogTitle || "—"}</div></td>
                        <td className="small">{item.wikidataLabelEn || item.wikidataLabelPt || "—"}<div className="text-secondary">{item.titleMatchesLabel === null ? "Label ausente" : item.titleMatchesLabel ? "Label confere" : "Label diverge"}</div></td>
                        <td className="small">{item.titleP1476.join(" / ") || "—"}<div className="text-secondary">{item.titleMatchesP1476 === null ? "P1476 ausente" : item.titleMatchesP1476 ? "Título confere" : "Título diverge"}</div></td>
                        <td className="small">{item.p31Qids.join(", ") || "—"}<div className="text-secondary">{item.visualProduction ? "Audiovisual" : "Não reconhecida"}</div></td>
                        <td className="small">{item.p6216Qids.join(", ") || "—"}<div className="text-secondary">{item.publicDomain ? "Domínio público" : "Não confirmado"}</div></td>
                        <td className="small">{classificationLabel[item.classification] || item.classification}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
      <div className="small text-secondary">
        <AlertTriangle size={13} className="me-1" /> A classificação de domínio público exige P6216 = Q19652. Valores ausentes ou diferentes são sinalizados, nunca presumidos como domínio público.
      </div>
    </div>
  );
};
