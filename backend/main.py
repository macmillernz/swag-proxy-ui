from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from typing import Literal, Optional
import json
import os
from pathlib import Path

PROXY_CONF_DIR = Path(os.getenv("PROXY_CONF_DIR", "/config/nginx/proxy-confs"))
NGINX_CONF_DIR = Path(os.getenv("NGINX_CONF_DIR", "/config/nginx"))
SWAG_CONTAINER = os.getenv("SWAG_CONTAINER_NAME", "swag")
METADATA_PREFIX = "## SWAG-UI: "
EDITABLE_CONF_FILES = {"nginx.conf", "proxy.conf", "resolver.conf", "ssl.conf"}

AUTH_PROVIDERS = {"authelia", "authentik", "ldap", "tinyauth"}

DEFAULT_AUTH_TEMPLATES: dict[str, dict[str, str]] = {
    "authelia": {
        "server": """\
## Authelia server-block snippet
## https://www.authelia.com/integration/proxies/nginx/

location = /authelia/api/authz/auth-request {
    internal;

    proxy_pass              http://authelia:9091/api/authz/auth-request;

    proxy_pass_request_body off;
    proxy_set_header        Content-Length "";
    proxy_set_header        X-Original-URL $scheme://$http_host$request_uri;
    proxy_set_header        X-Forwarded-Method $request_method;
    proxy_set_header        X-Forwarded-Proto $scheme;
    proxy_set_header        X-Forwarded-Host $http_host;
    proxy_set_header        X-Forwarded-URI $request_uri;
    proxy_set_header        X-Forwarded-For $remote_addr;
    proxy_set_header        X-Original-Method $request_method;
    proxy_set_header        X-Original-URI $request_uri;
    proxy_set_header        X-Real-IP $remote_addr;
}

location @authelia_proxy_signin {
    internal;
    add_header Set-Cookie $authelia_redirect_cookie;
    return 302 https://authelia.example.com/;
}
""",
        "location": """\
## Authelia location-block snippet
auth_request /authelia/api/authz/auth-request;
auth_request_set $user   $upstream_http_remote_user;
auth_request_set $groups $upstream_http_remote_groups;
auth_request_set $name   $upstream_http_remote_name;
auth_request_set $emails $upstream_http_remote_emails;

proxy_set_header Remote-User   $user;
proxy_set_header Remote-Groups $groups;
proxy_set_header Remote-Name   $name;
proxy_set_header Remote-Emails $emails;

error_page 401 =302 https://authelia.example.com/;
""",
    },
    "authentik": {
        "server": """\
## Authentik server-block snippet
## https://goauthentik.io/docs/providers/proxy/nginx

location /outpost.goauthentik.io {
    proxy_pass          https://authentik:9443/outpost.goauthentik.io;
    proxy_set_header    Host $host;
    proxy_set_header    X-Original-URL $scheme://$http_host$request_uri;
    add_header          Set-Cookie $auth_cookie;
    auth_request_set    $auth_cookie $upstream_http_set_cookie;
    proxy_pass_request_body off;
    set                 $null '';
    proxy_set_header    Content-Length $null;
}

location @goauthentik_proxy_signin {
    internal;
    add_header Set-Cookie $auth_cookie;
    return 302 /outpost.goauthentik.io/start?rd=$request_uri;
}
""",
        "location": """\
## Authentik location-block snippet
auth_request /outpost.goauthentik.io/auth/nginx;
error_page 401 = @goauthentik_proxy_signin;
auth_request_set $auth_cookie $upstream_http_set_cookie;
add_header Set-Cookie $auth_cookie;

auth_request_set $authentik_username $upstream_http_x_authentik_username;
auth_request_set $authentik_groups   $upstream_http_x_authentik_groups;
auth_request_set $authentik_email    $upstream_http_x_authentik_email;
auth_request_set $authentik_name     $upstream_http_x_authentik_name;
auth_request_set $authentik_uid      $upstream_http_x_authentik_uid;

proxy_set_header X-authentik-username $authentik_username;
proxy_set_header X-authentik-groups   $authentik_groups;
proxy_set_header X-authentik-email    $authentik_email;
proxy_set_header X-authentik-name     $authentik_name;
proxy_set_header X-authentik-uid      $authentik_uid;
""",
    },
    "ldap": {
        "server": """\
## LDAP server-block snippet (linuxserver/ldap-auth)

location /ldaplogin {
    proxy_pass http://ldap-auth:9000;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Target $proxy_proto_addr;
    proxy_set_header X-Username '';
    proxy_set_header X-Url $scheme://$http_host$request_uri;
    proxy_set_header X-Cookie-Name "ZNC_Auth";
    proxy_set_header Cookie $http_cookie;
}

location = /auth {
    internal;
    proxy_pass http://ldap-auth:8888;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
    proxy_set_header X-Ldap-URL      "ldap://ldap.example.com:389";
    proxy_set_header X-Ldap-Base     "dc=example,dc=com";
    proxy_set_header X-Ldap-Binddn   "cn=admin,dc=example,dc=com";
    proxy_set_header X-Ldap-Bindpasswd "";
    proxy_set_header X-Ldap-Group    "(|(memberUid=$remote_user))";
    proxy_set_header X-CookieName    "ZNC_Auth";
    proxy_set_header Cookie $http_cookie;
}
""",
        "location": """\
## LDAP location-block snippet
auth_request /auth;
error_page 401 =200 /ldaplogin;
""",
    },
    "tinyauth": {
        "server": """\
## TinyAuth server-block snippet
## https://github.com/steveiliop56/tinyauth

location = /tinyauth {
    internal;
    proxy_pass http://tinyauth:3000/api/auth/nginx;
    proxy_set_header X-Original-URI $request_uri;
    proxy_set_header X-Original-URL $scheme://$host$request_uri;
    proxy_pass_request_body off;
    proxy_set_header Content-Length "";
}

location @tinyauth_login {
    internal;
    set $domain $scheme://$host;
    return 302 http://tinyauth:3000/?redirect=$domain$request_uri;
}
""",
        "location": """\
## TinyAuth location-block snippet
auth_request /tinyauth;
error_page 401 = @tinyauth_login;
""",
    },
}

app = FastAPI(title="SWAG Proxy UI")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

try:
    import docker as docker_sdk
except ImportError:
    docker_sdk = None


# ── Models ────────────────────────────────────────────────────────────────────

class ExtraLocation(BaseModel):
    path: str
    upstream_host: str
    upstream_port: int = 80
    upstream_proto: Literal["http", "https"] = "http"
    websocket: bool = False
    allow_ips: list[str] = []
    auth_location: bool = False


class ProxyHost(BaseModel):
    name: str
    type: Literal["subdomain", "subfolder"] = "subdomain"
    upstream_host: str
    upstream_port: int = 80
    upstream_proto: Literal["http", "https"] = "http"
    websocket: bool = False
    enabled: bool = True
    custom_location: Optional[str] = None
    client_max_body_size: str = "0"
    allow_ips: list[str] = []          # server-level (subdomain) / primary location (subfolder)
    extra_locations: list[ExtraLocation] = []
    auth_provider: Literal["none", "authelia", "authentik", "ldap", "tinyauth"] = "none"
    auth_server: bool = False          # include {provider}-server.conf in server block (subdomain only)
    auth_location: bool = False        # include {provider}-location.conf in primary location


class ConfigFileUpdate(BaseModel):
    content: str


# ── Conf generation helpers ───────────────────────────────────────────────────

def build_location_block(
    path: str,
    upstream_host: str,
    upstream_port: int,
    upstream_proto: str,
    websocket: bool,
    allow_ips: list[str],
    auth_provider: str = "none",
    auth_location: bool = False,
) -> str:
    lines = [
        f"    location {path} {{",
        "        include /config/nginx/proxy.conf;",
        "        include /config/nginx/resolver.conf;",
    ]
    if auth_provider != "none" and auth_location:
        lines.append(f"        include /config/nginx/{auth_provider}-location.conf;")
    for ip in allow_ips:
        lines.append(f"        allow {ip};")
    if allow_ips:
        lines.append("        deny all;")
    lines += [
        f"        set $upstream_app {upstream_host};",
        f"        set $upstream_port {upstream_port};",
        f"        set $upstream_proto {upstream_proto};",
        f"        proxy_pass $upstream_proto://$upstream_app:$upstream_port;",
    ]
    if websocket:
        lines += [
            "        proxy_set_header Upgrade $http_upgrade;",
            "        proxy_set_header Connection $connection_upgrade;",
        ]
    lines.append("    }")
    return "\n".join(lines)


def generate_subdomain_conf(host: ProxyHost) -> str:
    meta = json.dumps(host.model_dump())
    lines = [
        f"{METADATA_PREFIX}{meta}",
        "## Generated by SWAG Proxy UI",
        "",
        "server {",
        "    listen 443 ssl;",
        "    listen [::]:443 ssl;",
        "",
        f"    server_name {host.name}.*;",
        "",
        "    include /config/nginx/ssl.conf;",
        "",
        f"    client_max_body_size {host.client_max_body_size};",
    ]
    if host.auth_provider != "none" and host.auth_server:
        lines.append(f"    include /config/nginx/{host.auth_provider}-server.conf;")
    if host.allow_ips:
        lines.append("")
        for ip in host.allow_ips:
            lines.append(f"    allow {ip};")
        lines.append("    deny all;")
    lines.append("")
    lines.append(build_location_block(
        "/", host.upstream_host, host.upstream_port,
        host.upstream_proto, host.websocket, [],
        auth_provider=host.auth_provider, auth_location=host.auth_location,
    ))
    for loc in host.extra_locations:
        lines.append("")
        lines.append(build_location_block(
            loc.path, loc.upstream_host, loc.upstream_port,
            loc.upstream_proto, loc.websocket, loc.allow_ips,
            auth_provider=host.auth_provider, auth_location=loc.auth_location,
        ))
    lines += ["}", ""]
    return "\n".join(lines)


def generate_subfolder_conf(host: ProxyHost) -> str:
    meta = json.dumps(host.model_dump())
    loc_path = host.custom_location or f"/{host.name}"
    lines = [
        f"{METADATA_PREFIX}{meta}",
        "## Generated by SWAG Proxy UI",
        "",
        f"location = {loc_path} {{",
        f"    return 301 $scheme://$host{loc_path}/;",
        "}",
        "",
        build_location_block(
            f"{loc_path}/", host.upstream_host, host.upstream_port,
            host.upstream_proto, host.websocket, host.allow_ips,
            auth_provider=host.auth_provider, auth_location=host.auth_location,
        ),
    ]
    for loc in host.extra_locations:
        lines.append("")
        lines.append(build_location_block(
            loc.path, loc.upstream_host, loc.upstream_port,
            loc.upstream_proto, loc.websocket, loc.allow_ips,
            auth_provider=host.auth_provider, auth_location=loc.auth_location,
        ))
    lines.append("")
    return "\n".join(lines)


# ── File helpers ──────────────────────────────────────────────────────────────

def conf_filename(name: str, type_: str, enabled: bool) -> str:
    return f"{name}.{type_}.conf" + ("" if enabled else ".disabled")


def find_conf_file(name: str) -> Optional[tuple[Path, bool, str]]:
    for type_ in ["subdomain", "subfolder"]:
        for enabled in [True, False]:
            path = PROXY_CONF_DIR / conf_filename(name, type_, enabled)
            if path.exists():
                return path, enabled, type_
    return None


def parse_metadata(path: Path) -> Optional[dict]:
    try:
        first_line = path.open().readline().strip()
        if first_line.startswith(METADATA_PREFIX):
            return json.loads(first_line[len(METADATA_PREFIX):])
    except Exception:
        pass
    return None


# ── Proxy host endpoints ──────────────────────────────────────────────────────

@app.get("/api/proxy-hosts")
def list_proxy_hosts():
    if not PROXY_CONF_DIR.exists():
        return {"hosts": [], "warning": f"Config directory not found: {PROXY_CONF_DIR}"}

    hosts = []
    seen: set[str] = set()

    for path in sorted(PROXY_CONF_DIR.iterdir()):
        filename = path.name
        enabled = not filename.endswith(".disabled")
        name = filename[:-len(".disabled")] if not enabled else filename

        if name.endswith(".subdomain.conf"):
            host_name, host_type = name[:-len(".subdomain.conf")], "subdomain"
        elif name.endswith(".subfolder.conf"):
            host_name, host_type = name[:-len(".subfolder.conf")], "subfolder"
        else:
            continue

        if host_name in seen:
            continue
        seen.add(host_name)

        meta = parse_metadata(path)
        if meta:
            meta["enabled"] = enabled
            hosts.append({"managed": True, **meta})
        else:
            hosts.append({"managed": False, "name": host_name, "type": host_type, "enabled": enabled})

    return {"hosts": hosts}


@app.post("/api/proxy-hosts", status_code=201)
def create_proxy_host(host: ProxyHost):
    if find_conf_file(host.name):
        raise HTTPException(400, detail=f"Proxy host '{host.name}' already exists")
    path = PROXY_CONF_DIR / conf_filename(host.name, host.type, host.enabled)
    content = generate_subdomain_conf(host) if host.type == "subdomain" else generate_subfolder_conf(host)
    path.write_text(content)
    return host


@app.get("/api/proxy-hosts/{name}")
def get_proxy_host(name: str):
    result = find_conf_file(name)
    if not result:
        raise HTTPException(404, detail=f"Proxy host '{name}' not found")
    path, enabled, _ = result
    meta = parse_metadata(path)
    if not meta:
        raise HTTPException(422, detail="Conf file has no SWAG-UI metadata (unmanaged file)")
    meta["enabled"] = enabled
    return meta


@app.put("/api/proxy-hosts/{name}")
def update_proxy_host(name: str, host: ProxyHost):
    result = find_conf_file(name)
    if not result:
        raise HTTPException(404, detail=f"Proxy host '{name}' not found")
    result[0].unlink()
    path = PROXY_CONF_DIR / conf_filename(host.name, host.type, host.enabled)
    content = generate_subdomain_conf(host) if host.type == "subdomain" else generate_subfolder_conf(host)
    path.write_text(content)
    return host


@app.delete("/api/proxy-hosts/{name}", status_code=204)
def delete_proxy_host(name: str):
    result = find_conf_file(name)
    if not result:
        raise HTTPException(404, detail=f"Proxy host '{name}' not found")
    result[0].unlink()


@app.post("/api/proxy-hosts/{name}/toggle")
def toggle_proxy_host(name: str):
    result = find_conf_file(name)
    if not result:
        raise HTTPException(404, detail=f"Proxy host '{name}' not found")
    path, enabled, host_type = result
    new_path = PROXY_CONF_DIR / conf_filename(name, host_type, not enabled)
    path.rename(new_path)
    return {"name": name, "enabled": not enabled}


@app.get("/api/proxy-hosts/{name}/parse")
def parse_unmanaged_conf(name: str):
    """Extract structured settings from an unmanaged conf file for onboarding."""
    import re

    result = find_conf_file(name)
    if not result:
        raise HTTPException(404, detail=f"Proxy host '{name}' not found")
    path, enabled, type_ = result
    content = path.read_text()

    # ── helpers ──────────────────────────────────────────────────────────────

    def search(text: str, pattern: str, default=None):
        m = re.search(pattern, text)
        return m.group(1) if m else default

    def find_allow_ips(text: str) -> list[str]:
        """Return all allowed IPs/CIDRs, excluding 'allow all'."""
        return [
            ip.strip() for ip in re.findall(r'\ballow\s+([^;]+);', text)
            if ip.strip() != 'all'
        ]

    def extract_location_blocks(text: str) -> list[tuple[str, str]]:
        """
        Return (path_modifier_string, block_content) for every location { } block.
        Uses brace-counting so nested blocks are captured but also returned
        independently — callers must filter by content.
        """
        blocks = []
        for m in re.finditer(r'\blocation\s+([^{;]+?)\s*\{', text):
            loc_path = m.group(1).strip()
            start = m.end()
            depth, j = 1, start
            while j < len(text) and depth > 0:
                if text[j] == '{':
                    depth += 1
                elif text[j] == '}':
                    depth -= 1
                j += 1
            blocks.append((loc_path, text[start:j - 1]))
        return blocks

    def parse_upstream(block: str) -> tuple[str, int, str]:
        """Extract upstream host/port/proto from a location block."""
        host  = search(block, r'set \$upstream_app\s+(\S+);', '')
        port  = search(block, r'set \$upstream_port\s+(\d+);', '80')
        proto = search(block, r'set \$upstream_proto\s+(https?);', 'http')

        # Fallback: bare proxy_pass http://host:port
        if not host:
            m = re.search(r'proxy_pass\s+(https?)://([^:/\s;]+)(?::(\d+))?', block)
            if m:
                proto = m.group(1)
                host  = m.group(2)
                port  = m.group(3) or ('443' if proto == 'https' else '80')

        return host or '', int(port or 80), proto or 'http'

    def detect_auth_provider_from_text(text: str) -> str:
        """Infer auth provider from include or auth_request statements."""
        for provider in ('authelia', 'authentik', 'ldap', 'tinyauth'):
            if re.search(rf'/config/nginx/{provider}[_-]', text):
                return provider
        # Fallback: auth_request path hints
        m = re.search(r'auth_request\s+(/\S+);', text)
        if m:
            req = m.group(1).lower()
            if 'authelia'    in req:               return 'authelia'
            if 'goauthentik' in req or 'outpost' in req: return 'authentik'
            if 'tinyauth'    in req:               return 'tinyauth'
            if req in ('/auth', '/auth;'):          return 'ldap'
        return 'none'

    # ── split content into pre-locations section vs location blocks ───────────

    all_location_blocks = extract_location_blocks(content)

    # Content *before* the first location block = server-level directives
    m_first_loc = re.search(r'\blocation\s+[^{;]+\{', content)
    pre_location_content = content[:m_first_loc.start()] if m_first_loc else content

    # ── server-level auth ────────────────────────────────────────────────────

    auth_server_provider = detect_auth_provider_from_text(
        re.sub(r'\blocation\b.*', '', pre_location_content, flags=re.DOTALL)
        if re.search(r'\blocation\b', pre_location_content) else pre_location_content
    )
    # Only count it if there's an explicit *-server.conf include
    auth_server = bool(re.search(
        r'include\s+/config/nginx/(?:authelia|authentik|ldap|tinyauth)-server\.conf',
        pre_location_content,
    ))

    # ── server-level allow IPs ───────────────────────────────────────────────

    server_allow_ips = find_allow_ips(pre_location_content)

    # ── custom_location (subfolder redirect) ─────────────────────────────────

    custom_location: Optional[str] = None
    if type_ == 'subfolder':
        m_redir = re.search(
            r'location\s*=\s*(/[^\s{]+)\s*\{[^}]*return\s+30[12]',
            content, re.DOTALL
        )
        if m_redir:
            redir_path = m_redir.group(1)
            if redir_path != f'/{name}':
                custom_location = redir_path

    # ── classify location blocks ─────────────────────────────────────────────

    proxy_locations = []   # locations that have a real upstream
    for loc_path, block in all_location_blocks:
        # Skip internal auth-helper locations and named error handlers
        if loc_path.startswith('@'):
            continue
        if re.search(r'\binternal\s*;', block):
            continue
        if re.search(r'\breturn\s+30[12]\b', block):
            continue

        host, port, proto = parse_upstream(block)
        if not host:
            continue

        is_ws       = bool(re.search(r'proxy_set_header\s+Upgrade', block, re.IGNORECASE))
        loc_allows  = find_allow_ips(block)
        loc_auth    = bool(re.search(r'\bauth_request\b|include\s+/config/nginx/\S+-location\.conf', block))
        loc_provider = detect_auth_provider_from_text(block) if loc_auth else 'none'

        proxy_locations.append({
            'path':            loc_path,
            'upstream_host':   host,
            'upstream_port':   port,
            'upstream_proto':  proto,
            'websocket':       is_ws,
            'allow_ips':       loc_allows,
            'auth_location':   loc_auth,
            'auth_provider':   loc_provider,
        })

    # ── identify primary vs extra locations ──────────────────────────────────

    primary: Optional[dict] = None
    if type_ == 'subdomain':
        for candidate_path in ('/', '= /'):
            primary = next((l for l in proxy_locations if l['path'] == candidate_path), None)
            if primary:
                break
        if primary is None and proxy_locations:
            primary = proxy_locations[0]
        extra_locs = [l for l in proxy_locations if l is not primary]
    else:
        # Subfolder: primary is the location whose path matches the subfolder path
        subfolder_path = (custom_location or f'/{name}').rstrip('/') + '/'
        primary = next(
            (l for l in proxy_locations if l['path'].rstrip('/') + '/' == subfolder_path),
            proxy_locations[0] if proxy_locations else None
        )
        extra_locs = [l for l in proxy_locations if l is not primary]

    # ── determine upstream from primary location ──────────────────────────────

    upstream_host  = primary['upstream_host']  if primary else ''
    upstream_port  = primary['upstream_port']  if primary else 80
    upstream_proto = primary['upstream_proto'] if primary else 'http'
    websocket      = primary['websocket']      if primary else False

    # allow_ips: server-level for subdomain, primary location for subfolder
    allow_ips = (
        primary['allow_ips'] if (type_ == 'subfolder' and primary)
        else server_allow_ips
    )

    # ── determine auth settings ───────────────────────────────────────────────

    auth_provider = 'none'
    auth_location = False

    if auth_server and auth_server_provider != 'none':
        auth_provider = auth_server_provider

    if primary and primary['auth_location']:
        auth_location = True
        if primary['auth_provider'] != 'none':
            auth_provider = primary['auth_provider']

    # ── build output ─────────────────────────────────────────────────────────

    return {
        "name":               name,
        "type":               type_,
        "enabled":            enabled,
        "upstream_host":      upstream_host,
        "upstream_port":      upstream_port,
        "upstream_proto":     upstream_proto,
        "websocket":          websocket,
        "client_max_body_size": search(content, r'client_max_body_size\s+(\S+);', '0'),
        "allow_ips":          allow_ips,
        "extra_locations":    [
            {
                "path":           l['path'],
                "upstream_host":  l['upstream_host'],
                "upstream_port":  l['upstream_port'],
                "upstream_proto": l['upstream_proto'],
                "websocket":      l['websocket'],
                "allow_ips":      l['allow_ips'],
                "auth_location":  l['auth_location'],
            }
            for l in extra_locs
        ],
        "custom_location":    custom_location,
        "auth_provider":      auth_provider,
        "auth_server":        auth_server,
        "auth_location":      auth_location,
        "raw_conf":           content,
    }


@app.get("/api/proxy-hosts/{name}/conf")
def get_conf_content(name: str):
    result = find_conf_file(name)
    if not result:
        raise HTTPException(404, detail=f"Proxy host '{name}' not found")
    return {"content": result[0].read_text(), "filename": result[0].name}


# ── Nginx config file endpoints ───────────────────────────────────────────────

@app.get("/api/nginx-configs")
def list_nginx_configs():
    result = []
    for filename in sorted(EDITABLE_CONF_FILES):
        path = NGINX_CONF_DIR / filename
        result.append({"filename": filename, "exists": path.exists()})
    return result


@app.get("/api/nginx-configs/{filename}")
def get_nginx_config(filename: str):
    if filename not in EDITABLE_CONF_FILES:
        raise HTTPException(400, detail=f"Not an editable file: {filename}")
    path = NGINX_CONF_DIR / filename
    if not path.exists():
        raise HTTPException(404, detail=f"{filename} not found — is /config/nginx mounted?")
    return {"filename": filename, "content": path.read_text()}


@app.put("/api/nginx-configs/{filename}")
def update_nginx_config(filename: str, body: ConfigFileUpdate):
    if filename not in EDITABLE_CONF_FILES:
        raise HTTPException(400, detail=f"Not an editable file: {filename}")
    path = NGINX_CONF_DIR / filename
    if not path.exists():
        raise HTTPException(404, detail=f"{filename} not found")
    path.write_text(body.content)
    return {"filename": filename, "message": "saved"}


# ── Nginx reload endpoint ─────────────────────────────────────────────────────

@app.post("/api/nginx/reload")
def reload_nginx():
    if docker_sdk is None:
        raise HTTPException(503, detail="Docker SDK not installed in this image")

    try:
        client = docker_sdk.from_env()
    except Exception as e:
        raise HTTPException(503, detail=f"Docker socket unavailable. Mount /var/run/docker.sock:ro\n{e}")

    try:
        container = client.containers.get(SWAG_CONTAINER)
    except Exception:
        raise HTTPException(404, detail=f"Container '{SWAG_CONTAINER}' not found. Set SWAG_CONTAINER_NAME env var.")

    # Test config first
    test = container.exec_run("nginx -t")
    test_output = test.output.decode() if test.output else ""
    if test.exit_code != 0:
        raise HTTPException(422, detail=f"Config test failed — reload aborted:\n{test_output}")

    # Reload
    reload = container.exec_run("nginx -s reload")
    if reload.exit_code != 0:
        output = reload.output.decode() if reload.output else ""
        raise HTTPException(500, detail=f"Reload failed:\n{output}")

    return {"message": "nginx reloaded successfully", "test_output": test_output}


# ── Auth config endpoints ─────────────────────────────────────────────────────

def _auth_conf_path(provider: str, level: str) -> Path:
    return NGINX_CONF_DIR / f"{provider}-{level}.conf"


def _auth_status(provider: str, level: str) -> str:
    if _auth_conf_path(provider, level).exists():
        return "active"
    if (NGINX_CONF_DIR / f"{provider}-{level}.conf.sample").exists():
        return "sample"
    return "new"


def _auth_content(provider: str, level: str) -> str:
    conf = _auth_conf_path(provider, level)
    if conf.exists():
        return conf.read_text()
    sample = NGINX_CONF_DIR / f"{provider}-{level}.conf.sample"
    if sample.exists():
        return sample.read_text()
    return DEFAULT_AUTH_TEMPLATES.get(provider, {}).get(level, "")


@app.get("/api/auth-configs")
def list_auth_configs():
    """Return status (active/sample/new) for each provider × level."""
    result: dict[str, dict[str, str]] = {}
    for provider in AUTH_PROVIDERS:
        result[provider] = {
            "server":   _auth_status(provider, "server"),
            "location": _auth_status(provider, "location"),
        }
    return result


@app.get("/api/auth-configs/{provider}/{level}")
def get_auth_config(provider: str, level: str):
    if provider not in AUTH_PROVIDERS:
        raise HTTPException(400, detail=f"Unknown auth provider: {provider}")
    if level not in ("server", "location"):
        raise HTTPException(400, detail="Level must be 'server' or 'location'")
    if not NGINX_CONF_DIR.exists():
        raise HTTPException(503, detail="Nginx config dir not mounted — check /config/nginx volume")
    return {
        "provider": provider,
        "level": level,
        "status": _auth_status(provider, level),
        "content": _auth_content(provider, level),
    }


@app.put("/api/auth-configs/{provider}/{level}")
def update_auth_config(provider: str, level: str, body: ConfigFileUpdate):
    if provider not in AUTH_PROVIDERS:
        raise HTTPException(400, detail=f"Unknown auth provider: {provider}")
    if level not in ("server", "location"):
        raise HTTPException(400, detail="Level must be 'server' or 'location'")
    if not NGINX_CONF_DIR.exists():
        raise HTTPException(503, detail="Nginx config dir not mounted — check /config/nginx volume")
    _auth_conf_path(provider, level).write_text(body.content)
    return {"provider": provider, "level": level, "message": "saved"}


# ── Health ────────────────────────────────────────────────────────────────────

@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "conf_dir": str(PROXY_CONF_DIR),
        "conf_dir_exists": PROXY_CONF_DIR.exists(),
        "nginx_conf_dir": str(NGINX_CONF_DIR),
        "nginx_conf_dir_exists": NGINX_CONF_DIR.exists(),
        "docker_available": docker_sdk is not None,
        "swag_container": SWAG_CONTAINER,
    }


# Serve built frontend in production
static_dir = Path("static")
if static_dir.exists():
    app.mount("/", StaticFiles(directory=str(static_dir), html=True), name="static")
