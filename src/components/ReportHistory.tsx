import { useState, useEffect } from "react";
import { FileText, Calendar, CheckCircle2, AlertTriangle, XCircle, ChevronRight, ArrowLeft, Download, RefreshCw, Eye } from "lucide-react";
import { Report } from "../types";

export default function ReportHistory() {
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [filter, setFilter] = useState<"ALL" | "OK" | "WARNING" | "ERROR">("ALL");

  const fetchReports = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/organize/reports");
      const data = await res.json();
      if (data.reports) {
        setReports(data.reports);
      }
    } catch (e) {
      console.error("Error fetching reports:", e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const selectReport = async (id: string) => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/organize/reports/${id}`);
      const data = await res.json();
      if (data) {
        setSelectedReport(data);
      }
    } catch (e) {
      console.error("Error loading report details:", e);
    } finally {
      setIsLoading(false);
    }
  };

  const getFilteredLogs = () => {
    if (!selectedReport) return [];
    if (filter === "ALL") return selectedReport.logs;
    return selectedReport.logs.filter(l => l.status === filter);
  };

  const downloadReportJson = (report: Report) => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(report, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `reporte_organizador_${report.id}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const formatDate = (isoStr: string) => {
    try {
      const date = new Date(isoStr);
      return date.toLocaleString("es-ES", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit"
      });
    } catch (e) {
      return isoStr;
    }
  };

  if (selectedReport) {
    const successRate = selectedReport.totalProcessed > 0
      ? Math.round((selectedReport.successCount / selectedReport.totalProcessed) * 100)
      : 0;

    const filteredLogs = getFilteredLogs();

    return (
      <div id="selected-report-container" className="bg-[#0F172A] rounded-xl border border-slate-800 p-6 shadow-2xl">
        <button
          onClick={() => setSelectedReport(null)}
          className="flex items-center gap-2 text-sm text-slate-400 hover:text-white mb-6 transition-colors cursor-pointer font-medium"
        >
          <ArrowLeft className="w-4 h-4 text-orange-500" />
          Volver al Historial de Reportes
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-800 mb-6">
          <div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 text-xs font-semibold rounded border font-mono ${
                selectedReport.id.startsWith("error_") || selectedReport.organizeType === "N/A"
                  ? "bg-red-500/10 text-red-400 border-red-500/20"
                  : "bg-orange-500/10 text-orange-400 border-orange-500/20"
              }`}>
                ID: {selectedReport.id}
              </span>
              <h3 className="text-xl font-display font-semibold text-white tracking-tight">
                {selectedReport.id.startsWith("error_") || selectedReport.organizeType === "N/A"
                  ? "Informe de Error de Sistema"
                  : "Detalles del Informe de Procesamiento"}
              </h3>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-slate-400 mt-1.5 font-mono">
              <Calendar className="w-3.5 h-3.5 text-orange-500" />
              {formatDate(selectedReport.timestamp)}
            </div>
          </div>

          <button
            onClick={() => downloadReportJson(selectedReport)}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center justify-center gap-1.5 transition-all cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            Exportar JSON del Informe
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="p-4 bg-slate-900/60 rounded-lg border border-slate-800">
            <span className="text-xs text-slate-400 font-medium uppercase tracking-wider block">Total Procesado</span>
            <span className="text-2xl font-bold text-white mt-1 block font-mono">{selectedReport.totalProcessed}</span>
            <span className="text-[11px] text-slate-500 mt-0.5 block">películas en cola</span>
          </div>

          <div className="p-4 bg-green-950/20 rounded-lg border border-green-900/30">
            <span className="text-xs text-green-400 font-medium uppercase tracking-wider block">Éxito</span>
            <span className="text-2xl font-bold text-green-400 mt-1 block font-mono">{selectedReport.successCount}</span>
            <span className="text-[11px] text-green-500/80 mt-0.5 block">movidas correctamente</span>
          </div>

          <div className="p-4 bg-red-950/20 rounded-lg border border-red-900/30">
            <span className="text-xs text-red-400 font-medium uppercase tracking-wider block">Errores</span>
            <span className="text-2xl font-bold text-red-400 mt-1 block font-mono">{selectedReport.errorCount}</span>
            <span className="text-[11px] text-red-500/80 mt-0.5 block">fallidas o ignoradas</span>
          </div>

          <div className="p-4 bg-orange-950/20 rounded-lg border border-orange-900/30">
            <span className="text-xs text-orange-400 font-medium uppercase tracking-wider block">Tasa de Éxito</span>
            <span className="text-2xl font-bold text-orange-400 mt-1 block font-mono">{successRate}%</span>
            <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
              <div className="bg-orange-500 h-full rounded-full" style={{ width: `${successRate}%` }}></div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-2 mb-4 border-b border-slate-800 pb-3.5">
          {(["ALL", "OK", "WARNING", "ERROR"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setFilter(type)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
                filter === type
                  ? "bg-orange-600 border-orange-600 text-white shadow-md"
                  : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
              }`}
            >
              {type === "ALL" && `Todos (${selectedReport.logs.length})`}
              {type === "OK" && `Correctos (${selectedReport.logs.filter(l => l.status === "OK").length})`}
              {type === "WARNING" && `Advertencias (${selectedReport.logs.filter(l => l.status === "WARNING").length})`}
              {type === "ERROR" && `Errores (${selectedReport.logs.filter(l => l.status === "ERROR").length})`}
            </button>
          ))}
        </div>

        {/* Logs List */}
        <div className="border border-slate-800 rounded-lg overflow-hidden bg-slate-950">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[#1E293B] border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-widest">
              <tr>
                <th className="px-4 py-3 font-semibold">Archivo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
                <th className="px-4 py-3 font-semibold">Operación / Resultado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900 font-mono text-xs text-slate-300">
              {filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={3} className="text-center py-8 text-slate-500 italic">
                    No hay operaciones de este tipo registradas en el informe.
                  </td>
                </tr>
              ) : (
                filteredLogs.map((log, idx) => (
                  <tr key={idx} className="hover:bg-slate-900/40 transition-colors">
                    <td className="px-4 py-3 font-medium text-slate-200 max-w-xs truncate" title={log.file}>
                      {log.file}
                    </td>
                    <td className="px-4 py-3">
                      {log.status === "OK" && (
                        <span className="inline-flex items-center gap-1 text-green-400 bg-green-900/20 px-2 py-0.5 rounded border border-green-900/30">
                          <CheckCircle2 className="w-3.5 h-3.5" /> OK
                        </span>
                      )}
                      {log.status === "WARNING" && (
                        <span className="inline-flex items-center gap-1 text-yellow-400 bg-yellow-900/20 px-2 py-0.5 rounded border border-yellow-900/30">
                          <AlertTriangle className="w-3.5 h-3.5" /> ADVERTENCIA
                        </span>
                      )}
                      {log.status === "ERROR" && (
                        <span className="inline-flex items-center gap-1 text-red-400 bg-red-900/20 px-2 py-0.5 rounded border border-red-900/30">
                          <XCircle className="w-3.5 h-3.5" /> ERROR
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-slate-400">
                      <div>{log.message}</div>
                      {log.newName && (
                        <div className="text-[10px] text-orange-400 mt-1">
                          Renombrado a: <strong className="font-semibold">{log.newName}</strong>
                        </div>
                      )}
                      {log.destination && (
                        <div className="text-[10px] text-slate-500 truncate mt-0.5" title={log.destination}>
                          Ruta destino: {log.destination}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div id="reports-history-list" className="bg-[#0F172A] rounded-xl border border-slate-800 p-6 shadow-2xl">
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-800">
        <div>
          <h3 className="text-lg font-display font-semibold text-white tracking-tight">
            Historial de Operaciones
          </h3>
          <p className="text-xs text-slate-400 mt-0.5">
            Informes históricos de los escaneos y movimientos realizados por el organizador.
          </p>
        </div>
        <button
          onClick={fetchReports}
          disabled={isLoading}
          className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-lg border border-slate-700 transition-colors cursor-pointer"
          title="Refrescar Informes"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {reports.length === 0 ? (
        <div className="text-center py-12 text-slate-500 italic bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
          <FileText className="w-10 h-10 text-slate-700 mx-auto mb-3" />
          <span className="block text-sm font-semibold text-slate-300">No hay reportes de procesamiento registrados todavía.</span>
          <span className="block text-xs text-slate-500 mt-1.5">
            Los informes aparecerán aquí automáticamente tras procesar y organizar películas.
          </span>
        </div>
      ) : (
        <div className="divide-y divide-slate-800 border border-slate-800 rounded-lg overflow-hidden bg-slate-900/30">
          {reports.map((report) => {
            const successRate = report.totalProcessed > 0
              ? Math.round((report.successCount / report.totalProcessed) * 100)
              : 0;

            return (
              <div
                key={report.id}
                className="p-4 hover:bg-slate-900/40 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className={`p-2 rounded-lg border shrink-0 ${
                    report.id.startsWith("error_") || report.organizeType === "N/A"
                      ? "bg-red-500/10 text-red-400 border-red-500/20"
                      : "bg-orange-500/10 text-orange-400 border-orange-500/20"
                  }`}>
                    {report.id.startsWith("error_") || report.organizeType === "N/A" ? (
                      <XCircle className="w-5 h-5 text-red-500" />
                    ) : (
                      <FileText className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white font-mono flex items-center gap-2">
                      {report.id}
                      <span className={`px-1.5 py-0.2 text-[10px] rounded border font-normal ${
                        report.id.startsWith("error_") || report.organizeType === "N/A"
                          ? "bg-red-500/10 text-red-400 border-red-500/20 font-bold uppercase tracking-wider"
                          : "bg-slate-800 text-slate-300 border-slate-700"
                      }`}>
                        {report.organizeType === "flat" 
                          ? "Organización Plana" 
                          : report.organizeType === "alphabetical" 
                          ? "Orden Alfabético" 
                          : "Error de Sistema"}
                      </span>
                    </h4>
                    <p className="text-xs text-slate-400 mt-1 flex items-center gap-1 font-mono">
                      <Calendar className="w-3.5 h-3.5 text-orange-400" />
                      {formatDate(report.timestamp)}
                    </p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>Procesados: <strong className="text-white">{report.totalProcessed}</strong></span>
                      <span className="text-green-400 font-medium">Correctos: <strong className="text-green-300">{report.successCount}</strong></span>
                      <span className="text-red-400 font-medium font-mono">Errores: <strong className="text-red-300">{report.errorCount}</strong></span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-500 block font-semibold uppercase tracking-wider">Tasa de Éxito</span>
                    <span className={`text-sm font-bold block ${
                      report.id.startsWith("error_") || report.organizeType === "N/A"
                        ? "text-red-500 font-black"
                        : successRate >= 90 
                        ? "text-green-400" 
                        : successRate >= 50 
                        ? "text-yellow-400" 
                        : "text-red-400"
                    }`}>
                      {report.id.startsWith("error_") || report.organizeType === "N/A" ? "FALLO" : `${successRate}%`}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => selectReport(report.id)}
                      className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition-colors flex items-center gap-1.5 text-xs font-semibold cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5 text-orange-400" />
                      Ver Detalles
                    </button>
                    <button
                      onClick={() => downloadReportJson(report)}
                      className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-orange-400 rounded-lg border border-slate-700 transition-colors cursor-pointer"
                      title="Descargar Informe JSON"
                    >
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
