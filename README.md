# CineOrganize AI (Movie Organizer)

CineOrganize AI es un organizador inteligente y estandarizador de películas diseñado para integrarse con Emby, servidores NAS (vía SMB/FTP) y Gemini AI para obtener la máxima precisión y enriquecimiento de metadatos de películas de TMDb y Trakt.tv.

## Características

- 🎥 **Estandarización Inteligente**: Renombra archivos de películas usando el formato estándar de Emby: `Título de la Película (Año) [imdbid-ttXXXXXXX]`.
- 🧠 **Potenciado por Gemini 2.0 Flash**: Analiza nombres complejos de archivos (con etiquetas de release, formato, resolución, etc.), lee metadatos locales de NFO y busca en TMDb/Trakt.tv en tiempo real usando el motor de búsqueda integrado de Gemini.
- 📁 **Soporte de Almacenamiento Remoto**: Escanea y organiza directorios en local o remotamente mediante protocolos **SMB (Samba)** y **FTP**.
- 📊 **Historial de Informes**: Registra escaneos exitosos y errores en formato JSON persistente.
- 📦 **Empaquetado en .deb**: Incluye script para generar un paquete Debian instalable nativamente en Ubuntu/Debian con una interfaz gráfica basada en PyGObject/WebKit.

## Requisitos de Entorno

Para que CineOrganize AI funcione al 100%, debes configurar las siguientes variables de entorno:

- `GEMINI_API_KEY`: Tu clave de API de Google AI Studio (requerida para habilitar la consulta inteligente y enriquecimiento de metadatos en TMDb y Trakt.tv).

## Configuración y Conexiones

### Rutas Locales
- Formato: `/ruta/absoluta/a/tus/descargas`
- Ejemplo de simulación predeterminada: `/tmp/movie_organizer/downloads`

### Rutas SMB (Samba/NAS)
- Formato: `smb://usuario:contraseña@host:puerto/recurso/subcarpeta`
- Ejemplo: `smb://admin:secreto@192.168.1.100/video/torrent/descargas`

### Rutas FTP
- Formato: `ftp://usuario:contraseña@host:puerto/subcarpeta`
- Ejemplo: `ftp://user:pass@ftp.miservidor.com/movies`

## Compilación e Instalación (.deb)

Puedes generar el paquete de instalación Debian utilizando el script avanzado `build_deb.sh`:

1. Dale permisos de ejecución al script:
   ```bash
   chmod +x build_deb.sh
   ```

2. Compila el paquete especificando una versión opcional (ej. `1.2.0`):
   ```bash
   ./build_deb.sh 1.2.0
   ```

3. Instala el archivo `.deb` resultante:
   ```bash
   sudo dpkg -i movie-organizer_1.2.0_all.deb
   # Si faltan dependencias, corrígelas con:
   sudo apt-get install -f
   ```

El instalador configurará automáticamente:
- El lanzador del menú de aplicaciones (`CineOrganize AI`)
- Un servicio de systemd ejecutándose en producción en el puerto `3000` con `NODE_ENV=production`.
- Un wrapper nativo de GTK3/WebKit para una experiencia de escritorio fluida.

---
Creado con ❤️ para amantes del cine y organizadores de NAS de alta precisión.
