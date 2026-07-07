#!/bin/bash
# Build script for Movie Organizer .deb package on Ubuntu

set -e

echo "=== 1. Building Frontend and Backend ==="
npm install
npm run build

echo "=== 2. Setting up Debian directory structure ==="
BUILD_DIR="/tmp/movie-organizer-deb-build"
DEB_DEST="./movie-organizer_1.0.0_all.deb"

# Clean up
rm -rf "$BUILD_DIR"
mkdir -p "$BUILD_DIR/DEBIAN"
mkdir -p "$BUILD_DIR/usr/bin"
mkdir -p "$BUILD_DIR/usr/share/movie-organizer"
mkdir -p "$BUILD_DIR/lib/systemd/system"

echo "=== 3. Creating DEBIAN/control ==="
cat << 'EOF' > "$BUILD_DIR/DEBIAN/control"
Package: movie-organizer
Version: 1.0.0
Section: utils
Priority: optional
Architecture: all
Maintainer: Organizador de Películas AI <CMineWar1.5@gmail.com>
Depends: nodejs (>= 16)
Description: Organizador inteligente de películas con Emby y Gemini AI.
 Escanea directorios de descarga de películas, lee metadatos de Emby
 y renombra los archivos con el formato estandarizado 'Título [IMDbID]'.
 Se integra con Gemini AI para lograr máxima precisión en la clasificación.
EOF

echo "=== 4. Creating DEBIAN/postinst script ==="
cat << 'EOF' > "$BUILD_DIR/DEBIAN/postinst"
#!/bin/sh
set -e
chmod +x /usr/bin/movie-organizer
systemctl daemon-reload || true
echo "Organizador de Películas instalado con éxito!"
echo "Puedes iniciarlo con: movie-organizer"
exit 0
EOF
chmod 755 "$BUILD_DIR/DEBIAN/postinst"

echo "=== 5. Creating usr/bin/movie-organizer launcher ==="
cat << 'EOF' > "$BUILD_DIR/usr/bin/movie-organizer"
#!/bin/bash
# Executable to launch the Movie Organizer application
echo "Iniciando Organizador de Películas..."
if [ -z "$GEMINI_API_KEY" ]; then
  echo "ADVERTENCIA: La variable GEMINI_API_KEY no está configurada."
  echo "Se utilizará el algoritmo de emparejamiento local de respaldo."
fi
node /usr/share/movie-organizer/server.cjs
EOF
chmod 755 "$BUILD_DIR/usr/bin/movie-organizer"

echo "=== 6. Creating Systemd service configuration ==="
cat << 'EOF' > "$BUILD_DIR/lib/systemd/system/movie-organizer.service"
[Unit]
Description=Movie Organizer Web Service
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

echo "=== 7. Copying build artifacts ==="
cp dist/server.cjs "$BUILD_DIR/usr/share/movie-organizer/server.cjs"
cp -r dist "$BUILD_DIR/usr/share/movie-organizer/dist"

echo "=== 8. Packaging .deb ==="
dpkg-deb --build "$BUILD_DIR" "$DEB_DEST"

echo "=== SUCCESS: .deb package created at $DEB_DEST ==="
