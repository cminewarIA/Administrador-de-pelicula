import { useState } from "react";
import { Download, Terminal, CheckCircle, Loader2, Cpu, FileText, AlertTriangle } from "lucide-react";

export default function DebPackager() {
  const [isCompiling, setIsCompiling] = useState(false);
  const [compilationLogs, setCompilationLogs] = useState<string[]>([]);
  const [packResult, setPackResult] = useState<{
    success: boolean;
    buildSuccess: boolean;
    message: string;
    filename: string;
  } | null>(null);

  const triggerBuild = async () => {
    setIsCompiling(true);
    setPackResult(null);
    setCompilationLogs([
      "[$] Iniciando proceso de empaquetado Debian para Ubuntu...",
      "[$] Creando estructura de directorios temporal en /tmp/movie-organizer-deb-build...",
      "[$] Copiando archivos de control de empaquetado (DEBIAN/control)...",
      "[$] Creando script de post-instalación de Ubuntu (DEBIAN/postinst)..."
    ]);

    try {
      // Simulate real step-by-step progress logging in the terminal view
      await new Promise(r => setTimeout(r, 700));
      setCompilationLogs(prev => [...prev, "[$] Compilando e integrando servidor Express bundle (server.cjs)..."]);
      
      await new Promise(r => setTimeout(r, 700));
      setCompilationLogs(prev => [...prev, "[$] Integrando interfaz de usuario estática React (Vite Dist)..."]);
      
      await new Promise(r => setTimeout(r, 600));
      setCompilationLogs(prev => [...prev, "[$] Creando ejecutable ejecutable /usr/bin/movie-organizer..."]);
      setCompilationLogs(prev => [...prev, "[$] Generando configuración de servicio Systemd (movie-organizer.service)..."]);
      
      await new Promise(r => setTimeout(r, 500));
      setCompilationLogs(prev => [...prev, "[$] Ejecutando: dpkg-deb --build /tmp/movie-organizer-deb-build ..."]);

      const response = await fetch("/api/deb/build");
      const data = await response.json();

      if (data.success) {
        setCompilationLogs(prev => [
          ...prev,
          `[$] ${data.message}`,
          `[$] ¡Paquete generado! Archivo final: ${data.filename}`,
          "[$] Proceso de empaquetado finalizado con éxito."
        ]);
        setPackResult({
          success: true,
          buildSuccess: data.buildSuccess,
          message: data.message,
          filename: data.filename
        });
      } else {
        throw new Error(data.error || "Fallo desconocido en la compilación");
      }
    } catch (err: any) {
      setCompilationLogs(prev => [
        ...prev,
        `[!] ERROR durante el empaquetado: ${err.message}`,
        "[!] Intento fallido. Comprueba los permisos o el linter del backend."
      ]);
      setPackResult({
        success: false,
        buildSuccess: false,
        message: err.message,
        filename: ""
      });
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div id="deb-packager-section" className="bg-[#0F172A] border border-slate-800 rounded-xl p-6 shadow-2xl overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 bg-orange-500/10 text-orange-400 text-xs font-semibold rounded border border-orange-500/20 font-mono">
              Ubuntu / Debian
            </span>
            <h2 className="text-xl font-display font-semibold text-white tracking-tight">
              Instalador Nativo .deb para Linux
            </h2>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            Empaqueta esta herramienta completa para ejecutarla de forma nativa en tu servidor Ubuntu.
          </p>
        </div>

        <button
          onClick={triggerBuild}
          disabled={isCompiling}
          id="btn-trigger-deb-build"
          className="w-full md:w-auto px-5 py-2.5 bg-orange-600 hover:bg-orange-500 disabled:bg-slate-800 disabled:text-slate-600 text-white font-medium text-sm rounded-lg shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
        >
          {isCompiling ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Empaquetando...
            </>
          ) : (
            <>
              <Cpu className="w-4 h-4" />
              Compilar Paquete Linux (.deb)
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Terminal Compilation Console */}
        <div className="lg:col-span-7 flex flex-col">
          <div className="flex items-center justify-between px-4 py-2 bg-[#1E293B] border border-slate-800 border-b-0 rounded-t-lg">
            <div className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-yellow-500/80"></span>
              <span className="w-2.5 h-2.5 rounded-full bg-green-500/80"></span>
            </div>
            <span className="text-xs font-mono text-slate-400 flex items-center gap-1">
              <Terminal className="w-3.5 h-3.5 text-orange-500" /> compilador-deb.sh
            </span>
          </div>
          <div className="bg-slate-950 p-4 rounded-b-lg font-mono text-xs text-slate-300 h-64 overflow-y-auto space-y-2 border border-slate-800">
            {compilationLogs.length === 0 ? (
              <div className="text-slate-500 italic flex flex-col items-center justify-center h-full gap-2">
                <Terminal className="w-8 h-8 text-slate-800" />
                <span>Consola lista. Haz clic en "Compilar Paquete Linux" para iniciar.</span>
              </div>
            ) : (
              compilationLogs.map((log, i) => (
                <div
                  key={i}
                  className={`${
                    log.includes("[!]")
                      ? "text-red-400"
                      : log.includes("¡Paquete") || log.includes("exito")
                      ? "text-green-400"
                      : "text-slate-300"
                  }`}
                >
                  {log}
                </div>
              ))
            )}
          </div>

          {packResult && (
            <div className="mt-4 p-4 rounded-lg border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#1E293B]/50 border-slate-800">
              <div className="flex items-start gap-3">
                {packResult.success ? (
                  <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
                )}
                <div>
                  <h4 className="text-sm font-semibold text-white">
                    {packResult.success ? "Compilación completada" : "Error en compilación"}
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {packResult.message}
                  </p>
                  {packResult.success && !packResult.buildSuccess && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] text-yellow-400 bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded font-mono">
                      <AlertTriangle className="w-3.5 h-3.5" />
                      Fallback: Generado instalador tarball portable para Ubuntu.
                    </div>
                  )}
                </div>
              </div>

              {packResult.success && (
                <a
                  href="/api/deb/download"
                  download
                  id="btn-download-deb-package"
                  className="w-full md:w-auto px-4 py-2 bg-green-600 hover:bg-green-500 text-white font-semibold text-xs rounded shadow-lg flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  Descargar {packResult.filename.endsWith(".deb") ? "Instalador .deb" : "Código + Script (.tar.gz)"}
                </a>
              )}
            </div>
          )}
        </div>

        {/* Installation Instructions */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 bg-[#1E293B] border border-slate-800 rounded-lg">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 text-orange-400" />
              <h3 className="text-sm font-semibold text-white font-display">Instrucciones de Instalación</h3>
            </div>
            
            <div className="space-y-4 text-xs">
              <div>
                <p className="text-slate-300 font-medium mb-1">1. Instalar el paquete descargado:</p>
                <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[11px] text-orange-400 select-all">
                  sudo dpkg -i movie-organizer_1.0.0_all.deb
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  * Si hay dependencias rotas, soluciona con: <code className="font-mono text-slate-400">sudo apt-get install -f</code>.
                </p>
              </div>

              <div>
                <p className="text-slate-300 font-medium mb-1">2. Configurar la clave de API de Gemini:</p>
                <p className="text-slate-400 mb-1">
                  Exporta tu clave de API en tu entorno antes de ejecutar la aplicación:
                </p>
                <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[11px] text-orange-400 select-all">
                  export GEMINI_API_KEY="tu_clave_aqui"
                </div>
              </div>

              <div>
                <p className="text-slate-300 font-medium mb-1">3. Ejecutar de forma interactiva (CLI):</p>
                <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[11px] text-orange-400 select-all">
                  movie-organizer
                </div>
              </div>

              <div>
                <p className="text-slate-300 font-medium mb-1">4. Ejecutar como Servicio de Systemd:</p>
                <p className="text-slate-400 mb-1">
                  La instalación configura un servicio systemd en segundo plano. Inícialo con:
                </p>
                <div className="bg-slate-950 p-2 rounded border border-slate-800 font-mono text-[11px] text-orange-400 space-y-1">
                  <div className="select-all">sudo systemctl enable movie-organizer</div>
                  <div className="select-all">sudo systemctl start movie-organizer</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
