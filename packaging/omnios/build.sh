#!/usr/bin/bash
#
# CDDL HEADER START
#
# The contents of this file are subject to the terms of the
# Common Development and Distribution License, Version 1.0 only
# (the "License").  You may not use this file except in compliance
# with the License.
#
# You can obtain a copy of the license at usr/src/OPENSOLARIS.LICENSE
# or http://www.opensolaris.org/os/licensing.
# See the License for the specific language governing permissions
# and limitations under the License.
#
# When distributing Covered Code, include this CDDL HEADER in each
# file and include the License file at usr/src/OPENSOLARIS.LICENSE.
# If applicable, add the following below this CDDL HEADER, with the
# fields enclosed by brackets "[]" replaced with your own identifying
# information: Portions Copyright [yyyy] [name of copyright owner]
#
# CDDL HEADER END
#
#
# Copyright 2025 MarkProminic. All rights reserved.
# Use is subject to license terms.
#

set -e

# Simple logging functions
logmsg() { echo "=== $*"; }
logcmd() { echo ">>> $*"; "$@"; }
logerr() { echo "ERROR: $*" >&2; }

# Set up variables
SRCDIR="$(pwd)"
DESTDIR="${SRCDIR}/proto"
PROG=web-terminal
# Use DEV_VERSION if set (for development builds), otherwise use package.json version
if [ -n "$DEV_VERSION" ]; then
    VER="$DEV_VERSION"
    # Always use base package name for IPS operations (manifest is hardcoded)
    PKG=application/management/web-terminal
    PACKAGE_PREFIX="web-terminal-dev"
else
    VER=$(node -p "require('./package.json').version" 2>/dev/null || echo "1.0.0")
    PKG=application/management/web-terminal
    PACKAGE_PREFIX="web-terminal"
fi

# Clean and create staging directory
rm -rf "$DESTDIR"
mkdir -p "$DESTDIR"

#### Build Structure
# /opt/web-terminal/
#   # Node.js application files
#   app.js
#   package.json
#   models/
#   routes/
#   middleware/
#   config/
#   utils/
#   scripts/
#   node_modules/
#   startup.sh
#   shutdown.sh
# /var/lib/web-terminal/
# /var/log/web-terminal/

build_app() {
    logmsg "Building Web-Terminal"
    
    # Set up environment for OmniOS/Solaris
    export MAKE=gmake
    export CC=gcc
    export CXX=g++
    
    # Set POSIX compilation flags for better-sqlite3 compatibility on Solaris
    export CPPFLAGS="-D_POSIX_C_SOURCE=199309L -D__EXTENSIONS__"
    export CFLAGS="-D_POSIX_C_SOURCE=199309L -D__EXTENSIONS__"
    
    # Install dependencies using structured scripts (backend only since frontend build is disabled)
    MAKE=gmake logcmd npm run cinstall:backend:nodev
    
    # TODO: Enable when Vite builds are ready
    # Build frontend
    # logcmd npm run build
}

install_app() {
    pushd $DESTDIR >/dev/null

    # Create main application directory
    logcmd mkdir -p opt/web-terminal
    pushd opt/web-terminal >/dev/null

    # Copy application files
    logmsg "Installing Web-Terminal application files"
    logcmd cp $SRCDIR/app.js .
    logcmd cp $SRCDIR/package.json .
    logcmd cp $SRCDIR/LICENSE.md .
    
    # Copy application directories (Web-Terminal's actual structure)
    for dir in models routes middleware config utils scripts; do
        if [ -d "$SRCDIR/$dir" ]; then
            logcmd cp -r $SRCDIR/$dir .
        fi
    done
    
    # Copy web assets
    logcmd mkdir -p web
    # TODO: Enable when Vite builds are ready
    # logcmd cp -r $SRCDIR/web/dist web/
    # Temporary: Copy public assets directly
    logcmd cp -r $SRCDIR/web/public web/
    
    # Copy node_modules (production only)
    if [ -d "$SRCDIR/node_modules" ]; then
        logcmd cp -r $SRCDIR/node_modules .
    fi
    
    # Copy SMF method scripts
    logcmd cp $SRCDIR/packaging/omnios/startup.sh .
    logcmd cp $SRCDIR/packaging/omnios/shutdown.sh .
    logcmd chmod 755 startup.sh shutdown.sh
    
    popd >/dev/null # /opt/web-terminal

    # Install configuration
    logmsg "Installing configuration files"
    logcmd mkdir -p etc/web-terminal

    # Create data and log directories
    logcmd mkdir -p var/lib/web-terminal
    logcmd mkdir -p var/log/web-terminal

    # Install SMF manifest
    logmsg "Installing SMF manifest"
    logcmd mkdir -p lib/svc/manifest/system
    logcmd cp $SRCDIR/packaging/omnios/web-terminal-smf.xml lib/svc/manifest/system/web-terminal.xml

    # Install man pages in standard OOCE location
    logmsg "Installing man pages"
    logcmd mkdir -p opt/ooce/share/man/man8 opt/ooce/share/man/man5
    logcmd cp $SRCDIR/packaging/omnios/man/web-terminal.8 opt/ooce/share/man/man8/ || \
        logerr "--- copying main man page failed"
    logcmd cp $SRCDIR/packaging/omnios/man/web-terminal.yaml.5 opt/ooce/share/man/man5/ || \
        logerr "--- copying config man page failed"

    popd >/dev/null # $DESTDIR
}

post_install() {
    logmsg "--- Setting up Web-Terminal staging directory"
    
    pushd $DESTDIR >/dev/null
    
    # Create SSL directory (certificates will be generated during installation)
    logcmd mkdir -p etc/web-terminal/ssl
    
    # Create database directory
    logcmd mkdir -p var/lib/web-terminal/database

    popd >/dev/null
    
    logmsg "Web-Terminal staging setup completed"
}

# Main build process
logmsg "Starting Web-Terminal build process"
build_app
install_app
post_install

# Create the complete package
logmsg "Creating IPS package"
cd "$SRCDIR"
export VERSION="$VER"
sed "s/@VERSION@/${VERSION}/g" packaging/omnios/web-terminal.p5m > web-terminal.p5m.tmp
pkgsend generate proto | pkgfmt > web-terminal.p5m.generated
pkgmogrify -DVERSION="${VERSION}" web-terminal.p5m.tmp web-terminal.p5m.generated > web-terminal.p5m.final

# Create temporary local repository
TEMP_REPO="${SRCDIR}/temp-repo"
rm -rf "$TEMP_REPO"
pkgrepo create "$TEMP_REPO"
pkgrepo set -s "$TEMP_REPO" publisher/prefix=MarkProminic

# Publish package to temporary repository
pkgsend -s "file://${TEMP_REPO}" publish -d proto web-terminal.p5m.final

# Create .p5p package archive
PACKAGE_FILE="${PACKAGE_PREFIX}-${VERSION}.p5p"
pkgrecv -s "file://${TEMP_REPO}" -a -d "${PACKAGE_FILE}" "${PKG}"

# Clean up temporary repository
rm -rf "$TEMP_REPO"

logmsg "Package build completed: ${PACKAGE_FILE}"
logmsg "Complete package ready for upload to GitHub artifacts"

# Vim hints
# vim:ts=4:sw=4:et:
