#!/usr/bin/env python3
"""Patch android/app/build.gradle to sign release builds with credentials/keystore.properties.

`expo prebuild --clean` regenerates the android/ directory and reverts the signing
config to the debug keystore. Run this script after every prebuild:

    python3 scripts/apply-release-signing.py
"""

from pathlib import Path

GRADLE = Path(__file__).resolve().parent.parent / "android" / "app" / "build.gradle"

DEBUG_BLOCK = """    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }"""

SIGNED_BLOCK = """    def keystoreProps = new Properties()
    def keystorePropsFile = rootProject.file('../credentials/keystore.properties')
    if (keystorePropsFile.exists()) {
        keystorePropsFile.withInputStream { keystoreProps.load(it) }
    }
    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        if (keystorePropsFile.exists()) {
            release {
                storeFile rootProject.file('../credentials/' + new File(keystoreProps['storeFile']).getName())
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            }
        }
    }"""

RELEASE_DEBUG_SIGNING = """            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug"""

RELEASE_SIGNED_SIGNING = (
    "            signingConfig keystorePropsFile.exists()"
    " ? signingConfigs.release : signingConfigs.debug"
)


def main() -> None:
    src = GRADLE.read_text()
    if "keystoreProps" in src:
        print("already patched")
        return
    if DEBUG_BLOCK not in src or RELEASE_DEBUG_SIGNING not in src:
        raise SystemExit("build.gradle layout changed; update this script")
    src = src.replace(DEBUG_BLOCK, SIGNED_BLOCK)
    src = src.replace(RELEASE_DEBUG_SIGNING, RELEASE_SIGNED_SIGNING)
    GRADLE.write_text(src)
    print(f"patched {GRADLE}")


if __name__ == "__main__":
    main()
