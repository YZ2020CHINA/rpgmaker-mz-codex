# Third-party notices

This integration is based on [Redseb/rpgmaker-mz-mcp](https://github.com/Redseb/rpgmaker-mz-mcp), pinned to commit `5119a9a3fe31776e402aa4a81f5f03b8b724551f` (version 1.4.0).

Copyright (c) 2026 Mikolaj Zyzanski. MIT License. Full license is retained in `vendor/upstream/LICENSE` in the source workspace and `UPSTREAM-LICENSE.txt` in the packaged runtime. The upstream TypeScript tool modules are bundled without edits. Two upstream test assertions use platform-aware path helpers locally (basename and resolve) so they also run on Windows; runtime behavior is unchanged. The wrapper adds serialized requests, a session-first automatic checkpoint, local installation/project/launch/backup tools and browser discovery. The custom tileset skill is redistributed with a path-resolution adjustment. The Chinese authoring guidance is adapted from the upstream authoring skill.

The MCP SDK, Zod and other bundled JavaScript dependencies retain their license notices in `DEPENDENCY-LICENSES.txt`. Playwright Core is shipped as its own runtime directory with its original LICENSE and NOTICE files. Development dependencies are not runtime requirements.

RPG Maker MZ is a proprietary product. This package does not redistribute its executable, engine scripts, graphics, audio, fonts or templates. Creating a game copies the template from the user's licensed local installation into the user-selected game directory. Use and distribution of that game's engine/assets remain subject to the RPG Maker license. This is an independent integration, not an official RPG Maker or OpenAI product.
