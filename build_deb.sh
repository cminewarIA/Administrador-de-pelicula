#!/bin/bash
# Advanced Build script for Movie Organizer .deb package on Ubuntu/Debian
# Author: Organizador de Películas AI <CMineWar1.5@gmail.com>

set -e

# Extract version from first parameter, or default to 1.0.0
VERSION="${1:-1.0.0}"
# Strip leading 'v' or 'V' if present (e.g., v1.0.1 -> 1.0.1)
VERSION="${VERSION#[vV]}"

echo "=== 1. Building Frontend and Backend ==="
if [ ! -d "node_modules" ]; then
  echo "node_modules not found, running npm install..."
  npm install
fi
npm run build

echo "=== 2. Setting up Debian directory structure for version ${VERSION} ==="
BUILD_DIR="/tmp/movie-organizer-deb-build"
DEB_DEST="./movie-organizer_${VERSION}_all.deb"

# Clean up any existing build dir
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/DEBIAN"
mkdir -p "$BUILD_DIR/usr/bin"
mkdir -p "$BUILD_DIR/usr/share/movie-organizer"
mkdir -p "$BUILD_DIR/usr/share/applications"
mkdir -p "$BUILD_DIR/usr/share/pixmaps"
mkdir -p "$BUILD_DIR/usr/share/icons/hicolor/scalable/apps"
mkdir -p "$BUILD_DIR/lib/systemd/system"

echo "=== 3. Creating DEBIAN/control ==="
cat << EOF > "$BUILD_DIR/DEBIAN/control"
Package: movie-organizer
Version: ${VERSION}
Section: utils
Priority: optional
Architecture: all
Maintainer: Organizador de Películas AI <CMineWar1.5@gmail.com>
Depends: nodejs (>= 16), python3, python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.0 | gir1.2-webkit2-4.1
Description: Organizador inteligente de películas con Emby y Gemini AI.
 Escanea directorios de descarga de películas, lee metadatos de Emby
 y renombra los archivos con el formato estandarizado 'Título [IMDbID]'.
 Se integra con Gemini AI para lograr máxima precisión en la clasificación.
 Incluye soporte para lanzador de escritorio y actualizaciones automáticas.
EOF

echo "=== 4. Creating DEBIAN maintainer scripts (Upgrades, Restarts) ==="

# postinst script
cat << 'EOF' > "$BUILD_DIR/DEBIAN/postinst"
#!/bin/sh
set -e

# Make launcher executable
chmod +x /usr/bin/movie-organizer
chmod +x /usr/bin/cineorganize-ai 2>/dev/null || true

# Handle systemd setup if systemd is active on the host
if [ -d /run/systemd/system ]; then
    echo "Reloading systemd daemon, enabling and starting movie-organizer service..."
    systemctl daemon-reload || true
    systemctl enable movie-organizer || true
    systemctl restart movie-organizer || true
fi

# Update desktop and icon databases
if [ -x /usr/bin/update-desktop-database ]; then
    echo "Updating desktop database..."
    update-desktop-database -q || true
fi

if [ -x /usr/bin/gtk-update-icon-cache ]; then
    echo "Updating GTK icon cache..."
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi

echo "¡Organizador de Películas instalado/actualizado con éxito!"
echo "Puedes iniciarlo desde el buscador de aplicaciones o con: movie-organizer"
exit 0
EOF
chmod 755 "$BUILD_DIR/DEBIAN/postinst"

# prerm script (called before removal or upgrade)
cat << 'EOF' > "$BUILD_DIR/DEBIAN/prerm"
#!/bin/sh
set -e

# Stop service if systemd is active on the host
if [ -d /run/systemd/system ] && [ "$1" = "remove" -o "$1" = "upgrade" ]; then
    echo "Stopping movie-organizer service before removal/upgrade..."
    systemctl stop movie-organizer || true
fi

exit 0
EOF
chmod 755 "$BUILD_DIR/DEBIAN/prerm"

# postrm script (called after removal or upgrade)
cat << 'EOF' > "$BUILD_DIR/DEBIAN/postrm"
#!/bin/sh
set -e

# Reload systemd daemon if service is removed or purged
if [ -d /run/systemd/system ]; then
    systemctl daemon-reload || true
fi

# Update desktop and icon databases
if [ -x /usr/bin/update-desktop-database ]; then
    update-desktop-database -q || true
fi

if [ -x /usr/bin/gtk-update-icon-cache ]; then
    gtk-update-icon-cache -f -t /usr/share/icons/hicolor || true
fi

exit 0
EOF
chmod 755 "$BUILD_DIR/DEBIAN/postrm"

echo "=== 5. Creating launcher executable (/usr/bin/movie-organizer) ==="
# This smart launcher handles both desktop launcher clicks and headless CLI execution
cat << 'EOF' > "$BUILD_DIR/usr/bin/movie-organizer"
#!/bin/bash
# Executable launcher for Movie Organizer application

# Check if running in a graphical desktop session
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
  # User clicked desktop launcher or ran from desktop terminal
  # Check if port 3000 is already in use
  if ! ss -tuln | grep -q ":3000 "; then
    echo "Iniciando servidor de metadatos de películas en segundo plano..."
    if [ -z "$GEMINI_API_KEY" ]; then
      echo "ADVERTENCIA: La variable GEMINI_API_KEY no está configurada."
    fi
    node /usr/share/movie-organizer/server.cjs > /tmp/movie-organizer.log 2>&1 &
    
    # Wait for server to boot (max 5 seconds)
    for i in {1..10}; do
      if ss -tuln | grep -q ":3000 "; then
        break
      fi
      sleep 0.5
    done
  fi
  
  # Launch native PyGObject WebKit window
  echo "Iniciando interfaz nativa..."
  if python3 /usr/share/movie-organizer/gui.py > /tmp/movie-organizer-gui.log 2>&1; then
    echo "Interfaz nativa cerrada con éxito."
  else
    echo "La interfaz nativa falló o no está disponible. Abriendo en navegador..."
    xdg-open "http://localhost:3000" > /dev/null 2>&1 &
  fi
else
  # Running in non-graphical context (e.g. systemd or ssh terminal)
  echo "Iniciando Organizador de Películas en modo servicio (Puerto 3000)..."
  if [ -z "$GEMINI_API_KEY" ]; then
    echo "ADVERTENCIA: La variable GEMINI_API_KEY no está configurada."
  fi
  exec node /usr/share/movie-organizer/server.cjs
fi
EOF
chmod 755 "$BUILD_DIR/usr/bin/movie-organizer"
ln -sf movie-organizer "$BUILD_DIR/usr/bin/cineorganize-ai"

echo "=== 5b. Creating native PyGObject WebKit GUI wrapper ==="
cat << 'EOF' > "$BUILD_DIR/usr/share/movie-organizer/gui.py"
#!/usr/bin/env python3
import sys
import os
import gi

# Setup GTK & WebKit with fallback versions
try:
    gi.require_version('Gtk', '3.0')
    try:
        gi.require_version('WebKit2', '4.1')
    except (ValueError, AttributeError):
        try:
            gi.require_version('WebKit2', '4.0')
        except (ValueError, AttributeError):
            pass
    from gi.repository import Gtk, WebKit2, Gdk
except Exception as e:
    print(f"Error cargando dependencias de interfaz nativa GTK/WebKit: {e}", file=sys.stderr)
    print("Por favor, asegúrate de instalar python3-gi, gir1.2-gtk-3.0, gir1.2-webkit2-4.0 o gir1.2-webkit2-4.1", file=sys.stderr)
    sys.exit(1)

class MovieOrganizerApp(Gtk.Window):
    def __init__(self):
        super().__init__(title="CineOrganize AI")
        self.set_default_size(1280, 800)
        self.set_position(Gtk.WindowPosition.CENTER)
        
        # Set window icon if available
        icon_path = "/usr/share/pixmaps/cineorganize-ai.svg"
        if not os.path.exists(icon_path):
            icon_path = "/usr/share/pixmaps/movie-organizer.svg"
            
        if os.path.exists(icon_path):
            try:
                self.set_icon_from_file(icon_path)
            except Exception:
                pass
                
        # Main vertical container
        self.vbox = Gtk.Box(orientation=Gtk.Orientation.VERTICAL, spacing=0)
        self.add(self.vbox)
        
        # Web View
        self.webview = WebKit2.WebView()
        
        # Enable developer tools and performance settings
        settings = self.webview.get_settings()
        settings.set_enable_developer_extras(True)
        settings.set_enable_webgl(True)
        settings.set_enable_html5_database(True)
        settings.set_enable_html5_local_storage(True)
        
        # Load localhost server
        self.webview.load_uri("http://localhost:3000")
        
        # Add Webview to vbox inside scrolled window
        self.scrolled_window = Gtk.ScrolledWindow()
        self.scrolled_window.add(self.webview)
        self.vbox.pack_start(self.scrolled_window, True, True, 0)
        
        self.connect("destroy", Gtk.main_quit)
        self.show_all()

if __name__ == "__main__":
    app = MovieOrganizerApp()
    Gtk.main()
EOF
chmod 755 "$BUILD_DIR/usr/share/movie-organizer/gui.py"

echo "=== 6. Creating Systemd service configuration ==="
cat << 'EOF' > "$BUILD_DIR/lib/systemd/system/movie-organizer.service"
[Unit]
Description=Servicio Web del Organizador de Películas
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/usr/share/movie-organizer
ExecStart=/usr/bin/movie-organizer
Restart=on-failure
Environment=PORT=3000

[Install]
WantedBy=multi-user.target
EOF

echo "=== 7. Creating Desktop Entry and Icon ==="
# Desktop Entry to appear in Ubuntu applications launcher menu (for movie-organizer)
cat << 'EOF' > "$BUILD_DIR/usr/share/applications/movie-organizer.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=CineOrganize AI
Comment=Estandariza tus películas usando metadatos inteligentes de Emby, TMDb, Trakt y Gemini
Exec=/usr/bin/cineorganize-ai
Icon=cineorganize-ai
Terminal=false
Categories=Utility;FileTools;Database;
Keywords=movie;organizer;emby;gemini;tmdb;trakt;cine;
StartupNotify=true
EOF

# Desktop Entry to appear in Ubuntu applications launcher menu (for cineorganize-ai)
cat << 'EOF' > "$BUILD_DIR/usr/share/applications/cineorganize-ai.desktop"
[Desktop Entry]
Version=1.0
Type=Application
Name=CineOrganize AI
Comment=Estandariza tus películas usando metadatos inteligentes de Emby, TMDb, Trakt y Gemini
Exec=/usr/bin/cineorganize-ai
Icon=cineorganize-ai
Terminal=false
Categories=Utility;FileTools;Database;
Keywords=movie;organizer;emby;gemini;tmdb;trakt;cine;
StartupNotify=true
EOF

# Copy our beautiful scalable vector SVG icon
cp ./assets/movie-organizer.svg "$BUILD_DIR/usr/share/pixmaps/movie-organizer.svg"
cp ./assets/movie-organizer.svg "$BUILD_DIR/usr/share/icons/hicolor/scalable/apps/movie-organizer.svg"
cp ./assets/cineorganize-ai.svg "$BUILD_DIR/usr/share/pixmaps/cineorganize-ai.svg"
cp ./assets/cineorganize-ai.svg "$BUILD_DIR/usr/share/icons/hicolor/scalable/apps/cineorganize-ai.svg"

echo "=== 8. Copying build artifacts ==="
cp dist/server.cjs "$BUILD_DIR/usr/share/movie-organizer/server.cjs"
cp -r dist "$BUILD_DIR/usr/share/movie-organizer/dist"

echo "=== 9. Packaging .deb ==="
dpkg-deb --build "$BUILD_DIR" "$DEB_DEST"

echo "=== SUCCESS: .deb package created at $DEB_DEST ==="
