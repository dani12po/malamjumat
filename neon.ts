import { defineConfig } from "@neon/config/v1";

export default defineConfig({
  preview: {
    buckets: {
      malamjumat: { access: "public_read" },
    },
  },
});
