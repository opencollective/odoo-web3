#!/usr/bin/env python3
"""
Filtering HTTP(S) proxy for the bwrap sandbox.

Allows requests only to hostnames matching one of the ALLOWED patterns.
Supports CONNECT (HTTPS tunnel) and plain HTTP forwarding.
Wildcard patterns: "*.example.com" matches any subdomain AND the apex.
"""

import fnmatch
import http.server
import logging
import select
import socket
import socketserver
import sys
import threading
import urllib.parse
from http import HTTPStatus

ALLOWED = [
    "*.claude.com",
    "*.anthropic.com",
    "*.odoo.com",
    "*.opencollective.com",
    "*.stripe.com",
    "*.monerium.com",
    "*.monerium.dev",
]

LISTEN_HOST = "127.0.0.1"
LISTEN_PORT = 8888
UPSTREAM_TIMEOUT = 30
TUNNEL_IDLE_TIMEOUT = 300


def host_allowed(host: str) -> bool:
    host = host.lower().rstrip(".")
    for pat in ALLOWED:
        p = pat.lower()
        if fnmatch.fnmatch(host, p):
            return True
        if p.startswith("*.") and host == p[2:]:
            return True
    return False


class ProxyHandler(http.server.BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    timeout = UPSTREAM_TIMEOUT

    def log_message(self, fmt, *args):
        logging.info("%s - %s", self.client_address[0], fmt % args)

    def _deny(self, host: str):
        logging.warning("DENY %s %s (host=%s)", self.command, self.path, host)
        body = f"Sandbox proxy: host '{host}' is not on the allowlist.\n".encode()
        self.send_response(HTTPStatus.FORBIDDEN)
        self.send_header("Content-Type", "text/plain; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Connection", "close")
        self.end_headers()
        self.wfile.write(body)

    def do_CONNECT(self):
        host, _, port_s = self.path.partition(":")
        try:
            port = int(port_s) if port_s else 443
        except ValueError:
            self.send_error(HTTPStatus.BAD_REQUEST, "bad CONNECT target")
            return

        if not host_allowed(host):
            self._deny(host)
            return

        try:
            upstream = socket.create_connection((host, port), timeout=UPSTREAM_TIMEOUT)
        except OSError as e:
            logging.warning("CONNECT upstream failed %s:%s: %s", host, port, e)
            self.send_error(HTTPStatus.BAD_GATEWAY, f"upstream: {e}")
            return

        logging.info("TUNNEL %s:%s", host, port)
        self.send_response(HTTPStatus.OK, "Connection Established")
        self.end_headers()
        self._splice(self.connection, upstream)

    def _splice(self, a: socket.socket, b: socket.socket):
        a.setblocking(False)
        b.setblocking(False)
        socks = [a, b]
        try:
            while True:
                r, _, x = select.select(socks, [], socks, TUNNEL_IDLE_TIMEOUT)
                if x or not r:
                    break
                for s in r:
                    try:
                        data = s.recv(65536)
                    except (BlockingIOError, InterruptedError):
                        continue
                    except OSError:
                        return
                    if not data:
                        return
                    other = b if s is a else a
                    try:
                        other.sendall(data)
                    except OSError:
                        return
        finally:
            for s in socks:
                try:
                    s.shutdown(socket.SHUT_RDWR)
                except OSError:
                    pass
                s.close()

    def do_GET(self):
        self._forward()

    def do_POST(self):
        self._forward()

    def do_PUT(self):
        self._forward()

    def do_DELETE(self):
        self._forward()

    def do_HEAD(self):
        self._forward()

    def do_PATCH(self):
        self._forward()

    def do_OPTIONS(self):
        self._forward()

    def _forward(self):
        url = urllib.parse.urlsplit(self.path)
        if url.scheme not in ("http", ""):
            self.send_error(HTTPStatus.BAD_REQUEST, "only http/https supported")
            return
        host = url.hostname or self.headers.get("Host", "").split(":")[0]
        if not host:
            self.send_error(HTTPStatus.BAD_REQUEST, "no host")
            return
        if not host_allowed(host):
            self._deny(host)
            return

        port = url.port or 80
        path = urllib.parse.urlunsplit(("", "", url.path or "/", url.query, ""))

        try:
            upstream = socket.create_connection((host, port), timeout=UPSTREAM_TIMEOUT)
        except OSError as e:
            self.send_error(HTTPStatus.BAD_GATEWAY, f"upstream: {e}")
            return

        try:
            body_len = int(self.headers.get("Content-Length", "0") or "0")
        except ValueError:
            body_len = 0

        req_lines = [f"{self.command} {path} HTTP/1.1\r\n"]
        sent_host = False
        sent_connection = False
        for k, v in self.headers.items():
            lk = k.lower()
            if lk in ("proxy-connection", "proxy-authorization"):
                continue
            if lk == "connection":
                sent_connection = True
                v = "close"
            if lk == "host":
                sent_host = True
            req_lines.append(f"{k}: {v}\r\n")
        if not sent_host:
            req_lines.append(f"Host: {host}\r\n")
        if not sent_connection:
            req_lines.append("Connection: close\r\n")
        req_lines.append("\r\n")

        try:
            upstream.sendall("".join(req_lines).encode("iso-8859-1"))
            remaining = body_len
            while remaining > 0:
                chunk = self.rfile.read(min(65536, remaining))
                if not chunk:
                    break
                upstream.sendall(chunk)
                remaining -= len(chunk)
            while True:
                data = upstream.recv(65536)
                if not data:
                    break
                self.wfile.write(data)
        except OSError as e:
            logging.warning("forward error %s: %s", host, e)
        finally:
            try:
                upstream.close()
            except OSError:
                pass
        logging.info("HTTP %s %s://%s%s", self.command, url.scheme or "http", host, path)


class ThreadingProxy(socketserver.ThreadingMixIn, http.server.HTTPServer):
    daemon_threads = True
    allow_reuse_address = True


def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s sandbox-proxy %(levelname)s %(message)s",
    )
    srv = ThreadingProxy((LISTEN_HOST, LISTEN_PORT), ProxyHandler)
    logging.info("listening on %s:%d", LISTEN_HOST, LISTEN_PORT)
    logging.info("allowlist: %s", ", ".join(ALLOWED))
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        srv.server_close()


if __name__ == "__main__":
    main()
