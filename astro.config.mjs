// @ts-check
import { defineConfig } from 'astro/config';
import rehypeExternalLinks from 'rehype-external-links';
import netlify from '@astrojs/netlify';
import path from 'node:path';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'static',
  adapter: netlify(),
  markdown: {
    rehypePlugins: [
      [rehypeExternalLinks, { target: '_blank', rel: ['noopener', 'noreferrer'] }]
    ]
  },
  vite: {
    plugins: [tailwindcss()],
    server: {
      fs: {
        // Allow dev server to load deps from the main repo root when using a symlinked node_modules.
        allow: [
          process.cwd(),
          path.resolve(process.cwd(), '../../node_modules'),
        ],
      },
    },
  }
});
