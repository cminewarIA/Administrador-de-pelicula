import { useState, useEffect } from "react";
import { 
  Folder, 
  RefreshCw, 
  FolderOpen, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle, 
  HelpCircle, 
  ChevronRight, 
  Play, 
  Trash2, 
  FileCheck, 
  Database, 
  CheckSquare, 
  Square, 
  Settings, 
  ListOrdered, 
  Terminal, 
  FileText 
} from "lucide-react";

import { WorkspaceStatus, MovieFile } from "./types";
import ReportHistory from "./components/ReportHistory";

export default function App() {
  const [activeTab, setActiveTab] = useState<"organizer" | "history">("organizer");
  const [status, setStatus] = useState<WorkspaceStatus | null>(null);
  const [movies, setMovies] = useState<MovieFile[]>([]);
  const [selectedMovieIds, setSelectedMovieIds] = useState<string[]>([]);
  
  // Folders state
  const [downloadsPath, setDownloadsPath] = useState(() => localStorage.getItem("downloadsPath") || "");
  const [organizedPath, setOrganizedPath] = useState(() => localStorage.getItem("organizedPath") || "");
  const [geminiApiKey, setGeminiApiKey] = useState(() => localStorage.getItem("geminiApiKey") || "");
  const [isSavingConfig, setIsSavingConfig] = useState(false);
  const [configMessage, setConfigMessage] = useState("");

  // Scan & Match states
  const [isScanning, setIsScanning] = useState(false);
  const [scanningLogs, setScanningLogs] = useState<string[]>([]);
  const [isMatching, setIsMatching] = useState(false);
  const [matchProgress, setMatchProgress] = useState({ current: 0, total: 0 });
  const [isProcessing, setIsProcessing] = useState(false);

  // Settings
  const [organizeType, setOrganizeType] = useState<"flat" | "alphabetical">("alphabetical");
  const [cleanFolders, setCleanFolders] = useState(true);
  const [processSubtitles, setProcessSubtitles] = useState(true);
  const [recursiveScan, setRecursiveScan] = useState(true);

  // Final processed report state
  const [recentReport, setRecentReport] = useState<any | null>(null);

  // Live action logs
  const [appLogs, setAppLogs] = useState<Array<{ timestamp: string; type: string; message: string }>>([
    { timestamp: new Date().toLocaleTimeString("es-ES", { hour12: false }), type: "success", message: "AI MATCH ENGINE: Motor de organización listo para operar." },
    { timestamp: new Date().toLocaleTimeString("es-ES", { hour12: false }), type: "info", message: "NFO MONITOR: Escaneando metadatos generados por Emby." }
  ]);

  const addLog = (message: string, type: "info" | "success" | "warning" | "error" = "info") => {
    const timestamp = new Date().toLocaleTimeString("es-ES", { hour12: false });
    setAppLogs(prev => [{ timestamp, type, message }, ...prev].slice(0, 100));
  };

  // Fetch workspace status
  const fetchWorkspaceStatus = async (syncLocal = false) => {
    try {
      const res = await fetch("/api/workspace");
      const data: WorkspaceStatus = await res.json();
      setStatus(data);

      const savedDownloads = localStorage.getItem("downloadsPath") || "";
      const savedOrganized = localStorage.getItem("organizedPath") || "";

      // Prioritize local state, then localStorage, then server config
      const finalDownloads = downloadsPath || savedDownloads || data.downloadsFolder;
      const finalOrganized = organizedPath || savedOrganized || data.organizedFolder;

      setDownloadsPath(finalDownloads);
      setOrganizedPath(finalOrganized);

      if (finalDownloads) localStorage.setItem("downloadsPath", finalDownloads);
      if (finalOrganized) localStorage.setItem("organizedPath", finalOrganized);

      // Auto-sync browser-saved folders with server if server has different defaults
      if (syncLocal && (finalDownloads !== data.downloadsFolder || finalOrganized !== data.organizedFolder)) {
        addLog(`Sincronizando rutas persistidas con el servidor: ${finalDownloads} -> ${finalOrganized}`, "info");
        await fetch("/api/workspace/config", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ downloads: finalDownloads, organized: finalOrganized, geminiApiKey: geminiApiKey || undefined })
        });
      }
    } catch (e) {
      console.error("Error fetching workspace status:", e);
    }
  };

  useEffect(() => {
    fetchWorkspaceStatus(true);
  }, []);

  // Save paths configuration
  const savePathsConfig = async () => {
    setIsSavingConfig(true);
    setConfigMessage("");
    addLog(`Guardando nueva configuración de directorios y clave API...`, "info");
    try {
      const res = await fetch("/api/workspace/config", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ downloads: downloadsPath, organized: organizedPath, geminiApiKey })
      });
      const data = await res.json();
      if (data.success) {
        setConfigMessage("¡Rutas actualizadas con éxito!");
        addLog(`Configuración de directorios guardada con éxito.`, "success");
        
        // Persistir localmente en el navegador
        localStorage.setItem("downloadsPath", downloadsPath);
        localStorage.setItem("organizedPath", organizedPath);
        if (geminiApiKey) {
          localStorage.setItem("geminiApiKey", geminiApiKey);
        } else {
          localStorage.removeItem("geminiApiKey");
        }

        fetchWorkspaceStatus();
        setTimeout(() => setConfigMessage(""), 3000);
      }
    } catch (e: any) {
      setConfigMessage(`Error: ${e.message}`);
      addLog(`Fallo al guardar rutas: ${e.message}`, "error");
    } finally {
      setIsSavingConfig(false);
    }
  };

  // Seed sample structures
  const reseedWorkspace = async () => {
    if (!confirm("¿Deseas restaurar y sembrar la estructura de descargas de prueba? Esto reiniciará la carpeta simulated en el servidor.")) {
      return;
    }
    addLog("Iniciando restauración y siembra de la estructura demo de películas...", "info");
    try {
      const res = await fetch("/api/workspace/reset", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        fetchWorkspaceStatus();
        setMovies([]);
        setSelectedMovieIds([]);
        setRecentReport(null);
        addLog("Estructura de prueba sembrada con éxito. Listo para escanear.", "success");
        alert("¡Estructura de prueba sembrada con éxito! Haz clic en 'Escanear Directorio' para leer los archivos.");
      }
    } catch (e: any) {
      addLog(`Error al resetear workspace: ${e.message}`, "error");
      alert(`Error al resetear workspace: ${e.message}`);
    }
  };

  // Scan folder for movies with real-time stream decoding
  const scanDownloads = async () => {
    setIsScanning(true);
    setRecentReport(null);
    setScanningLogs([]);
    addLog(`Escaneando carpeta de origen: ${downloadsPath} (Subcarpetas: ${recursiveScan ? 'SÍ' : 'NO'})`, "info");
    try {
      const res = await fetch(`/api/organize/scan?recursive=${recursiveScan}`);
      if (!res.body) {
        throw new Error("El servidor no soporta la transmisión de progreso de escaneo.");
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        // Keep the last partial line in the buffer
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const data = JSON.parse(line);
            if (data.type === "scan") {
              const nfoInfo = data.hasNfo ? ` (NFO detectado${data.embyTitle ? `: ${data.embyTitle}` : ""})` : " (Sin NFO)";
              setScanningLogs(prev => [...prev, data.file]);
              addLog(`[LECTURA] Leyendo archivo: ${data.file}${nfoInfo}`, "info");
            } else if (data.type === "log") {
              addLog(data.message, "warning");
            } else if (data.type === "done") {
              if (data.movies) {
                const moviesList = data.movies.map((m: any) => ({
                  ...m,
                  status: "idle" as const
                }));
                setMovies(moviesList);
                // Select all by default
                setSelectedMovieIds(moviesList.map((m: any) => m.id));
                addLog(`Escaneo completo. Encontradas ${moviesList.length} películas listas para procesar.`, "success");
              }
            } else if (data.type === "error") {
              addLog(`Error reportado por el servidor: ${data.error}`, "error");
            }
          } catch (err: any) {
            console.error("Error al decodificar línea de progreso de escaneo:", err);
          }
        }
      }
    } catch (e: any) {
      addLog(`Error al escanear directorio: ${e.message}`, "error");
      alert(`Error al escanear: ${e.message}`);
    } finally {
      setIsScanning(false);
    }
  };

  // Match items sequentially with Gemini AI
  const matchAllSelectedWithAi = async () => {
    const selectedItems = movies.filter(m => selectedMovieIds.includes(m.id));
    if (selectedItems.length === 0) {
      alert("Por favor selecciona al menos una película para emparejar por IA.");
      return;
    }

    setIsMatching(true);
    setMatchProgress({ current: 0, total: selectedItems.length });
    addLog(`Iniciando análisis secuencial por IA para ${selectedItems.length} películas...`, "info");

    for (let i = 0; i < selectedItems.length; i++) {
      const currentItem = selectedItems[i];
      
      // Update status to matching
      setMovies(prev => prev.map(m => m.id === currentItem.id ? { ...m, status: "matching" } : m));
      setMatchProgress({ current: i + 1, total: selectedItems.length });
      addLog(`[${i + 1}/${selectedItems.length}] Analizando metadatos de: "${currentItem.fileName}"`, "info");

      try {
        const res = await fetch("/api/organize/match", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fileName: currentItem.fileName,
            embyTitle: currentItem.embyTitle,
            embyYear: currentItem.embyYear,
            embyImdb: currentItem.embyImdb
          })
        });

        const matchResult = await res.json();
        
        setMovies(prev => prev.map(m => m.id === currentItem.id ? {
          ...m,
          matchedTitle: matchResult.title,
          matchedYear: matchResult.year,
          matchedImdbId: matchResult.imdbId,
          confidence: matchResult.confidence,
          reasoning: matchResult.reasoning,
          synopsis: matchResult.synopsis,
          posterUrl: matchResult.posterUrl,
          rating: matchResult.rating,
          sourceUsed: matchResult.sourceUsed,
          status: "matched" as const
        } : m));

        addLog(`Emparejado: "${currentItem.fileName}" → "${matchResult.title}" (${matchResult.year}) [Conf: ${Math.round(matchResult.confidence * 100)}%]`, "success");

      } catch (err: any) {
        setMovies(prev => prev.map(m => m.id === currentItem.id ? {
          ...m,
          status: "error" as const,
          error: err.message || "Fallo al consultar Gemini"
        } : m));
        addLog(`Fallo al analizar "${currentItem.fileName}": ${err.message}`, "error");
      }

      // Small UI pause for smoothness
      await new Promise(r => setTimeout(r, 450));
    }

    setIsMatching(false);
    addLog(`Análisis por IA finalizado para todas las películas seleccionadas.`, "success");
  };

  // Individual item matching
  const matchSingleWithAi = async (id: string) => {
    const item = movies.find(m => m.id === id);
    if (!item) return;

    setMovies(prev => prev.map(m => m.id === id ? { ...m, status: "matching" } : m));
    addLog(`Iniciando análisis individual de: "${item.fileName}"`, "info");

    try {
      const res = await fetch("/api/organize/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fileName: item.fileName,
          embyTitle: item.embyTitle,
          embyYear: item.embyYear,
          embyImdb: item.embyImdb
        })
      });

      const matchResult = await res.json();
      
      setMovies(prev => prev.map(m => m.id === id ? {
        ...m,
        matchedTitle: matchResult.title,
        matchedYear: matchResult.year,
        matchedImdbId: matchResult.imdbId,
        confidence: matchResult.confidence,
        reasoning: matchResult.reasoning,
        synopsis: matchResult.synopsis,
        posterUrl: matchResult.posterUrl,
        rating: matchResult.rating,
        sourceUsed: matchResult.sourceUsed,
        status: "matched" as const
      } : m));

      addLog(`Emparejado individual: "${item.fileName}" → "${matchResult.title}" (${matchResult.year})`, "success");

    } catch (err: any) {
      setMovies(prev => prev.map(m => m.id === id ? {
        ...m,
        status: "error" as const,
        error: err.message
      } : m));
      addLog(`Error al emparejar individualmente: ${err.message}`, "error");
    }
  };

  // Edit matched properties manually
  const updateMatchedFields = (id: string, field: "matchedTitle" | "matchedYear" | "matchedImdbId", value: any) => {
    setMovies(prev => prev.map(m => m.id === id ? {
      ...m,
      [field]: value,
      status: "matched" as const // mark as matched/ready
    } : m));
  };

  const updateCustomDestFolder = (id: string, folder: string) => {
    setMovies(prev => prev.map(m => m.id === id ? {
      ...m,
      customDestFolder: folder
    } : m));
  };

  const getFirstLetterFolder = (title: string) => {
    if (!title) return "";
    const cleanTitle = title.replace(/[\\/:*?"<>|]/g, "").trim();
    const firstLetter = cleanTitle.charAt(0).toUpperCase();
    return /^[A-Z]$/.test(firstLetter) ? firstLetter : "#";
  };

  // Selection handlers
  const toggleSelectMovie = (id: string) => {
    setSelectedMovieIds(prev => 
      prev.includes(id) ? prev.filter(mid => mid !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedMovieIds.length === movies.length) {
      setSelectedMovieIds([]);
    } else {
      setSelectedMovieIds(movies.map(m => m.id));
    }
  };

  // Execute processing
  const executeOrganization = async () => {
    const itemsToProcess = movies.filter(m => selectedMovieIds.includes(m.id) && m.status === "matched");
    
    if (itemsToProcess.length === 0) {
      alert("Por favor selecciona películas que ya tengan un emparejamiento resuelto (estado 'Completado') para procesarlas.");
      return;
    }

    if (!confirm(`¿Estás seguro de que deseas renombrar y mover ${itemsToProcess.length} películas a la carpeta de destino?`)) {
      return;
    }

    setIsProcessing(true);
    setRecentReport(null);
    addLog(`Organizando y reubicando ${itemsToProcess.length} películas... esquema: ${organizeType === 'flat' ? 'Directorio Plano' : 'Carpetas A-Z'}`, "info");

    try {
      const res = await fetch("/api/organize/process", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: itemsToProcess,
          organizeType,
          cleanFolders,
          processSubtitles
        })
      });

      const data = await res.json();
      if (data.success) {
        setRecentReport(data.report);
        // Clean processed movies from list
        setMovies(prev => prev.filter(m => !selectedMovieIds.includes(m.id)));
        setSelectedMovieIds([]);
        fetchWorkspaceStatus();
        addLog(`Operación completada con éxito. Procesadas: ${data.report.totalProcessed}, Correctas: ${data.report.successCount}, Errores: ${data.report.errorCount}`, "success");
      }
    } catch (err: any) {
      addLog(`Error durante el procesamiento físico de archivos: ${err.message}`, "error");
      alert(`Error durante el procesamiento: ${err.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 font-sans flex flex-col selection:bg-orange-600 selection:text-white">
      {/* Header */}
      <header className="h-14 flex items-center justify-between px-6 border-b border-slate-800 bg-[#0F172A] shrink-0">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-orange-600 rounded-md flex items-center justify-center font-bold text-white font-mono shadow-lg shadow-orange-600/20">C</div>
          <div>
            <h1 className="text-base font-semibold tracking-tight text-white flex items-center gap-2">
              CineOrganize AI <span className="text-[10px] font-mono font-normal opacity-50 px-2 py-0.5 bg-black/40 rounded border border-slate-800 hidden sm:inline">v1.2.0-stable</span>
            </h1>
          </div>
        </div>
        <div className="flex items-center space-x-3 sm:space-x-4">
          <div className="hidden sm:flex items-center gap-2 text-[10px] bg-slate-900 px-2.5 py-1 rounded border border-slate-800 font-mono text-slate-400">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            {status?.hasGeminiKey ? (
              <span className="text-orange-400 font-bold uppercase tracking-wider">Gemini API Online</span>
            ) : (
              <span className="text-slate-400 font-bold uppercase tracking-wider">Local Offline</span>
            )}
          </div>
          <button 
            onClick={reseedWorkspace}
            id="btn-reseed-data"
            className="bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded text-xs font-semibold border border-slate-700 text-slate-200 transition-colors cursor-pointer flex items-center gap-1.5 shadow-sm"
            title="Generar archivos de simulación de prueba en el servidor"
          >
            <Database className="w-3.5 h-3.5 text-orange-500" />
            <span className="hidden sm:inline">Sembrar Demo</span>
            <span className="sm:hidden">Demo</span>
          </button>
        </div>
      </header>

      {/* Main split viewport layout */}
      <div className="flex-1 flex overflow-hidden">
        
        {/* Left Sidebar (Desktop Only) */}
        <aside className="w-64 shrink-0 border-r border-slate-800 bg-[#0F172A] p-4 flex flex-col space-y-6 hidden md:flex overflow-y-auto">
          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 font-mono">Directorio Origen</h2>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg">
              <input
                type="text"
                value={downloadsPath}
                onChange={(e) => setDownloadsPath(e.target.value)}
                className="w-full bg-black/40 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button 
                onClick={savePathsConfig}
                disabled={isSavingConfig}
                className="mt-2 text-[10px] text-orange-400 font-bold hover:text-orange-300 block uppercase tracking-wide cursor-pointer transition-colors"
              >
                {isSavingConfig ? "Guardando..." : "Guardar Configuración"}
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 font-mono">Directorio Destino</h2>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg">
              <input
                type="text"
                value={organizedPath}
                onChange={(e) => setOrganizedPath(e.target.value)}
                className="w-full bg-black/40 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button 
                onClick={savePathsConfig}
                disabled={isSavingConfig}
                className="mt-2 text-[10px] text-orange-400 font-bold hover:text-orange-300 block uppercase tracking-wide cursor-pointer transition-colors"
              >
                {isSavingConfig ? "Guardando..." : "Guardar Configuración"}
              </button>
            </div>
          </section>

          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 font-mono">Clave API de Gemini</h2>
            <div className="p-3 bg-slate-900 border border-slate-800/80 rounded-lg space-y-2">
              <input
                type="password"
                placeholder={status?.hasGeminiKey ? "Configurada (clic para cambiar)" : "Escribe tu clave API aquí..."}
                value={geminiApiKey}
                onChange={(e) => setGeminiApiKey(e.target.value)}
                className="w-full bg-black/40 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
              />
              <button 
                onClick={savePathsConfig}
                disabled={isSavingConfig}
                className="text-[10px] text-orange-400 font-bold hover:text-orange-300 block uppercase tracking-wide cursor-pointer transition-colors"
              >
                {isSavingConfig ? "Guardando..." : "Guardar Clave"}
              </button>
            </div>
            {configMessage && <span className="text-[10px] text-green-400 block mt-2 font-mono">{configMessage}</span>}
          </section>

          <section>
            <h2 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 font-mono">Estadísticas</h2>
            <div className="grid grid-cols-2 gap-2 text-center font-mono">
              <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-800/50">
                <p className="text-base font-bold text-white">{status?.downloadsCount ?? 0}</p>
                <p className="text-[8px] text-slate-400">TOTAL SCANNED</p>
              </div>
              <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-800/50">
                <p className="text-base font-bold text-green-400">{movies.filter(m => m.status === 'matched').length}</p>
                <p className="text-[8px] text-slate-400">RESOLVED</p>
              </div>
              <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-800/50">
                <p className="text-base font-bold text-yellow-400">{movies.filter(m => m.status === 'idle').length}</p>
                <p className="text-[8px] text-slate-400">PENDING</p>
              </div>
              <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-800/50">
                <p className="text-base font-bold text-blue-400">{status?.organizedCount ?? 0}</p>
                <p className="text-[8px] text-slate-400">LIB COUNT</p>
              </div>
            </div>
          </section>

          {/* Real-time terminal output logs */}
          <section className="flex-1 flex flex-col min-h-0">
            <h2 className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 font-mono">Registro en Tiempo Real</h2>
            <div className="flex-1 bg-black/60 border border-slate-800 rounded-lg p-2.5 font-mono text-[9px] text-slate-400 overflow-y-auto space-y-1.5 scrollbar-thin">
              {appLogs.map((log, index) => (
                <div key={index} className="leading-relaxed">
                  <span className="text-slate-600">[{log.timestamp}]</span>{" "}
                  <span className={
                    log.type === "success" 
                      ? "text-green-400" 
                      : log.type === "error" 
                      ? "text-red-400" 
                      : log.type === "warning" 
                      ? "text-yellow-400" 
                      : "text-slate-400"
                  }>
                    {log.message}
                  </span>
                </div>
              ))}
            </div>
          </section>

          <div className="pt-4 border-t border-slate-800 text-[10px] text-slate-500 flex justify-between font-mono shrink-0">
            <span>CPU Load: 12%</span>
            <span>Hilos: 8 Activos</span>
          </div>
        </aside>

        {/* Workspace Area */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6">
          
          {/* Main Panel Card container */}
          <div className="bg-[#0F172A] rounded-xl border border-slate-800 shadow-2xl overflow-hidden max-w-6xl mx-auto">
            
            {/* Header Tabs Navigation */}
            <div className="bg-slate-900 px-4 py-3 flex flex-col sm:flex-row items-stretch sm:items-center justify-between border-b border-slate-800 gap-3">
              <div className="flex space-x-2">
                <button
                  onClick={() => setActiveTab("organizer")}
                  id="tab-btn-organizer"
                  className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "organizer"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <Folder className="w-3.5 h-3.5 text-orange-500" />
                  Organizador Activo
                </button>
                
                <button
                  onClick={() => setActiveTab("history")}
                  id="tab-btn-history"
                  className={`px-4 py-2 text-xs font-semibold rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                    activeTab === "history"
                      ? "bg-orange-600 text-white shadow-md shadow-orange-600/10"
                      : "text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 text-orange-500" />
                  Historial de Informes
                </button>
              </div>

              <div className="text-[10px] font-mono text-slate-500 uppercase tracking-wider flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 border-slate-800/80 pt-2 sm:pt-0">
                <span>Películas: {status?.downloadsCount ?? 0}</span>
                <span className="hidden sm:inline text-slate-700">|</span>
                <span>Organizadas: {status?.organizedCount ?? 0}</span>
              </div>
            </div>

            {/* Content Switcher */}
            <div className="p-4 sm:p-6 bg-[#0F172A]">

              {activeTab === "history" && <ReportHistory />}

              {activeTab === "organizer" && (
                <div className="space-y-6">
                  
                  {/* Mobile Config Panel (Hidden on md:flex, shown on mobile) */}
                  <div className="md:hidden bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-4">
                    <div className="flex items-center gap-2 pb-2 border-b border-slate-800">
                      <Settings className="w-4 h-4 text-orange-500" />
                      <h3 className="text-xs font-bold uppercase tracking-wider text-white font-mono">Configuración de Directorios</h3>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">Ruta Origen:</label>
                        <input
                          type="text"
                          value={downloadsPath}
                          onChange={(e) => setDownloadsPath(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">Ruta Destino:</label>
                        <input
                          type="text"
                          value={organizedPath}
                          onChange={(e) => setOrganizedPath(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-400 font-mono block mb-1">Clave API Gemini:</label>
                        <input
                          type="password"
                          placeholder={status?.hasGeminiKey ? "Configurada" : "Escribe clave API..."}
                          value={geminiApiKey}
                          onChange={(e) => setGeminiApiKey(e.target.value)}
                          className="w-full bg-slate-950 border border-slate-800 rounded px-2 py-1 text-xs font-mono text-slate-300 focus:outline-none focus:ring-1 focus:ring-orange-500"
                        />
                      </div>
                      <button
                        onClick={savePathsConfig}
                        disabled={isSavingConfig}
                        className="w-full py-1.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs rounded transition-colors"
                      >
                        {isSavingConfig ? "Guardando..." : "Guardar Configuración"}
                      </button>
                      {configMessage && <p className="text-[10px] text-green-400 font-mono text-center">{configMessage}</p>}
                    </div>
                  </div>

                  {/* Scanning Controls */}
                  <div className="bg-slate-900 border border-slate-800/80 rounded-xl overflow-hidden p-4 sm:p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div>
                      <h3 className="text-base font-semibold text-white tracking-tight">
                        Bandeja de Películas Descargadas
                      </h3>
                      <p className="text-xs text-slate-400 mt-1">
                        Escanea tu carpeta de descargas de Emby para comenzar la organización inteligente.
                      </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 w-full sm:w-auto">
                      <label className="flex items-center gap-2 cursor-pointer select-none py-2 px-3 bg-slate-950 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
                        <input
                          type="checkbox"
                          checked={recursiveScan}
                          onChange={(e) => setRecursiveScan(e.target.checked)}
                          className="rounded border-slate-700 bg-slate-900 text-orange-500 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                        />
                        <span className="text-xs font-semibold text-slate-300">Escanear subcarpetas</span>
                      </label>

                      <button
                        onClick={scanDownloads}
                        disabled={isScanning || isMatching || isProcessing}
                        id="btn-scan-folder"
                        className="px-5 py-2.5 bg-orange-600 hover:bg-orange-500 text-white font-semibold text-xs rounded-lg shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer hover:shadow-orange-600/10 shrink-0"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 text-white ${isScanning ? "animate-spin" : ""}`} />
                        Escanear Carpeta de Origen
                      </button>
                    </div>
                  </div>

                  {/* Scanning Progress Console Overlay */}
                  {isScanning && (
                    <div className="bg-slate-950 border border-orange-500/30 p-4 rounded-xl space-y-3 shadow-lg shadow-orange-500/5 max-w-4xl mx-auto mb-6">
                      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                        <div className="flex items-center gap-2">
                          <RefreshCw className="w-4 h-4 text-orange-500 animate-spin" />
                          <h4 className="text-xs font-bold uppercase tracking-wider text-white font-mono">
                            Escaneando Directorio Activo (Lectura en Tiempo Real)
                          </h4>
                        </div>
                        <span className="text-[10px] bg-orange-500/10 text-orange-400 px-2 py-0.5 rounded-full font-mono">
                          {scanningLogs.length} Archivos Leídos
                        </span>
                      </div>
                      
                      <div className="max-h-40 overflow-y-auto font-mono text-[11px] text-slate-300 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-800">
                        {scanningLogs.length === 0 ? (
                          <p className="text-slate-500 italic">Estableciendo conexión y leyendo metadatos...</p>
                        ) : (
                          scanningLogs.map((file, idx) => (
                            <div key={idx} className="flex items-start gap-2 text-slate-400 animate-fadeIn">
                              <span className="text-emerald-500">✔</span>
                              <span className="text-emerald-400/80 shrink-0 font-bold">[LECTURA]</span>
                              <span className="truncate text-slate-300 font-mono select-all" title={file}>
                                {file}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  {movies.length === 0 ? (
                    <div className="py-16 text-center text-slate-500 bg-slate-900/30 rounded-xl border border-dashed border-slate-800/80 max-w-xl mx-auto px-4">
                      <FolderOpen className="w-10 h-10 text-slate-600 mx-auto mb-3" />
                      <span className="block text-sm font-semibold text-slate-300">No se han leído archivos todavía.</span>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto mt-2 leading-relaxed">
                        Haz clic en el botón de escaneo superior para buscar películas en el servidor. 
                        Si es tu primera vez, haz clic en <strong className="text-slate-400">"Sembrar Demo"</strong> arriba para generar archivos simulados de prueba.
                      </p>
                    </div>
                  ) : (
                    <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/60">
                      
                      {/* Matching controls bar */}
                      <div className="bg-slate-900/90 border-b border-slate-800 p-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="flex items-center gap-2 text-xs text-slate-300 font-medium font-mono">
                          <Sparkles className="w-4 h-4 text-orange-400" />
                          <span>{selectedMovieIds.length} de {movies.length} seleccionados</span>
                        </div>

                        <div className="flex items-center gap-2 w-full md:w-auto">
                          <button
                            onClick={matchAllSelectedWithAi}
                            disabled={isMatching || selectedMovieIds.length === 0}
                            id="btn-ai-match-selected"
                            className="w-full md:w-auto px-4 py-2 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-500 text-white text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-md shadow-orange-600/10"
                          >
                            {isMatching ? (
                              <>
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                {`Análisis Gemini (${matchProgress.current}/${matchProgress.total})...`}
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 text-white" />
                                Ejecutar Análisis por IA (Gemini)
                              </>
                            )}
                          </button>
                        </div>
                      </div>

                      {/* Matching progress bar */}
                      {isMatching && (
                        <div className="w-full bg-slate-800 h-1.5">
                          <div 
                            className="bg-orange-500 h-full transition-all duration-300" 
                            style={{ width: `${(matchProgress.current / matchProgress.total) * 100}%` }}
                          ></div>
                        </div>
                      )}

                      {/* Movie files List Table */}
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm border-collapse whitespace-nowrap">
                          <thead className="bg-[#1E293B] border-b border-slate-800 text-slate-400 text-[10px] uppercase tracking-widest font-mono">
                            <tr>
                              <th className="px-4 py-3.5 text-center w-12">
                                <input
                                  type="checkbox"
                                  checked={selectedMovieIds.length === movies.length && movies.length > 0}
                                  onChange={toggleSelectAll}
                                  className="rounded border-slate-700 bg-slate-900 text-orange-500 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                />
                              </th>
                              <th className="px-5 py-3.5 font-semibold">Archivo / Origen</th>
                              <th className="px-5 py-3.5 font-semibold">Metadatos de Emby (.nfo)</th>
                              <th className="px-5 py-3.5 font-semibold">Resultado de Análisis de IA</th>
                              <th className="px-5 py-3.5 text-center font-semibold">Precisión</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-900 text-xs text-slate-300 font-mono">
                            {movies.map((movie) => {
                              const isSelected = selectedMovieIds.includes(movie.id);
                              return (
                                <tr 
                                  key={movie.id} 
                                  className={`transition-colors ${
                                    isSelected ? "bg-orange-500/5 hover:bg-orange-500/10" : "hover:bg-slate-900/30"
                                  }`}
                                >
                                  {/* Checkbox column */}
                                  <td className="px-4 py-4 text-center">
                                    <input
                                      type="checkbox"
                                      checked={isSelected}
                                      onChange={() => toggleSelectMovie(movie.id)}
                                      className="rounded border-slate-700 bg-slate-900 text-orange-500 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                    />
                                  </td>

                                  {/* Filename & Source Details */}
                                  <td className="px-5 py-4">
                                    <div className="max-w-xs sm:max-w-md space-y-2">
                                      <span className="font-semibold text-slate-100 block truncate" title={movie.fileName}>
                                        {movie.fileName}
                                      </span>
                                      
                                      {/* Original path (current location) */}
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400" title={movie.originalPath}>
                                        <FolderOpen className="w-3.5 h-3.5 text-orange-400 shrink-0" />
                                        <span className="font-semibold shrink-0">Origen:</span>
                                        <span className="truncate bg-slate-900/60 border border-slate-800 px-1.5 py-0.5 rounded text-slate-300 max-w-[280px]">
                                          {movie.originalPath}
                                        </span>
                                      </div>

                                      {/* Target path (destination folder) */}
                                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                                        <Folder className="w-3.5 h-3.5 text-green-400 shrink-0" />
                                        <span className="font-semibold shrink-0">Destino:</span>
                                        <input
                                          type="text"
                                          value={movie.customDestFolder !== undefined ? movie.customDestFolder : (organizeType === "alphabetical" && movie.matchedTitle ? `${organizedPath}/${getFirstLetterFolder(movie.matchedTitle)}` : organizedPath)}
                                          onChange={(e) => updateCustomDestFolder(movie.id, e.target.value)}
                                          className="px-2 py-0.5 border border-slate-800 rounded text-[10px] bg-slate-950 text-slate-300 focus:ring-1 focus:ring-orange-500 focus:border-orange-500 focus:outline-none flex-1 max-w-[280px] font-mono h-5.5"
                                          title="Modificar carpeta de destino para esta película"
                                          placeholder="Carpeta de destino"
                                        />
                                      </div>

                                      <div className="flex items-center gap-2 text-[10px] text-slate-500">
                                        <span className="bg-slate-800 text-slate-300 px-1.5 py-0.2 rounded border border-slate-700">
                                          {movie.extension.toUpperCase()}
                                        </span>
                                        <span>{formatSize(movie.sizeBytes)}</span>
                                        {movie.folderName && (
                                          <span className="truncate" title={`Carpeta: ${movie.folderName}`}>
                                            / {movie.folderName}
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </td>

                                  {/* Emby Metadata Status */}
                                  <td className="px-5 py-4">
                                    {movie.hasNfo ? (
                                      <div className="text-[11px]">
                                        <span className="inline-flex items-center gap-1 text-green-400 bg-green-950/20 px-2 py-0.5 rounded border border-green-900/30 font-semibold font-sans">
                                          <FileCheck className="w-3.5 h-3.5" /> Emby NFO
                                        </span>
                                        <div className="mt-1.5 text-[10px] text-slate-400 space-y-0.5">
                                          {movie.embyTitle && <div className="truncate text-slate-300">Título: {movie.embyTitle}</div>}
                                          {movie.embyYear && <div>Año: {movie.embyYear}</div>}
                                          {movie.embyImdb && <div className="text-orange-400 font-semibold">{movie.embyImdb}</div>}
                                        </div>
                                      </div>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-semibold font-sans">
                                        <AlertTriangle className="w-3.5 h-3.5 text-yellow-500" /> Sin Metadatos
                                      </span>
                                    )}
                                  </td>

                                  {/* AI resolved result & Manual Fields */}
                                  <td className="px-5 py-4">
                                    {movie.status === "idle" && (
                                      <button
                                        onClick={() => matchSingleWithAi(movie.id)}
                                        className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded border border-slate-700 flex items-center gap-1 transition-colors cursor-pointer"
                                      >
                                        <Sparkles className="w-3.5 h-3.5 text-orange-400" />
                                        Analizar Individual
                                      </button>
                                    )}

                                    {movie.status === "matching" && (
                                      <div className="flex items-center gap-2 text-xs text-orange-400 font-semibold">
                                        <span className="w-3.5 h-3.5 border-2 border-orange-500 border-t-transparent rounded-full animate-spin"></span>
                                        Consultando IA...
                                      </div>
                                    )}

                                    {movie.status === "error" && (
                                      <div className="text-xs">
                                        <span className="text-red-400 font-bold block">Error</span>
                                        <span className="text-slate-500 block text-[10px] max-w-xs truncate">{movie.error}</span>
                                      </div>
                                    )}

                                    {movie.status === "matched" && (
                                      <div className="flex items-start gap-3.5 py-1">
                                        {movie.posterUrl && (
                                          <img
                                            src={movie.posterUrl}
                                            alt={movie.matchedTitle}
                                            referrerPolicy="no-referrer"
                                            className="w-14 h-20 object-cover rounded-md shadow-lg border border-slate-800/80 shrink-0 mt-0.5"
                                          />
                                        )}
                                        <div className="space-y-1.5 flex-1 min-w-0">
                                          {/* Editable Inputs for manual verify */}
                                          <div className="flex flex-wrap items-center gap-1.5">
                                            <input
                                              type="text"
                                              value={movie.matchedTitle || ""}
                                              onChange={(e) => updateMatchedFields(movie.id, "matchedTitle", e.target.value)}
                                              className="px-2 py-0.5 border border-slate-800 rounded text-xs font-semibold bg-slate-950 text-slate-100 focus:ring-1 focus:ring-orange-500 focus:outline-none w-48 truncate"
                                              title="Título Estandarizado"
                                              placeholder="Título de la película"
                                            />
                                            <input
                                              type="number"
                                              value={movie.matchedYear || ""}
                                              onChange={(e) => updateMatchedFields(movie.id, "matchedYear", parseInt(e.target.value, 10))}
                                              className="px-1.5 py-0.5 border border-slate-800 rounded text-xs font-semibold bg-slate-950 text-slate-100 focus:ring-1 focus:ring-orange-500 focus:outline-none w-14 text-center"
                                              title="Año"
                                              placeholder="Año"
                                            />
                                            <input
                                              type="text"
                                              value={movie.matchedImdbId || ""}
                                              onChange={(e) => updateMatchedFields(movie.id, "matchedImdbId", e.target.value)}
                                              className="px-2 py-0.5 border border-slate-800 rounded text-xs font-semibold bg-slate-950 text-orange-400 border-orange-950/40 focus:ring-1 focus:ring-orange-500 focus:outline-none w-22 text-center font-bold"
                                              title="IMDb ID"
                                              placeholder="tt1234567"
                                            />
                                          </div>

                                          {/* Source & Rating Badge */}
                                          <div className="flex flex-wrap items-center gap-2 text-[10px]">
                                            {movie.rating && (
                                              <span className="inline-flex items-center gap-0.5 text-yellow-400 font-bold bg-yellow-950/20 px-1.5 py-0.2 rounded border border-yellow-900/30">
                                                ★ {movie.rating.toFixed(1)} / 10
                                              </span>
                                            )}
                                            {movie.sourceUsed && (
                                              <span className="inline-flex items-center gap-1 text-sky-400 bg-sky-950/20 px-1.5 py-0.2 rounded border border-sky-900/30 text-[9px] font-semibold font-sans">
                                                <Database className="w-2.5 h-2.5" /> {movie.sourceUsed}
                                              </span>
                                            )}
                                          </div>

                                          {/* Synopsis */}
                                          {movie.synopsis && (
                                            <p 
                                              className="text-[10px] text-slate-400 max-w-lg whitespace-normal leading-relaxed font-sans line-clamp-2"
                                              title={movie.synopsis}
                                            >
                                              {movie.synopsis}
                                            </p>
                                          )}
                                          
                                          {movie.reasoning && (
                                            <p 
                                              className="text-[9px] text-slate-500 max-w-lg whitespace-normal italic leading-normal font-sans"
                                              title={movie.reasoning}
                                            >
                                              {movie.reasoning}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </td>

                                  {/* Confidence level badge */}
                                  <td className="px-5 py-4 text-center">
                                    {movie.status === "matched" && movie.confidence !== undefined && (
                                      <div>
                                        <span className={`inline-block px-2.5 py-0.5 rounded text-[11px] font-bold ${
                                          movie.confidence >= 0.9 
                                            ? "bg-green-950/30 text-green-400 border border-green-900/20" 
                                            : movie.confidence >= 0.7 
                                            ? "bg-yellow-950/30 text-yellow-400 border border-yellow-900/20" 
                                            : "bg-red-950/30 text-red-400 border border-red-900/20"
                                        }`}>
                                          {Math.round(movie.confidence * 100)}%
                                        </span>
                                      </div>
                                    )}
                                  </td>

                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* Processing execution section */}
                      <div className="bg-[#1E293B] p-5 sm:p-6 border-t border-slate-800 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                        
                        {/* Execution settings panel */}
                        <div className="space-y-4 w-full lg:max-w-xl">
                          <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block font-mono">
                            Opciones de Clasificación y Reubicación
                          </h4>
                          
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                              <label className="text-[11px] font-semibold text-slate-300 block font-mono">Esquema de Destino:</label>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => setOrganizeType("flat")}
                                  className={`flex-1 px-3 py-2 border rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    organizeType === "flat"
                                      ? "bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/10"
                                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                                  }`}
                                >
                                  Directorio Plano
                                </button>
                                <button
                                  onClick={() => setOrganizeType("alphabetical")}
                                  className={`flex-1 px-3 py-2 border rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                                    organizeType === "alphabetical"
                                      ? "bg-orange-600 border-orange-600 text-white shadow-md shadow-orange-600/10"
                                      : "bg-slate-800 border-slate-700 text-slate-300 hover:bg-slate-700"
                                  }`}
                                >
                                  Alfabético (A-Z)
                                </button>
                              </div>
                            </div>

                            <div className="space-y-3 pt-6 sm:pt-4">
                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={processSubtitles}
                                  onChange={(e) => setProcessSubtitles(e.target.checked)}
                                  className="rounded border-slate-700 bg-slate-900 text-orange-500 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                />
                                <span className="text-xs font-semibold text-slate-300">Renombrar subtítulos (.srt, .vtt)</span>
                              </label>

                              <label className="flex items-center gap-2 cursor-pointer select-none">
                                <input
                                  type="checkbox"
                                  checked={cleanFolders}
                                  onChange={(e) => setCleanFolders(e.target.checked)}
                                  className="rounded border-slate-700 bg-slate-900 text-orange-500 focus:ring-orange-500 h-4 w-4 cursor-pointer"
                                />
                                <span className="text-xs font-semibold text-slate-300">Eliminar directorios vacíos</span>
                              </label>
                            </div>
                          </div>
                        </div>

                        {/* Execute action button */}
                        <div className="w-full lg:w-auto shrink-0 self-stretch flex items-end justify-end">
                          <button
                            onClick={executeOrganization}
                            disabled={isProcessing || movies.filter(m => selectedMovieIds.includes(m.id) && m.status === "matched").length === 0}
                            id="btn-execute-organizer"
                            className="w-full lg:w-auto px-6 py-4 bg-[#16A34A] hover:bg-green-500 disabled:bg-slate-800 disabled:text-slate-500 text-white font-bold text-sm rounded-xl shadow-lg shadow-green-600/10 flex items-center justify-center gap-2.5 transition-all cursor-pointer"
                          >
                            {isProcessing ? (
                              <>
                                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                                Procesando archivos...
                              </>
                            ) : (
                              <>
                                <Play className="w-4.5 h-4.5 fill-current" />
                                Mover y Organizar Selección
                              </>
                            )}
                          </button>
                        </div>

                      </div>

                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Comprehensive processed report summary view */}
          {recentReport && activeTab === "organizer" && (
            <div id="processing-report-popup" className="bg-[#0F172A] border border-slate-800 rounded-xl shadow-2xl p-6 overflow-hidden max-w-6xl mx-auto">
              <div className="flex justify-between items-center pb-4 mb-4 border-b border-slate-800">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-400" />
                  <h3 className="text-lg font-display font-bold text-white tracking-tight">
                    ¡Operación de Procesamiento Completada!
                  </h3>
                </div>
                <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                  Reporte ID: {recentReport.id}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 mb-6 text-center">
                <div className="p-4 bg-green-950/20 rounded-lg border border-green-900/30">
                  <span className="text-xs text-green-400 font-semibold block uppercase">Exitosas</span>
                  <span className="text-2xl font-bold text-green-400 mt-1 block font-mono">{recentReport.successCount}</span>
                </div>
                <div className="p-4 bg-red-950/20 rounded-lg border border-red-900/30">
                  <span className="text-xs text-red-400 font-semibold block uppercase font-mono">Errores</span>
                  <span className="text-2xl font-bold text-red-400 mt-1 block font-mono">{recentReport.errorCount}</span>
                </div>
                <div className="p-4 bg-orange-950/20 rounded-lg border border-orange-900/30">
                  <span className="text-xs text-orange-400 font-semibold block uppercase">Total Procesados</span>
                  <span className="text-2xl font-bold text-orange-400 mt-1 block font-mono">{recentReport.totalProcessed}</span>
                </div>
              </div>

              <div className="bg-slate-950 rounded-lg p-4 font-mono text-xs text-slate-300 h-44 overflow-y-auto space-y-1.5 border border-slate-800">
                <div className="text-slate-500"># --- INFORME EXHAUSTIVO DE PROCESAMIENTO ---</div>
                {recentReport.logs.map((log: any, idx: number) => (
                  <div 
                    key={idx} 
                    className={
                      log.status === "OK" 
                        ? "text-green-400" 
                        : log.status === "WARNING" 
                        ? "text-yellow-400" 
                        : "text-red-400"
                    }
                  >
                    [{log.status}] {log.file} {log.newName ? `-> ${log.newName}` : ""} | {log.message}
                  </div>
                ))}
                <div className="text-slate-500"># --- FIN DEL INFORME ---</div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-800">
                <button
                  onClick={() => setRecentReport(null)}
                  className="px-4 py-2 border border-slate-700 text-slate-300 text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                >
                  Cerrar Informe
                </button>
                <button
                  onClick={() => {
                    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(recentReport, null, 2));
                    const downloadAnchor = document.createElement("a");
                    downloadAnchor.setAttribute("href", dataStr);
                    downloadAnchor.setAttribute("download", `informe_procesamiento_${recentReport.id}.json`);
                    document.body.appendChild(downloadAnchor);
                    downloadAnchor.click();
                    downloadAnchor.remove();
                  }}
                  className="px-4 py-2 bg-orange-600 hover:bg-orange-500 text-white text-xs font-semibold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <FileText className="w-3.5 h-3.5" />
                  Exportar JSON de Informe
                </button>
              </div>
            </div>
          )}

        </main>
      </div>
    </div>
  );
}
