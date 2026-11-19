import { useEffect, useState } from 'react';
import { Download, Github } from 'lucide-react';

interface Asset {
  name: string;
  browser_download_url: string;
  size: number;
}

interface Release {
  tag_name: string;
  name: string;
  html_url: string;
  published_at: string;
  assets: Asset[];
}

const RELEASES_REPO = 'Markox36/kibo-releases';

type OsKey = 'linux' | 'macos' | 'windows';

interface OsGroup {
  key: OsKey;
  label: string;
  icon: JSX.Element;
  matches: (name: string) => boolean;
  formatLabel: (name: string) => string;
  primary?: (name: string) => boolean;
}

const OS_GROUPS: OsGroup[] = [
  {
    key: 'macos',
    label: 'macOS',
    icon: <AppleLogo />,
    matches: (n) => /\.dmg$/i.test(n) || /\.app\.tar\.gz$/i.test(n),
    formatLabel: (n) => {
      if (/\.dmg$/i.test(n)) return 'DMG · Universal (Intel + Apple Silicon)';
      return 'App bundle · tar.gz';
    },
    primary: (n) => /\.dmg$/i.test(n),
  },
  {
    key: 'windows',
    label: 'Windows',
    icon: <WindowsLogo />,
    matches: (n) => /\.msi$/i.test(n) || /-setup\.exe$/i.test(n),
    formatLabel: (n) => {
      if (/\.msi$/i.test(n)) return 'MSI · Instalador x64';
      return 'Instalador EXE · x64';
    },
    primary: (n) => /-setup\.exe$/i.test(n),
  },
  {
    key: 'linux',
    label: 'Linux',
    icon: <LinuxLogo />,
    matches: (n) => /\.(deb|rpm|AppImage)$/i.test(n),
    formatLabel: (n) => {
      if (/\.deb$/i.test(n)) return 'DEB · Debian / Ubuntu';
      if (/\.rpm$/i.test(n)) return 'RPM · Fedora / RHEL';
      return 'AppImage · Portable';
    },
    primary: (n) => /\.AppImage$/i.test(n),
  },
];

function formatSize(bytes: number) {
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

export function DownloadsSection() {
  const [release, setRelease] = useState<Release | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`https://api.github.com/repos/${RELEASES_REPO}/releases/latest`, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((data: Release) => {
        if (!cancelled) setRelease(data);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section id="descargas" className="border-t border-kibo-border bg-kibo-surface/30">
      <div className="mx-auto max-w-6xl px-4 py-16">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-2xl md:text-3xl font-semibold tracking-tight">
            Descargas
          </h2>
          <p className="mt-3 text-kibo-muted">
            App de escritorio nativa para Linux, macOS y Windows.
            {release && (
              <>
                {' '}
                Última versión{' '}
                <span className="font-mono text-kibo-text">{release.tag_name}</span>.
              </>
            )}
          </p>
        </div>

        {error && (
          <div className="mt-8 text-center text-sm text-kibo-muted">
            No se pudieron cargar las versiones.{' '}
            <a
              className="text-kibo-accent hover:underline"
              href={`https://github.com/${RELEASES_REPO}/releases`}
              target="_blank"
              rel="noreferrer"
            >
              Ver en GitHub
            </a>
            .
          </div>
        )}

        {!error && !release && (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {OS_GROUPS.map((g) => (
              <div
                key={g.key}
                className="h-56 rounded-xl border border-kibo-border bg-kibo-surface animate-pulse"
              />
            ))}
          </div>
        )}

        {release && (
          <div className="mt-10 grid grid-cols-1 md:grid-cols-3 gap-4">
            {OS_GROUPS.map((group) => {
              const assets = release.assets
                .filter((a) => group.matches(a.name))
                .sort((a, b) => {
                  const ap = group.primary?.(a.name) ? 0 : 1;
                  const bp = group.primary?.(b.name) ? 0 : 1;
                  return ap - bp;
                });
              return (
                <div
                  key={group.key}
                  className="rounded-xl border border-kibo-border bg-kibo-surface p-5 shadow-soft flex flex-col"
                >
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 rounded-md bg-kibo-bg text-kibo-text inline-flex items-center justify-center border border-kibo-border">
                      {group.icon}
                    </div>
                    <div>
                      <div className="font-semibold tracking-tight">{group.label}</div>
                      <div className="text-[11px] font-mono text-kibo-muted">
                        {release.tag_name}
                      </div>
                    </div>
                  </div>

                  <ul className="space-y-2">
                    {assets.length === 0 && (
                      <li className="text-xs text-kibo-muted">
                        Sin archivos disponibles.
                      </li>
                    )}
                    {assets.map((asset, idx) => {
                      const primary = idx === 0;
                      return (
                        <li key={asset.name}>
                          <a
                            href={asset.browser_download_url}
                            className={
                              primary
                                ? 'w-full h-10 rounded-md bg-kibo-accentDeep hover:bg-kibo-accent text-white text-sm font-medium inline-flex items-center justify-between px-3 gap-2'
                                : 'w-full h-9 rounded-md border border-kibo-border hover:border-kibo-muted text-sm text-kibo-text inline-flex items-center justify-between px-3 gap-2'
                            }
                          >
                            <span className="flex items-center gap-2 min-w-0">
                              <Download size={14} className="shrink-0" />
                              <span className="truncate">
                                {group.formatLabel(asset.name)}
                              </span>
                            </span>
                            <span
                              className={
                                primary
                                  ? 'text-[11px] font-mono text-white/70'
                                  : 'text-[11px] font-mono text-kibo-muted'
                              }
                            >
                              {formatSize(asset.size)}
                            </span>
                          </a>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              );
            })}
          </div>
        )}

        <div className="mt-8 text-center">
          <a
            href={`https://github.com/${RELEASES_REPO}/releases`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 text-sm text-kibo-muted hover:text-kibo-text"
          >
            <Github size={14} />
            Ver todas las versiones
          </a>
        </div>
      </div>
    </section>
  );
}

function AppleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M16.365 1.43c0 1.14-.42 2.23-1.11 3.03-.77.88-2.02 1.55-3.05 1.47-.13-1.11.41-2.28 1.09-3.03.77-.86 2.09-1.5 3.07-1.47zM20.5 17.14c-.6 1.39-.89 2-1.66 3.23-1.07 1.71-2.58 3.84-4.45 3.86-1.66.02-2.09-1.09-4.34-1.08-2.26.01-2.73 1.1-4.39 1.08-1.87-.03-3.29-1.94-4.36-3.65C-.53 16.56-.87 10.9 1.99 7.96 4 5.86 6.98 5.24 9.31 6.03c1.05.36 2.02 1.02 3.02 1.02s2.16-.71 3.32-1.07c1.34-.42 3.02-.45 4.43.75-3.9 2.15-3.27 7.71.42 9.41z"/>
    </svg>
  );
}

function WindowsLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M2 3.5 11 2.3v9.2H2V3.5zM12 2.15l10-1.35v10.7H12V2.15zM2 12.5h9v9.2L2 20.5v-8zM12 12.5h10v10.7l-10-1.35V12.5z"/>
    </svg>
  );
}

function LinuxLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12.504 0c-.155 0-.315.008-.48.021-4.226.333-3.105 4.807-3.17 6.298-.076 1.092-.3 1.953-1.05 3.02-.885 1.051-2.127 2.75-2.716 4.521-.278.832-.41 1.684-.287 2.489a.424.424 0 0 0-.11.135c-.26.268-.45.6-.663.839-.199.199-.485.267-.797.4-.313.136-.658.269-.864.68-.09.189-.136.394-.132.602 0 .199.027.4.055.536.058.399.116.728.04.97-.249.68-.28 1.145-.106 1.484.174.334.535.47.94.601.81.2 1.91.135 2.774.6.926.466 1.866.67 2.616.47.526-.116.97-.464 1.208-.946.587-.003 1.23-.269 2.26-.334.699-.058 1.574.267 2.577.2.025.134.063.198.114.333l.003.003c.391.778 1.113 1.132 1.884 1.071.771-.06 1.592-.536 2.257-1.306.631-.765 1.683-1.084 2.378-1.503.348-.199.629-.469.649-.853.023-.4-.2-.811-.714-1.376v-.097l-.003-.003c-.17-.2-.25-.535-.338-.926-.085-.401-.182-.786-.492-1.046h-.003c-.059-.054-.124-.09-.192-.129-.055-.026-.11-.049-.174-.06a1.751 1.751 0 0 0-.096-.02c-.107-.056-.29-.11-.5-.11-.13-.001-.264.017-.386.058-.322.111-.618.396-.945.628-.24.169-.44.336-.634.402-.108.032-.132-.049-.117-.152h-.001c.008-.117.088-.407.096-.601.02-.404.011-.694-.116-.983-.128-.29-.377-.545-.73-.729-.352-.184-.664-.219-1.006-.283-.343-.064-.727-.201-1.153-.402-.44-.202-.688-.633-.887-1.147-.198-.514-.335-1.107-.578-1.719-.244-.612-.605-1.235-1.246-1.702-.639-.464-.966-1.32-1.157-2.256-.191-.937-.24-1.95-.24-2.833V2.72c0-1.267-.454-2.72-2.155-2.72zM10.996 2.75c.318 0 .599.126.795.328.196.203.323.485.323.815 0 .33-.127.607-.323.808-.196.202-.477.328-.795.328a1.128 1.128 0 0 1-.822-.328c-.196-.201-.322-.478-.322-.808 0-.33.126-.612.322-.815.219-.202.512-.328.822-.328zm2.677.42c.31 0 .604.089.842.24.238.15.408.38.408.679 0 .3-.17.53-.408.68-.238.15-.532.24-.842.24a1.55 1.55 0 0 1-.842-.24c-.238-.15-.408-.38-.408-.68 0-.299.17-.529.408-.68.238-.15.531-.24.842-.24z"/>
    </svg>
  );
}
